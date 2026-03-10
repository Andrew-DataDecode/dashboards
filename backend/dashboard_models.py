"""Pydantic models for config-driven dashboard schema and API request/response."""

from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, field_validator


class FilterType(str, Enum):
    date_range = "date_range"
    multiselect = "multiselect"
    select = "select"
    text = "text"


class TextMatch(str, Enum):
    exact = "exact"
    contains = "contains"


class OptionsFrom(BaseModel):
    data_source: str
    column: str


class FilterDef(BaseModel):
    type: FilterType
    label: str
    default: Any = None
    options_from: Optional[OptionsFrom] = None
    match: Optional[TextMatch] = None
    depends_on: Optional[list[str]] = None


class PaginationConfig(BaseModel):
    default_page_size: int = 50
    server_side: bool = False


class DuckDBSource(BaseModel):
    source: Literal["duckdb"]
    sql_ref: str
    table_name: str
    filters: list[str] = []
    text_filters: list[str] = []
    pagination: Optional[PaginationConfig] = None
    cache_ttl_seconds: int = 300


class SemanticSource(BaseModel):
    source: Literal["semantic"]
    model: str
    dimensions: list[str] = []
    measures: list[str] = []
    time_grain: Optional[str] = None
    filters: list[str] = []
    cache_ttl_seconds: int = 300


class DuckDBSemanticSource(BaseModel):
    source: Literal["duckdb_semantic"]
    model: str
    dimensions: list[str] = []
    measures: list[str] = []
    filters: list[str] = []
    cache_ttl_seconds: int = 300


class ComputedSource(BaseModel):
    source: Literal["computed"]
    function: str
    inputs: list[str] = []
    output: Optional[str] = None
    params: dict[str, Any] = {}
    cache_ttl_seconds: int = 300


DataSource = DuckDBSource | SemanticSource | DuckDBSemanticSource | ComputedSource


class ComputedValue(BaseModel):
    source: str
    agg: Optional[str] = None
    column: Optional[str] = None
    expr: Optional[str] = None


class SortConfig(BaseModel):
    column: str
    direction: Literal["asc", "desc"] = "desc"


class ColumnDef(BaseModel):
    key: str
    label: str
    format: Optional[str] = None
    width: Optional[int] = None


class LayoutNode(BaseModel):
    type: str
    title: Optional[str] = None
    children: Optional[list["LayoutNode"]] = None
    width: Optional[int] = None
    value: Optional[str] = None
    format: Optional[str] = None
    display: Optional[str] = None
    decimals: Optional[int] = None
    data_source: Optional[str] = None
    columns: Optional[list[ColumnDef] | Literal["auto"]] = None
    default_sort: Optional[SortConfig] = None
    pagination: Optional[PaginationConfig] = None
    aggregations: Optional[dict[str, str]] = None
    column_format: Optional[dict[str, str]] = None
    x: Optional[str] = None
    y: Optional[Any] = None
    series: Optional[str] = None


class PageDef(BaseModel):
    id: str
    label: str
    layout: list[LayoutNode]


class DashboardConfig(BaseModel):
    schema_version: int
    title: str
    description: str
    data_sources: dict[str, DataSource]
    filters: dict[str, FilterDef]
    computed: dict[str, ComputedValue] = {}
    layout: list[LayoutNode] = []
    pages: Optional[list[PageDef]] = None

    @field_validator("schema_version")
    @classmethod
    def check_version(cls, v):
        if v != 1:
            raise ValueError(f"Unsupported schema_version: {v}. Only version 1 is supported.")
        return v


class DashboardQueryRequest(BaseModel):
    filters: dict[str, Any] = {}
    pagination: dict[str, Any] = {}
    data_source: Optional[str] = None


class DashboardQueryResponse(BaseModel):
    data_sources: dict[str, Any]
    computed: dict[str, Any] = {}
    filter_options: dict[str, list] = {}
    queried_at: str
    errors: list[str] = []


class PageRequest(BaseModel):
    data_source: str
    filters: dict[str, Any] = {}
    page: int = 1
    page_size: int = 50
    sort_column: Optional[str] = None
    sort_direction: Literal["asc", "desc"] = "desc"

    @field_validator("page_size")
    @classmethod
    def cap_page_size(cls, v):
        return min(v, 500)


class PageResponseItem(BaseModel):
    status: str = "ok"
    columns: list[str] = []
    rows: list[dict[str, Any]] = []
    total_rows: int = 0
    page: int = 1
    page_size: int = 50
    queried_at: str = ""
    error: Optional[str] = None
