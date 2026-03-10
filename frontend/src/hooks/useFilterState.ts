import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DashboardConfig, FilterConfig } from '../types/dashboard';

function resolveDateToken(val: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (val === 'today') return today;
  if (val === 'current_month_start') return today.slice(0, 7) + '-01';
  return val;
}

function resolveDefault(def: unknown): unknown {
  if (def && typeof def === 'object' && 'start' in (def as Record<string, unknown>)) {
    const d = def as Record<string, string>;
    return {
      start: resolveDateToken(d.start),
      end: resolveDateToken(d.end),
    };
  }
  if (Array.isArray(def)) {
    return def.map((v) => (typeof v === 'string' ? resolveDateToken(v) : v));
  }
  return def;
}

function parseFromUrl(
  params: URLSearchParams,
  filters: Record<string, FilterConfig>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const [id, def] of Object.entries(filters)) {
    switch (def.type) {
      case 'date_range': {
        const start = params.get(`${id}_start`);
        const end = params.get(`${id}_end`);
        if (start || end) {
          values[id] = { start: start ?? '', end: end ?? '' };
        } else {
          values[id] = resolveDefault(def.default);
        }
        break;
      }
      case 'multiselect': {
        const raw = params.get(id);
        if (raw) {
          values[id] = raw.split(',').filter(Boolean);
        } else {
          values[id] = resolveDefault(def.default) ?? [];
        }
        break;
      }
      case 'text': {
        const raw = params.get(id);
        values[id] = raw ?? resolveDefault(def.default) ?? '';
        break;
      }
    }
  }

  return values;
}

function serializeToUrl(
  values: Record<string, unknown>,
  filters: Record<string, FilterConfig>,
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [id, def] of Object.entries(filters)) {
    const val = values[id];
    if (val === undefined || val === null) continue;

    switch (def.type) {
      case 'date_range': {
        const dr = val as { start: string; end: string };
        if (dr.start) params[`${id}_start`] = dr.start;
        if (dr.end) params[`${id}_end`] = dr.end;
        break;
      }
      case 'multiselect': {
        const arr = val as string[];
        if (arr.length > 0) params[id] = arr.join(',');
        break;
      }
      case 'text': {
        if (val) params[id] = String(val);
        break;
      }
    }
  }

  return params;
}

export function useFilterState(
  config: DashboardConfig | null,
): [Record<string, unknown>, (filterId: string, value: unknown) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const filterValues = useMemo(() => {
    if (!config) return {};
    return parseFromUrl(searchParams, config.filters);
  }, [searchParams, config]);

  const setFilter = useCallback(
    (filterId: string, value: unknown) => {
      if (!config) return;
      const updated = { ...filterValues, [filterId]: value };
      const serialized = serializeToUrl(updated, config.filters);
      setSearchParams(serialized, { replace: true });
    },
    [config, filterValues, setSearchParams],
  );

  return [filterValues, setFilter];
}
