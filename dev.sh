#!/usr/bin/env bash
# dev.sh -- Local development with docker compose
#
# Usage:
#   ./dev.sh              # Build and start
#   ./dev.sh --restart    # Just restart (no rebuild)

set -euo pipefail
cd "$(dirname "$0")"

# Create local dirs if needed
mkdir -p logs secrets data

case "${1:-build}" in
  --restart)
    echo "==> Restarting..."
    docker compose down
    docker compose up -d
    ;;
  *)
    echo "==> Building and starting..."
    docker compose up -d --build
    ;;
esac

echo ""
echo "==> Running on http://localhost:8001"
