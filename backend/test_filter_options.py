"""Tests for dynamic filter options (DISTINCT queries)."""

import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

from .dashboard_models import (
    DashboardConfig,
    DuckDBSource,
    FilterDef,
    FilterType,
    OptionsFrom,
    LayoutNode,
)


def _make_config(options_from=None):
    filters = {}
    if options_from:
        filters["brand_filter"] = FilterDef(
            type=FilterType.multiselect,
            label="Brand",
            options_from=OptionsFrom(data_source="main", column="brand_name"),
        )
    return DashboardConfig(
        schema_version=1,
        title="Test",
        description="Test dashboard",
        data_sources={
            "main": DuckDBSource(
                source="duckdb",
                sql_ref="main.sql",
                table_name="main_table",
                cache_ttl_seconds=300,
            ),
        },
        filters=filters,
        layout=[LayoutNode(type="table", title="Test", data_source="main")],
    )


@pytest.mark.asyncio
class TestGatherFilterOptions:
    @patch("backend.duckdb_engine.get_duckdb_engine")
    async def test_distinct_query_generated(self, mock_get_engine):
        config = _make_config(options_from=True)
        dashboard_dir = Path("/tmp/test-dashboard")

        with patch.object(Path, "exists", return_value=True), \
             patch.object(Path, "read_text", return_value="SELECT * FROM brands"):
            mock_engine = MagicMock()
            mock_engine.query.return_value = {
                "columns": ["brand_name"],
                "rows": [{"brand_name": "BrandA"}, {"brand_name": "BrandB"}],
                "row_count": 2,
            }
            mock_get_engine.return_value = mock_engine

            from .dashboard_query import gather_filter_options
            result = await gather_filter_options(config, dashboard_dir)

            assert "brand_filter" in result
            assert result["brand_filter"] == ["BrandA", "BrandB"]

            call_sql = mock_engine.query.call_args[0][0]
            assert "SELECT DISTINCT brand_name" in call_sql
            assert "WHERE brand_name IS NOT NULL" in call_sql
            assert "LIMIT 1000" in call_sql

    async def test_no_options_when_no_options_from(self):
        config = _make_config(options_from=False)
        dashboard_dir = Path("/tmp/test-dashboard")

        from .dashboard_query import gather_filter_options
        result = await gather_filter_options(config, dashboard_dir)
        assert result == {}
