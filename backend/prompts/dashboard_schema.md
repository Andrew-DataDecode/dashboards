## Dashboard Config Schema

Dashboards are defined by a `config.json` file in `project/dashboard-content/dashboards/<slug>/`. The backend loads and validates the config at startup.

**schema_version**: always `1`.

### Top-level structure

```json
{
  "schema_version": 1,
  "title": "...",
  "description": "...",
  "data_sources": { "<id>": <DataSource> },
  "filters": { "<id>": <FilterDef> },
  "computed": { "<id>": <ComputedValue> },
  "layout": [ <LayoutNode> ],
  "pages": [ <PageDef> ]
}
```

Use `layout` for single-page dashboards. Use `pages` for multi-tab dashboards.

### DataSource (two variants)

**DuckDB** — runs a SQL file:
```json
{
  "source": "duckdb",
  "sql_ref": "orders.sql",
  "table_name": "orders",
  "filters": ["@date_range:order_date", "@brand:brand_name"],
  "text_filters": ["@order_id:order_id"],
  "pagination": { "default_page_size": 50, "server_side": true },
  "cache_ttl_seconds": 300
}
```

**Semantic** — queries the semantic layer model:
```json
{
  "source": "semantic",
  "model": "order_activity",
  "dimensions": ["manage_brand", "order_date"],
  "measures": ["gross_order_value"],
  "filters": ["@date_range:order_date"]
}
```

Filter binding syntax: `@<filter_id>:<column_name>`. Filters go in `filters[]`; text-match filters go in `text_filters[]`.

### FilterDef

```json
"date_range": { "type": "date_range", "label": "Date Range", "default": { "start": "2025-01-01", "end": "today" } },
"brand":      { "type": "multiselect", "label": "Brand", "options_from": { "data_source": "orders", "column": "brand_name" } },
"order_id":   { "type": "text", "label": "Order ID", "match": "exact" }
```

Filter types: `date_range`, `multiselect`, `select`, `text`. Text match: `exact` or `contains`.

### ComputedValue

Server-side aggregation over a data source result. Reference in layout as `$computed.<key>`.

```json
"total_revenue": { "source": "orders", "agg": "sum", "column": "revenue" },
"avg_value":     { "source": "orders", "expr": "SUM(revenue) / NULLIF(SUM(order_count), 0)" }
```

### LayoutNode types

**section** — groups panels with optional heading:
```json
{ "type": "section", "title": "Overview", "children": [ <row|panel> ] }
```

**row** — horizontal container (12-column grid):
```json
{ "type": "row", "children": [ <panel width=4>, <panel width=8> ] }
```

**big_value** — KPI card:
```json
{ "type": "big_value", "title": "Total Revenue", "value": "$computed.total_revenue", "format": "currency", "width": 4 }
```

**table** — data table with columns:
```json
{
  "type": "table", "title": "Orders", "data_source": "orders", "width": 12,
  "columns": [
    { "key": "order_date", "label": "Date", "format": "date", "width": 120 },
    { "key": "revenue", "label": "Revenue", "format": "currency", "width": 100 }
  ],
  "default_sort": { "column": "order_date", "direction": "desc" },
  "pagination": { "default_page_size": 50, "server_side": true }
}
```

**chart** — visualization panel:
```json
{ "type": "chart", "chart_type": "line", "title": "Revenue Trend", "data_source": "orders", "x": "order_date", "y": "revenue", "width": 12 }
{ "type": "chart", "chart_type": "bar",  "title": "By Brand",      "data_source": "orders", "x": "brand", "y": "revenue", "series": "region", "stacked": true, "width": 6 }
{ "type": "chart", "chart_type": "pie",  "title": "Category Mix",  "data_source": "orders", "x": "category", "y": "revenue", "donut": true, "width": 6 }
```

Chart types: `line`, `bar`, `area`, `pie`. Options: `stacked` (bar/area), `horizontal` (bar), `donut` (pie), `series` (split by column).

Column formats: `text`, `number`, `currency`, `date`, `datetime`. Big_value formats: `number`, `currency`, `percent`.

### PageDef (multi-tab)

```json
{ "id": "overview", "label": "Overview", "layout": [ <LayoutNode> ] }
```

### Deployment

SQL files referenced by `sql_ref` must exist alongside `config.json` in `project/dashboard-content/dashboards/<slug>/`. Each SQL should produce the columns expected by the layout. The backend validates all configs at startup.
