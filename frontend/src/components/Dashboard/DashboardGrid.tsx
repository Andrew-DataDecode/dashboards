import { useState } from 'react';
import { Box, Flex, Grid, GridItem, Heading, Button } from '@chakra-ui/react';
import type {
  LayoutNode,
  DashboardQueryResponse,
  PaginationState,
  BigValueNode,
  ChartNode,
  TableNodeExtended,
} from '../../types/dashboard';
import PanelWrapper from './PanelWrapper';
import BigValuePanel from './panels/BigValuePanel';
import TablePanel from './panels/TablePanel';
import LinePanel from './panels/LinePanel';
import BarPanel from './panels/BarPanel';
import AreaPanel from './panels/AreaPanel';
import PiePanel from './panels/PiePanel';

interface DashboardGridProps {
  layout: LayoutNode[];
  data: DashboardQueryResponse | null;
  computed: Record<string, number | string | null>;
  pagination: Record<string, PaginationState>;
  onSort: (dataSource: string, column: string, direction: 'asc' | 'desc') => void;
  onPageChange: (dataSource: string, page: number) => void;
  onRetry: () => void;
  loading: boolean;
  onExportCsv?: (sourceId: string) => Promise<void>;
  onExportXlsx?: (sourceId: string) => Promise<void>;
}

function resolveComputed(valueRef: string, computed: Record<string, number | string | null>): number | string | null {
  if (valueRef.startsWith('$computed.')) {
    const key = valueRef.slice('$computed.'.length);
    return computed[key] ?? null;
  }
  if (valueRef.startsWith('$computed_source.')) {
    const parts = valueRef.slice('$computed_source.'.length).split('.');
    if (parts.length >= 3 && parts[1] === '_metrics') {
      const key = `${parts[0]}._metrics.${parts.slice(2).join('.')}`;
      return computed[key] ?? null;
    }
  }
  return valueRef;
}

function titleCase(key: string): string {
  if (/^\d+$/.test(key)) return key;
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function deriveAutoColumns(rows: Record<string, unknown>[], columnFormat?: Record<string, string>): import('../../types/dashboard').ColumnDef[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map(key => ({
    key,
    label: titleCase(key),
    format: (columnFormat?.[key] as import('../../types/dashboard').ColumnDef['format']) ?? undefined,
  }));
}

function renderNode(
  node: LayoutNode,
  props: DashboardGridProps,
  index: number,
): React.JSX.Element {
  switch (node.type) {
    case 'section':
      return (
        <GridItem key={index} colSpan={{ base: 1, md: 2, lg: 12 }}>
          {node.title && (
            <Heading size="md" color="text.primary" mb="3" mt={index > 0 ? "6" : "0"}>
              {node.title}
            </Heading>
          )}
          <Flex direction="column" gap="6">
            {node.children.map((child, i) => renderNode(child, props, i))}
          </Flex>
        </GridItem>
      );
    case 'row':
      return (
        <Grid
          key={index}
          templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(12, 1fr)" }}
          gap="6"
        >
          {node.children.map((child, i) => renderNode(child, props, i))}
        </Grid>
      );
    case 'big_value': {
      const bv = node as BigValueNode;
      const value = resolveComputed(bv.value, props.computed);
      return (
        <GridItem
          key={index}
          as="section"
          role="region"
          aria-label={bv.title}
          colSpan={{ base: 1, md: 1, lg: bv.width ?? 3 }}
        >
          <BigValuePanel title={bv.title} value={value} format={bv.format} display={bv.display} decimals={bv.decimals} loading={props.loading} />
        </GridItem>
      );
    }
    case 'table': {
      const tn = node as TableNodeExtended;
      const ds = props.data?.data_sources[tn.data_source];
      const dsError = ds?.status === 'error'
        ? { error: ds.error ?? 'Unknown error', error_type: ds.error_type ?? 'error' }
        : undefined;
      const pag = props.pagination[tn.data_source] ?? {
        page: 1,
        page_size: tn.pagination?.default_page_size ?? 50,
      };
      const tableRows = ds?.rows ?? [];
      const resolvedColumns = tn.columns === 'auto'
        ? deriveAutoColumns(tableRows, tn.column_format)
        : tn.columns;
      const exportActions = (props.onExportCsv || props.onExportXlsx) ? (
        <ExportButtons
          onExportCsv={props.onExportCsv ? () => props.onExportCsv!(tn.data_source) : undefined}
          onExportXlsx={props.onExportXlsx ? () => props.onExportXlsx!(tn.data_source) : undefined}
        />
      ) : undefined;
      return (
        <GridItem
          key={index}
          as="section"
          role="region"
          aria-label={tn.title}
          colSpan={{ base: 1, md: 2, lg: tn.width ?? 12 }}
        >
          <PanelWrapper
            title={tn.title}
            loading={props.loading}
            error={dsError}
            onRetry={props.onRetry}
            headerActions={exportActions}
          >
            <TablePanel
              title={tn.title}
              columns={resolvedColumns}
              rows={tableRows}
              totalRows={ds?.total_rows}
              pagination={pag}
              defaultSort={tn.default_sort}
              onSort={(col, dir) => props.onSort(tn.data_source, col, dir)}
              onPageChange={(page) => props.onPageChange(tn.data_source, page)}
              aggregations={tn.aggregations}
            />
          </PanelWrapper>
        </GridItem>
      );
    }
    case 'chart': {
      const cn = node as ChartNode;
      const ds = props.data?.data_sources[cn.data_source];
      const dsError = ds?.status === 'error'
        ? { error: ds.error ?? 'Unknown error', error_type: ds.error_type ?? 'error' }
        : undefined;
      const chartData = ds?.rows ?? [];
      const ChartComponent =
        cn.chart_type === 'pie' ? PiePanel
        : cn.chart_type === 'bar' ? BarPanel
        : cn.chart_type === 'area' ? AreaPanel
        : LinePanel;
      return (
        <GridItem
          key={index}
          as="section"
          role="region"
          aria-label={cn.title}
          colSpan={{ base: 1, md: 2, lg: cn.width ?? 12 }}
        >
          <PanelWrapper
            title={cn.title}
            loading={props.loading}
            error={dsError}
            onRetry={props.onRetry}
          >
            <ChartComponent config={cn} data={chartData} />
          </PanelWrapper>
        </GridItem>
      );
    }
    default:
      return <Box key={index} />;
  }
}

function ExportButtons({ onExportCsv, onExportXlsx }: { onExportCsv?: () => Promise<void>; onExportXlsx?: () => Promise<void> }) {
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  async function handle(type: 'csv' | 'xlsx') {
    const fn = type === 'csv' ? onExportCsv : onExportXlsx;
    if (!fn || exporting) return;
    setExporting(type);
    try { await fn(); } finally { setExporting(null); }
  }
  return (
    <>
      {onExportCsv && (
        <Button variant="outline" size="xs" disabled={exporting !== null} onClick={() => handle('csv')} borderColor="border.default" color="text.secondary" fontSize="12px">
          {exporting === 'csv' ? 'Exporting...' : 'CSV'}
        </Button>
      )}
      {onExportXlsx && (
        <Button variant="outline" size="xs" disabled={exporting !== null} onClick={() => handle('xlsx')} borderColor="border.default" color="text.secondary" fontSize="12px">
          {exporting === 'xlsx' ? 'Exporting...' : 'Excel'}
        </Button>
      )}
    </>
  );
}

export default function DashboardGrid(props: DashboardGridProps) {
  return (
    <Grid
      templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(12, 1fr)" }}
      gap="6"
      p="6"
    >
      {props.layout.map((node, i) => renderNode(node, props, i))}
    </Grid>
  );
}
