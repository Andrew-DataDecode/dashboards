import json
import os
import shutil
from pathlib import Path
from unittest.mock import MagicMock

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"

# Set env vars before any config.py import
os.environ.setdefault("CONTENT_ROOT", str(FIXTURES_DIR / "content"))
os.environ.setdefault("DUCKDB_GCS_URL", "gs://test-bucket/analyte_health/dashboard.duckdb")
os.environ.setdefault("DUCKDB_GCS_CREDENTIALS", str(FIXTURES_DIR / "fake-creds.json"))
os.environ.setdefault("DUCKDB_LOCAL_PATH", "/tmp/test-dashboard.duckdb")
os.environ.setdefault("CLERK_PUBLISHABLE_KEY", "pk_test_fake")
os.environ.setdefault("LOG_FORMAT", "text")
os.environ.setdefault("LOG_LEVEL", "WARNING")


@pytest.fixture
def fixtures_dir():
    return FIXTURES_DIR


@pytest.fixture
def mock_dashboard_dir(tmp_path):
    """Temp directory with valid config and SQL files for testing."""
    config_path = FIXTURES_DIR / "valid_config.json"
    sql_path = FIXTURES_DIR / "mock_sql" / "detail.sql"

    shutil.copy(config_path, tmp_path / "config.json")
    shutil.copy(sql_path, tmp_path / "detail.sql")

    return tmp_path


@pytest.fixture
def mock_dashboard_config():
    """A valid DashboardConfig instance."""
    from backend.dashboard_models import DashboardConfig

    config_data = json.loads((FIXTURES_DIR / "valid_config.json").read_text())
    return DashboardConfig(**config_data)


@pytest.fixture
def mock_duckdb_engine():
    """Mock DuckDB engine that returns canned results."""
    engine = MagicMock()
    engine.query.return_value = {
        "columns": ["consultation_id", "consultation_status_finalized_at", "consultation_type"],
        "rows": [
            {"consultation_id": "C001", "consultation_status_finalized_at": "2025-08-15", "consultation_type": "async"},
            {"consultation_id": "C002", "consultation_status_finalized_at": "2025-08-16", "consultation_type": "scheduled"},
        ],
        "row_count": 2,
    }
    engine.table_loaded.return_value = True
    return engine


@pytest.fixture
def dashboard_dir(tmp_path):
    """Temp dir with test SQL files for filter binding tests."""
    sql_content = (FIXTURES_DIR / "mock_sql" / "detail.sql").read_text()
    (tmp_path / "detail.sql").write_text(sql_content)
    return tmp_path
