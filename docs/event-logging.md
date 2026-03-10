# Event Logging

Structured event logging for the frontend platform. Events are written as newline-delimited JSON (JSONL) to local disk, then flushed to GCS.

---

## Event Schemas

### page_view

Logged by `UsageLoggingMiddleware` on every non-static authenticated request.

```json
{
  "event_type": "page_view",
  "timestamp": "2026-03-04T14:22:01.003Z",
  "user_id": "user_2abc123def",
  "user_email": "analyst@example.com",
  "method": "GET",
  "path": "/dashboards/payment-audit",
  "status_code": 200,
  "ip_address": "10.0.1.42",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "session_id": "sess_a1b2c3d4",
  "dashboard_path": "/dashboards/payment-audit"
}
```

| Field | Type | Required | Source |
|---|---|---|---|
| `event_type` | string | yes | literal `"page_view"` |
| `timestamp` | string (ISO 8601) | yes | server clock, UTC |
| `user_id` | string | yes | JWT `sub` claim, default `"anonymous"` |
| `user_email` | string | no | JWT `email` claim |
| `method` | string | yes | HTTP method |
| `path` | string | yes | request URL path |
| `status_code` | integer | yes | HTTP response status |
| `ip_address` | string | no | `request.client.host` |
| `user_agent` | string | no | `User-Agent` header |
| `session_id` | string | no | client-provided or generated |
| `dashboard_path` | string | no | set when path matches `/dashboards/*` |

### user_session

Emitted once per session start (first request from a new session ID).

```json
{
  "event_type": "user_session",
  "timestamp": "2026-03-04T14:20:00.000Z",
  "session_id": "sess_a1b2c3d4",
  "user_id": "user_2abc123def",
  "user_email": "analyst@example.com",
  "ip_address": "10.0.1.42",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  "referrer": "https://internal.example.com/home",
  "screen_width": 1920,
  "screen_height": 1080
}
```

| Field | Type | Required | Source |
|---|---|---|---|
| `event_type` | string | yes | literal `"user_session"` |
| `timestamp` | string (ISO 8601) | yes | server clock, UTC |
| `session_id` | string | yes | generated on first request |
| `user_id` | string | yes | JWT `sub` claim |
| `user_email` | string | no | JWT `email` claim |
| `ip_address` | string | no | `request.client.host` |
| `user_agent` | string | no | `User-Agent` header |
| `referrer` | string | no | `Referer` header |
| `screen_width` | integer | no | client-reported |
| `screen_height` | integer | no | client-reported |

---

## File Layout

### GCS

```
gs://<BUCKET>/usage-events/YYYY-MM-DD/events.jsonl
```

One file per day, appended via flush. Example:

```
gs://ah-platform-logs/usage-events/2026-03-04/events.jsonl
gs://ah-platform-logs/usage-events/2026-03-03/events.jsonl
```

### Local (pre-flush)

```
/app/data/events/buffer.jsonl        # active write buffer
/app/data/events/buffer.jsonl.1      # rotated (pending upload)
```

---

## Flush Behavior

The event buffer flushes to GCS on whichever trigger fires first:

| Trigger | Threshold | Rationale |
|---|---|---|
| Time | 10 seconds | Keeps latency bounded for near-real-time queries |
| Count | 100 events | Prevents unbounded memory growth under load |
| Size | 512 KB | Caps memory usage from large payloads |
| Shutdown | on SIGTERM/SIGINT | Drains buffer before process exit |

Flush is atomic: write to temp file, upload, then truncate buffer. Failed uploads retain the buffer for retry on next cycle.

---

## Querying Events

### gsutil  + jq

```bash
# all page views for a specific user today
gsutil cat gs://ah-platform-logs/usage-events/2026-03-04/events.jsonl \
  | jq -c 'select(.event_type == "page_view" and .user_email == "analyst@example.com")'

# count events by type for a date range
for d in 2026-03-{01..04}; do
  gsutil cat "gs://ah-platform-logs/usage-events/$d/events.jsonl" 2>/dev/null
done | jq -sc 'group_by(.event_type) | map({type: .[0].event_type, count: length})'

# most visited dashboards today
gsutil cat gs://ah-platform-logs/usage-events/2026-03-04/events.jsonl \
  | jq -c 'select(.dashboard_path != null)' \
  | jq -sc 'group_by(.dashboard_path) | map({path: .[0].dashboard_path, views: length}) | sort_by(-.views)'

# unique users today
gsutil cat gs://ah-platform-logs/usage-events/2026-03-04/events.jsonl \
  | jq -sc '[.[].user_email] | unique | length'
```

### BigQuery External Table

Create an external table pointing at the GCS path:

```sql
CREATE OR REPLACE EXTERNAL TABLE `dev_analytics.usage_events`
OPTIONS (
  format = 'JSON',
  uris = ['gs://ah-platform-logs/usage-events/*/*.jsonl']
);
```

Query it directly:

```sql
-- daily active users, last 7 days
SELECT
  DATE(timestamp) AS day,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(*) AS total_events
FROM `dev_analytics.usage_events`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY day
ORDER BY day DESC;

-- top dashboards by unique viewers
SELECT
  dashboard_path,
  COUNT(DISTINCT user_id) AS unique_viewers,
  COUNT(*) AS total_views
FROM `dev_analytics.usage_events`
WHERE event_type = 'page_view'
  AND dashboard_path IS NOT NULL
GROUP BY dashboard_path
ORDER BY unique_viewers DESC;

-- sessions with auth failures
SELECT
  session_id,
  user_email,
  COUNTIF(status_code IN (401, 403)) AS auth_failures,
  COUNT(*) AS total_requests
FROM `dev_analytics.usage_events`
WHERE event_type = 'page_view'
GROUP BY session_id, user_email
HAVING auth_failures > 0
ORDER BY auth_failures DESC;
```

---

## Local Dev Setup

Events log to local disk only (no GCS upload) when `EVENT_LOG_GCS_BUCKET` is unset.

```bash
# ensure the buffer directory exists
mkdir -p /app/data/events

# set env vars (add to .env.local)
EVENT_LOG_DIR=/app/data/events
# EVENT_LOG_GCS_BUCKET=ah-platform-logs   # uncomment to enable GCS upload
# EVENT_LOG_GCS_PREFIX=usage-events       # uncomment to set GCS prefix

# tail events in real time
tail -f /app/data/events/buffer.jsonl | jq .

# filter to page views only
tail -f /app/data/events/buffer.jsonl | jq 'select(.event_type == "page_view")'
```

### Log Rotation

Rotate the local buffer when it exceeds 100 MB. Add to `/etc/logrotate.d/event-log`:

```
/app/data/events/buffer.jsonl {
    size 100M
    rotate 3
    compress
    missingok
    notifempty
    copytruncate
}
```

Test rotation:

```bash
logrotate -d /etc/logrotate.d/event-log   # dry run
logrotate -f /etc/logrotate.d/event-log   # force rotate
```

---

## GCS Retention Policy

Set a 90-day lifecycle rule on the logs bucket to auto-delete old event files.

Create `/tmp/lifecycle.json`:

```json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 90}
    }
  ]
}
```

Apply and verify:

```bash
gsutil lifecycle set /tmp/lifecycle.json gs://ah-platform-logs/
gsutil lifecycle get gs://ah-platform-logs/
```

For longer retention, load to a native BigQuery table before the 90-day window:

```sql
CREATE OR REPLACE TABLE `dev_analytics.usage_events_archive`
PARTITION BY DATE(timestamp)
OPTIONS (partition_expiration_days = 365)
AS
SELECT * FROM `dev_analytics.usage_events`
WHERE DATE(timestamp) < DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY);
```

Run the archive query monthly (or on a schedule) to capture events before lifecycle deletion.
