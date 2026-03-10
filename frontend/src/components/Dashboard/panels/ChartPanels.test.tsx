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
  buildChartOptions: vi.fn(() => ({ series: [] })),
  CATEGORICAL_PALETTE: ['#4E79A7'],
}))

import LinePanel from './LinePanel'
import BarPanel from './BarPanel'
import AreaPanel from './AreaPanel'
import * as echarts from 'echarts'
import { buildChartOptions } from '../../../utils/chartDefaults'
import type { ChartNode } from '../../../types/dashboard'

const baseConfig: ChartNode = {
  type: 'chart',
  chart_type: 'line',
  title: 'Test',
  data_source: 'test',
  x: 'month',
  y: 'value',
}

const sampleData = [
  { month: 'Jan', value: 100 },
  { month: 'Feb', value: 200 },
]

describe('LinePanel', () => {
  beforeEach(() => vi.clearAllMocks())

  test('initializes echarts and calls setOption', () => {
    render(<LinePanel config={baseConfig} data={sampleData} />)
    expect(echarts.init).toHaveBeenCalled()
    const instance = (echarts.init as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(instance.setOption).toHaveBeenCalled()
  })

  test('calls buildChartOptions with line chart_type', () => {
    render(<LinePanel config={baseConfig} data={sampleData} />)
    expect(buildChartOptions).toHaveBeenCalledWith(
      expect.objectContaining({ chart_type: 'line' }),
      sampleData,
    )
  })

  test('renders nothing with empty data', () => {
    const { container } = render(<LinePanel config={baseConfig} data={[]} />)
    expect(container.textContent).toContain('No data')
  })

  test('disposes on unmount', () => {
    const { unmount } = render(<LinePanel config={baseConfig} data={sampleData} />)
    const instance = (echarts.init as ReturnType<typeof vi.fn>).mock.results[0].value
    unmount()
    expect(instance.dispose).toHaveBeenCalled()
  })
})

describe('BarPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  test('calls buildChartOptions with bar chart_type', () => {
    render(<BarPanel config={{ ...baseConfig, chart_type: 'bar' }} data={sampleData} />)
    expect(buildChartOptions).toHaveBeenCalledWith(
      expect.objectContaining({ chart_type: 'bar' }),
      sampleData,
    )
  })

  test('renders empty state with no data', () => {
    const { container } = render(<BarPanel config={{ ...baseConfig, chart_type: 'bar' }} data={[]} />)
    expect(container.textContent).toContain('No data')
  })
})

describe('AreaPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  test('calls buildChartOptions with area chart_type', () => {
    render(<AreaPanel config={{ ...baseConfig, chart_type: 'area' }} data={sampleData} />)
    expect(buildChartOptions).toHaveBeenCalledWith(
      expect.objectContaining({ chart_type: 'area' }),
      sampleData,
    )
  })

  test('renders empty state with no data', () => {
    const { container } = render(<AreaPanel config={{ ...baseConfig, chart_type: 'area' }} data={[]} />)
    expect(container.textContent).toContain('No data')
  })
})
