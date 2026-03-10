# Dashboard Config Schema Reference

Schema version: **1**
Backend models: `project/tanit/backend/dashboard_models.py`
Frontend types: `project/tanit/frontend/src/types/dashboard.ts`

---

## DashboardConfig (top-level)

| Field | Type | Required | Description |
|---|---|---|---|
| `schema_version` | `int` | Yes | Must be `1`. Validated at load time. |
| `title` | `string` | Yes | Display name shown in sidebar and page header. |
| `description` | `string` | Yes | Short summary shown on dashboard index page. |
| `data_sources` | `Record<string, DataSource>` | Yes | Named data sources keyed by id. Referenced by panels and computed values. |
| `filters` | `Record<string, FilterDef>` | Yes | Named filters keyed by id. Referenced in data source `filters`/`text_filters` arrays. |
| `computed` | `Record<string, ComputedValue>` | No | Named computed aggregations. Referenced in big_value panels as `$computed.<key>`. |
| `layout` | `LayoutNode[]` | No | Default layout tree. Used when `pages` is absent, or as fallback. |
| `pages` | `PageDef[]` | No | Multi-page dashboard. Each page has its own layout. Renders tab navigation. |

Use `layout` for single-page dashboards. Use `pages` for multi-tab dashboards. If both are present, pages take precedence in the tab UI; `layout` serves as default/fallback.

---

## DataSource

Discriminated union on `source` field. Two variants:

### DuckDBSource

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | `"duckdb"` | Yes | | Discriminator. |
| `sql_ref` | `string` | Yes | | SQL filename relative to dashboard directory. |
| `table_name` | `string` | Yes | | DuckDB table name the SQL creates/populates. |
| `filters` | `string[]` | No | `[]` | Filter bindings. Format: `@filter_id:column_name`. Applied as WHERE clauses. |
| `text_filters` | `string[]` | No | `[]` | Text search filter bindings. Same format as `filters`. |
| `pagination` | `PaginationConfig` | No | `null` | Server-side pagination config. |
| `cache_ttl_seconds` | `int` | No | `300` | Query result cache duration in seconds. |

### SemanticSource

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | `"semantic"` | Yes | | Discriminator. |
| `model` | `string` | Yes | | Semantic layer model name. |
| `dimensions` | `string[]` | No | `[]` | Dimension fields to include. |
| `measures` | `string[]` | No | `[]` | Measure fields to include. |
| `time_grain` | `string` | No | `null` | Time granularity (e.g., `"day"`, `"month"`). |
| `filters` | `string[]` | No | `[]` | Filter bindings. Same `@filter_id:column_name` format. |
| `cache_ttl_seconds` | `int` | No | `300` | Query result cache duration. |

### PaginationConfig

| Field | Type | Default | Description |
|---|---|---|---|
| `default_page_size` | `int` | `50` | Rows per page. Max 500 (enforced server-side). |
| `server_side` | `bool` | `false` | When `true`, pagination queries are sent to the backend per page. |

---

## FilterDef

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `FilterType` | Yes | | One of: `"date_range"`, `"multiselect"`, `"select"`, `"text"`. |
| `label` | `string` | Yes | | Display label in filter bar. |
| `default` | `any` | No | `null` | Default value. For `date_range`: `{"start": "YYYY-MM-DD", "end": "today"}`. |
| `options_from` | `OptionsFrom` | No | `null` | Dynamic options from a data source column. |
| `match` | `TextMatch` | No | `null` | For `text` filters: `"exact"` or `"contains"`. |
| `depends_on` | `string[]` | No | `null` | Filter ids this filter depends on (cascading filters). |

### OptionsFrom

| Field | Type | Description |
|---|---|---|
| `data_source` | `string` | Data source id to pull distinct values from. |
| `column` | `string` | Column name to extract options from. |

### Filter binding syntax

Data sources reference filters using `@filter_id:column_name`:
- `@date_range:order_date` -- apply the `date_range` filter to column `order_date`
- `@brand:brand_name` -- apply the `brand` filter to column `brand_name`

Regular filters go in `filters[]`. Text-match filters go in `text_filters[]`.

---

## ComputedValue

Aggregations computed server-side from data source results. Referenced in layout as `$computed.<key>`.

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | `string` | Yes | Data source id to aggregate from. |
| `agg` | `string` | No | Aggregation function: `"sum"`, `"count"`, `"avg"`, `"min"`, `"max"`. Use with `column`. |
| `column` | `string` | No | Column to aggregate. Required when `agg` is set. |
| `expr` | `string` | No | Raw SQL expression. Alternative to `agg`+`column` for complex aggregations. |

Use either `agg`+`column` or `expr`, not both.

---

## LayoutNode

Recursive tree structure. Discriminated union on `type`.

### section

Groups panels under an optional heading.

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"section"` | Yes | |
| `title` | `string` | No | Section heading text. |
| `children` | `LayoutNode[]` | Yes | Child nodes (rows, panels). |

### row

Horizontal container using 12-column grid.

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"row"` | Yes | |
| `children` | `LayoutNode[]` | Yes | Child panels. Use `width` on children to control column span. |

### big_value

Single KPI metric card.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"big_value"` | Yes | | |
| `title` | `string` | Yes | | Label shown above the value. |
| `value` | `string` | Yes | | Value reference. Use `$computed.<key>` to bind to a computed value. |
| `format` | `string` | No | | Display format: `"number"`, `"currency"`, `"percent"`. |
| `width` | `int` | No | `3` | Grid column span (out of 12). |

### table

Data table with sorting, pagination, and column definitions.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"table"` | Yes | | |
| `title` | `string` | Yes | | Panel heading. |
| `data_source` | `string` | Yes | | Data source id. |
| `columns` | `ColumnDef[]` | Yes | | Column definitions. |
| `default_sort` | `SortConfig` | No | | Initial sort column and direction. |
| `pagination` | `PaginationConfig` | No | | Pagination settings for this table. |
| `width` | `int` | No | `12` | Grid column span (out of 12). |

### chart

Chart panel. The `chart_type` field selects the visualization.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"chart"` | Yes | | |
| `chart_type` | `string` | Yes | | One of: `"line"`, `"bar"`, `"area"`, `"pie"`. |
| `title` | `string` | Yes | | Panel heading. |
| `data_source` | `string` | Yes | | Data source id. |
| `x` | `string` | Yes | | Column for x-axis (or pie labels). |
| `y` | `string \| string[]` | Yes | | Column(s) for y-axis (or pie values). |
| `series` | `string` | No | | Column to split into multiple series. |
| `width` | `int` | No | `12` | Grid column span (out of 12). |
| `height` | `int` | No | | Chart height in pixels. |
| `stacked` | `bool` | No | `false` | Stack series (bar/area). |
| `horizontal` | `bool` | No | `false` | Horizontal orientation (bar only). |
| `donut` | `bool` | No | `false` | Donut variant (pie only). |
| `color_override` | `Record<string, string>` | No | | Map series names to hex colors. |

---

## Supporting types

### ColumnDef

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `key` | `string` | Yes | | Column key matching the data source result. |
| `label` | `string` | Yes | | Display header text. |
| `format` | `string` | No | | Format: `"text"`, `"number"`, `"currency"`, `"datetime"`, `"date"`. |
| `width` | `int` | No | | Column width in pixels. |

### SortConfig

| Field | Type | Default | Description |
|---|---|---|---|
| `column` | `string` | | Column key to sort by. |
| `direction` | `"asc" \| "desc"` | `"desc"` | Sort direction. |

### PageDef

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique page identifier. |
| `label` | `string` | Yes | Tab label text. |
| `layout` | `LayoutNode[]` | Yes | Layout tree for this page. |

---

## Example: Minimal Dashboard

Single data source, one table, one line chart.

```json
{
  "schema_version": 1,
  "title": "Daily Orders",
  "description": "Order volume over time",

  "data_sources": {
    "orders": {
      "source": "duckdb",
      "sql_ref": "orders.sql",
      "table_name": "daily_orders",
      "filters": ["@date_range:order_date"],
      "cache_ttl_seconds": 300
    }
  },

  "filters": {
    "date_range": {
      "type": "date_range",
      "label": "Date Range",
      "default": { "start": "2025-01-01", "end": "today" }
    }
  },

  "layout": [
    {
      "type": "section",
      "title": "Orders",
      "children": [
        {
          "type": "row",
          "children": [
            {
              "type": "chart",
              "chart_type": "line",
              "title": "Orders Over Time",
              "data_source": "orders",
              "x": "order_date",
              "y": "order_count",
              "width": 12
            }
          ]
        },
        {
          "type": "row",
          "children": [
            {
              "type": "table",
              "title": "Order Detail",
              "data_source": "orders",
              "columns": [
                { "key": "order_date", "label": "Date", "format": "date", "width": 120 },
                { "key": "order_count", "label": "Orders", "format": "number", "width": 100 },
                { "key": "revenue", "label": "Revenue", "format": "currency", "width": 120 }
              ],
              "default_sort": { "column": "order_date", "direction": "desc" },
              "width": 12
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Example: Full-Featured Dashboard

Demonstrates: filters, computed values, pages, all 6 panel types (big_value, table, line, bar, area, pie).

```json
{
  "schema_version": 1,
  "title": "Sales Analytics",
  "description": "Multi-page sales dashboard with all panel types",

  "data_sources": {
    "daily": {
      "source": "duckdb",
      "sql_ref": "daily.sql",
      "table_name": "sales_daily",
      "filters": ["@date_range:sale_date", "@region:region"],
      "cache_ttl_seconds": 300
    },
    "by_category": {
      "source": "duckdb",
      "sql_ref": "by_category.sql",
      "table_name": "sales_by_category",
      "filters": ["@date_range:sale_date", "@region:region"],
      "cache_ttl_seconds": 600
    },
    "detail": {
      "source": "duckdb",
      "sql_ref": "detail.sql",
      "table_name": "sales_detail",
      "filters": ["@date_range:sale_date", "@region:region"],
      "text_filters": ["@order_id:order_id"],
      "pagination": { "default_page_size": 50, "server_side": true },
      "cache_ttl_seconds": 300
    }
  },

  "filters": {
    "date_range": {
      "type": "date_range",
      "label": "Date Range",
      "default": { "start": "2025-01-01", "end": "today" }
    },
    "region": {
      "type": "multiselect",
      "label": "Region",
      "options_from": { "data_source": "daily", "column": "region" }
    },
    "order_id": {
      "type": "text",
      "label": "Order ID",
      "match": "exact"
    }
  },

  "computed": {
    "total_revenue": {
      "source": "daily",
      "agg": "sum",
      "column": "revenue"
    },
    "total_orders": {
      "source": "daily",
      "agg": "sum",
      "column": "order_count"
    },
    "avg_order_value": {
      "source": "daily",
      "expr": "SUM(revenue) / NULLIF(SUM(order_count), 0)"
    }
  },

  "pages": [
    {
      "id": "overview",
      "label": "Overview",
      "layout": [
        {
          "type": "section",
          "title": "Key Metrics",
          "children": [
            {
              "type": "row",
              "children": [
                { "type": "big_value", "title": "Total Revenue", "value": "$computed.total_revenue", "format": "currency", "width": 4 },
                { "type": "big_value", "title": "Total Orders", "value": "$computed.total_orders", "format": "number", "width": 4 },
                { "type": "big_value", "title": "Avg Order Value", "value": "$computed.avg_order_value", "format": "currency", "width": 4 }
              ]
            },
            {
              "type": "row",
              "children": [
                {
                  "type": "chart",
                  "chart_type": "line",
                  "title": "Revenue Trend",
                  "data_source": "daily",
                  "x": "sale_date",
                  "y": "revenue",
                  "width": 6
                },
                {
                  "type": "chart",
                  "chart_type": "area",
                  "title": "Order Volume (Stacked by Region)",
                  "data_source": "daily",
                  "x": "sale_date",
                  "y": "order_count",
                  "series": "region",
                  "stacked": true,
                  "width": 6
                }
              ]
            },
            {
              "type": "row",
              "children": [
                {
                  "type": "chart",
                  "chart_type": "bar",
                  "title": "Revenue by Category",
                  "data_source": "by_category",
                  "x": "category",
                  "y": "revenue",
                  "series": "region",
                  "stacked": true,
                  "width": 6
                },
                {
                  "type": "chart",
                  "chart_type": "pie",
                  "title": "Category Mix",
                  "data_source": "by_category",
                  "x": "category",
                  "y": "revenue",
                  "donut": true,
                  "width": 6
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "detail",
      "label": "Order Detail",
      "layout": [
        {
          "type": "section",
          "title": "Orders",
          "children": [
            {
              "type": "row",
              "children": [
                {
                  "type": "table",
                  "title": "Sales Detail",
                  "data_source": "detail",
                  "columns": [
                    { "key": "order_id", "label": "Order ID", "width": 100 },
                    { "key": "sale_date", "label": "Date", "format": "date", "width": 110 },
                    { "key": "region", "label": "Region", "width": 100 },
                    { "key": "category", "label": "Category", "width": 120 },
                    { "key": "quantity", "label": "Qty", "format": "number", "width": 60 },
                    { "key": "revenue", "label": "Revenue", "format": "currency", "width": 110 }
                  ],
                  "default_sort": { "column": "sale_date", "direction": "desc" },
                  "pagination": { "default_page_size": 50, "server_side": true },
                  "width": 12
                }
              ]
            }
          ]
        }
      ]
    }
  ],

  "layout": []
}
```

---

## Config Deployment

### Directory structure

Each dashboard lives in its own directory under the content root:

```
project/dashboard-content/dashboards/
  <slug>/
    config.json       # Dashboard config (this schema)
    detail.sql        # SQL files referenced by sql_ref
    summary.sql
    ...
```

The directory name becomes the dashboard slug used in URLs: `/dashboard/<slug>`.

### Steps

1. Create a new directory: `project/dashboard-content/dashboards/<slug>/`
2. Write `config.json` following this schema.
3. Write SQL files referenced by `sql_ref` fields. Each SQL file should produce a table matching `table_name`.
4. Restart the backend, or call the DuckDB reload endpoint if available:
   ```
   POST /api/admin/reload
   ```
   The backend validates all dashboard configs at startup. Invalid configs log errors but do not prevent other dashboards from loading.

### Validation

- `schema_version` must be `1` (enforced by Pydantic validator).
- All `data_source` references in layout nodes must match keys in `data_sources`.
- All `@filter_id` references in data source `filters`/`text_filters` must match keys in `filters`.
- `sql_ref` files must exist in the dashboard directory.
- `page_size` is capped at 500 server-side regardless of config value.

### Environment

The backend resolves the content directory from the `CONTENT_ROOT` environment variable (default: `/app/content`). Dashboards are read from `$CONTENT_ROOT/dashboards/`.
