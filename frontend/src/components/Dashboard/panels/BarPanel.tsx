import { useMemo } from 'react'
import { useECharts } from '../../../hooks/useECharts'
import { buildChartOptions } from '../../../utils/chartDefaults'
import type { ChartNode } from '../../../types/dashboard'

interface BarPanelProps {
  config: ChartNode
  data: Record<string, unknown>[]
}

export default function BarPanel({ config, data }: BarPanelProps) {
  const options = useMemo(() => {
    if (!data?.length) return null
    return buildChartOptions(
      { ...config, chart_type: 'bar' },
      data,
    )
  }, [config, data])

  const { chartRef, height } = useECharts(options, config.height)

  if (!data?.length) {
    return <div className="chart-panel__empty">No data</div>
  }

  return <div ref={chartRef} role="img" aria-label={config.title} style={{ width: '100%', height }} />
}
