import { describe, it, expect } from 'vitest';
import { formatNumber, formatCurrency, formatPercentage } from './formatUtils';

describe('formatNumber', () => {
  it('formats numbers with K suffix', () => {
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(25000)).toBe('25K');
  });

  it('formats numbers with M suffix', () => {
    expect(formatNumber(1500000)).toBe('1.5M');
    expect(formatNumber(25000000)).toBe('25M');
  });

  it('formats numbers with B suffix', () => {
    expect(formatNumber(1500000000)).toBe('1.5B');
  });

  it('formats small numbers without suffix', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(42)).toBe('42');
  });

  it('formats with custom decimals', () => {
    expect(formatNumber(1234, 2)).toBe('1.23K');
  });
});

describe('formatCurrency', () => {
  it('formats currency with dollar sign', () => {
    expect(formatCurrency(1234.56)).toBe('$1.23K');
    expect(formatCurrency(42)).toBe('$42');
  });

  it('supports custom currency symbol', () => {
    expect(formatCurrency(1234, '€')).toBe('€1.23K');
  });
});

describe('formatPercentage', () => {
  it('formats percentage with % sign', () => {
    expect(formatPercentage(0.1234)).toBe('12.3%');
    expect(formatPercentage(1.5)).toBe('150%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercentage(0.1234, 1)).toBe('12.3%');
    expect(formatPercentage(0.1234, 2)).toBe('12.34%');
  });
});
