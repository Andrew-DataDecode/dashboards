import type { DashboardConfig, DashboardQueryResponse, PaginationState } from '../types/dashboard';

export class DashboardApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`Dashboard API error ${status}: ${body}`);
  }
}

export async function fetchDashboardConfig(
  slug: string,
  getToken: () => Promise<string | null>,
): Promise<DashboardConfig> {
  const token = await getToken();
  const res = await fetch(`/api/dashboard/${slug}/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new DashboardApiError(res.status, await res.text());
  return res.json();
}

export async function queryDashboard(
  slug: string,
  filters: Record<string, unknown>,
  pagination: Record<string, PaginationState>,
  getToken: () => Promise<string | null>,
  dataSource?: string,
): Promise<DashboardQueryResponse> {
  const token = await getToken();
  const res = await fetch(`/api/dashboard/${slug}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filters, pagination, data_source: dataSource }),
  });
  if (!res.ok) throw new DashboardApiError(res.status, await res.text());
  return res.json();
}
