"""DuckDB query execution, filter binding, and parameterization."""

import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any, Optional

import structlog

from .dashboard_models import (
    DashboardConfig,
    DuckDBSemanticSource,
    DuckDBSource,
    FilterDef,
    FilterType,
    PaginationConfig,
    SemanticSource,
    SortConfig,
    TextMatch,
)

MAX_PAGE_SIZE = 500
_FILTER_BINDING_RE = re.compile(r"@(\w+):(\w+)")


def build_filtered_query(
    base_sql: str,
    filter_bindings: list[str],
    filter_values: dict[str, Any],
    filter_defs: dict[str, FilterDef],
    sort: Optional[SortConfig] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    allowed_sort_columns: Optional[set[str]] = None,
) -> tuple[str, dict]:
    """Build parameterized SQL with filter clauses.

    Returns (sql_string, params_dict).
    """
    where_clauses = []
    params = {}

    for binding in filter_bindings:
        match = _FILTER_BINDING_RE.match(binding)
        if not match:
            continue

        filter_id, column = match.group(1), match.group(2)
        value = filter_values.get(filter_id)
        filter_def = filter_defs.get(filter_id)

        if not filter_def or value is None:
            continue

        if filter_def.type == FilterType.date_range:
            if isinstance(value, dict):
                start = value.get("start")
                end = value.get("end")
                if start:
                    param_name = f"p_{filter_id}_start"
                    where_clauses.append(f"{column} >= ${param_name}::TIMESTAMP")
                    params[param_name] = start
                if end:
                    param_name = f"p_{filter_id}_end"
                    where_clauses.append(
                        f"{column} < ${param_name}::DATE + INTERVAL '1 day'"
                    )
                    params[param_name] = end

        elif filter_def.type == FilterType.multiselect:
            if isinstance(value, list) and value:
                param_name = f"p_{filter_id}_values"
                where_clauses.append(
                    f"CAST({column} AS VARCHAR) IN (SELECT UNNEST(${param_name}))"
                )
                params[param_name] = value

        elif filter_def.type == FilterType.text:
            if isinstance(value, str) and value:
                param_name = f"p_{filter_id}_value"
                if filter_def.match == TextMatch.contains:
                    where_clauses.append(
                        f"LOWER({column}) LIKE CONCAT('%', LOWER(${param_name}), '%')"
                    )
                else:
                    where_clauses.append(f"{column} = ${param_name}")
                params[param_name] = value

    has_group_by = bool(re.search(r"\bGROUP\s+BY\b", base_sql, re.IGNORECASE))
    if has_group_by and where_clauses:
        table_match = re.search(r"\bFROM\s+(\w+)", base_sql, re.IGNORECASE)
        if table_match:
            table_name = table_match.group(1)
            filtered_from = f"(SELECT * FROM {table_name} WHERE {' AND '.join(where_clauses)}) AS {table_name}"
            sql = re.sub(
                r"\bFROM\s+" + re.escape(table_name) + r"\b",
                f"FROM {filtered_from}",
                base_sql,
                count=1,
                flags=re.IGNORECASE,
            )
            sql = f"WITH base AS ({sql}) SELECT * FROM base"
        else:
            sql = f"WITH base AS ({base_sql}) SELECT * FROM base"
            sql += " WHERE " + " AND ".join(where_clauses)
    else:
        sql = f"WITH base AS ({base_sql}) SELECT * FROM base"
        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)

    if sort:
        if allowed_sort_columns and sort.column not in allowed_sort_columns:
            raise ValueError(
                f"Invalid sort column '{sort.column}'. "
                f"Allowed: {sorted(allowed_sort_columns)}"
            )
        sql += f" ORDER BY {sort.column} {sort.direction}"

    if page is not None:
        actual_page_size = min(page_size or 50, MAX_PAGE_SIZE)
        offset = (max(page, 1) - 1) * actual_page_size
        sql += f" LIMIT $p_page_size OFFSET $p_offset"
        params["p_page_size"] = actual_page_size
        params["p_offset"] = offset

    return sql, params


async def execute_duckdb_source(
    name: str,
    source: DuckDBSource,
    config: DashboardConfig,
    filter_values: dict,
    pagination: dict,
    dashboard_dir: Path,
) -> dict:
    """Execute a DuckDB data source query."""
    log = structlog.get_logger("dashboard_query")

    sql_dir = dashboard_dir
    if (dashboard_dir / name).is_dir():
        sql_dir = dashboard_dir / name
    elif not (dashboard_dir / source.sql_ref).exists():
        from . import config as app_config
        for candidate in app_config.dashboards_dir().glob("*/"):
            if (candidate / source.sql_ref).exists():
                sql_dir = candidate
                break

    sql_path = sql_dir / source.sql_ref
    if not sql_path.exists():
        raise FileNotFoundError(f"SQL file not found: {source.sql_ref}")

    base_sql = sql_path.read_text()

    from .dashboard import get_panel_columns

    allowed_cols = get_panel_columns(config, name)

    page_params = pagination.get(name, {})
    sort = None
    if "sort_column" in page_params:
        sort = SortConfig(
            column=page_params["sort_column"],
            direction=page_params.get("sort_direction", "desc"),
        )

    all_bindings = source.filters + source.text_filters
    query, params = build_filtered_query(
        base_sql=base_sql,
        filter_bindings=all_bindings,
        filter_values=filter_values,
        filter_defs=config.filters,
        sort=sort,
        page=page_params.get("page"),
        page_size=page_params.get("page_size"),
        allowed_sort_columns=allowed_cols if allowed_cols else None,
    )

    from .duckdb_engine import get_duckdb_engine

    engine = get_duckdb_engine()
    slug = dashboard_dir.name
    filters_applied = list(filter_values.keys()) if filter_values else []
    start = time.perf_counter()
    try:
        result = engine.query(query, params)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        log.info(
            "query.executed",
            slug=slug,
            data_source=name,
            duration_ms=duration_ms,
            row_count=result["row_count"],
            filters_applied=filters_applied,
        )
        return result
    except Exception as e:
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        sql_hash = hashlib.sha256(query.encode()).hexdigest()[:12]
        log.error(
            "query.error",
            sql_hash=sql_hash,
            error=str(e),
            duration_ms=duration_ms,
        )
        raise


async def execute_semantic_source(
    name: str,
    source: SemanticSource,
    filter_values: dict,
) -> dict:
    """Execute a semantic layer data source query."""
    from .semantic import call_tool

    bsl_filters = []
    for binding in source.filters:
        match = _FILTER_BINDING_RE.match(binding)
        if not match:
            continue
        filter_id, column = match.group(1), match.group(2)
        value = filter_values.get(filter_id)
        if value is None:
            continue
        if isinstance(value, dict):
            if value.get("start"):
                bsl_filters.append(f"{column} >= '{value['start']}'")
            if value.get("end"):
                bsl_filters.append(f"{column} <= '{value['end']}'")
        elif isinstance(value, list):
            for v in value:
                bsl_filters.append(f"{column} = '{v}'")
        elif isinstance(value, str) and value:
            bsl_filters.append(f"{column} = '{value}'")

    tool_input = {
        "model_name": source.model,
        "dimensions": source.dimensions,
        "measures": source.measures,
        "filters": bsl_filters,
    }
    if source.time_grain:
        tool_input["time_grain"] = source.time_grain

    result_str = await call_tool("query_model", tool_input)
    result = json.loads(result_str)

    if "error" in result:
        raise RuntimeError(f"Semantic query failed: {result['error']}")

    return {
        "columns": result.get("columns", []),
        "rows": result.get("rows", result.get("data", [])),
        "row_count": result.get("row_count", 0),
    }


async def gather_filter_options(
    config: DashboardConfig,
    dashboard_dir: Path,
) -> dict[str, list[str]]:
    """Run DISTINCT queries for filters with options_from config."""
    options: dict[str, list[str]] = {}

    for filter_id, filter_def in config.filters.items():
        if not filter_def.options_from:
            continue

        source_name = filter_def.options_from.data_source
        column = filter_def.options_from.column
        source = config.data_sources.get(source_name)
        if not source or not isinstance(source, DuckDBSource):
            continue

        sql_path = dashboard_dir / source.sql_ref
        if not sql_path.exists():
            continue

        base_sql = sql_path.read_text()
        distinct_sql = (
            f"WITH base AS ({base_sql}) "
            f"SELECT DISTINCT {column} FROM base "
            f"WHERE {column} IS NOT NULL "
            f"ORDER BY {column} "
            f"LIMIT 1000"
        )

        from .duckdb_engine import get_duckdb_engine

        engine = get_duckdb_engine()
        result = engine.query(distinct_sql, {})
        values = [str(row[column]) for row in result["rows"]]
        options[filter_id] = values

    return options


async def execute_duckdb_semantic_source(
    name: str,
    source: DuckDBSemanticSource,
    config: DashboardConfig,
    filter_values: dict,
) -> dict:
    """Execute a DuckDB semantic model query."""
    from .duckdb_semantic import query_semantic_model
    from .duckdb_engine import get_duckdb_engine

    bsl_filters = []
    for binding in source.filters:
        match = _FILTER_BINDING_RE.match(binding)
        if not match:
            continue
        filter_id, column = match.group(1), match.group(2)
        value = filter_values.get(filter_id)
        if value is None:
            continue
        if isinstance(value, dict):
            if value.get("start"):
                bsl_filters.append(f"{column} >= '{value['start']}'")
            if value.get("end"):
                bsl_filters.append(f"{column} <= '{value['end']}'")
        elif isinstance(value, list):
            quoted = ", ".join(f"'{v}'" for v in value)
            bsl_filters.append(f"{column} IN ({quoted})")
        elif isinstance(value, str) and value:
            bsl_filters.append(f"{column} = '{value}'")

    sql = query_semantic_model(
        source.model,
        source.dimensions,
        source.measures,
        filters=bsl_filters if bsl_filters else None,
    )

    engine = get_duckdb_engine()
    return engine.query(sql, {})
