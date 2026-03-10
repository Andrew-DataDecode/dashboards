# Cloud Run Deployment Guide -- Tanit Frontend

Service name: `tanit`
Region: `us-central1`
Port: `8001`
Image: `us-central1-docker.pkg.dev/$CLOUD_RUN_PROJECT/tanit/tanit:latest`

---

## 1. Prerequisites

### GCP Project

```bash
export CLOUD_RUN_PROJECT=gcr-tests-488119
gcloud config set project $CLOUD_RUN_PROJECT
```

### Artifact Registry

```bash
gcloud artifacts repositories create tanit \
  --repository-format=docker \
  --location=us-central1 \
  --project=$CLOUD_RUN_PROJECT

gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Secret Manager

Three secrets required:

```bash
# BigQuery / GCS service account key (JSON file)
gcloud secrets create bq-credentials \
  --data-file=/path/to/service-account.json \
  --project=$CLOUD_RUN_PROJECT

# Anthropic API key (plain text)
echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key \
  --data-file=- \
  --project=$CLOUD_RUN_PROJECT

# Clerk publishable key (plain text)
echo -n "pk_test_..." | gcloud secrets create clerk-publishable-key \
  --data-file=- \
  --project=$CLOUD_RUN_PROJECT
```

Grant the Cloud Run service account access:

```bash
SA=$(gcloud iam service-accounts list \
  --filter="displayName:Compute Engine default" \
  --format="value(email)" \
  --project=$CLOUD_RUN_PROJECT)

for SECRET in bq-credentials anthropic-api-key clerk-publishable-key; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$CLOUD_RUN_PROJECT
done
```

### GCS Buckets

| Bucket | Purpose |
|--------|---------|
| Dashboard DuckDB bucket (e.g. `dashboard-example`) | Hosts `dashboard.duckdb` file downloaded at startup |
| Event log bucket (e.g. `ah-frontend-logs`) | Optional. GCS event log backend storage |

```bash
gcloud storage buckets create gs://dashboard-example --location=us-central1
gcloud storage buckets create gs://ah-frontend-logs --location=us-central1
```

Grant the service account read access to the DuckDB bucket and write access to the event log bucket:

```bash
gcloud storage buckets add-iam-policy-binding gs://dashboard-example \
  --member="serviceAccount:$SA" --role="roles/storage.objectViewer"

gcloud storage buckets add-iam-policy-binding gs://ah-frontend-logs \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"
```

---

## 2. Environment Variable Reference

Every env var read by the backend, sorted by source file.

### Core (config.py) -- startup validated

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIRONMENT` | No | `local` | Runtime mode. Set to `production` in Cloud Run. |
| `CONTENT_ROOT` | No | `/app/content` | Root directory for dashboard configs, permissions, data files. |
| `PERMISSIONS_CONFIG` | No | `$CONTENT_ROOT/permissions.json` | Path to permissions JSON file. Validated at startup. |
| `DUCKDB_GCS_URL` | **Yes** | _(none)_ | GCS URI to DuckDB file. Must start with `gs://`. Example: `gs://dashboard-example/analyte_health/dashboard.duckdb` |
| `DUCKDB_GCS_CREDENTIALS` | No | `/app/secrets/gcs-credentials.json` | Path to GCS service account JSON for DuckDB downloads. Mapped from Secret Manager in deploy.sh. |
| `DUCKDB_LOCAL_PATH` | No | `/app/data/dashboard.duckdb` | Local path where DuckDB file is cached. Parent directory must exist and be writable. |
| `CLERK_PUBLISHABLE_KEY` | **Yes** | _(none)_ | Clerk auth publishable key. Injected via Secret Manager. |

### Core (config.py) -- logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `INFO` | Python log level. Options: `DEBUG`, `INFO`, `WARNING`, `ERROR`. |
| `LOG_FORMAT` | No | `text` | Log output format. `json` for Cloud Logging structured logs, `text` for local dev. |
| `LOG_FILE_PATH` | No | _(none)_ | Optional file path for rotating log output (10MB, 3 backups). |

### App (app.py)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | _(none)_ | Anthropic API key for Claude chat. Injected via Secret Manager. |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000,http://localhost:3002,http://localhost:5173` | Comma-separated CORS origins. Set to your production domain in Cloud Run. |

### Event Logger (event_logger.py)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EVENT_LOG_BACKEND` | No | `local` | Event log backend. `gcs` for GCS JSONL, `local` for local file. |
| `EVENT_LOG_GCS_BUCKET` | If backend=gcs | _(none)_ | GCS bucket name for event logs. Required when `EVENT_LOG_BACKEND=gcs`. |
| `EVENT_LOG_GCS_PREFIX` | No | `events` | GCS object prefix. Events written to `{prefix}/{YYYY-MM-DD}/events.jsonl`. |
| `EVENT_LOG_DIR` | No | `/app/data` | Local directory for event JSONL file when backend=local. |

### Usage / Chat (usage_logger.py, chat_logger.py)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `USAGE_DB_PATH` | No | `/app/data/usage.db` | SQLite path for API usage tracking. |
| `CHAT_DB_PATH` | No | `/app/data/chat_logs.db` | SQLite path for chat session logs. |

### Rate Limiter (rate_limiter.py)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_PER_USER` | No | `60` | Max requests per user per minute. |
| `RATE_LIMIT_GLOBAL` | No | `500` | Max total requests per minute across all users. |

### Semantic Layer (semantic.py)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT` | No | `api-project-178709533099` | BigQuery project ID for semantic layer queries. |
| `APP_ENV` | No | `dev` | Environment selector for semantic layer dataset resolution. |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | _(none)_ | BQ credentials path for semantic layer. Typically the same mounted secret. |

### Dockerfile defaults (baked into image)

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTENT_ROOT` | `/app/content` | Overridable at deploy time. |
| `PERMISSIONS_CONFIG` | `/app/content/permissions.json` | Overridable at deploy time. |
| `CHAT_DB_PATH` | `/app/data/chat_logs.db` | Overridable at deploy time. |
| `USAGE_DB_PATH` | `/app/data/usage.db` | Overridable at deploy time. |

### Build args (Dockerfile)

| Arg | Required | Description |
|-----|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | **Yes** | Baked into the frontend JS bundle at build time. Must match the runtime `CLERK_PUBLISHABLE_KEY`. |

---

## 3. deploy.sh Walkthrough

The script runs from the `project/tanit/` directory. Source: `project/tanit/deploy.sh`.

### Step 1: Validate required env vars

```bash
: "${CLOUD_RUN_PROJECT:?Set CLOUD_RUN_PROJECT (e.g. gcr-tests-488119)}"
: "${VITE_CLERK_PUBLISHABLE_KEY:?Set VITE_CLERK_PUBLISHABLE_KEY}"
: "${DUCKDB_GCS_URL:?Set DUCKDB_GCS_URL}"
```

Exits immediately if any are unset.

### Step 2: Build Docker image

```bash
docker build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
  -t us-central1-docker.pkg.dev/$CLOUD_RUN_PROJECT/tanit/tanit:latest \
  .
```

Multi-stage build:
1. **Stage 1 (frontend-build)**: `node:20-alpine`. Runs `npm ci` + `npm run build`. The Clerk key is embedded into the Vite bundle via the build arg.
2. **Stage 2 (runtime)**: `python:3.12-slim`. Installs backend pip deps, copies backend code and built frontend static files. Creates `/app/content`, `/app/logs`, `/app/data`, `/app/secrets` mount points.

### Step 3: Push to Artifact Registry

```bash
docker push us-central1-docker.pkg.dev/$CLOUD_RUN_PROJECT/tanit/tanit:latest
```

Requires `gcloud auth configure-docker us-central1-docker.pkg.dev` to have been run once.

### Step 4: Deploy to Cloud Run

```bash
gcloud run deploy tanit \
  --image $IMAGE \
  --region us-central1 \
  --project $CLOUD_RUN_PROJECT \
  --port 8001 \
  --memory 1Gi \
  --allow-unauthenticated \
  --set-env-vars "ENVIRONMENT=production,CONTENT_ROOT=/app/content,..." \
  --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest,
                 CLERK_PUBLISHABLE_KEY=clerk-publishable-key:latest,
                 /secrets/gcs-credentials.json=bq-credentials:latest"
```

Key details:
- `--allow-unauthenticated`: Auth is handled by Clerk at the app layer, not IAM.
- `--set-secrets`: Mounts `bq-credentials` as a file at `/secrets/gcs-credentials.json`. Other secrets injected as env vars.
- `--memory 1Gi`: DuckDB loads tables into memory at startup.

### Step 5: Print service URL

```bash
gcloud run services describe tanit \
  --region us-central1 \
  --project $CLOUD_RUN_PROJECT \
  --format 'value(status.url)'
```

### Full invocation

```bash
cd project/tanit

export CLOUD_RUN_PROJECT=gcr-tests-488119
export VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
export DUCKDB_GCS_URL=gs://dashboard-example/analyte_health/dashboard.duckdb
export ALLOWED_ORIGINS=https://your-domain.com

./deploy.sh
```

---

## 4. Scaling Behavior

### Cloud Run defaults (unless overridden)

| Setting | Value | Notes |
|---------|-------|-------|
| Min instances | 0 | Scales to zero when idle. |
| Max instances | 100 | Cloud Run default. |
| Concurrency | 80 | Requests per container instance. |
| Memory | 1Gi | Set in deploy.sh. |
| CPU | 1 | Cloud Run default for 1Gi memory. |
| Request timeout | 300s | Cloud Run default. |

### Cold start

Cold starts happen when scaling from zero or adding new instances. Expected cold start time:

1. Container pull from Artifact Registry (~2-5s)
2. Python process start + uvicorn bind (~1s)
3. `validate()` config checks (~instant)
4. DuckDB engine init: downloads `.duckdb` from GCS and loads tables (~3-10s depending on file size)
5. Dashboard config validation (~instant)

Total cold start: **~5-15s** depending on DuckDB file size.

To eliminate cold starts:

```bash
gcloud run services update tanit \
  --min-instances=1 \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT
```

### Adjusting limits

```bash
# Increase memory for large DuckDB files
gcloud run services update tanit \
  --memory=2Gi \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT

# Set max instances
gcloud run services update tanit \
  --max-instances=10 \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT
```

---

## 5. Monitoring

### Cloud Logging

All logs go to stdout in JSON format (when `LOG_FORMAT=json`, set in deploy.sh).

View recent logs:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="tanit"' \
  --project=$CLOUD_RUN_PROJECT \
  --limit=50 \
  --format=json
```

Filter by log level:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="tanit"
   AND severity>=ERROR' \
  --project=$CLOUD_RUN_PROJECT \
  --limit=20
```

Filter by request path:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="tanit"
   AND jsonPayload.path="/api/health"' \
  --project=$CLOUD_RUN_PROJECT \
  --limit=10
```

### Event logs in GCS

When `EVENT_LOG_BACKEND=gcs`, events are written to:

```
gs://$EVENT_LOG_GCS_BUCKET/$EVENT_LOG_GCS_PREFIX/YYYY-MM-DD/events.jsonl
```

Query today's events:

```bash
gcloud storage cat gs://ah-frontend-logs/events/$(date +%Y-%m-%d)/events.jsonl | head -20
```

List event log files:

```bash
gcloud storage ls gs://ah-frontend-logs/events/ --recursive
```

### Health check

The `/api/health` endpoint returns dependency status:

```bash
curl -sf https://tanit-xxxxxx-uc.a.run.app/api/health | python3 -m json.tool
```

Response shape:

```json
{
  "status": "ok",
  "anthropic_api": "ok",
  "content_files": "ok",
  "databases": "ok",
  "duckdb": "ok"
}
```

`status` is `"ok"` when all checks pass, `"degraded"` otherwise.

### Recommended alerts

Set up via Cloud Monitoring alerting policies.

**1. Health check failure**

```bash
gcloud monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Tanit health check failure" \
  --condition-display-name="Health endpoint returns non-200" \
  --condition-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="tanit"
    AND httpRequest.requestUrl=~"/api/health"
    AND httpRequest.status>=500' \
  --condition-threshold-value=1 \
  --condition-threshold-duration=300s
```

Or use an uptime check:

```bash
gcloud monitoring uptime create \
  --display-name="Tanit Health" \
  --resource-type=cloud-run-revision \
  --service=tanit \
  --path=/api/health \
  --check-interval=60s \
  --project=$CLOUD_RUN_PROJECT
```

**2. Error rate spike**

Monitor 5xx responses:

```bash
gcloud logging metrics create tanit-5xx \
  --description="Tanit 5xx responses" \
  --log-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="tanit"
    AND httpRequest.status>=500' \
  --project=$CLOUD_RUN_PROJECT
```

**3. GCS event log write failures**

```bash
gcloud logging metrics create tanit-gcs-flush-failed \
  --description="GCS event flush failures" \
  --log-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="tanit"
    AND textPayload=~"GCS event flush failed"' \
  --project=$CLOUD_RUN_PROJECT
```

**4. DuckDB init failure**

```bash
gcloud logging metrics create tanit-duckdb-init-failed \
  --description="DuckDB engine init failures" \
  --log-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="tanit"
    AND textPayload=~"DuckDB engine init failed"' \
  --project=$CLOUD_RUN_PROJECT
```

---

## 6. Troubleshooting

### Startup failures

| Error message | Cause | Fix |
|---------------|-------|-----|
| `CONTENT_ROOT=/app/content is not a directory` | Content volume not mounted or empty | Verify content files exist in the image or mount a volume with dashboard configs |
| `CONTENT_ROOT/dashboards/ does not exist` | Missing dashboards subdirectory | Ensure `$CONTENT_ROOT/dashboards/` exists with at least one dashboard config |
| `PERMISSIONS_CONFIG=... not found` | Missing permissions.json | Create `$CONTENT_ROOT/permissions.json` |
| `DUCKDB_GCS_URL is required but not set` | Missing env var | Add `DUCKDB_GCS_URL` to `--set-env-vars` in deploy.sh |
| `DUCKDB_GCS_URL must start with gs://` | Malformed URL | Fix the URL to `gs://bucket/path/file.duckdb` |
| `DUCKDB_GCS_CREDENTIALS=... file not found` | Secret not mounted | Verify `--set-secrets` includes `/secrets/gcs-credentials.json=bq-credentials:latest` |
| `CLERK_PUBLISHABLE_KEY is required but not set` | Secret not injected | Check Secret Manager secret exists: `gcloud secrets describe clerk-publishable-key --project=$CLOUD_RUN_PROJECT` |
| `DUCKDB_LOCAL_PATH parent directory is not writable` | Permission issue | The Dockerfile creates `/app/data` -- ensure nothing overrides it |

### Runtime errors

| Error message | Cause | Fix |
|---------------|-------|-----|
| `Anthropic API authentication failed` | Bad or expired API key | Update secret: `echo -n "sk-ant-new..." \| gcloud secrets versions add anthropic-api-key --data-file=- --project=$CLOUD_RUN_PROJECT` then redeploy |
| `Chat service is busy` | Anthropic rate limit hit | Wait, or upgrade Anthropic plan |
| `GCS event flush failed, N events lost` | GCS write permissions or network | Check bucket IAM: `gcloud storage buckets get-iam-policy gs://$EVENT_LOG_GCS_BUCKET` |
| `DuckDB engine init failed` | GCS download error or corrupt file | Re-upload DuckDB file, check GCS credentials |
| 429 from `/api/chat` | Rate limiter triggered | Adjust `RATE_LIMIT_PER_USER` / `RATE_LIMIT_GLOBAL` env vars and redeploy |

### Debugging commands

```bash
# View container logs (last 5 minutes)
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="tanit"
   AND timestamp>="'"$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"'"' \
  --project=$CLOUD_RUN_PROJECT \
  --format=json

# Check current revision
gcloud run revisions list \
  --service=tanit \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT

# Check secrets are accessible
gcloud secrets versions access latest --secret=bq-credentials --project=$CLOUD_RUN_PROJECT > /dev/null && echo "OK" || echo "FAIL"
gcloud secrets versions access latest --secret=anthropic-api-key --project=$CLOUD_RUN_PROJECT > /dev/null && echo "OK" || echo "FAIL"
gcloud secrets versions access latest --secret=clerk-publishable-key --project=$CLOUD_RUN_PROJECT > /dev/null && echo "OK" || echo "FAIL"

# Force new deployment (same image, picks up new secret versions)
gcloud run services update tanit \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT \
  --update-secrets="ANTHROPIC_API_KEY=anthropic-api-key:latest"

# Rollback to previous revision
gcloud run services update-traffic tanit \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT

# Delete and redeploy from scratch
gcloud run services delete tanit --region=us-central1 --project=$CLOUD_RUN_PROJECT
./deploy.sh
```

### DNS cutover (from old service)

After verifying the new service works:

```bash
# Verify health
curl -sf https://tanit-xxxxxx-uc.a.run.app/api/health

# Update DNS to point at the new URL, then decommission old service
gcloud run services delete data-ops-frontend \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT
```
