import { buildLineOptions } from 'mviz/charts/line'
import { buildBarOptions } from 'mviz/charts/bar'
import { buildAreaOptions } from 'mviz/charts/area'
import { buildPieOptions } from 'mviz/charts/pie'
import type { ChartSpec as MvizChartSpec } from 'mviz'
import { formatCompact } from './formatters'

export const CATEGORICAL_PALETTE = [
  '#7f56d9', '#2f1868', '#475467', '#059669',
  '#fec84b', '#E15759', '#4E79A7', '#76B7B2',
]

export interface ChartPanelConfig {
  type: 'chart'
  chart_type: 'line' | 'bar' | 'area' | 'pie'
  title: string
  data_source: string
  x: string
  y: string | string[]
  series?: string
  height?: number
  width?: number
  stacked?: boolean
  horizontal?: boolean
  donut?: boolean
  color_override?: Record<string, string>
}

type EChartsOption = Record<string, unknown>

function deepMerge(target: EChartsOption, source: EChartsOption): EChartsOption {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as EChartsOption,
        source[key] as EChartsOption,
      )
    } else {
      result[key] = source[key]
    }
  }
  return result
}

export function toMvizSpec(
  panel: ChartPanelConfig,
  data: Record<string, unknown>[],
): MvizChartSpec {
  return {
    type: panel.chart_type,
    data,
    x: panel.x,
    y: panel.y,
    title: panel.title,
    series: panel.series,
    stacked: panel.stacked,
    horizontal: panel.horizontal,
    donut: panel.donut,
  } as MvizChartSpec
}

function getSeriesCount(
  panel: ChartPanelConfig,
  data: Record<string, unknown>[],
): number {
  if (panel.series) {
    const unique = new Set(data.map((d) => d[panel.series!]))
    return unique.size
  }
  return Array.isArray(panel.y) ? panel.y.length : 1
}

function buildPalette(
  panel: ChartPanelConfig,
  seriesCount: number,
): string[] {
  const colors = [...CATEGORICAL_PALETTE]
  if (panel.color_override) {
    for (const [idx, hex] of Object.entries(panel.color_override)) {
      const i = Number(idx)
      if (i >= 0 && i < colors.length) {
        colors[i] = hex
      }
    }
  }
  return colors.slice(0, Math.max(seriesCount, 1))
}

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function buildDefaults(
  panel: ChartPanelConfig,
  seriesCount: number,
): EChartsOption {
  const isPie = panel.chart_type === 'pie'
  const animationDuration = reducedMotion ? 0 : 400

  const defaults: EChartsOption = {
    color: buildPalette(panel, seriesCount),
    animation: true,
    animationDuration,
    animationEasing: 'cubicOut',
    grid: {
      top: 40,
      right: 24,
      bottom: 40,
      left: 60,
      containLabel: true,
    },
    tooltip: isPie
      ? { trigger: 'item', backgroundColor: '#fff', borderColor: '#E5E7EB' }
      : {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: '#fff',
          borderColor: '#E5E7EB',
        },
    legend:
      seriesCount <= 1
        ? { show: false }
        : {
            show: true,
            top: 0,
            left: 'center',
            type: seriesCount > 5 ? 'scroll' : 'plain',
          },
  }

  if (!isPie) {
    defaults.xAxis = {
      axisLabel: { color: '#6B7280', fontSize: 12 },
      axisTick: { show: false },
      splitLine: { show: false },
    }
    defaults.yAxis = {
      axisLabel: {
        color: '#6B7280',
        fontSize: 12,
        formatter: (v: number) => formatCompact(v),
      },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: '#F3F4F6' } },
    }
  }

  return defaults
}

export function buildChartOptions(
  panelConfig: ChartPanelConfig,
  data: Record<string, unknown>[],
): EChartsOption {
  const mvizSpec = toMvizSpec(panelConfig, data)

  let options: EChartsOption
  switch (panelConfig.chart_type) {
    case 'line':
      options = buildLineOptions(mvizSpec) as EChartsOption
      break
    case 'bar':
      options = buildBarOptions(mvizSpec) as EChartsOption
      break
    case 'area':
      options = buildAreaOptions(mvizSpec) as EChartsOption
      break
    case 'pie':
      options = buildPieOptions(mvizSpec) as EChartsOption
      break
    default:
      throw new Error(`Unknown chart type: ${(panelConfig as ChartPanelConfig).chart_type}`)
  }

  const seriesCount = getSeriesCount(panelConfig, data)
  const defaults = buildDefaults(panelConfig, seriesCount)

  const merged = deepMerge(options, defaults)

  merged.aria = {
    enabled: true,
    decal: { show: true },
  }

  // Add saveAsImage toolbox to all charts
  merged.toolbox = {
    show: true,
    right: 8,
    top: 0,
    feature: {
      saveAsImage: {
        type: 'png',
        pixelRatio: 2,
        name: panelConfig.title || 'chart',
        title: 'Download PNG',
        iconStyle: {
          borderColor: '#6B7280',
        },
        emphasis: {
          iconStyle: {
            borderColor: '#111827',
          },
        },
      },
    },
  }

  return merged
}
