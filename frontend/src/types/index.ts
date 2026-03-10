// --- Permissions ---
export interface RoutePermission {
  path: string;
  groups: string[];
}

export interface NavLinkConfig {
  path: string;
  label: string;
}

// --- Metrics ---
export interface MetricData {
  name: string;
  description?: string;
  formula?: string;
  current: number;
  previous: number;
  thresholds: { green: number; yellow: number };
  weeklyData: number[];
  monthlyData?: number[];
  yoyData?: number[];
  unit: string;
}

export type RAGStatus = 'green' | 'yellow' | 'red';

// --- Process Map ---
export interface ProcessStep {
  id: string;
  type: 'start' | 'end' | 'action' | 'decision';
  name: string;
  description?: string;
  branch?: string;
  nextStep?: string;
  branches?: Array<{ label: string; nextStep: string }>;
  stepMetrics?: string[];
  hasDetail?: boolean;
}

export interface ProcessData {
  name: string;
  description: string;
  processMetrics: Array<{ dataSource: string }>;
  steps: ProcessStep[];
}

// --- Metric Tree ---
export interface TreeNode {
  id: string;
  metric: string;
  children?: string[];
  operator?: string;
}

export interface MetricTreeConfig {
  name: string;
  description?: string;
  nodes: TreeNode[];
}

// --- Charts ---
export interface ChartSpecBigValue {
  type: 'big_value';
  label: string;
  value: number | string;
  format?: string;
}

export interface ChartSpecLine {
  type: 'line';
  title: string;
  x: string;
  y: string;
  series?: string;
  data: Record<string, unknown>[];
}

export interface ChartSpecBar {
  type: 'bar';
  title: string;
  x: string;
  y: string;
  data: Record<string, unknown>[];
}

export type ChartSpec = ChartSpecBigValue | ChartSpecLine | ChartSpecBar;

// --- Chat ---
export interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
  toolCalls?: ToolCall[];
  chartSpec?: ChartSpec;
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  result_preview?: string;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  tool_calls?: ToolCall[];
  chart_spec?: ChartSpec;
}

// --- Clerk metadata extension ---
export interface ClerkPublicMetadata {
  groups?: string[];
  allowedRoutes?: string[];
}
