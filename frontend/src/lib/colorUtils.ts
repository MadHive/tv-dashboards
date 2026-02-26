/**
 * MadHive color constants
 */
export const MADHIVE_COLORS = {
  purpleDark: '#200847',
  purple: '#291036',
  purpleMedium: '#3D1F5C',
  pink: '#FF9BD3',
  pinkSoft: '#FDA4D4',
  pinkBright: '#FF7AC6',
  chalk: '#F4DFFF',
} as const;

/**
 * Get color from gradient scale based on value position
 */
export function getColorScale(value: number, min: number, max: number): string {
  const normalized = (value - min) / (max - min);

  if (normalized <= 0.33) return MADHIVE_COLORS.purpleMedium;
  if (normalized <= 0.66) return MADHIVE_COLORS.pinkSoft;
  return MADHIVE_COLORS.pink;
}

/**
 * Get MadHive chart color palette (for Chart.js datasets)
 */
export function getMadHiveChartColors(count?: number): string[] {
  const colors = [
    'rgb(255, 155, 211)', // hot pink
    'rgb(253, 164, 212)', // soft pink
    'rgb(244, 223, 255)', // chalk
    'rgb(200, 100, 255)', // purple accent
    'rgb(255, 120, 200)', // pink variant
    'rgb(220, 140, 255)', // light purple
  ];

  return count ? colors.slice(0, count) : colors;
}

/**
 * Convert hex color to rgba with alpha
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  hex = hex.replace('#', '');

  // Handle 3-char hex
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Create gradient background CSS string
 */
export function createGradient(color1: string, color2: string, angle: number = 135): string {
  return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
}
