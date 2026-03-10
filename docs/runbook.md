# Tanit Operator Runbook

Service: `tanit` (Cloud Run), port 8001
Stack: FastAPI backend + React (Vite) frontend, served as a single container
Auth: Clerk (JWT / JWKS verification)
Data: DuckDB (downloaded from GCS at startup)

---

## Environment Setup

### Local Python venv

```bash
# From repo root
python -m venv .venv
.venv/bin/pip install -r project/tanit/backend/requirements.txt
source .venv/bin/activate
```

### .env.local (docker-compose dev)

```bash
cd project/tanit
cp .env.local.template .env.local
# Edit .env.local -- minimum required fields:
#   DUCKDB_GCS_URL=gs://your-bucket/path/dashboard.duckdb
#   CLERK_PUBLISHABLE_KEY=pk_test_...
```

Full template reference:

```
ENVIRONMENT=local
CONTENT_ROOT=/app/content
PERMISSIONS_CONFIG=/app/content/permissions.json
DUCKDB_GCS_URL=gs://dashboard-example/analyte_health/dashboard.duckdb
DUCKDB_GCS_CREDENTIALS=/app/secrets/gcs-credentials.json
DUCKDB_LOCAL_PATH=/app/data/dashboard.duckdb
CLERK_PUBLISHABLE_KEY=pk_test_...
LOG_LEVEL=DEBUG
LOG_FORMAT=text
LOG_FILE_PATH=/app/logs/app.log
USAGE_DB_PATH=/app/data/usage.db
CHAT_DB_PATH=/app/data/chat_logs.db
RATE_LIMIT_PER_USER=60
RATE_LIMIT_GLOBAL=500
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002,http://localhost:5173
```

### Frontend .env (native dev only)

```bash
# project/tanit/frontend/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
# Must match CLERK_PUBLISHABLE_KEY in .env.local / backend environment
```

### Clerk credentials (from .credentials/)

```bash
# Load from project .credentials (already set up on dev box)
source ../../.credentials/frontend/clerk.env
echo $VITE_CLERK_PUBLISHABLE_KEY   # confirm it's set
```

---

## Build

### Docker image (local build)

```bash
cd project/tanit
docker build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
  -t tanit:local \
  .
```

### Docker image for Cloud Run

```bash
cd project/tanit
export CLOUD_RUN_PROJECT=gcr-tests-488119
export IMAGE="us-central1-docker.pkg.dev/${CLOUD_RUN_PROJECT}/tanit/tanit:latest"

docker build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
  -t "${IMAGE}" \
  .

docker push "${IMAGE}"
```

---

## Run Locally

### Option A: Native (hot-reload, fastest for development)

```bash
cd project/tanit
./dev-local.sh
# React app:  http://localhost:3002  (primary)
# API:        http://localhost:8001
```

### Option B: Docker Compose (closer to production)

```bash
cd project/tanit
./dev.sh              # build + start
./dev.sh --restart    # restart without rebuild (faster)
# App:        http://localhost:8001
```

### Option C: Backend only (no frontend)

```bash
cd project/tanit
source ../../.venv/bin/activate
PYTHONPATH="$(pwd)" uvicorn backend.app:app --reload --port 8001 --reload-dir backend
```

---

## Test

### Run all backend tests

```bash
cd project/tanit
source ../../.venv/bin/activate
PYTHONPATH="$(pwd)" python -m pytest backend/test_*.py -v
```

### Run a specific test file

```bash
cd project/tanit
source ../../.venv/bin/activate
PYTHONPATH="$(pwd)" python -m pytest backend/test_dashboard_api.py -v
```

### Run the phase 1 integration test suite

```bash
cd project/tanit
source ../../.venv/bin/activate
PYTHONPATH="$(pwd)" python test_phase1.py
```

### Validate dashboard configs (dry run, no server needed)

```bash
cd project/tanit
source ../../.venv/bin/activate
# All dashboards
CONTENT_ROOT=../dashboard-content PYTHONPATH="$(pwd)" python -m backend.validate_dashboards

# Single dashboard
CONTENT_ROOT=../dashboard-content PYTHONPATH="$(pwd)" python -m backend.validate_dashboards --dashboard payment-audit
```

---

## Deploy to Cloud Run

### Prerequisites (one-time GCP setup)

```bash
export CLOUD_RUN_PROJECT=gcr-tests-488119

# Artifact Registry repo
gcloud artifacts repositories create tanit \
  --repository-format=docker \
  --location=us-central1 \
  --project=$CLOUD_RUN_PROJECT

# Docker auth
gcloud auth configure-docker us-central1-docker.pkg.dev

# Secrets
gcloud secrets create bq-credentials \
  --data-file=path/to/bq-service-account.json \
  --project=$CLOUD_RUN_PROJECT

echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key \
  --data-file=- \
  --project=$CLOUD_RUN_PROJECT

echo -n "pk_test_..." | gcloud secrets create clerk-publishable-key \
  --data-file=- \
  --project=$CLOUD_RUN_PROJECT

# Grant Cloud Run service account access to secrets
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

### Deploy (standard)

```bash
cd project/tanit

export CLOUD_RUN_PROJECT=gcr-tests-488119
export VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
export DUCKDB_GCS_URL=gs://dashboard-example/analyte_health/dashboard.duckdb
export ALLOWED_ORIGINS=https://your-domain.com   # optional, omit for default

./deploy.sh
```

### Deploy with custom ALLOWED_ORIGINS

```bash
cd project/tanit
export CLOUD_RUN_PROJECT=gcr-tests-488119
export VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
export DUCKDB_GCS_URL=gs://dashboard-example/analyte_health/dashboard.duckdb
export ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
./deploy.sh
```

---

## Validate Config (Post-Deploy)

### Health check

```bash
# Replace URL with actual Cloud Run URL
curl -sf https://tanit-xxxxxx-uc.a.run.app/api/health | python3 -m json.tool
# Expected: {"status": "ok", "anthropic_api": "ok", "content_files": "ok", "databases": "ok", "duckdb": "ok"}
```

### Confirm deployment URL

```bash
gcloud run services describe tanit \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT \
  --format='value(status.url)'
```

### Check current revision

```bash
gcloud run revisions list \
  --service=tanit \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT
```

### Verify secrets are accessible

```bash
gcloud secrets versions access latest --secret=bq-credentials --project=$CLOUD_RUN_PROJECT > /dev/null && echo "OK" || echo "FAIL"
gcloud secrets versions access latest --secret=anthropic-api-key --project=$CLOUD_RUN_PROJECT > /dev/null && echo "OK" || echo "FAIL"
gcloud secrets versions access latest --secret=clerk-publishable-key --project=$CLOUD_RUN_PROJECT > /dev/null && echo "OK" || echo "FAIL"
```

---

## Common Workflows

### Add a dashboard

1. Create the dashboard directory under `project/dashboard-content/dashboards/<slug>/`:

```bash
mkdir -p project/dashboard-content/dashboards/my-dashboard
```

2. Create `config.json` (minimum required fields):

```json
{
  "schema_version": 1,
  "title": "My Dashboard",
  "description": "Description here",
  "data_sources": {
    "main": {
      "source": "duckdb",
      "sql_ref": "main.sql",
      "table_name": "some_duckdb_table",
      "filters": []
    }
  },
  "filters": {},
  "layout": [
    {
      "type": "section",
      "title": "My Dashboard",
      "children": []
    }
  ]
}
```

3. Create SQL files referenced by `sql_ref` in the same directory:

```bash
# project/dashboard-content/dashboards/my-dashboard/main.sql
touch project/dashboard-content/dashboards/my-dashboard/main.sql
```

4. Register the dashboard in `project/dashboard-content/permissions.json`:

```json
{
  "dashboards": {
    "my-dashboard": {
      "title": "My Dashboard",
      "description": "Description here",
      "path": "/dashboards/my-dashboard"
    }
  },
  "groups": {
    "analytics": ["my-dashboard"]
  }
}
```

5. Validate config:

```bash
cd project/tanit
source ../../.venv/bin/activate
CONTENT_ROOT=../dashboard-content PYTHONPATH="$(pwd)" python -m backend.validate_dashboards --dashboard my-dashboard
```

6. Redeploy:

```bash
cd project/tanit
./deploy.sh
```

### Update a secret (e.g. rotate Anthropic API key)

```bash
echo -n "sk-ant-new-key..." | gcloud secrets versions add anthropic-api-key \
  --data-file=- \
  --project=$CLOUD_RUN_PROJECT

# Force redeploy to pick up new version
gcloud run services update tanit \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT \
  --update-secrets="ANTHROPIC_API_KEY=anthropic-api-key:latest"
```

### Add a Clerk user

1. Go to https://dashboard.clerk.com > Users > Create User
2. Set email, name, password
3. Under Public Metadata, set permissions:

```json
{
  "groups": ["analytics"],
  "allowedRoutes": ["/dashboards/*"],
  "allowedDashboards": ["payment-audit"]
}
```

For full access:

```json
{
  "groups": ["analytics", "executive"],
  "allowedDashboards": ["*"]
}
```

### Modify Clerk user permissions

Clerk Dashboard > Users > select user > Public Metadata > edit JSON > Save

Changes propagate within ~60 seconds (next token refresh).

### Remove a Clerk user

Clerk Dashboard > Users > select user > Delete User

---

## Check Logs

### Cloud Run logs (last 50 entries)

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="tanit"' \
  --project=$CLOUD_RUN_PROJECT \
  --limit=50 \
  --format=json
```

### Cloud Run logs -- errors only

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="tanit"
   AND severity>=ERROR' \
  --project=$CLOUD_RUN_PROJECT \
  --limit=20
```

### Cloud Run logs -- last 5 minutes

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="tanit"
   AND timestamp>="'"$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"'"' \
  --project=$CLOUD_RUN_PROJECT \
  --format=json
```

### Docker compose logs (local)

```bash
cd project/tanit
docker compose logs -f
docker compose logs -f --tail=100
```

### Event logs from GCS (when EVENT_LOG_BACKEND=gcs)

```bash
# Today's events
gcloud storage cat gs://ah-frontend-logs/events/$(date +%Y-%m-%d)/events.jsonl | head -20

# All event log files
gcloud storage ls gs://ah-frontend-logs/events/ --recursive

# Filter to page views for a specific user
gcloud storage cat gs://ah-frontend-logs/events/$(date +%Y-%m-%d)/events.jsonl \
  | jq -c 'select(.event_type == "page_view" and .user_email == "user@example.com")'

# Most visited dashboards today
gcloud storage cat gs://ah-frontend-logs/events/$(date +%Y-%m-%d)/events.jsonl \
  | jq -c 'select(.dashboard_path != null)' \
  | jq -sc 'group_by(.dashboard_path) | map({path: .[0].dashboard_path, views: length}) | sort_by(-.views)'
```

### Event logs from local buffer (docker or dev-local)

```bash
# Real-time tail (inside container or mounted path)
tail -f project/tanit/logs/buffer.jsonl | jq .

# Page views only
tail -f project/tanit/logs/buffer.jsonl | jq 'select(.event_type == "page_view")'
```

---

## Scaling

### Prevent cold starts (warm instance)

```bash
gcloud run services update tanit \
  --min-instances=1 \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT
```

### Increase memory (for large DuckDB files)

```bash
gcloud run services update tanit \
  --memory=2Gi \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT
```

### Cap max instances

```bash
gcloud run services update tanit \
  --max-instances=10 \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT
```

---

## Rollback

### Roll back to previous revision

```bash
# List revisions to find the previous one
gcloud run revisions list \
  --service=tanit \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT

# Route 100% traffic to a specific revision
gcloud run services update-traffic tanit \
  --to-revisions=tanit-00042-abc=100 \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT
```

---

## Troubleshooting

### STARTUP FAILED -- CONTENT_ROOT=/app/content is not a directory

**Cause**: Dashboard content not mounted or missing from image.
**Fix**: Verify `project/dashboard-content/` is mounted or baked into the image. In docker-compose, `../dashboard-content` maps to `/app/content`.

```bash
# Check docker-compose volume
docker compose exec tanit ls /app/content/dashboards
```

### STARTUP FAILED -- PERMISSIONS_CONFIG=... not found

**Cause**: `project/dashboard-content/permissions.json` missing.
**Fix**:

```bash
ls project/dashboard-content/permissions.json
# Create if missing -- see "Add a dashboard" section for schema
```

### STARTUP FAILED -- DUCKDB_GCS_URL is required but not set

**Cause**: Missing env var.
**Fix**: Set in `.env.local` for docker-compose, or `--set-env-vars` in deploy.sh.

```bash
# Check if it's set in the running container
docker compose exec tanit env | grep DUCKDB
```

### STARTUP FAILED -- DUCKDB_GCS_CREDENTIALS=... file not found

**Cause**: GCS credentials file not mounted.
**Fix** (docker-compose): Check `DUCKDB_CREDENTIALS_PATH` points to a valid JSON file.

```bash
# Ensure DUCKDB_CREDENTIALS_PATH points to a valid GCS service account JSON:
export DUCKDB_CREDENTIALS_PATH=/path/to/gcs-credentials.json
./dev.sh
```

**Fix** (Cloud Run): Verify secret mount.

```bash
gcloud secrets versions access latest --secret=bq-credentials --project=$CLOUD_RUN_PROJECT | python3 -m json.tool | head -5
```

### STARTUP FAILED -- CLERK_PUBLISHABLE_KEY is required but not set

**Cause**: Clerk key not set.
**Fix** (local):

```bash
# Add to .env.local
echo "CLERK_PUBLISHABLE_KEY=pk_test_..." >> project/tanit/.env.local
```

**Fix** (Cloud Run):

```bash
gcloud secrets describe clerk-publishable-key --project=$CLOUD_RUN_PROJECT
# If missing, create it:
echo -n "pk_test_..." | gcloud secrets create clerk-publishable-key --data-file=- --project=$CLOUD_RUN_PROJECT
```

### Health check returns "duckdb": "not_initialized"

**Cause**: DuckDB file failed to download from GCS or file is corrupt.
**Fix**:

```bash
# Check logs for the DuckDB init error
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="tanit" AND textPayload=~"DuckDB"' \
  --project=$CLOUD_RUN_PROJECT --limit=10

# Verify GCS file exists
gcloud storage ls $DUCKDB_GCS_URL

# Verify credentials have read access
gcloud storage cp $DUCKDB_GCS_URL /tmp/test.duckdb && echo "Download OK"
```

### Health check returns "content_files": "missing"

**Cause**: `$CONTENT_ROOT/data/mockMetrics.json` missing.
**Fix**:

```bash
ls project/dashboard-content/data/
# mockMetrics.json must exist in the data/ directory
```

### 401 "Token expired" on API calls

**Cause**: JWT `exp` claim passed. Clock skew or stale token caching.
**Fix**:

```bash
# Check server clock
date -u
timedatectl status
# Ensure ntpd/chrony is synced -- max skew for JWT validation is typically 60s
```

### 401 "No matching signing key found"

**Cause**: JWT `kid` doesn't match JWKS -- wrong Clerk instance or key rotation.
**Fix**:

```bash
# Decode the publishable key to see which Clerk instance it points to
echo "pk_test_xxxxx" | cut -d_ -f3 | base64 -d 2>/dev/null

# Confirm both env vars point to the same instance
docker compose exec tanit env | grep CLERK
# CLERK_PUBLISHABLE_KEY and frontend's VITE_CLERK_PUBLISHABLE_KEY must match

# Restart backend to clear 60-minute JWKS cache
docker compose restart tanit
```

### CORS blocked (browser console: "blocked by CORS policy")

**Cause**: Frontend origin not in ALLOWED_ORIGINS.
**Fix**:

```bash
# Check current ALLOWED_ORIGINS
docker compose exec tanit env | grep ALLOWED_ORIGINS

# Add your origin to .env.local
# ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002,http://localhost:YOUR_PORT
docker compose restart tanit
```

### 403 "Dashboard access denied"

**Cause**: User's Clerk `publicMetadata.allowedDashboards` doesn't include the slug.
**Fix**:
Clerk Dashboard > Users > select user > Public Metadata > add slug to `allowedDashboards` or set `"*"`.

### 404 "Dashboard 'slug' not found"

**Cause**: Dashboard config missing from `$CONTENT_ROOT/dashboards/<slug>/config.json`.
**Fix**:

```bash
ls project/dashboard-content/dashboards/
# Add missing dashboard -- see "Add a dashboard" workflow
```

### 429 from /api/chat or /api/dashboard

**Cause**: Rate limiter triggered.
**Fix** (temporary -- adjust limits):

```bash
# In .env.local for docker-compose
RATE_LIMIT_PER_USER=120
RATE_LIMIT_GLOBAL=1000

# In Cloud Run
gcloud run services update tanit \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT \
  --set-env-vars="RATE_LIMIT_PER_USER=120,RATE_LIMIT_GLOBAL=1000"
```

### "Anthropic API authentication failed" in chat

**Cause**: Bad or expired Anthropic API key.
**Fix**:

```bash
# Rotate the secret
echo -n "sk-ant-new-key..." | gcloud secrets versions add anthropic-api-key \
  --data-file=- \
  --project=$CLOUD_RUN_PROJECT

# Force Cloud Run to pick up new version
gcloud run services update tanit \
  --region=us-central1 \
  --project=$CLOUD_RUN_PROJECT \
  --update-secrets="ANTHROPIC_API_KEY=anthropic-api-key:latest"
```

### Dashboard config validation fails

**Cause**: JSON syntax error, missing SQL file, unknown field in config.
**Fix**:

```bash
cd project/tanit
source ../../.venv/bin/activate
CONTENT_ROOT=../dashboard-content PYTHONPATH="$(pwd)" python -m backend.validate_dashboards --dashboard <slug>
# Read the error output -- it will point to the specific field or missing file
```

### "GCS event flush failed, N events lost"

**Cause**: GCS write permissions or network issue.
**Fix**:

```bash
# Check bucket IAM
gcloud storage buckets get-iam-policy gs://$EVENT_LOG_GCS_BUCKET

# Grant write access to service account
gcloud storage buckets add-iam-policy-binding gs://$EVENT_LOG_GCS_BUCKET \
  --member="serviceAccount:$SA" \
  --role="roles/storage.objectAdmin"
```

### Container exits immediately on startup

**Fix**:

```bash
# View startup logs
docker compose logs tanit | head -50

# Or for Cloud Run -- view last deployment logs
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="tanit"' \
  --project=$CLOUD_RUN_PROJECT \
  --limit=30 \
  --format=json | python3 -m json.tool
```

---

## Env Var Reference (Complete)

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENVIRONMENT` | No | `local` | Runtime mode. `production` in Cloud Run. |
| `CONTENT_ROOT` | No | `/app/content` | Dashboard configs, permissions, data root. |
| `PERMISSIONS_CONFIG` | No | `$CONTENT_ROOT/permissions.json` | Path to permissions file. |
| `DUCKDB_GCS_URL` | Yes | _(none)_ | GCS URI (`gs://`) for DuckDB file. |
| `DUCKDB_GCS_CREDENTIALS` | No | `/app/secrets/gcs-credentials.json` | GCS service account JSON path. |
| `DUCKDB_LOCAL_PATH` | No | `/app/data/dashboard.duckdb` | Local cache path for DuckDB file. |
| `CLERK_PUBLISHABLE_KEY` | Yes | _(none)_ | Clerk publishable key (backend JWT validation). |
| `ANTHROPIC_API_KEY` | Yes | _(none)_ | Anthropic API key for chat. |
| `ALLOWED_ORIGINS` | No | localhost ports | Comma-separated CORS origins. |
| `LOG_LEVEL` | No | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`. |
| `LOG_FORMAT` | No | `text` | `json` (Cloud Logging) or `text` (local). |
| `LOG_FILE_PATH` | No | _(none)_ | Optional rotating log file path. |
| `USAGE_DB_PATH` | No | `/app/data/usage.db` | SQLite path for usage tracking. |
| `CHAT_DB_PATH` | No | `/app/data/chat_logs.db` | SQLite path for chat logs. |
| `RATE_LIMIT_PER_USER` | No | `60` | Max requests/min per user. |
| `RATE_LIMIT_GLOBAL` | No | `500` | Max requests/min total. |
| `EVENT_LOG_BACKEND` | No | `local` | `gcs` or `local`. |
| `EVENT_LOG_GCS_BUCKET` | If backend=gcs | _(none)_ | GCS bucket for event logs. |
| `EVENT_LOG_GCS_PREFIX` | No | `events` | GCS object prefix for event logs. |
| `EVENT_LOG_DIR` | No | `/app/data` | Local directory for event JSONL. |
| `GCP_PROJECT` | No | _(see semantic.py)_ | BigQuery project for semantic layer. |
| `APP_ENV` | No | `dev` | Semantic layer dataset selector. |
