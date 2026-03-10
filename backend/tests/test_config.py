"""Tests for config.py startup validation."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest


def test_validate_passes_with_valid_config(tmp_path):
    """validate() should not exit when all config is valid."""
    content_dir = tmp_path / "content"
    dashboards_dir = content_dir / "dashboards"
    dashboards_dir.mkdir(parents=True)
    perms = content_dir / "permissions.json"
    perms.write_text("{}")
    creds = tmp_path / "creds.json"
    creds.write_text("{}")

    env = {
        "CONTENT_ROOT": str(content_dir),
        "PERMISSIONS_CONFIG": str(perms),
        "DUCKDB_GCS_URL": "gs://test-bucket/analyte_health/dashboard.duckdb",
        "DUCKDB_GCS_CREDENTIALS": str(creds),
        "DUCKDB_LOCAL_PATH": str(tmp_path / "dashboard.duckdb"),
        "CLERK_PUBLISHABLE_KEY": "pk_test",
    }
    with patch.dict(os.environ, env, clear=False):
        import importlib
        import backend.config as cfg
        importlib.reload(cfg)
        cfg.validate()


def test_validate_exits_on_missing_content_root(tmp_path):
    """validate() should sys.exit(1) when CONTENT_ROOT doesn't exist."""
    env = {
        "CONTENT_ROOT": str(tmp_path / "nonexistent"),
        "DUCKDB_GCS_URL": "gs://test-bucket/dashboard.duckdb",
        "DUCKDB_GCS_CREDENTIALS": str(tmp_path / "creds.json"),
        "CLERK_PUBLISHABLE_KEY": "pk_test",
    }
    with patch.dict(os.environ, env, clear=False):
        import importlib
        import backend.config as cfg
        importlib.reload(cfg)
        with pytest.raises(SystemExit):
            cfg.validate()


def test_validate_exits_on_missing_required_vars(tmp_path):
    """validate() should sys.exit(1) when required env vars are unset."""
    content_dir = tmp_path / "content"
    dashboards_dir = content_dir / "dashboards"
    dashboards_dir.mkdir(parents=True)
    perms = content_dir / "permissions.json"
    perms.write_text("{}")

    env = {
        "CONTENT_ROOT": str(content_dir),
        "PERMISSIONS_CONFIG": str(perms),
        "DUCKDB_GCS_URL": "",
        "DUCKDB_GCS_CREDENTIALS": str(tmp_path / "missing.json"),
        "CLERK_PUBLISHABLE_KEY": "",
    }
    with patch.dict(os.environ, env, clear=False):
        import importlib
        import backend.config as cfg
        importlib.reload(cfg)
        with pytest.raises(SystemExit):
            cfg.validate()
