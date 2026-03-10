"""
EventLogger abstraction with GCS and local file backends.

Provides a Protocol-based interface for structured event logging as JSONL.
GCS backend buffers writes and flushes on time, count, or size thresholds.
Local backend appends immediately.

Backend selection: EVENT_LOG_BACKEND env var ("gcs" or "local", default "local")
"""

import atexit
import json
import logging
import os
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

log = logging.getLogger(__name__)


class EventLogger(Protocol):
    def log(self, event_type: str, payload: dict) -> None: ...


class GCSJsonLineLogger:
    def __init__(
        self,
        bucket: str,
        prefix: str = "events",
        flush_interval: float = 10.0,
        flush_count: int = 100,
        flush_bytes: int = 512 * 1024,
    ):
        from google.cloud import storage

        self._client = storage.Client()
        self._bucket = self._client.bucket(bucket)
        self._prefix = prefix
        self._flush_interval = flush_interval
        self._flush_count = flush_count
        self._flush_bytes = flush_bytes

        self._buffer: list[bytes] = []
        self._buffer_size = 0
        self._lock = threading.Lock()
        self._closed = False

        self._timer: threading.Timer | None = None
        self._schedule_flush()

        atexit.register(self._shutdown)
        self._prev_sigterm = signal.getsignal(signal.SIGTERM)
        signal.signal(signal.SIGTERM, self._handle_sigterm)

    def log(self, event_type: str, payload: dict) -> None:
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            **payload,
        }
        line = json.dumps(record, separators=(",", ":")).encode() + b"\n"

        flush_needed = False
        with self._lock:
            if self._closed:
                return
            self._buffer.append(line)
            self._buffer_size += len(line)
            if len(self._buffer) >= self._flush_count or self._buffer_size >= self._flush_bytes:
                flush_needed = True

        if flush_needed:
            self.flush()

    def flush(self) -> None:
        with self._lock:
            if not self._buffer:
                return
            batch = self._buffer
            self._buffer = []
            self._buffer_size = 0

        blob_path = self._blob_path()
        data = b"".join(batch)

        try:
            blob = self._bucket.blob(blob_path)
            if blob.exists():
                existing = blob.download_as_bytes()
                data = existing + data
            blob.upload_from_string(data, content_type="application/x-ndjson")
        except Exception:
            log.exception("GCS event flush failed, %d events lost", len(batch))

    def _blob_path(self) -> str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"{self._prefix}/{date_str}/events.jsonl"

    def _schedule_flush(self) -> None:
        if self._closed:
            return
        self._timer = threading.Timer(self._flush_interval, self._timed_flush)
        self._timer.daemon = True
        self._timer.start()

    def _timed_flush(self) -> None:
        try:
            self.flush()
        finally:
            self._schedule_flush()

    def _shutdown(self) -> None:
        with self._lock:
            self._closed = True
        if self._timer:
            self._timer.cancel()
        self.flush()

    def _handle_sigterm(self, signum, frame) -> None:
        self._shutdown()
        if callable(self._prev_sigterm) and self._prev_sigterm not in (
            signal.SIG_DFL,
            signal.SIG_IGN,
        ):
            self._prev_sigterm(signum, frame)
        sys.exit(0)


class LocalFileLogger:
    def __init__(self, directory: str | Path = "/app/data"):
        self._path = Path(directory) / "events.jsonl"
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def log(self, event_type: str, payload: dict) -> None:
        record = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            **payload,
        }
        line = json.dumps(record, separators=(",", ":")) + "\n"
        with open(self._path, "a") as f:
            f.write(line)
            f.flush()


def create_logger() -> EventLogger:
    backend = os.environ.get("EVENT_LOG_BACKEND", "local").lower()

    if backend == "gcs":
        bucket = os.environ.get("EVENT_LOG_GCS_BUCKET", "")
        if not bucket:
            raise ValueError("EVENT_LOG_GCS_BUCKET is required when EVENT_LOG_BACKEND=gcs")
        prefix = os.environ.get("EVENT_LOG_GCS_PREFIX", "events")
        return GCSJsonLineLogger(bucket=bucket, prefix=prefix)

    if backend == "local":
        directory = os.environ.get("EVENT_LOG_DIR", "/app/data")
        return LocalFileLogger(directory=directory)

    raise ValueError(f"Unknown EVENT_LOG_BACKEND: {backend!r} (expected 'gcs' or 'local')")
