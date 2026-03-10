"""Centralized configuration: env var loading, path resolution, startup validation, logging."""

import logging
import logging.handlers
import os
import sys
from contextvars import ContextVar
from pathlib import Path

import structlog

ENVIRONMENT = os.environ.get("ENVIRONMENT", "local")
CONTENT_ROOT = Path(os.environ.get("CONTENT_ROOT", "/app/content"))


def dashboards_dir() -> Path:
    return CONTENT_ROOT / "dashboards"


def permissions_path() -> Path:
    return Path(os.environ.get("PERMISSIONS_CONFIG", str(CONTENT_ROOT / "permissions.json")))


def duckdb_gcs_url() -> str:
    return os.environ.get("DUCKDB_GCS_URL", "")


def duckdb_gcs_credentials() -> str:
    return os.environ.get("DUCKDB_GCS_CREDENTIALS", "/app/secrets/gcs-credentials.json")


def duckdb_local_path() -> Path:
    return Path(os.environ.get("DUCKDB_LOCAL_PATH", "/app/data/dashboard.duckdb"))


def event_log_backend() -> str:
    return os.environ.get("EVENT_LOG_BACKEND", "local").lower()


def event_log_gcs_bucket() -> str:
    return os.environ.get("EVENT_LOG_GCS_BUCKET", "")


def event_log_gcs_prefix() -> str:
    return os.environ.get("EVENT_LOG_GCS_PREFIX", "events")


def event_log_gcs_credentials() -> str:
    return os.environ.get("EVENT_LOG_GCS_CREDENTIALS", "")


def event_log_local_dir() -> Path:
    return Path(os.environ.get("EVENT_LOG_DIR", "/app/data/events"))


def event_log_flush_interval() -> float:
    return float(os.environ.get("EVENT_LOG_FLUSH_INTERVAL", "10.0"))


def event_log_flush_size() -> int:
    return int(os.environ.get("EVENT_LOG_FLUSH_SIZE", str(512 * 1024)))


def validate():
    """Validate all required config on startup. Collects all errors before exiting."""
    errors = []

    if not CONTENT_ROOT.is_dir():
        errors.append(f"CONTENT_ROOT={CONTENT_ROOT} is not a directory")
    elif not dashboards_dir().is_dir():
        errors.append(f"CONTENT_ROOT/dashboards/ does not exist at {dashboards_dir()}")

    if not permissions_path().is_file():
        errors.append(f"PERMISSIONS_CONFIG={permissions_path()} not found")

    gcs_url = duckdb_gcs_url()
    if not gcs_url:
        errors.append("DUCKDB_GCS_URL is required but not set")
    elif not gcs_url.startswith("gs://"):
        errors.append(f"DUCKDB_GCS_URL must start with gs://, got: {gcs_url}")

    local_path = duckdb_local_path()
    if not local_path.parent.exists():
        errors.append(f"DUCKDB_LOCAL_PATH parent directory does not exist: {local_path.parent}")
    elif not os.access(local_path.parent, os.W_OK):
        errors.append(f"DUCKDB_LOCAL_PATH parent directory is not writable: {local_path.parent}")

    creds = duckdb_gcs_credentials()
    if not Path(creds).is_file():
        errors.append(f"DUCKDB_GCS_CREDENTIALS={creds} file not found")

    if not os.environ.get("CLERK_PUBLISHABLE_KEY"):
        errors.append("CLERK_PUBLISHABLE_KEY is required but not set")

    backend = event_log_backend()
    if backend == "gcs":
        if not event_log_gcs_bucket():
            errors.append("EVENT_LOG_GCS_BUCKET is required when EVENT_LOG_BACKEND=gcs")
    elif backend == "local":
        local_dir = event_log_local_dir()
        if not local_dir.parent.exists():
            errors.append(
                f"EVENT_LOG_DIR parent directory does not exist: {local_dir.parent}"
            )

    if errors:
        if ENVIRONMENT in ("local", "dev"):
            print("STARTUP WARNINGS (non-fatal in local/dev mode):", file=sys.stderr)
            for e in errors:
                print(f"  - {e}", file=sys.stderr)
        else:
            print("STARTUP FAILED -- configuration errors:", file=sys.stderr)
            for e in errors:
                print(f"  - {e}", file=sys.stderr)
            sys.exit(1)


request_id: ContextVar[str] = ContextVar("request_id", default="")


def setup_logging():
    """Configure structlog as a stdlib wrapper with stdout + optional file output."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_format = os.environ.get("LOG_FORMAT", "text")
    log_file_path = os.environ.get("LOG_FILE_PATH")

    if log_format == "json":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))
    root_logger.handlers.clear()

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    root_logger.addHandler(stream_handler)

    if log_file_path:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file_path, maxBytes=10 * 1024 * 1024, backupCount=3
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
