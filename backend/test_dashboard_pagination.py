"""Tests for server-side pagination endpoint."""

import pytest

from .dashboard_query import build_filtered_query
from .dashboard_models import PageRequest, PageResponseItem


class TestPageRequest:
    def test_page_size_capped_at_500(self):
        req = PageRequest(data_source="test", page_size=1000)
        assert req.page_size == 500

    def test_default_values(self):
        req = PageRequest(data_source="test")
        assert req.page == 1
        assert req.page_size == 50
        assert req.sort_direction == "desc"


class TestBuildFilteredQuery:
    def test_adds_limit_offset_for_pagination(self):
        sql, params = build_filtered_query(
            base_sql="SELECT * FROM orders",
            filter_bindings=[],
            filter_values={},
            filter_defs={},
            page=3,
            page_size=50,
        )
        assert "LIMIT $p_page_size" in sql
        assert "OFFSET $p_offset" in sql
        assert params["p_page_size"] == 50
        assert params["p_offset"] == 100  # (3-1) * 50

    def test_page_size_capped_at_max(self):
        sql, params = build_filtered_query(
            base_sql="SELECT 1",
            filter_bindings=[],
            filter_values={},
            filter_defs={},
            page=1,
            page_size=1000,
        )
        assert params["p_page_size"] == 500

    def test_sort_column_validated(self):
        with pytest.raises(ValueError, match="Invalid sort column"):
            from .dashboard_models import SortConfig
            build_filtered_query(
                base_sql="SELECT 1",
                filter_bindings=[],
                filter_values={},
                filter_defs={},
                sort=SortConfig(column="malicious_col", direction="asc"),
                allowed_sort_columns={"name", "amount"},
            )

    def test_valid_sort_column_accepted(self):
        from .dashboard_models import SortConfig
        sql, params = build_filtered_query(
            base_sql="SELECT name, amount FROM orders",
            filter_bindings=[],
            filter_values={},
            filter_defs={},
            sort=SortConfig(column="name", direction="asc"),
            allowed_sort_columns={"name", "amount"},
        )
        assert "ORDER BY name asc" in sql

    def test_count_query_has_no_order_or_limit(self):
        sql, params = build_filtered_query(
            base_sql="SELECT * FROM orders",
            filter_bindings=[],
            filter_values={},
            filter_defs={},
        )
        assert "LIMIT" not in sql
        assert "OFFSET" not in sql
        assert "ORDER BY" not in sql


class TestPageResponseItem:
    def test_default_status_ok(self):
        resp = PageResponseItem()
        assert resp.status == "ok"

    def test_error_response(self):
        resp = PageResponseItem(status="error", error="Something failed")
        assert resp.error == "Something failed"
