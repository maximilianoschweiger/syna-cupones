/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#00e5a0',
          400: '#00f5ad',
          600: '#00b87d',
        },
        dark: {
          900: '#060e1c',
          800: '#0a1628',
          700: '#0d1a2e',
          600: '#111d32',
          500: '#162640',
          400: '#1c2e4a',
          300: '#253854',
          200: '#334155',
        },
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.35)',
        'glow-sm': '0 0 14px rgba(0,229,160,0.25)',
        'glow-md': '0 0 28px rgba(0,229,160,0.3)',
        'glow-lg': '0 0 50px rgba(0,229,160,0.2)',
      },
      animation: {
        'float': 'float 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 14px rgba(0,229,160,0.25)' },
          '50%': { boxShadow: '0 0 28px rgba(0,229,160,0.45)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
