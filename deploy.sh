#!/usr/bin/env bash
# deploy.sh -- Build, push, and deploy tanit to Cloud Run
#
# Cutover plan (from data-ops-frontend -> tanit):
#   1. Deploy new "tanit" service via this script
#   2. Verify health: curl -f <cloud-run-url>/health
#   3. Update DNS to point at the new tanit service URL
#   4. Decommission old "data-ops-frontend" service:
#      gcloud run services delete data-ops-frontend --region=us-central1 --project=$CLOUD_RUN_PROJECT
#
# Prerequisites (one-time GCP setup):
#
#   1. Artifact Registry repo:
#      gcloud artifacts repositories create tanit \
#        --repository-format=docker --location=us-central1 \
#        --project=$CLOUD_RUN_PROJECT
#
#   2. Docker configured for Artifact Registry:
#      gcloud auth configure-docker us-central1-docker.pkg.dev
#
#   3. Secrets in Secret Manager:
#      - bq-credentials             (JSON file -- BQ service account key)
#      - anthropic-api-key          (env var -- Anthropic API key)
#      - clerk-publishable-key      (env var -- Clerk publishable key)
#      - event-log-gcs-credentials  (JSON file -- GCS service account key for event log writes)
#
#   4. GCS bucket for event logs:
#      gcloud storage buckets create gs://ah-tanit-event-logs \
#        --location=us-central1 \
#        --project=$CLOUD_RUN_PROJECT
#      # Grant the event log service account write access to the bucket.
#
#   5. Optional: Cloud Logging sink for GCS archival:
#      gcloud logging sinks create frontend-logs-to-gcs \
#        storage.googleapis.com/ah-frontend-logs \
#        --log-filter='resource.type="cloud_run_revision"
#          AND resource.labels.service_name="tanit"'
#
# Usage:
#   export CLOUD_RUN_PROJECT=gcr-tests-488119
#   export VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
#   export DUCKDB_GCS_URL=gs://dashboard-example/analyte_health/dashboard.duckdb
#   ./deploy.sh

set -euo pipefail

: "${CLOUD_RUN_PROJECT:?Set CLOUD_RUN_PROJECT (e.g. gcr-tests-488119)}"
: "${VITE_CLERK_PUBLISHABLE_KEY:?Set VITE_CLERK_PUBLISHABLE_KEY}"
: "${DUCKDB_GCS_URL:?Set DUCKDB_GCS_URL}"

REGION="us-central1"
SERVICE="tanit"
REPO="us-central1-docker.pkg.dev/${CLOUD_RUN_PROJECT}/tanit"
IMAGE="${REPO}/${SERVICE}:latest"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-}"

echo "==> Building Docker image..."
docker build \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
  -t "${IMAGE}" \
  .

echo "==> Pushing to Artifact Registry..."
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${CLOUD_RUN_PROJECT}" \
  --port 8001 \
  --memory 1Gi \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=4 \
  --startup-probe-path=/api/health \
  --timeout=60 \
  --set-env-vars "ENVIRONMENT=production,CONTENT_ROOT=/app/content,DUCKDB_GCS_URL=${DUCKDB_GCS_URL},DUCKDB_GCS_CREDENTIALS=/secrets/gcs-credentials.json,DUCKDB_LOCAL_PATH=/app/data/dashboard.duckdb,LOG_LEVEL=INFO,LOG_FORMAT=json,ALLOWED_ORIGINS=${ALLOWED_ORIGINS},EVENT_LOG_BACKEND=gcs,EVENT_LOG_GCS_BUCKET=ah-tanit-event-logs,EVENT_LOG_GCS_PREFIX=events" \
  --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest,CLERK_PUBLISHABLE_KEY=clerk-publishable-key:latest,/secrets/gcs-credentials.json=bq-credentials:latest,EVENT_LOG_GCS_CREDENTIALS=event-log-gcs-credentials:latest"

URL=$(gcloud run services describe "${SERVICE}" \
  --region "${REGION}" \
  --project "${CLOUD_RUN_PROJECT}" \
  --format 'value(status.url)')

echo ""
echo "==> Deployed successfully!"
echo "    URL: ${URL}"
