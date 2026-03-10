import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { buildBarOptions } from 'mviz/charts/bar'
import { buildLineOptions } from 'mviz/charts/line'
import type { ChartSpec as MvizChartSpec } from 'mviz'
import type { ChartSpec } from './types/index.ts'

export interface ChartRendererProps {
  chartSpec: ChartSpec;
}

function ChartRenderer({ chartSpec }: ChartRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current || !chartSpec) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    try {
      if (chartSpec.type === 'big_value') {
        chartInstance.current.dispose()
        chartInstance.current = null
      } else if (chartSpec.type === 'line') {
        const options = buildLineOptions(chartSpec as unknown as MvizChartSpec)
        chartInstance.current.setOption(options, true)
      } else if (chartSpec.type === 'bar') {
        const options = buildBarOptions(chartSpec as unknown as MvizChartSpec)
        chartInstance.current.setOption(options, true)
      }
    } catch (error) {
      console.error('Chart rendering error:', error)
    }

    const currentRef = chartRef.current
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance.current) {
        chartInstance.current.resize()
      }
    })
    resizeObserver.observe(currentRef)

    return () => {
      resizeObserver.disconnect()
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
    }
  }, [chartSpec])

  if (!chartSpec) return null

  if (chartSpec.type === 'big_value') {
    const formatValue = (val: number | string) => {
      if (typeof val === 'number') {
        return val.toLocaleString('en-US', { maximumFractionDigits: 2 })
      }
      return val
    }

    return (
      <div className="chart-container big-value">
        <div className="big-value-label">{chartSpec.label || 'Value'}</div>
        <div className="big-value-number">{formatValue(chartSpec.value)}</div>
      </div>
    )
  }

  return <div ref={chartRef} className="chart-container" style={{ width: '100%', height: '400px' }} />
}

export default ChartRenderer
