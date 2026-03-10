"""DuckDB OLAP engine -- downloads pre-built .duckdb file from GCS for sub-ms dashboard queries."""

import logging
from pathlib import Path
from typing import Any, Optional

import duckdb
from google.cloud import storage

from . import config

logger = logging.getLogger(__name__)


class DuckDBEngine:
    def __init__(self, gcs_url: str, credentials_path: str, local_path: Path):
        self.gcs_url = gcs_url
        self.credentials_path = credentials_path
        self.db_path = local_path
        self._tables: dict[str, str] = {}

        self._download_db()
        self.conn = duckdb.connect(str(self.db_path), read_only=True)
        self._discover_tables()

    def _download_db(self) -> None:
        url = self.gcs_url
        if not url.startswith("gs://"):
            raise ValueError(f"DUCKDB_GCS_URL must start with gs://, got: {url}")

        path = url[len("gs://"):]
        bucket_name, _, blob_path = path.partition("/")

        client = storage.Client.from_service_account_json(self.credentials_path)
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(str(self.db_path))
        logger.info(f"Downloaded {url} to {self.db_path}")

    def _discover_tables(self) -> None:
        self._tables.clear()
        rows = self.conn.execute("SHOW TABLES").fetchall()
        for row in rows:
            name = row[0]
            self._tables[name] = name
        logger.info(f"Discovered {len(self._tables)} tables: {list(self._tables.keys())}")

    def query(self, sql: str, params: Optional[dict[str, Any]] = None) -> dict:
        if params:
            named = {k: v for k, v in params.items()}
            result = self.conn.execute(sql, named)
        else:
            result = self.conn.execute(sql)

        columns = [desc[0] for desc in result.description] if result.description else []
        rows_raw = result.fetchall()
        rows = [dict(zip(columns, row)) for row in rows_raw]

        for row in rows:
            for key, val in row.items():
                if hasattr(val, "isoformat"):
                    row[key] = val.isoformat()

        return {"columns": columns, "rows": rows, "row_count": len(rows)}

    def table_loaded(self, name: str) -> bool:
        return name in self._tables

    def reload(self) -> dict:
        self.conn.close()
        self._download_db()
        self.conn = duckdb.connect(str(self.db_path), read_only=True)
        self._discover_tables()
        return {"tables_loaded": list(self._tables.keys())}


_engine: Optional[DuckDBEngine] = None


def init_duckdb_engine() -> DuckDBEngine:
    global _engine
    _engine = DuckDBEngine(
        config.duckdb_gcs_url(),
        config.duckdb_gcs_credentials(),
        config.duckdb_local_path(),
    )
    return _engine


def get_duckdb_engine() -> DuckDBEngine:
    if _engine is None:
        raise RuntimeError("DuckDB engine not initialized -- call init_duckdb_engine() first")
    return _engine
