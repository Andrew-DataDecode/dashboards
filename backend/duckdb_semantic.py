"""DuckDB semantic model registry -- translates dimension/measure queries into SQL.

Lightweight alternative to boring_semantic_layer for DuckDB-backed tables.
Models define named dimensions (columns) and measures (aggregations).
Query translates to SELECT dims, agg_measures FROM table GROUP BY dims.
"""

import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class SemanticModel:
    def __init__(self, table_name: str, name: str):
        self.table_name = table_name
        self.name = name
        self._dimensions: dict[str, str] = {}
        self._measures: dict[str, str] = {}

    def with_dimension(self, name: str, column: str) -> "SemanticModel":
        self._dimensions[name] = column
        return self

    def with_measure(self, name: str, expr: str) -> "SemanticModel":
        self._measures[name] = expr
        return self

    def query(
        self,
        dimensions: list[str],
        measures: list[str],
        filters: list[str] | None = None,
        limit: int = 10000,
    ) -> str:
        select_parts = []
        for d in dimensions:
            col = self._dimensions.get(d)
            if not col:
                raise ValueError(f"Unknown dimension '{d}' in model '{self.name}'")
            select_parts.append(f"{col} AS {d}")

        for m in measures:
            expr = self._measures.get(m)
            if not expr:
                raise ValueError(f"Unknown measure '{m}' in model '{self.name}'")
            select_parts.append(f"{expr} AS {m}")

        sql = f"SELECT {', '.join(select_parts)} FROM {self.table_name}"

        if filters:
            where = " AND ".join(filters)
            sql += f" WHERE {where}"

        if dimensions:
            sql += f" GROUP BY {', '.join(str(i+1) for i in range(len(dimensions)))}"

        sql += f" LIMIT {limit}"
        return sql

    def get_dimensions(self) -> list[str]:
        return list(self._dimensions.keys())

    def get_measures(self) -> list[str]:
        return list(self._measures.keys())


_registry: dict[str, SemanticModel] | None = None


def _build_registry() -> dict[str, SemanticModel]:
    models = {}

    consultation = SemanticModel("consultations", "consultation")
    consultation.with_dimension("consultation_id", "consultation_id")
    consultation.with_dimension("website_name", "website_name")
    consultation.with_dimension("clinician_name", "clinician_name")
    consultation.with_dimension("consultation_type", "consultation_type")
    consultation.with_dimension("treatment_type", "treatment_type_name")
    consultation.with_dimension("year_month", "year_month")
    consultation.with_measure("consultation_count", "COUNT(*)")
    consultation.with_measure("total_rate", "SUM(COALESCE(rate, 0))")
    models["consultation"] = consultation

    orders = SemanticModel("orders", "orders")
    orders.with_dimension("website_name", "website_name")
    orders.with_dimension("order_status", "order_status")
    orders.with_dimension("clinician_id", "CAST(clinician_id AS VARCHAR)")
    orders.with_dimension("test_result_status", "test_result_status")
    orders.with_dimension("year_month", "STRFTIME(order_date, '%Y-%m')")
    orders.with_measure("order_count", "COUNT(*)")
    orders.with_measure("total_payment", "SUM(COALESCE(total_payment, 0))")
    models["orders"] = orders

    return models


def get_duckdb_registry() -> dict[str, SemanticModel]:
    global _registry
    if _registry is None:
        _registry = _build_registry()
    return _registry


def query_semantic_model(
    model_name: str,
    dimensions: list[str],
    measures: list[str],
    filters: list[str] | None = None,
    limit: int = 10000,
) -> str:
    registry = get_duckdb_registry()
    model = registry.get(model_name)
    if not model:
        raise ValueError(f"Unknown semantic model '{model_name}'. Available: {list(registry.keys())}")
    return model.query(dimensions, measures, filters, limit)
