import type { ProcessData, MetricData, MetricTreeConfig, RAGStatus } from '../types/index.ts';

export async function loadProcess(id: string): Promise<ProcessData> {
  const response = await fetch(`/data/processes/${id}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load process: ${id}`);
  }
  return response.json() as Promise<ProcessData>;
}

export async function loadMetrics(): Promise<Record<string, MetricData>> {
  const response = await fetch('/data/mockMetrics.json');
  if (!response.ok) {
    throw new Error('Failed to load metrics');
  }
  return response.json() as Promise<Record<string, MetricData>>;
}

export async function loadMetricTree(id: string): Promise<MetricTreeConfig> {
  const response = await fetch(`/data/metricTrees/${id}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load metric tree: ${id}`);
  }
  return response.json() as Promise<MetricTreeConfig>;
}

export function getMetricValue(data: Record<string, unknown>, path: string): MetricData | null {
  if (!data || !path) return null;

  const keys = path.split('.');
  let current: unknown = data;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }

  return current as MetricData;
}

export function calculateWoW(current: number, previous: number): number {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function calculateMoM(monthlyData: number[]): number {
  if (!monthlyData || monthlyData.length < 2) return 0;

  const current = monthlyData[monthlyData.length - 1];
  const previous = monthlyData[monthlyData.length - 2];

  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function calculateYoY(yoyData: number[]): number {
  if (!yoyData || yoyData.length < 2) return 0;

  const previous = yoyData[0];
  const current = yoyData[1];

  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function getRAGStatus(wowChange: number, thresholds: { green: number; yellow: number } | undefined): RAGStatus {
  if (!thresholds) return 'yellow';

  if (wowChange >= thresholds.green) {
    return 'green';
  } else if (wowChange >= thresholds.yellow) {
    return 'yellow';
  } else {
    return 'red';
  }
}

export function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return 'N/A';

  const formattedNumber = typeof value === 'number'
    ? value.toFixed(value % 1 === 0 ? 0 : 1)
    : String(value);

  if (!unit) return formattedNumber;

  const prefixUnits = ['$', '£', '€', '¥'];

  if (prefixUnits.includes(unit)) {
    return `${unit}${formattedNumber}`;
  } else {
    return `${formattedNumber}${unit}`;
  }
}
