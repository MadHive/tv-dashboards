// ===========================================================================
// Unified Theme System
// Client-aligned color schemes for dashboards, maps, charts, and widgets
// ===========================================================================

window.Themes = (function () {
  'use strict';

  // ── Complete theme definitions with all color properties ──────────────────

  const THEMES = {
    // MadHive default brand theme
    brand: {
      name: 'MadHive Brand',
      logoText: 'MADHIVE',
      logoSub: 'PLATFORM',

      // Canvas/chart colors (used by charts.js)
      canvas: {
        pink:     '#FDA4D4',
        hotPink:  '#FF9BD3',
        deep:     '#200847',
        violet:   '#3D1A5C',
        surface:  '#1A0B38',
        border:   '#2E1860',
        text1:    '#F3F2EB',
        text2:    '#B8A8D0',
        text3:    '#6B5690',
        green:    '#4ADE80',
        amber:    '#FBBF24',
        red:      '#FB7185',
        cyan:     '#67E8F9',
      },

      // Dashboard UI colors
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

      // Map colors
      map: {
        particleNormal: '#67E8F9',
        particleFast: '#FDA4D4',
        stateGlowHigh: '#FDA4D4',
      },

      // Optional logo
      logoImage: null,
    },

    // iHeart Media theme
    iheart: {
      name: 'iHeart Media',
      logoText: 'iHEART',
      logoSub: 'MEDIA',

      canvas: {
        pink:     '#C8102E',
        hotPink:  '#FF4458',
        deep:     '#120005',
        violet:   '#1f000a',
        surface:  '#2d0010',
        border:   '#660022',
        text1:    '#ffe5ea',
        text2:    '#ffb3c0',
        text3:    '#ff7088',
        green:    '#4ADE80',
        amber:    '#FBBF24',
        red:      '#C8102E',
        cyan:     '#FF4458',
      },

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

      map: {
        particleNormal: '#C8102E',
        particleFast: '#FF4458',
        stateGlowHigh: '#FF4458',
      },

      logoImage: '/img/rf2d7i-iheartmedia-vertical-logo-red.png',
    },

    // FOX Corporation theme (Real brand colors)
    fox: {
      name: 'FOX',
      logoText: 'FOX',
      logoSub: 'CORPORATION',

      canvas: {
        pink:     '#D2232B',
        hotPink:  '#FF4444',
        deep:     '#00263E',
        violet:   '#003d5c',
        surface:  '#004872',
        border:   '#006b9d',
        text1:    '#E5E5E5',
        text2:    '#9dbdd6',
        text3:    '#4a90b8',
        green:    '#4ADE80',
        amber:    '#FBBF24',
        red:      '#D2232B',
        cyan:     '#00B9EA',
      },

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

      map: {
        particleNormal: '#00B9EA',
        particleFast: '#D2232B',
        stateGlowHigh: '#FF4444',
      },

      logoImage: '/img/fox-logo.svg',
    },

    // Hearst Media theme
    hearst: {
      name: 'Hearst',
      logoText: 'HEARST',
      logoSub: 'MEDIA',

      canvas: {
        pink:     '#4C76A2',
        hotPink:  '#6B99C3',
        deep:     '#0a0f18',
        violet:   '#12182a',
        surface:  '#1a2438',
        border:   '#2d4060',
        text1:    '#e5ebf3',
        text2:    '#a8bdd6',
        text3:    '#6B99C3',
        green:    '#4ADE80',
        amber:    '#FBBF24',
        red:      '#FB7185',
        cyan:     '#6B99C3',
      },

      bg: '#0a0f18',
      bgSurface: '#12182a',
      bgCard: '#1a2438',
      bgCardAlt: '#243250',
      border: '#2d4060',
      borderLit: '#4C76A2',
      accent: '#4C76A2',
      accentDim: 'rgba(76, 118, 162, 0.2)',
      text1: '#e5ebf3',
      text2: '#a8bdd6',
      text3: '#6B99C3',
      dotColor: '#12182a',

      map: {
        particleNormal: '#4C76A2',
        particleFast: '#6B99C3',
        stateGlowHigh: '#a8bdd6',
      },

      logoImage: '/img/hearst-logo.svg',
    },

    // Nexstar Media Group theme
    nexstar: {
      name: 'Nexstar',
      logoText: 'NEXSTAR',
      logoSub: 'MEDIA GROUP',

      canvas: {
        pink:     '#2380bb',
        hotPink:  '#5ca3d4',
        deep:     '#0a0f18',
        violet:   '#141d2d',
        surface:  '#1a2842',
        border:   '#2380bb',
        text1:    '#e8f0f8',
        text2:    '#a19065',
        text3:    '#5ca3d4',
        green:    '#4ADE80',
        amber:    '#a19065',
        red:      '#FB7185',
        cyan:     '#5ca3d4',
      },

      bg: '#0a0f18',
      bgSurface: '#141d2d',
      bgCard: '#1a2842',
      bgCardAlt: '#23385a',
      border: '#2d4d75',
      borderLit: '#5ca3d4',
      accent: '#2380bb',
      accentDim: 'rgba(35, 128, 187, 0.2)',
      text1: '#e8f0f8',
      text2: '#a19065',
      text3: '#5ca3d4',
      dotColor: '#141d2d',

      map: {
        particleNormal: '#2380bb',
        particleFast: '#5ca3d4',
        stateGlowHigh: '#a19065',
      },

      logoImage: '/img/nexstar-logo.png',
    },

    // E.W. Scripps theme
    scripps: {
      name: 'EW Scripps',
      logoText: 'SCRIPPS',
      logoSub: 'MEDIA',

      canvas: {
        pink:     '#005EB8',
        hotPink:  '#4A8FCA',
        deep:     '#001020',
        violet:   '#001a30',
        surface:  '#002a48',
        border:   '#005EB8',
        text1:    '#e5f2ff',
        text2:    '#8fc4e8',
        text3:    '#4A8FCA',
        green:    '#4ADE80',
        amber:    '#FBBF24',
        red:      '#FB7185',
        cyan:     '#4A8FCA',
      },

      bg: '#001020',
      bgSurface: '#001a30',
      bgCard: '#002a48',
      bgCardAlt: '#003d62',
      border: '#004880',
      borderLit: '#4A8FCA',
      accent: '#005EB8',
      accentDim: 'rgba(0, 94, 184, 0.2)',
      text1: '#e5f2ff',
      text2: '#8fc4e8',
      text3: '#4A8FCA',
      dotColor: '#001a30',

      map: {
        particleNormal: '#005EB8',
        particleFast: '#4A8FCA',
        stateGlowHigh: '#8fc4e8',
      },

      logoImage: '/img/scripps-logo.png',
    },

    // Cox Media Group theme
    cox: {
      name: 'Cox Media Group',
      logoText: 'COX',
      logoSub: 'MEDIA GROUP',

      canvas: {
        pink:     '#db3902',
        hotPink:  '#f66032',
        deep:     '#1a0800',
        violet:   '#2d1000',
        surface:  '#4a1a00',
        border:   '#7a2900',
        text1:    '#ffe8d8',
        text2:    '#f0b090',
        text3:    '#c86040',
        green:    '#4ADE80',
        amber:    '#FBBF24',
        red:      '#db3902',
        cyan:     '#006385',
      },

      bg: '#1a0800',
      bgSurface: '#2d1000',
      bgCard: '#4a1a00',
      bgCardAlt: '#662400',
      border: '#7a2900',
      borderLit: '#a03800',
      accent: '#db3902',
      accentDim: 'rgba(219, 57, 2, 0.2)',
      text1: '#ffe8d8',
      text2: '#f0b090',
      text3: '#c86040',
      dotColor: '#2d1000',

      map: {
        particleNormal: '#006385',
        particleFast: '#db3902',
        stateGlowHigh: '#f66032',
      },

      logoImage: '/img/cox-logo.svg',
    },

    // Cool blue theme
    cool: {
      name: 'Cool Blue',
      logoText: 'TV',
      logoSub: 'DASHBOARDS',

      canvas: {
        pink:     '#60A5FA',
        hotPink:  '#93C5FD',
        deep:     '#0a0e1a',
        violet:   '#0f1729',
        surface:  '#1e3a8a',
        border:   '#2563eb',
        text1:    '#e0f2fe',
        text2:    '#93c5fd',
        text3:    '#60a5fa',
        green:    '#4ADE80',
        amber:    '#FBBF24',
        red:      '#FB7185',
        cyan:     '#67E8F9',
      },

      bg: '#0a0e1a',
      bgSurface: '#0f1729',
      bgCard: '#1e3a8a',
      bgCardAlt: '#2563eb',
      border: '#3b82f6',
      borderLit: '#60a5fa',
      accent: '#60A5FA',
      accentDim: 'rgba(96, 165, 250, 0.2)',
      text1: '#e0f2fe',
      text2: '#93c5fd',
      text3: '#60a5fa',
      dotColor: '#0f1729',

      map: {
        particleNormal: '#60A5FA',
        particleFast: '#FFFFFF',
        stateGlowHigh: '#e0f2fe',
      },

      logoImage: null,
    },

    // Warm orange theme
    warm: {
      name: 'Warm Orange',
      logoText: 'TV',
      logoSub: 'DASHBOARDS',

      canvas: {
        pink:     '#fbbf24',
        hotPink:  '#fcd34d',
        deep:     '#1a0f05',
        violet:   '#2d1a0a',
        surface:  '#92400e',
        border:   '#d97706',
        text1:    '#fef08a',
        text2:    '#fcd34d',
        text3:    '#fbbf24',
        green:    '#4ADE80',
        amber:    '#fbbf24',
        red:      '#FF6B35',
        cyan:     '#67E8F9',
      },

      bg: '#1a0f05',
      bgSurface: '#2d1a0a',
      bgCard: '#92400e',
      bgCardAlt: '#b45309',
      border: '#d97706',
      borderLit: '#fbbf24',
      accent: '#fbbf24',
      accentDim: 'rgba(251, 191, 36, 0.2)',
      text1: '#fef08a',
      text2: '#fcd34d',
      text3: '#fbbf24',
      dotColor: '#2d1a0a',

      map: {
        particleNormal: '#fbbf24',
        particleFast: '#FF6B35',
        stateGlowHigh: '#fef08a',
      },

      logoImage: null,
    },
  };

  // ── CSS Variable Application ──────────────────────────────────────────────

  function applyTheme(themeName, targetElement = document.documentElement) {
    const theme = THEMES[themeName] || THEMES.brand;

    // Apply CSS variables for dashboard UI
    targetElement.style.setProperty('--bg', theme.bg);
    targetElement.style.setProperty('--bg-surface', theme.bgSurface);
    targetElement.style.setProperty('--bg-card', theme.bgCard);
    targetElement.style.setProperty('--bg-card-alt', theme.bgCardAlt);
    targetElement.style.setProperty('--border', theme.border);
    targetElement.style.setProperty('--border-lit', theme.borderLit);
    targetElement.style.setProperty('--accent', theme.accent);
    targetElement.style.setProperty('--accent-dim', theme.accentDim);
    targetElement.style.setProperty('--t1', theme.text1);
    targetElement.style.setProperty('--t2', theme.text2);
    targetElement.style.setProperty('--t3', theme.text3);
    targetElement.style.setProperty('--dot-color', theme.dotColor);

    return theme;
  }

  // ── Theme Retrieval ────────────────────────────────────────────────────────

  function getTheme(themeName) {
    return THEMES[themeName] || THEMES.brand;
  }

  function getCanvasTheme(themeName) {
    const theme = getTheme(themeName);
    return theme.canvas;
  }

  function getMapColors(themeName) {
    const theme = getTheme(themeName);
    return theme.map;
  }

  function getAllThemeNames() {
    return Object.keys(THEMES);
  }

  function getThemeInfo(themeName) {
    const theme = getTheme(themeName);
    return {
      name: theme.name,
      logoText: theme.logoText,
      logoSub: theme.logoSub,
      logoImage: theme.logoImage,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    THEMES,
    applyTheme,
    getTheme,
    getCanvasTheme,
    getMapColors,
    getAllThemeNames,
    getThemeInfo,
  };
})();
