/**
 * INGLY DESIGN SYSTEM - TYPESCRIPT THEME DEFINITIONS
 * Muallif: Ingly Frontend & UI/UX Team
 * Loyiha: Ingly - 4000 Essential English Words
 */

export interface ColorScale {
  DEFAULT: string;
  hover?: string;
  active?: string;
  light?: string;
  subtle?: string;
  glow?: string;
  dark?: string;
  secondary?: string;
  darkElevated?: string;
  strong?: string;
  focus?: string;
  primary?: string;
  muted?: string;
  white?: string;
  darkMuted?: string;
  mastered?: string;
  masteredBg?: string;
  review?: string;
  reviewBg?: string;
  hard?: string;
  hardBg?: string;
  streak?: string;
  streakBg?: string;
}

export interface BookMetadata {
  book: number;
  title: string;
  level: string;
  color: string;
  bgSoft: string;
  unitsCount: number;
  wordsCount: number;
  badgeText: string;
}

export interface SRSModeConfig {
  key: 'hard' | 'review' | 'mastered';
  labelUz: string;
  labelEn: string;
  color: string;
  bg: string;
  intervalMinutes?: number;
  intervalDays?: number;
  description: string;
}

export {
  colors,
  gradients,
  borderRadius,
  borderRadiusWeb,
  shadowsWeb,
  shadowsNative,
  typography,
  booksConfig,
  srsModes,
} from './theme.js';
