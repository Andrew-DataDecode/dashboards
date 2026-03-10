import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('echarts', () => {
  const instance = {
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  }
  return {
    default: { init: vi.fn(() => instance) },
    init: vi.fn(() => instance),
  }
})

vi.mock('../../../utils/chartDefaults', () => ({
  buildChartOptions: vi.fn(() => ({ series: [{ type: 'pie' }] })),
  CATEGORICAL_PALETTE: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7'],
}))

import PiePanel from './PiePanel'
import { buildChartOptions } from '../../../utils/chartDefaults'
import type { ChartNode } from '../../../types/dashboard'

const pieConfig: ChartNode = {
  type: 'chart',
  chart_type: 'pie',
  title: 'Test Pie',
  data_source: 'test',
  x: 'category',
  y: 'value',
}

describe('PiePanel', () => {
  beforeEach(() => vi.clearAllMocks())

  test('renders as donut by default', () => {
    const data = [
      { category: 'A', value: 50 },
      { category: 'B', value: 30 },
      { category: 'C', value: 20 },
    ]
    render(<PiePanel config={pieConfig} data={data} />)
    expect(buildChartOptions).toHaveBeenCalledWith(
      expect.objectContaining({ donut: true }),
      data,
    )
  })

  test('renders as pie when donut=false', () => {
    const data = [
      { category: 'A', value: 50 },
      { category: 'B', value: 30 },
    ]
    render(<PiePanel config={{ ...pieConfig, donut: false }} data={data} />)
    expect(buildChartOptions).toHaveBeenCalledWith(
      expect.objectContaining({ donut: false }),
      data,
    )
  })

  test('buckets small slices into Other when > 6 slices', () => {
    const data = [
      { category: 'A', value: 100 },
      { category: 'B', value: 90 },
      { category: 'C', value: 80 },
      { category: 'D', value: 70 },
      { category: 'E', value: 60 },
      { category: 'F', value: 50 },
      { category: 'G', value: 1 },
      { category: 'H', value: 1 },
    ]
    render(<PiePanel config={pieConfig} data={data} />)
    // buildChartOptions should receive bucketed data with <= 6 items
    const call = (buildChartOptions as ReturnType<typeof vi.fn>).mock.calls[0]
    const processedData = call[1] as Record<string, unknown>[]
    expect(processedData.length).toBeLessThanOrEqual(6)
    const hasOther = processedData.some((d) => d.category === 'Other')
    expect(hasOther).toBe(true)
  })

  test('does not bucket when <= 6 slices', () => {
    const data = [
      { category: 'A', value: 50 },
      { category: 'B', value: 30 },
      { category: 'C', value: 20 },
    ]
    render(<PiePanel config={pieConfig} data={data} />)
    const call = (buildChartOptions as ReturnType<typeof vi.fn>).mock.calls[0]
    const processedData = call[1] as Record<string, unknown>[]
    expect(processedData.length).toBe(3)
  })

  test('renders empty state with no data', () => {
    const { container } = render(<PiePanel config={pieConfig} data={[]} />)
    expect(container.textContent).toContain('No data')
  })
})
