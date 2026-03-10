import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Box, Flex, Heading } from '@chakra-ui/react';
import { fetchDashboardConfig, queryDashboard, DashboardApiError } from '../api/dashboard';
import { downloadCsv, downloadXlsx } from '../api/exportDashboard';
import { useFilterState } from '../hooks/useFilterState';
import type { DashboardConfig, DashboardQueryResponse, PaginationState, LayoutNode, TableNodeExtended } from '../types/dashboard';
import FilterBar from '../components/Dashboard/filters/FilterBar';
import DashboardGrid from '../components/Dashboard/DashboardGrid';
import PageTabs from '../components/Dashboard/PageTabs';

function buildInitialPagination(layout: LayoutNode[]): Record<string, PaginationState> {
  const result: Record<string, PaginationState> = {};
  function walk(nodes: LayoutNode[]) {
    for (const node of nodes) {
      if (node.type === 'table') {
        const tn = node as TableNodeExtended;
        result[tn.data_source] = {
          page: 1,
          page_size: tn.pagination?.default_page_size ?? 50,
          sort_column: tn.default_sort?.column,
          sort_direction: tn.default_sort?.direction,
        };
      }
      if ('children' in node && Array.isArray((node as Record<string, unknown>).children)) {
        walk((node as { children: LayoutNode[] }).children);
      }
    }
  }
  walk(layout);
  return result;
}

export default function DashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { getToken } = useAuth();

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [data, setData] = useState<DashboardQueryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterValues, setFilter] = useFilterState(config);
  const [pagination, setPagination] = useState<Record<string, PaginationState>>({});
  const [activePage, setActivePage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function loadConfig() {
      try {
        const cfg = await fetchDashboardConfig(slug!, getToken);
        if (!cancelled) {
          setConfig(cfg);
          const allLayouts = cfg.pages?.flatMap(p => p.layout) ?? cfg.layout;
          setPagination(buildInitialPagination(allLayouts));
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof DashboardApiError && err.status === 404
            ? 'Dashboard not found'
            : 'Failed to load dashboard configuration';
          setError(msg);
          setLoading(false);
        }
      }
    }

    loadConfig();
    return () => { cancelled = true; };
  }, [slug, getToken]);

  const runQuery = useCallback(
    async (pag?: Record<string, PaginationState>, dataSource?: string) => {
      if (!slug || !config) return;
      setLoading(true);
      try {
        const result = await queryDashboard(
          slug,
          filterValues,
          pag ?? pagination,
          getToken,
          dataSource,
        );
        setData(result);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [slug, config, filterValues, pagination, getToken],
  );

  useEffect(() => {
    if (config?.pages?.length && !activePage) {
      setActivePage(config.pages[0].id);
    }
  }, [config, activePage]);

  const activeLayout = useMemo(() => {
    if (!config) return [];
    if (config.pages?.length && activePage) {
      const page = config.pages.find((p) => p.id === activePage);
      return page?.layout ?? config.layout;
    }
    return config.layout;
  }, [config, activePage]);

  useEffect(() => {
    if (config) runQuery();
  }, [config, filterValues]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = useCallback(
    (dataSource: string, column: string, direction: 'asc' | 'desc') => {
      const updated = {
        ...pagination,
        [dataSource]: {
          ...(pagination[dataSource] ?? { page: 1, page_size: 50 }),
          sort_column: column,
          sort_direction: direction,
          page: 1,
        },
      };
      setPagination(updated);
      runQuery(updated, dataSource);
    },
    [pagination, runQuery],
  );

  const handlePageChange = useCallback(
    (dataSource: string, page: number) => {
      const updated = {
        ...pagination,
        [dataSource]: {
          ...(pagination[dataSource] ?? { page: 1, page_size: 50 }),
          page,
        },
      };
      setPagination(updated);
      runQuery(updated, dataSource);
    },
    [pagination, runQuery],
  );

  function formatRelativeTime(queriedAt: string): string {
    const diffMinutes = Math.floor((now - new Date(queriedAt).getTime()) / 60000);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    return `${Math.floor(diffMinutes / 60)} hours ago`;
  }

  if (!slug) {
    return <Box p="8" color="text.secondary" textAlign="center">No dashboard selected.</Box>;
  }

  if (error) {
    return <Box p="8" color="status.red" textAlign="center">{error}</Box>;
  }

  return (
    <Flex h="calc(100vh - 56px)" bg="bg.page">
      {config && (
        <>
          {config.pages && config.pages.length > 1 && activePage && (
            <PageTabs
              title={config.title}
              pages={config.pages}
              activePage={activePage}
              onPageChange={setActivePage}
            />
          )}
          <Box flex="1" minW="0" overflowY="auto">
            <Flex align="baseline" justify="space-between" px="6" pt="6">
              {!(config.pages && config.pages.length > 1) && (
                <Heading size="lg" color="text.primary" fontWeight="600" fontSize="22px">
                  {config.title}
                </Heading>
              )}
              {data?.queried_at && (
                <Box as="span" fontSize="12px" color="text.secondary" title={data.queried_at} ml="auto">
                  Data as of {formatRelativeTime(data.queried_at)}
                </Box>
              )}
            </Flex>
            <FilterBar
              filters={config.filters}
              filterValues={filterValues}
              filterOptions={data?.filter_options ?? {}}
              onChange={setFilter}
            />
            <DashboardGrid
              layout={activeLayout}
              data={data}
              computed={data?.computed ?? {}}
              pagination={pagination}
              onSort={handleSort}
              onPageChange={handlePageChange}
              onRetry={() => runQuery()}
              loading={loading}
              onExportCsv={(sourceId) => downloadCsv(slug!, sourceId, filterValues, getToken)}
              onExportXlsx={(sourceId) => downloadXlsx(slug!, sourceId, filterValues, getToken)}
            />
          </Box>
        </>
      )}
      {!config && loading && (
        <Box p="8" color="text.secondary" textAlign="center" flex="1">Loading...</Box>
      )}
    </Flex>
  );
}
