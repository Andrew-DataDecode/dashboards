"""Integration test for consultations dashboard end-to-end.

Requires DuckDB engine with GCS credentials and parquet data.
Skipped by default.
Run with: pytest -m integration
"""

import pytest

from backend import config as app_config
from backend.dashboard import execute_dashboard, load_dashboard_config


@pytest.mark.integration
@pytest.mark.asyncio
async def test_consultations_dashboard_end_to_end():
    """Full round-trip: load config, execute queries, verify response shape."""
    config = load_dashboard_config("consultations")
    assert config.title == "Consultations"

    dashboard_dir = app_config.dashboards_dir() / "consultations"

    # Use a narrow date range to keep query fast and cheap
    filter_values = {
        "date_range": {"start": "2025-12-01", "end": "2025-12-31"},
    }

    result = await execute_dashboard(
        config=config,
        filter_values=filter_values,
        dashboard_dir=dashboard_dir,
    )

    # Verify response shape
    assert result.queried_at is not None
    assert "consultations" in result.data_sources
    assert "by_website" in result.data_sources

    # Check consultations data source
    consult_result = result.data_sources["consultations"]
    assert consult_result["status"] == "ok"
    assert "columns" in consult_result
    assert "rows" in consult_result
    assert isinstance(consult_result["rows"], list)

    # Check by_website data source
    website_result = result.data_sources["by_website"]
    assert website_result["status"] == "ok"

    # Check computed values were calculated
    assert "total_payment" in result.computed
    assert "total_consultations" in result.computed
