import { describe, it, expect } from 'vitest';
import { getColorScale, getMadHiveChartColors, hexToRgba } from './colorUtils';

describe('getColorScale', () => {
  it('returns purple for low values', () => {
    const color = getColorScale(10, 0, 100);
    expect(color).toBe('#3D1F5C'); // madhive-purple-medium
  });

  it('returns pink for high values', () => {
    const color = getColorScale(90, 0, 100);
    expect(color).toBe('#FF9BD3'); // madhive-pink
  });

  it('interpolates for mid values', () => {
    const color = getColorScale(50, 0, 100);
    expect(color).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('getMadHiveChartColors', () => {
  it('returns array of MadHive colors', () => {
    const colors = getMadHiveChartColors();
    expect(colors).toHaveLength(6);
    expect(colors[0]).toBe('rgb(255, 155, 211)'); // hot pink
  });

  it('returns specific count of colors', () => {
    const colors = getMadHiveChartColors(3);
    expect(colors).toHaveLength(3);
  });
});

describe('hexToRgba', () => {
  it('converts hex to rgba', () => {
    expect(hexToRgba('#FF9BD3', 0.5)).toBe('rgba(255, 155, 211, 0.5)');
  });

  it('handles 3-char hex', () => {
    expect(hexToRgba('#F00', 1)).toBe('rgba(255, 0, 0, 1)');
  });
});
