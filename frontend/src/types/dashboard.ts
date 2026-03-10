// --- Dashboard Config (from GET /api/dashboard/{slug}/config) ---

export interface PageConfig {
  id: string;
  label: string;
  layout: LayoutNode[];
}

export interface DashboardConfig {
  schema_version: number;
  title: string;
  description?: string;
  data_sources: Record<string, DataSourceConfig>;
  filters: Record<string, FilterConfig>;
  computed: Record<string, ComputedConfig>;
  layout: LayoutNode[];
  pages?: PageConfig[];
}

export interface DataSourceConfig {
  source: 'bigquery' | 'semantic';
  filters?: string[];
  text_filters?: string[];
  pagination?: { default_page_size: number; server_side: boolean };
}

export interface FilterConfig {
  type: 'date_range' | 'multiselect' | 'select' | 'text';
  label: string;
  default?: unknown;
  match?: 'exact' | 'contains';
  options_from?: { data_source: string; column: string };
}

export interface ComputedConfig {
  source: string;
  agg: 'sum' | 'count' | 'avg' | 'min' | 'max';
  column: string;
}

// Layout tree (discriminated union on type)
export type LayoutNode = SectionNode | RowNode | BigValueNode | TableNodeExtended | ChartNode;

export interface SectionNode {
  type: 'section';
  title?: string;
  children: LayoutNode[];
}

export interface RowNode {
  type: 'row';
  children: LayoutNode[];
}

export interface BigValueNode {
  type: 'big_value';
  title: string;
  value: string;
  format?: 'number' | 'currency' | 'percent';
  display?: 'compact' | 'full';
  decimals?: number;
  width?: number;
}

export interface TableNode {
  type: 'table';
  title: string;
  data_source: string;
  columns: ColumnDef[] | 'auto';
  default_sort?: { column: string; direction: 'asc' | 'desc' };
  pagination?: { default_page_size: number; server_side: boolean };
  column_format?: Record<string, string>;
  width?: number;
}

export interface ColumnDef {
  key: string;
  label: string;
  format?: 'text' | 'number' | 'currency' | 'percent' | 'datetime' | 'date';
  width?: number;
  align?: 'left' | 'right';
}

export interface ChartNode {
  type: 'chart';
  chart_type: 'line' | 'bar' | 'area' | 'pie';
  title: string;
  data_source: string;
  x: string;
  y: string | string[];
  series?: string;
  height?: number;
  width?: number;
  stacked?: boolean;
  horizontal?: boolean;
  donut?: boolean;
  color_override?: Record<string, string>;
}

export interface TableNodeExtended extends TableNode {
  aggregations?: Record<string, 'sum' | 'count' | 'avg' | 'min' | 'max'>;
}

// --- Query Response (from POST /api/dashboard/{slug}/query) ---

export interface DashboardQueryResponse {
  data_sources: Record<string, DataSourceResult>;
  computed: Record<string, number | string | null>;
  filter_options: Record<string, string[]>;
  queried_at: string;
}

export interface DataSourceResult {
  status: 'ok' | 'error';
  columns?: string[];
  rows?: Record<string, unknown>[];
  total_rows?: number;
  page?: number;
  page_size?: number;
  error?: string;
  error_type?: string;
}

// --- Filter + Pagination State ---

export interface PaginationState {
  page: number;
  page_size: number;
  sort_column?: string;
  sort_direction?: 'asc' | 'desc';
}

// --- Pagination Endpoint ---

export interface PageRequest {
  data_source: string;
  filters: Record<string, unknown>;
  page: number;
  page_size: number;
  sort_column?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface PageResponse {
  status: 'ok' | 'error';
  columns?: string[];
  rows?: Record<string, unknown>[];
  total_rows?: number;
  page?: number;
  page_size?: number;
  queried_at?: string;
  error?: string;
}

// --- Dashboard Index ---

export interface DashboardSummary {
  slug: string;
  title: string;
  description?: string;
}
