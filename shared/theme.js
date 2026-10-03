/**
 * INGLY DESIGN SYSTEM - SHARED THEME TOKEN DEFINITIONS
 * Muallif: Ingly Frontend & UI/UX Team
 * Loyiha: Ingly - 4000 Essential English Words
 *
 * Ushbu fayl ham Web Admin Panel (Tailwind / CSS-in-JS),
 * ham React Native mobil ilova uchun yagona dizayn manbasi hisoblanadi.
 */

// 1. HEX RANGLAR PALITRASI (TZ.txt 6-bo'lim asosida)
export const colors = {
  // Asosiy brend ranglari
  primary: {
    DEFAULT: '#5B4DFF', // Royal Indigo
    hover: '#4C3EE8',
    active: '#3F30D4',
    light: '#EEF0FF',
    subtle: '#F5F6FF',
    glow: 'rgba(91, 77, 255, 0.25)',
  },
  accent: {
    DEFAULT: '#38BDF8', // Sky Blue
    hover: '#0EA5E9',
    light: '#E0F2FE',
    subtle: '#F0F9FF',
  },

  // Foni va sirtlari (Surfaces)
  background: {
    DEFAULT: '#F8FAFC', // Soft Slate White
    dark: '#0F172A',    // Dark Navy Background
  },
  surface: {
    DEFAULT: '#FFFFFF', // Pure White
    secondary: '#F1F5F9', // Muted Gray Surface
    dark: '#1E293B',    // Dark Card Surface
    darkElevated: '#334155',
  },

  // Hoshiyalar va ajratuvchilar
  border: {
    DEFAULT: '#E2E8F0', // Light Gray
    strong: '#CBD5E1',
    dark: '#334155',
    focus: '#5B4DFF',
  },

  // Matn ranglari
  text: {
    primary: '#0F172A',   // Dark Navy
    secondary: '#64748B', // Slate Gray
    muted: '#94A3B8',     // Light Slate
    white: '#FFFFFF',
    darkMuted: '#94A3B8',
  },

  // Oraliq takrorlash (Spaced Repetition System - SRS) va Status ranglari
  status: {
    mastered: '#22C55E',  // "Yodlandi" - Emerald Green
    masteredBg: '#DCFCE7',
    review: '#0EA5E9',    // "Takrorlash" - Ocean Blue
    reviewBg: '#E0F2FE',
    hard: '#EF4444',      // "Qiyin" - Soft Coral Red
    hardBg: '#FEE2E2',
    streak: '#F97316',    // Kunlik streak olovchasi - Orange Flame
    streakBg: '#FFEDD5',
  },

  // Qo'shimcha semantik ranglar
  semantic: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
};

// 2. GRADIENTLAR
export const gradients = {
  // Asosiy brend gradienti (Logo va bosh sahifa kartalari)
  brand: 'linear-gradient(135deg, #5B4DFF 0%, #38BDF8 100%)',
  brandHover: 'linear-gradient(135deg, #4C3EE8 0%, #0EA5E9 100%)',
  brandVertical: 'linear-gradient(180deg, #5B4DFF 0%, #38BDF8 100%)',

  // Streak olovcha gradienti
  streak: 'linear-gradient(135deg, #F97316 0%, #FBBF24 100%)',

  // Yodlandi / Success gradienti
  success: 'linear-gradient(135deg, #10B981 0%, #22C55E 100%)',

  // Qiyin / Error gradienti
  danger: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',

  // VIP / Premium oltin gradienti
  premium: 'linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)',

  // Yumshoq karta sirti
  cardLight: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
  cardDark: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
};

// 3. BURCHAK RADIUSLARI (Border Radii)
// Web uchun string, React Native uchun son shaklida qulay foydalanish
export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  squircle: 28, // Ingly App Icon & Featured Cards
  full: 9999,
};

export const borderRadiusWeb = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  squircle: '28px',
  full: '9999px',
};

// 4. SOYALAR (Shadows)
// Web CSS soyalari
export const shadowsWeb = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
  md: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)',
  lg: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
  xl: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
  brand: '0 10px 25px -5px rgba(91, 77, 255, 0.35)',
  streak: '0 8px 20px -4px rgba(249, 115, 22, 0.35)',
};

// React Native uchun Elevation va Shadow ob'ektlari
export const shadowsNative = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  brandGlow: {
    shadowColor: '#5B4DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
};

// 5. TIPOGRAFIYA VA FONTLAR
export const typography = {
  fontFamily: {
    sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "'Plus Jakarta Sans', Inter, sans-serif",
    mono: "'Fira Code', Menlo, Monaco, Consolas, monospace",
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};

// 6. 4000 ESSENTIAL ENGLISH WORDS - 6 TA KITOB METADATASI VA DARALARI
export const booksConfig = [
  {
    book: 1,
    title: 'Book 1 - Elementary',
    level: 'A1 - A2',
    color: '#38BDF8', // Sky Blue
    bgSoft: '#E0F2FE',
    unitsCount: 30,
    wordsCount: 600,
    badgeText: 'Elementary',
  },
  {
    book: 2,
    title: 'Book 2 - Pre-Intermediate',
    level: 'A2 - B1',
    color: '#0EA5E9', // Ocean Blue
    bgSoft: '#BAE6FD',
    unitsCount: 30,
    wordsCount: 600,
    badgeText: 'Pre-Int',
  },
  {
    book: 3,
    title: 'Book 3 - Intermediate',
    level: 'B1',
    color: '#5B4DFF', // Royal Indigo
    bgSoft: '#EEF0FF',
    unitsCount: 30,
    wordsCount: 600,
    badgeText: 'Intermediate',
  },
  {
    book: 4,
    title: 'Book 4 - Upper-Intermediate',
    level: 'B2',
    color: '#8B5CF6', // Purple
    bgSoft: '#F3E8FF',
    unitsCount: 30,
    wordsCount: 600,
    badgeText: 'Upper-Int',
  },
  {
    book: 5,
    title: 'Book 5 - Advanced',
    level: 'C1',
    color: '#EC4899', // Pink
    bgSoft: '#FCE7F3',
    unitsCount: 30,
    wordsCount: 600,
    badgeText: 'Advanced',
  },
  {
    book: 6,
    title: 'Book 6 - Proficiency',
    level: 'C2',
    color: '#F59E0B', // Amber Gold
    bgSoft: '#FEF3C7',
    unitsCount: 30,
    wordsCount: 600,
    badgeText: 'Proficiency',
  },
];

// 7. ORALIQ TAKRORLASH (SRS) REJIMLARI QOIDALARI
export const srsModes = {
  hard: {
    key: 'hard',
    labelUz: 'Qiyin',
    labelEn: 'Hard',
    color: '#EF4444',
    bg: '#FEE2E2',
    intervalMinutes: 10,
    description: "So'zni tez-tez takrorlash uchun oraliqni qisqartiradi.",
  },
  review: {
    key: 'review',
    labelUz: 'Takrorlash',
    labelEn: 'Review',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    intervalDays: 1,
    description: "Ertangi kun rejasiga qo'shadi.",
  },
  mastered: {
    key: 'mastered',
    labelUz: 'Yodlandi',
    labelEn: 'Mastered',
    color: '#22C55E',
    bg: '#DCFCE7',
    intervalDays: 4,
    description: "O'rganilganlar hisobiga qo'shadi va oraliqni uzaytiradi.",
  },
};

const theme = {
  colors,
  gradients,
  borderRadius,
  borderRadiusWeb,
  shadowsWeb,
  shadowsNative,
  typography,
  booksConfig,
  srsModes,
};

export default theme;
