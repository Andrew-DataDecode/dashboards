import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export function useECharts(
  options: Record<string, unknown> | null,
  height: number = 400,
) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current || !options) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    chartInstance.current.setOption(options, true)

    const observer = new ResizeObserver(() => {
      chartInstance.current?.resize()
    })
    observer.observe(chartRef.current)

    return () => {
      observer.disconnect()
      chartInstance.current?.dispose()
      chartInstance.current = null
    }
  }, [options])

  return { chartRef, height }
}
