/**
 * Format large numbers with K/M/B suffixes
 */
export function formatNumber(value: number, decimals: number = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e9) {
    return `${sign}${parseFloat((abs / 1e9).toFixed(decimals))}B`;
  }
  if (abs >= 1e6) {
    return `${sign}${parseFloat((abs / 1e6).toFixed(decimals))}M`;
  }
  if (abs >= 1e3) {
    return `${sign}${parseFloat((abs / 1e3).toFixed(decimals))}K`;
  }
  return `${sign}${abs.toFixed(0)}`;
}

/**
 * Format currency with symbol and K/M/B suffixes
 */
export function formatCurrency(value: number, symbol: string = '$', decimals: number = 2): string {
  const formatted = formatNumber(value, decimals);
  return `${symbol}${formatted}`;
}

/**
 * Format percentage (0.1234 -> 12.34%)
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${parseFloat((value * 100).toFixed(decimals))}%`;
}

/**
 * Format number with commas (1234567 -> 1,234,567)
 */
export function formatWithCommas(value: number): string {
  return value.toLocaleString('en-US');
}
