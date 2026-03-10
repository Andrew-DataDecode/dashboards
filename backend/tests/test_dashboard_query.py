"""Filter binding engine tests -- SQL generation and parameterization."""

import pytest

from backend.dashboard_models import FilterDef, FilterType, SortConfig, TextMatch
from backend.dashboard_query import MAX_PAGE_SIZE, build_filtered_query


BASE_SQL = "SELECT * FROM consultations WHERE status = 'prescribed'"

DATE_RANGE_FILTER = FilterDef(type=FilterType.date_range, label="Date Range")
MULTISELECT_FILTER = FilterDef(type=FilterType.multiselect, label="Type")
TEXT_EXACT_FILTER = FilterDef(type=FilterType.text, label="ID", match=TextMatch.exact)
TEXT_CONTAINS_FILTER = FilterDef(type=FilterType.text, label="State", match=TextMatch.contains)


class TestDateRangeFilter:
    def test_date_range_produces_correct_clauses(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@date_range:created_at"],
            filter_values={"date_range": {"start": "2025-08-01", "end": "2025-08-31"}},
            filter_defs={"date_range": DATE_RANGE_FILTER},
        )
        assert "created_at >= $p_date_range_start" in sql
        assert "created_at < $p_date_range_end + INTERVAL '1 day'" in sql
        assert "p_date_range_start" in params
        assert "p_date_range_end" in params

    def test_date_range_partial_start_only(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@date_range:created_at"],
            filter_values={"date_range": {"start": "2025-08-01"}},
            filter_defs={"date_range": DATE_RANGE_FILTER},
        )
        assert "created_at >= $p_date_range_start" in sql
        assert "INTERVAL" not in sql


class TestMultiselectFilter:
    def test_multiselect_produces_in_unnest(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@ctype:consultation_type"],
            filter_values={"ctype": ["async", "scheduled"]},
            filter_defs={"ctype": MULTISELECT_FILTER},
        )
        assert "consultation_type IN (SELECT UNNEST($p_ctype_values))" in sql
        assert params["p_ctype_values"] == ["async", "scheduled"]

    def test_multiselect_empty_list_omitted(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@ctype:consultation_type"],
            filter_values={"ctype": []},
            filter_defs={"ctype": MULTISELECT_FILTER},
        )
        assert sql.endswith("SELECT * FROM base")
        assert len(params) == 0


class TestTextFilter:
    def test_text_exact_produces_equals(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@cid:consultation_id"],
            filter_values={"cid": "C12345"},
            filter_defs={"cid": TEXT_EXACT_FILTER},
        )
        assert "consultation_id = $p_cid_value" in sql
        assert params["p_cid_value"] == "C12345"

    def test_text_contains_produces_like(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@state:pharmacy_state"],
            filter_values={"state": "TX"},
            filter_defs={"state": TEXT_CONTAINS_FILTER},
        )
        assert "LOWER(pharmacy_state) LIKE CONCAT('%', LOWER($p_state_value), '%')" in sql

    def test_empty_text_omitted(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@cid:consultation_id"],
            filter_values={"cid": ""},
            filter_defs={"cid": TEXT_EXACT_FILTER},
        )
        assert sql.endswith("SELECT * FROM base")


class TestMultipleFilters:
    def test_multiple_filters_combined_with_and(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@date_range:created_at", "@ctype:consultation_type"],
            filter_values={
                "date_range": {"start": "2025-08-01", "end": "2025-08-31"},
                "ctype": ["async"],
            },
            filter_defs={
                "date_range": DATE_RANGE_FILTER,
                "ctype": MULTISELECT_FILTER,
            },
        )
        assert " AND " in sql
        assert len(params) == 3  # start, end, values


class TestSQLWrapping:
    def test_base_sql_wrapped_as_cte(self):
        sql, _ = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=[],
            filter_values={},
            filter_defs={},
        )
        assert sql.startswith("WITH base AS (")
        assert "SELECT * FROM base" in sql


class TestSortValidation:
    def test_valid_sort_applied(self):
        sql, _ = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=[],
            filter_values={},
            filter_defs={},
            sort=SortConfig(column="created_at", direction="desc"),
            allowed_sort_columns={"created_at", "id"},
        )
        assert "ORDER BY created_at desc" in sql

    def test_invalid_sort_column_raises(self):
        with pytest.raises(ValueError, match="Invalid sort column"):
            build_filtered_query(
                base_sql=BASE_SQL,
                filter_bindings=[],
                filter_values={},
                filter_defs={},
                sort=SortConfig(column="injected_col", direction="desc"),
                allowed_sort_columns={"created_at", "id"},
            )


class TestPagination:
    def test_pagination_adds_limit_offset(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=[],
            filter_values={},
            filter_defs={},
            page=2,
            page_size=25,
        )
        assert "LIMIT $p_page_size OFFSET $p_offset" in sql
        assert params["p_page_size"] == 25
        assert params["p_offset"] == 25  # page 2, size 25 -> offset 25

    def test_page_size_capped(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=[],
            filter_values={},
            filter_defs={},
            page=1,
            page_size=1000,
        )
        assert params["p_page_size"] == MAX_PAGE_SIZE


class TestParameterSecurity:
    def test_filter_values_never_in_sql_text(self):
        """Parameterized values must not appear in the SQL string itself."""
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@cid:consultation_id"],
            filter_values={"cid": "INJECTED_VALUE"},
            filter_defs={"cid": TEXT_EXACT_FILTER},
        )
        assert "INJECTED_VALUE" not in sql

    def test_missing_filter_def_skipped(self):
        sql, params = build_filtered_query(
            base_sql=BASE_SQL,
            filter_bindings=["@unknown:col"],
            filter_values={"unknown": "val"},
            filter_defs={},
        )
        assert sql.endswith("SELECT * FROM base")
