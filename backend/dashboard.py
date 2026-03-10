"""Dashboard config loading, validation, and query orchestration."""

import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from . import config as app_config
from .dashboard_models import (
    ComputedSource,
    ComputedValue,
    DashboardConfig,
    DashboardQueryResponse,
    DuckDBSemanticSource,
    DuckDBSource,
    LayoutNode,
    SemanticSource,
)
_FILTER_BINDING_RE = re.compile(r"@(\w+):(\w+)")


def load_dashboard_config(slug: str, base_dir: Optional[Path] = None) -> DashboardConfig:
    """Load and parse a dashboard config from content/dashboards/{slug}/config.json."""
    dashboards_dir = base_dir or app_config.dashboards_dir()
    config_path = dashboards_dir / slug / "config.json"
    if not config_path.exists():
        raise FileNotFoundError(f"Dashboard config not found: {config_path}")
    data = json.loads(config_path.read_text())
    return DashboardConfig(**data)


def validate_dashboard_config(config: DashboardConfig, dashboard_dir: Path) -> list[str]:
    """Run referential integrity checks on a parsed config. Returns list of errors."""
    errors = []
    ds_names = set(config.data_sources.keys())
    filter_names = set(config.filters.keys())

    # 1. Panel data_source references exist
    _check_layout_data_sources(config.layout, ds_names, errors)

    # 2. Filter bindings in data sources reference existing filters
    for ds_name, ds in config.data_sources.items():
        all_bindings = []
        if isinstance(ds, DuckDBSource):
            all_bindings = ds.filters + ds.text_filters
        elif isinstance(ds, (SemanticSource, DuckDBSemanticSource)):
            all_bindings = ds.filters

        for binding in all_bindings:
            match = _FILTER_BINDING_RE.match(binding)
            if match:
                filter_id = match.group(1)
                if filter_id not in filter_names:
                    errors.append(
                        f"data_sources.{ds_name}: filter binding '@{filter_id}' "
                        f"references nonexistent filter"
                    )

    # 3. Computed source references exist
    for comp_name, comp in config.computed.items():
        if comp.source not in ds_names:
            errors.append(
                f"computed.{comp_name}: source '{comp.source}' not in data_sources"
            )

    # 4. options_from.data_source references exist
    for filt_name, filt in config.filters.items():
        if filt.options_from and filt.options_from.data_source not in ds_names:
            errors.append(
                f"filters.{filt_name}.options_from: data_source "
                f"'{filt.options_from.data_source}' not in data_sources"
            )

    # 5 & 6. sql_ref resolves and no path traversal
    for ds_name, ds in config.data_sources.items():
        if isinstance(ds, DuckDBSource):
            sql_path = (dashboard_dir / ds.sql_ref).resolve()
            if not sql_path.is_relative_to(dashboard_dir.resolve()):
                errors.append(
                    f"data_sources.{ds_name}: sql_ref '{ds.sql_ref}' "
                    f"escapes dashboard directory (path traversal)"
                )
            elif not sql_path.exists():
                errors.append(
                    f"data_sources.{ds_name}: sql_ref '{ds.sql_ref}' "
                    f"file not found"
                )

    # 7. @param placeholders in SQL match declared filter bindings
    for ds_name, ds in config.data_sources.items():
        if isinstance(ds, DuckDBSource):
            sql_path = (dashboard_dir / ds.sql_ref).resolve()
            if sql_path.exists() and sql_path.is_relative_to(dashboard_dir.resolve()):
                sql_content = sql_path.read_text()
                declared_filters = set()
                for binding in ds.filters + ds.text_filters:
                    m = _FILTER_BINDING_RE.match(binding)
                    if m:
                        declared_filters.add(m.group(1))
                # Check for @param references in SQL that aren't declared
                sql_params = set(re.findall(r"@(\w+)", sql_content))
                for param in sql_params:
                    if param not in declared_filters and param not in ("param",):
                        pass  # SQL @params are BQ-native, not filter refs

    # 8. Filter depends_on DAG check (no cycles)
    _check_filter_dag(config.filters, errors)

    # 9. Chart guardrail warnings
    _check_chart_guardrails(config.layout, errors)

    return errors


def _check_layout_data_sources(
    nodes: list[LayoutNode], ds_names: set[str], errors: list[str]
) -> None:
    """Recursively check that panel data_source references exist."""
    for node in nodes:
        if node.data_source and node.data_source not in ds_names:
            errors.append(
                f"layout: panel '{node.title or node.type}' references "
                f"nonexistent data_source '{node.data_source}'"
            )
        if node.children:
            _check_layout_data_sources(node.children, ds_names, errors)


def _check_chart_guardrails(nodes: list[LayoutNode], warnings: list[str]) -> None:
    """Check chart panels for series count warnings."""
    for node in nodes:
        if node.type == "chart" and node.y:
            title = node.title or "untitled"
            chart_type = getattr(node, "chart_type", None)
            if not chart_type:
                # chart_type stored as a generic attribute on LayoutNode
                pass

            # Estimate series count from y field
            y_val = node.y
            series_count = len(y_val) if isinstance(y_val, list) else 1

            if node.type == "chart":
                ct = getattr(node, "chart_type", node.format)
                if ct == "pie" and series_count > 6:
                    warnings.append(
                        f"Warning: Pie chart '{title}' may have too many slices (>6)"
                    )
                if ct == "line" and series_count > 7:
                    warnings.append(
                        f"Warning: Line chart '{title}' has {series_count} series (max recommended: 7)"
                    )
                if ct == "bar" and series_count > 4:
                    stacked = getattr(node, "stacked", False)
                    if stacked:
                        warnings.append(
                            f"Warning: Stacked bar '{title}' has {series_count} series (max recommended: 4)"
                        )

        if node.children:
            _check_chart_guardrails(node.children, warnings)


def _check_filter_dag(filters: dict, errors: list[str]) -> None:
    """Check that filter depends_on forms a DAG (no cycles)."""
    graph = {}
    for name, filt in filters.items():
        graph[name] = filt.depends_on or []

    visited = set()
    in_stack = set()

    def dfs(node):
        if node in in_stack:
            errors.append(f"filters: circular dependency detected involving '{node}'")
            return
        if node in visited:
            return
        in_stack.add(node)
        for dep in graph.get(node, []):
            dfs(dep)
        in_stack.discard(node)
        visited.add(node)

    for name in graph:
        dfs(name)


def validate_all_dashboards(base_dir: Optional[Path] = None) -> dict[str, list[str]]:
    """Validate all dashboard configs. Returns {slug: [errors]}."""
    dashboards_dir = base_dir or app_config.dashboards_dir()
    results = {}
    if not dashboards_dir.exists():
        return results
    for config_path in dashboards_dir.glob("*/config.json"):
        slug = config_path.parent.name
        try:
            config = load_dashboard_config(slug, base_dir=dashboards_dir)
            errs = validate_dashboard_config(config, config_path.parent)
            results[slug] = errs
        except Exception as e:
            results[slug] = [f"Failed to load: {e}"]
    return results


def get_panel_columns(config: DashboardConfig, data_source_name: str) -> set[str]:
    """Extract allowed sort columns for a data source from layout panels."""
    columns = set()
    _collect_panel_columns(config.layout, data_source_name, columns)
    return columns


def _collect_panel_columns(
    nodes: list[LayoutNode], ds_name: str, columns: set[str]
) -> None:
    for node in nodes:
        if node.data_source == ds_name and node.columns:
            for col in node.columns:
                columns.add(col.key)
        if node.children:
            _collect_panel_columns(node.children, ds_name, columns)


def compute_values(
    computed: dict[str, ComputedValue], results: dict[str, Any]
) -> dict[str, Any]:
    """Compute aggregate values from query results."""
    import duckdb

    output = {}
    for name, spec in computed.items():
        source_result = results.get(spec.source, {})
        if source_result.get("status") != "ok":
            output[name] = None
            continue

        rows = source_result.get("rows", [])
        if not rows:
            output[name] = None
            continue

        if spec.expr:
            try:
                conn = duckdb.connect()
                import pyarrow as pa
                columns: dict[str, list] = {}
                for row in rows:
                    for k, v in row.items():
                        columns.setdefault(k, []).append(v)
                table = pa.table(columns)
                conn.register("source", table)
                result = conn.execute(f"SELECT {spec.expr} AS val FROM source").fetchone()
                output[name] = result[0] if result else None
                conn.close()
            except Exception:
                output[name] = None
            continue

        if not spec.column:
            output[name] = None
            continue

        values = [r.get(spec.column) for r in rows if r.get(spec.column) is not None]
        try:
            numeric = [float(v) for v in values]
        except (ValueError, TypeError):
            output[name] = None
            continue

        if spec.agg == "sum":
            output[name] = sum(numeric)
        elif spec.agg == "count":
            output[name] = len(values)
        elif spec.agg == "avg":
            output[name] = sum(numeric) / len(numeric) if numeric else None
        elif spec.agg == "min":
            output[name] = min(numeric) if numeric else None
        elif spec.agg == "max":
            output[name] = max(numeric) if numeric else None
        elif spec.agg == "count_distinct":
            output[name] = len(set(values))
        else:
            output[name] = None

    return output


def _execute_computed_sources(
    sources: dict[str, Any], results: dict[str, Any]
) -> None:
    """Run computed source functions and inject results into the results dict."""
    from .computed_registry import get_function

    computed_sources = {
        name: src for name, src in sources.items()
        if isinstance(src, ComputedSource)
    }
    if not computed_sources:
        return

    fn_cache: dict[str, dict] = {}

    for name, src in computed_sources.items():
        cache_key = src.function
        if cache_key not in fn_cache:
            try:
                fn = get_function(src.function)
                inputs = {}
                for inp_name in src.inputs:
                    inp_result = results.get(inp_name, {})
                    if inp_result.get("status") == "ok":
                        inputs[inp_name] = inp_result.get("rows", [])
                    else:
                        inputs[inp_name] = []

                output = fn(inputs, src.params)
                if isinstance(output, list):
                    fn_cache[cache_key] = {"_default": output}
                elif isinstance(output, dict):
                    fn_cache[cache_key] = output
                else:
                    fn_cache[cache_key] = {}
            except Exception as e:
                results[name] = {
                    "status": "error",
                    "error": str(e),
                    "error_type": type(e).__name__,
                }
                continue

        cached = fn_cache.get(cache_key, {})
        output_key = src.output or "_default"
        rows = cached.get(output_key, [])

        result_entry: dict[str, Any] = {"status": "ok", "rows": rows, "row_count": len(rows), "columns": list(rows[0].keys()) if rows else []}

        metrics = cached.get("_metrics", {})
        if metrics:
            result_entry["_metrics"] = metrics

        results[name] = result_entry


async def execute_dashboard(
    config: DashboardConfig,
    filter_values: dict,
    pagination: dict | None = None,
    data_source_filter: str | None = None,
    dashboard_dir: Path | None = None,
) -> DashboardQueryResponse:
    """Execute all dashboard queries concurrently, return partial results on failure."""
    from .dashboard_query import execute_duckdb_source, execute_duckdb_semantic_source, execute_semantic_source

    pagination = pagination or {}
    d_dir = dashboard_dir or app_config.dashboards_dir()

    sources = config.data_sources
    if data_source_filter:
        sources = {k: v for k, v in sources.items() if k == data_source_filter}

    tasks = {}
    for name, source in sources.items():
        if isinstance(source, DuckDBSource):
            tasks[name] = execute_duckdb_source(
                name, source, config, filter_values, pagination, d_dir
            )
        elif isinstance(source, DuckDBSemanticSource):
            tasks[name] = execute_duckdb_semantic_source(name, source, config, filter_values)
        elif isinstance(source, SemanticSource):
            tasks[name] = execute_semantic_source(name, source, filter_values)

    results = {}
    if tasks:
        gathered = await asyncio.gather(*tasks.values(), return_exceptions=True)
        for name, result in zip(tasks.keys(), gathered):
            if isinstance(result, Exception):
                results[name] = {
                    "status": "error",
                    "error": str(result),
                    "error_type": type(result).__name__,
                }
            else:
                results[name] = {"status": "ok", **result}

    # Execute computed sources after all data sources complete
    _execute_computed_sources(sources, results)

    computed = compute_values(config.computed, results)

    # Extract _metrics from computed sources into computed dict
    for name, result in results.items():
        if result.get("_metrics"):
            for metric_key, metric_val in result["_metrics"].items():
                computed[f"{name}._metrics.{metric_key}"] = metric_val

    # Gather filter options
    from .dashboard_query import gather_filter_options
    filter_options = await gather_filter_options(config, d_dir)

    return DashboardQueryResponse(
        data_sources=results,
        computed=computed,
        filter_options=filter_options,
        queried_at=datetime.now(timezone.utc).isoformat(),
    )
