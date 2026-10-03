/** @type {import('tailwindcss').Config} */
import { colors, borderRadiusWeb, shadowsWeb } from '../shared/theme.js';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Ingly Primary & Accent Palettes
        brand: {
          50: '#F5F6FF',
          100: '#EEF0FF',
          200: '#D5D7FF',
          300: '#ACB1FF',
          400: '#838BFF',
          500: '#5B4DFF', // Ingly Royal Indigo
          600: '#4C3EE8',
          700: '#3F30D4',
          800: '#3123B5',
          900: '#231792',
          DEFAULT: '#5B4DFF',
        },
        accent: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8', // Ingly Sky Blue
          500: '#0EA5E9',
          600: '#0284C7',
          DEFAULT: '#38BDF8',
        },
        // Ingly SRS (Spaced Repetition) & Status Colors
        mastered: {
          DEFAULT: '#22C55E', // Yodlandi
          light: '#DCFCE7',
          dark: '#16A34A',
        },
        review: {
          DEFAULT: '#0EA5E9', // Takrorlash
          light: '#E0F2FE',
          dark: '#0284C7',
        },
        hard: {
          DEFAULT: '#EF4444', // Qiyin
          light: '#FEE2E2',
          dark: '#DC2626',
        },
        streak: {
          DEFAULT: '#F97316', // Olovcha
          light: '#FFEDD5',
          dark: '#EA580C',
        },
        // Fon va kartochka ranglari
        inglyBg: '#F8FAFC',
        inglyCard: '#FFFFFF',
        inglyBorder: '#E2E8F0',
        inglyText: '#0F172A',
        inglyMuted: '#64748B',
      },
      borderRadius: {
        ...borderRadiusWeb,
      },
      boxShadow: {
        ...shadowsWeb,
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #5B4DFF 0%, #38BDF8 100%)',
        'streak-gradient': 'linear-gradient(135deg, #F97316 0%, #FBBF24 100%)',
        'success-gradient': 'linear-gradient(135deg, #10B981 0%, #22C55E 100%)',
        'card-gradient': 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
      },
    },
  },
  plugins: [],
};
