import type { PackageType } from './types';

export const CURRENCY_SYMBOL = '€';

export const TYPE_COLORS_DARK: Record<PackageType, { badge: string; icon: string }> = {
  hourly:  { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',          icon: 'text-sky-400' },
  monthly: { badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: 'text-violet-400' },
  yearly:  { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',    icon: 'text-amber-400' },
};
export const TYPE_COLORS_LIGHT: Record<PackageType, { badge: string; icon: string }> = {
  hourly:  { badge: 'bg-sky-50 text-sky-600 border-sky-200',          icon: 'text-sky-500' },
  monthly: { badge: 'bg-violet-50 text-violet-600 border-violet-200', icon: 'text-violet-500' },
  yearly:  { badge: 'bg-amber-50 text-amber-600 border-amber-200',    icon: 'text-amber-500' },
};

export function typeColors(type: PackageType, isDark: boolean) {
  return isDark ? TYPE_COLORS_DARK[type] : TYPE_COLORS_LIGHT[type];
}

// Global scrollbar CSS in index.css now handles .ss-thin — kept as empty string for back-compat.
export const SCROLLBAR_STYLE = '';
