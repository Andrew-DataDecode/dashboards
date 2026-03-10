"""Config validation tests for dashboard models and referential integrity."""

import json
import shutil
from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.dashboard_models import DashboardConfig
from backend.dashboard import (
    load_dashboard_config,
    validate_dashboard_config,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load_fixture(name: str) -> dict:
    return json.loads((FIXTURES_DIR / name).read_text())


def _load_invalid(name: str) -> dict:
    return json.loads((FIXTURES_DIR / "invalid_configs" / name).read_text())


class TestConfigParsing:
    def test_valid_config_parses(self):
        data = _load_fixture("valid_config.json")
        config = DashboardConfig(**data)
        assert config.title == "Test Dashboard"
        assert config.schema_version == 1
        assert "consultations" in config.data_sources

    def test_schema_version_required(self):
        data = _load_fixture("valid_config.json")
        del data["schema_version"]
        with pytest.raises(ValidationError):
            DashboardConfig(**data)

    def test_unknown_schema_version_rejected(self):
        data = _load_fixture("valid_config.json")
        data["schema_version"] = 99
        with pytest.raises(ValidationError, match="Unsupported schema_version"):
            DashboardConfig(**data)

    def test_duckdb_source_parses(self):
        data = _load_fixture("valid_config.json")
        config = DashboardConfig(**data)
        ds = config.data_sources["consultations"]
        assert ds.source == "duckdb"
        assert ds.sql_ref == "detail.sql"
        assert ds.table_name == "consultations"

    def test_semantic_source_parses(self):
        data = _load_fixture("valid_config.json")
        data["data_sources"]["payment_summary"] = {
            "source": "semantic",
            "model": "payment",
            "dimensions": ["payment_date"],
            "measures": ["gross_order_value"],
            "time_grain": "TIME_GRAIN_MONTH",
            "cache_ttl_seconds": 600,
        }
        config = DashboardConfig(**data)
        ds = config.data_sources["payment_summary"]
        assert ds.source == "semantic"
        assert ds.model == "payment"


class TestReferentialIntegrity:
    def test_panel_nonexistent_data_source(self, mock_dashboard_dir):
        data = _load_invalid("missing_data_source.json")
        shutil.copy(FIXTURES_DIR / "mock_sql" / "detail.sql", mock_dashboard_dir / "detail.sql")
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert any("nonexistent data_source" in e for e in errors)

    def test_filter_binding_nonexistent_filter(self, mock_dashboard_dir):
        data = _load_invalid("unknown_filter_ref.json")
        shutil.copy(FIXTURES_DIR / "mock_sql" / "detail.sql", mock_dashboard_dir / "detail.sql")
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert any("nonexistent filter" in e for e in errors)

    def test_computed_nonexistent_source(self, mock_dashboard_dir):
        data = _load_fixture("valid_config.json")
        data["computed"]["bad_comp"] = {
            "source": "nonexistent",
            "agg": "sum",
            "column": "x",
        }
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert any("not in data_sources" in e for e in errors)

    def test_options_from_nonexistent_source(self, mock_dashboard_dir):
        data = _load_fixture("valid_config.json")
        data["filters"]["bad_filter"] = {
            "type": "multiselect",
            "label": "Bad",
            "options_from": {"data_source": "nonexistent", "column": "x"},
        }
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert any("not in data_sources" in e for e in errors)

    def test_sql_ref_path_traversal_blocked(self, mock_dashboard_dir):
        data = _load_invalid("bad_sql_ref.json")
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert any("path traversal" in e for e in errors)

    def test_sql_ref_file_must_exist(self, mock_dashboard_dir):
        data = _load_fixture("valid_config.json")
        data["data_sources"]["consultations"]["sql_ref"] = "nonexistent.sql"
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert any("file not found" in e for e in errors)

    def test_filter_dependency_cycle_detected(self, mock_dashboard_dir):
        data = _load_invalid("circular_filter_deps.json")
        shutil.copy(FIXTURES_DIR / "mock_sql" / "detail.sql", mock_dashboard_dir / "detail.sql")
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert any("circular dependency" in e for e in errors)

    def test_valid_config_no_errors(self, mock_dashboard_dir):
        data = _load_fixture("valid_config.json")
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert errors == []

    def test_multiple_errors_returned(self, mock_dashboard_dir):
        data = _load_fixture("valid_config.json")
        data["computed"]["bad1"] = {"source": "nope1", "agg": "sum", "column": "x"}
        data["computed"]["bad2"] = {"source": "nope2", "agg": "sum", "column": "x"}
        config = DashboardConfig(**data)
        errors = validate_dashboard_config(config, mock_dashboard_dir)
        assert len(errors) >= 2
