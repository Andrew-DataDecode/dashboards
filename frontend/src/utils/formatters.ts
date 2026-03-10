export function formatCompact(value: number | null | undefined, format?: string): string {
  if (value === null || value === undefined) return '--';

  if (format === 'percent') return `${value.toFixed(1)}%`;

  const prefix = format === 'currency' ? '$' : '';
  const abs = Math.abs(value);

  if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
  if (format === 'currency') return `${prefix}${value.toFixed(2)}`;
  return value.toLocaleString();
}

export function formatBigValue(
  value: number | null | undefined,
  format?: string,
  display: 'compact' | 'full' = 'compact',
  decimals?: number,
): string {
  if (value === null || value === undefined) return '--';
  if (display === 'compact') return formatCompact(value, format);

  const d = decimals ?? (format === 'currency' ? 2 : 0);
  const prefix = format === 'currency' ? '$' : '';
  if (format === 'percent') return `${value.toFixed(d)}%`;
  return `${prefix}${value.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function formatFull(value: unknown, format?: string): string {
  if (value === null || value === undefined) return '--';

  switch (format) {
    case 'currency':
      return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'number':
      return Number(value).toLocaleString('en-US');
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'datetime':
      return new Date(value as string).toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      });
    case 'date':
      return new Date(value as string).toLocaleDateString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
    default:
      return String(value);
  }
}
