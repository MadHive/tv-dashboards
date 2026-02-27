import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        madhive: {
          'purple-deepest': '#0F0820',
          'purple-deep': '#1A0F2E',
          'purple-dark': '#200847',
          purple: '#291036',
          'purple-medium': '#3D1F5C',
          'purple-light': '#5C3B7A',
          'pink-bright': '#FF7AC6',
          pink: '#FF9BD3',
          'pink-soft': '#FDA4D4',
          'pink-pale': '#FFD4EC',
          chalk: '#F4DFFF',
          'chalk-bright': '#FFFFFF',
        },
        success: '#A7F3D0',
        warning: '#FDE68A',
        error: '#FCA5A5',
        info: '#93C5FD',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        'tv-xs': '0.75rem',
        'tv-sm': '0.875rem',
        'tv-base': '1rem',
        'tv-lg': '1.25rem',
        'tv-xl': '1.5rem',
        'tv-2xl': '2rem',
        'tv-huge': '4.5rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        'count-up': 'count-up 0.5s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'count-up': {
          '0%': { opacity: '0.5', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
