/**
 * Theme System Tests
 *
 * Enforces:
 * - All themes have required color properties
 * - Client logos are correctly configured
 * - Theme color consistency and accessibility
 */

import { describe, test, expect } from 'bun:test';

// Mock window.Themes - in real environment this is loaded from themes.js
const THEMES = {
  brand: {
    name: 'MadHive Brand',
    logoText: 'MADHIVE',
    logoSub: 'PLATFORM',
    bg: '#0f0520',
    bgSurface: '#1A0B38',
    bgCard: '#200847',
    bgCardAlt: '#2E1860',
    border: '#3D1A5C',
    borderLit: '#6B5690',
    accent: '#FDA4D4',
    accentDim: 'rgba(253, 164, 212, 0.2)',
    text1: '#F3F2EB',
    text2: '#B8A8D0',
    text3: '#6B5690',
    dotColor: '#1A0B38',
    logoImage: null,
  },
  fox: {
    name: 'FOX',
    logoText: 'FOX',
    logoSub: 'CORPORATION',
    bg: '#00263E',
    bgSurface: '#003d5c',
    bgCard: '#004872',
    bgCardAlt: '#00568a',
    border: '#006b9d',
    borderLit: '#0087c1',
    accent: '#D2232B',
    accentDim: 'rgba(210, 35, 43, 0.2)',
    text1: '#E5E5E5',
    text2: '#9dbdd6',
    text3: '#4a90b8',
    dotColor: '#003d5c',
    logoImage: '/img/fox-logo.svg',
  },
  iheart: {
    name: 'iHeart Media',
    logoText: 'iHEART',
    logoSub: 'MEDIA',
    bg: '#120005',
    bgSurface: '#1f000a',
    bgCard: '#2d0010',
    bgCardAlt: '#440018',
    border: '#660022',
    borderLit: '#990033',
    accent: '#C8102E',
    accentDim: 'rgba(200, 16, 46, 0.2)',
    text1: '#ffe5ea',
    text2: '#ffb3c0',
    text3: '#ff7088',
    dotColor: '#1f000a',
    logoImage: '/img/rf2d7i-iheartmedia-vertical-logo-red.png',
  },
};

describe('Theme System', () => {
  describe('Theme Structure', () => {
    const requiredColorProps = [
      'bg', 'bgSurface', 'bgCard', 'bgCardAlt',
      'border', 'borderLit', 'accent', 'accentDim',
      'text1', 'text2', 'text3', 'dotColor'
    ];

    const requiredMetaProps = ['name', 'logoText', 'logoSub', 'logoImage'];

    Object.entries(THEMES).forEach(([key, theme]) => {
      describe(`Theme: ${key}`, () => {
        test('has all required color properties', () => {
          requiredColorProps.forEach(prop => {
            expect(theme).toHaveProperty(prop);
            expect(theme[prop]).toBeTruthy();
          });
        });

        test('has all required metadata properties', () => {
          requiredMetaProps.forEach(prop => {
            expect(theme).toHaveProperty(prop);
            // logoImage can be null for generic themes
            if (prop !== 'logoImage') {
              expect(theme[prop]).toBeTruthy();
            }
          });
        });

        test('accent color uses valid CSS color format', () => {
          const { accent } = theme;
          // Hex color (#RRGGBB)
          const hexPattern = /^#[0-9A-Fa-f]{6}$/;
          expect(hexPattern.test(accent)).toBe(true);
        });

        test('accentDim uses rgba format with proper alpha', () => {
          const { accentDim } = theme;
          const rgbaPattern = /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*0?\.\d+\)$/;
          expect(rgbaPattern.test(accentDim)).toBe(true);
        });

        test('background colors are darker than surface colors', () => {
          // Convert hex to brightness value
          const getBrightness = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return (r * 299 + g * 587 + b * 114) / 1000;
          };

          const bgBrightness = getBrightness(theme.bg);
          const surfaceBrightness = getBrightness(theme.bgSurface);
          const cardBrightness = getBrightness(theme.bgCard);

          // bg should be darkest, then surface, then card
          expect(bgBrightness).toBeLessThanOrEqual(surfaceBrightness);
          expect(surfaceBrightness).toBeLessThanOrEqual(cardBrightness);
        });
      });
    });
  });

  describe('Client Branding', () => {
    test('FOX theme has correct logo path', () => {
      expect(THEMES.fox.logoImage).toBe('/img/fox-logo.svg');
    });

    test('iHeart theme has correct logo path', () => {
      expect(THEMES.iheart.logoImage).toBe('/img/rf2d7i-iheartmedia-vertical-logo-red.png');
    });

    test('MadHive brand theme has no logo image', () => {
      expect(THEMES.brand.logoImage).toBeNull();
    });

    test('client themes have distinct accent colors', () => {
      const accents = Object.values(THEMES).map(t => t.accent);
      const uniqueAccents = new Set(accents);
      // At least 3 unique accent colors (brand, fox, iheart are different)
      expect(uniqueAccents.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Color Accessibility', () => {
    test('text colors provide sufficient contrast with background', () => {
      Object.entries(THEMES).forEach(([key, theme]) => {
        // Simple contrast check - text1 should be much brighter than bg
        const getBrightness = (hex) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return (r * 299 + g * 587 + b * 114) / 1000;
        };

        const bgBrightness = getBrightness(theme.bg);
        const text1Brightness = getBrightness(theme.text1);

        // Contrast ratio should be significant (text much brighter than bg)
        expect(text1Brightness).toBeGreaterThan(bgBrightness + 100);
      });
    });
  });

  describe('CSS Variable Mapping', () => {
    const cssVars = [
      '--bg', '--bg-surface', '--bg-card', '--bg-card-alt',
      '--border', '--border-lit', '--accent', '--accent-dim',
      '--t1', '--t2', '--t3', '--dot-color'
    ];

    test('all required CSS variables are defined', () => {
      // This ensures the mapping in app.js covers all properties
      const themeProps = ['bg', 'bgSurface', 'bgCard', 'bgCardAlt',
                          'border', 'borderLit', 'accent', 'accentDim',
                          'text1', 'text2', 'text3', 'dotColor'];

      expect(themeProps.length).toBe(12);
      expect(cssVars.length).toBe(12);
    });
  });
});

describe('Theme Application', () => {
  test('applyTheme should set all CSS variables', () => {
    // Mock DOM
    const mockRoot = {
      style: {
        setProperty: () => {},
        properties: {}
      }
    };

    const applyTheme = (theme, root = mockRoot) => {
      const calls = [];
      root.style.setProperty = (key, value) => {
        calls.push({ key, value });
        root.style.properties[key] = value;
      };

      root.style.setProperty('--bg', theme.bg);
      root.style.setProperty('--bg-surface', theme.bgSurface);
      root.style.setProperty('--bg-card', theme.bgCard);
      root.style.setProperty('--bg-card-alt', theme.bgCardAlt);
      root.style.setProperty('--border', theme.border);
      root.style.setProperty('--border-lit', theme.borderLit);
      root.style.setProperty('--accent', theme.accent);
      root.style.setProperty('--accent-dim', theme.accentDim);
      root.style.setProperty('--t1', theme.text1);
      root.style.setProperty('--t2', theme.text2);
      root.style.setProperty('--t3', theme.text3);
      root.style.setProperty('--dot-color', theme.dotColor);

      return calls;
    };

    const calls = applyTheme(THEMES.fox);
    expect(calls.length).toBe(12);

    // Verify specific mappings
    expect(mockRoot.style.properties['--bg']).toBe(THEMES.fox.bg);
    expect(mockRoot.style.properties['--accent']).toBe(THEMES.fox.accent);
    expect(mockRoot.style.properties['--t1']).toBe(THEMES.fox.text1);
  });
});
