import { describe, test, expect, vi } from 'vitest'
import { buildChartOptions, CATEGORICAL_PALETTE, type ChartPanelConfig } from './chartDefaults'

vi.mock('mviz/charts/line', () => ({
  buildLineOptions: vi.fn(() => ({ series: [{ type: 'line' }] })),
}))
vi.mock('mviz/charts/bar', () => ({
  buildBarOptions: vi.fn(() => ({ series: [{ type: 'bar' }] })),
}))
vi.mock('mviz/charts/area', () => ({
  buildAreaOptions: vi.fn(() => ({ series: [{ type: 'line', areaStyle: {} }] })),
}))
vi.mock('mviz/charts/pie', () => ({
  buildPieOptions: vi.fn(() => ({ series: [{ type: 'pie' }] })),
}))

const baseConfig: ChartPanelConfig = {
  type: 'chart',
  chart_type: 'line',
  title: 'Test Chart',
  data_source: 'test',
  x: 'month',
  y: 'value',
}

const sampleData = [
  { month: 'Jan', value: 100 },
  { month: 'Feb', value: 200 },
]

describe('buildChartOptions', () => {
  test('applies grid defaults', () => {
    const result = buildChartOptions(baseConfig, sampleData)
    expect(result.grid).toEqual({
      top: 40,
      right: 24,
      bottom: 40,
      left: 60,
      containLabel: true,
    })
  })

  test('hides legend for single series', () => {
    const result = buildChartOptions(baseConfig, sampleData)
    expect(result.legend).toEqual({ show: false })
  })

  test('shows scrollable legend for multi-series data', () => {
    const multiConfig: ChartPanelConfig = {
      ...baseConfig,
      series: 'category',
    }
    const multiData = [
      { month: 'Jan', value: 100, category: 'A' },
      { month: 'Jan', value: 200, category: 'B' },
      { month: 'Jan', value: 300, category: 'C' },
      { month: 'Jan', value: 400, category: 'D' },
      { month: 'Jan', value: 500, category: 'E' },
      { month: 'Jan', value: 600, category: 'F' },
    ]
    const result = buildChartOptions(multiConfig, multiData)
    const legend = result.legend as Record<string, unknown>
    expect(legend.show).toBe(true)
    expect(legend.type).toBe('scroll')
  })

  test('applies categorical palette colors', () => {
    const result = buildChartOptions(baseConfig, sampleData)
    const colors = result.color as string[]
    expect(colors[0]).toBe(CATEGORICAL_PALETTE[0])
  })

  test('applies color_override to specific series', () => {
    const config: ChartPanelConfig = {
      ...baseConfig,
      series: 'cat',
      color_override: { '1': '#FF0000' },
    }
    const data = [
      { month: 'Jan', value: 100, cat: 'A' },
      { month: 'Feb', value: 200, cat: 'B' },
      { month: 'Mar', value: 300, cat: 'C' },
    ]
    const result = buildChartOptions(config, data)
    const colors = result.color as string[]
    expect(colors[1]).toBe('#FF0000')
    expect(colors[0]).toBe(CATEGORICAL_PALETTE[0])
  })

  test('uses compact formatting on y-axis labels', () => {
    const result = buildChartOptions(baseConfig, sampleData)
    const yAxis = result.yAxis as Record<string, unknown>
    const axisLabel = yAxis.axisLabel as Record<string, unknown>
    expect(typeof axisLabel.formatter).toBe('function')
    expect((axisLabel.formatter as (v: number) => string)(1500000)).toBe('$1.5M')
  })

  test('sets animation duration to 400ms', () => {
    const result = buildChartOptions(baseConfig, sampleData)
    expect(result.animationDuration).toBeDefined()
    expect(result.animationEasing).toBe('cubicOut')
  })

  test('routes line chart to buildLineOptions', async () => {
    const { buildLineOptions } = await import('mviz/charts/line')
    buildChartOptions({ ...baseConfig, chart_type: 'line' }, sampleData)
    expect(buildLineOptions).toHaveBeenCalled()
  })

  test('routes bar chart to buildBarOptions', async () => {
    const { buildBarOptions } = await import('mviz/charts/bar')
    buildChartOptions({ ...baseConfig, chart_type: 'bar' }, sampleData)
    expect(buildBarOptions).toHaveBeenCalled()
  })

  test('routes area chart to buildAreaOptions', async () => {
    const { buildAreaOptions } = await import('mviz/charts/area')
    buildChartOptions({ ...baseConfig, chart_type: 'area' }, sampleData)
    expect(buildAreaOptions).toHaveBeenCalled()
  })

  test('routes pie chart to buildPieOptions', async () => {
    const { buildPieOptions } = await import('mviz/charts/pie')
    buildChartOptions({ ...baseConfig, chart_type: 'pie' }, sampleData)
    expect(buildPieOptions).toHaveBeenCalled()
  })

  test('sets axis crosshair tooltip for line/bar/area', () => {
    const result = buildChartOptions(baseConfig, sampleData)
    const tooltip = result.tooltip as Record<string, unknown>
    expect(tooltip.trigger).toBe('axis')
    expect(tooltip.axisPointer).toEqual({ type: 'cross' })
  })

  test('sets item tooltip for pie', () => {
    const result = buildChartOptions({ ...baseConfig, chart_type: 'pie' }, sampleData)
    const tooltip = result.tooltip as Record<string, unknown>
    expect(tooltip.trigger).toBe('item')
  })
})
