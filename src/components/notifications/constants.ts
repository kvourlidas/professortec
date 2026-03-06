import type { Kind } from './types';

export const KIND_LABELS: Record<Kind, string> = {
  general: 'Γενικό',
  message: 'Μήνυμα',
  schedule: 'Πρόγραμμα',
  test: 'Διαγώνισμα',
};

export const KIND_COLORS: Record<Kind, string> = {
  general: 'border-slate-600/50 bg-slate-800/60 text-slate-300',
  message: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  schedule: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  test: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
};

export const KIND_COLORS_LIGHT: Record<Kind, string> = {
  general: 'border-slate-300 bg-slate-100 text-slate-600',
  message: 'border-blue-300 bg-blue-50 text-blue-600',
  schedule: 'border-emerald-300 bg-emerald-50 text-emerald-600',
  test: 'border-amber-300 bg-amber-50 text-amber-600',
};
