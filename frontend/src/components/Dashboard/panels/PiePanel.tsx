import { useMemo } from 'react'
import { useECharts } from '../../../hooks/useECharts'
import { buildChartOptions } from '../../../utils/chartDefaults'
import type { ChartNode } from '../../../types/dashboard'

interface PiePanelProps {
  config: ChartNode
  data: Record<string, unknown>[]
}

function bucketSmallSlices(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): Record<string, unknown>[] {
  if (data.length <= 6) return data

  const sorted = [...data].sort(
    (a, b) => Number(b[yKey] ?? 0) - Number(a[yKey] ?? 0),
  )
  const total = sorted.reduce((sum, d) => sum + Number(d[yKey] ?? 0), 0)
  const threshold = total * 0.03

  const kept: Record<string, unknown>[] = []
  let otherSum = 0

  for (const row of sorted) {
    const val = Number(row[yKey] ?? 0)
    if (kept.length < 5 && val >= threshold) {
      kept.push(row)
    } else {
      otherSum += val
    }
  }

  if (otherSum > 0) {
    kept.push({ [xKey]: 'Other', [yKey]: otherSum })
  }

  return kept
}

export default function PiePanel({ config, data }: PiePanelProps) {
  const processedData = useMemo(() => {
    if (!data?.length) return []
    const yKey = Array.isArray(config.y) ? config.y[0] : config.y
    return bucketSmallSlices(data, config.x, yKey)
  }, [data, config.x, config.y])

  const options = useMemo(() => {
    if (!processedData.length) return null
    const baseOptions = buildChartOptions(
      { ...config, chart_type: 'pie', donut: config.donut !== false },
      processedData,
    )
    const donut = config.donut !== false
    return {
      ...baseOptions,
      series: [{
        ...(Array.isArray(baseOptions.series) ? baseOptions.series[0] : baseOptions.series || {}),
        type: 'pie',
        radius: donut ? ['50%', '75%'] : ['0%', '75%'],
        label: { position: 'outside', show: true },
        labelLine: { show: true },
      }],
    }
  }, [config, processedData])

  const { chartRef, height } = useECharts(options, config.height)

  if (!data?.length) {
    return <div className="chart-panel__empty">No data</div>
  }

  return <div ref={chartRef} role="img" aria-label={config.title} style={{ width: '100%', height }} />
}
