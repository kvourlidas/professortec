import type { PackageRow, PackageType, SubscriptionRow } from './types';

export function money(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}
export function parseMoney(input: string): number {
  const n = Number((input ?? '').trim().replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
export function parsePct(input: string): number {
  const n = Number((input ?? '').trim().replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}
export function round2(n: number): number {
  return Number(Number(n ?? 0).toFixed(2));
}
export const pad2 = (n: number) => String(n).padStart(2, '0');

export function todayLocalISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function displayToISODate(display: string): string | null {
  const v = (display ?? '').trim();
  if (!v) return null;
  const parts = v.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const d = Number(dStr), m = Number(mStr), y = Number(yStr);
  if (!d || !m || !y) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
export function isoToDisplayDate(iso: string | null | undefined): string {
  const v = (iso ?? '').trim();
  if (!v) return '';
  if (v.includes('T')) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  const parts = v.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    if (y && m && d) return `${pad2(Number(d))}/${pad2(Number(m))}/${y}`;
  }
  return v;
}
export function monthKeyToRange(monthKey: string): { startISO: string; endISO: string } | null {
  const mk = (monthKey ?? '').trim();
  if (!mk) return null;
  const [yStr, mStr] = mk.split('-');
  const y = Number(yStr), m = Number(mStr);
  if (!y || !m || m < 1 || m > 12) return null;
  const end = new Date(y, m, 0);
  return { startISO: `${y}-${pad2(m)}-01`, endISO: `${y}-${pad2(m)}-${pad2(end.getDate())}` };
}

// Inclusive list of 'YYYY-MM' keys between two month keys (also 'YYYY-MM').
export function monthKeyList(startKey: string, endKey: string): string[] {
  const [ysStr, msStr] = (startKey ?? '').split('-');
  const [yeStr, meStr] = (endKey ?? '').split('-');
  const ys = Number(ysStr), ms = Number(msStr), ye = Number(yeStr), me = Number(meStr);
  if (!ys || !ms || !ye || !me) return [];
  const keys: string[] = [];
  let y = ys, m = ms;
  let guard = 0;
  while ((y < ye || (y === ye && m <= me)) && guard < 240) {
    keys.push(`${y}-${pad2(m)}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    guard += 1;
  }
  return keys;
}
export function formatDateTime(iso: string | null | undefined): string {
  const v = (iso ?? '').trim();
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ── Name-based fallback detectors (used only when package_type is not set) ──
export function isYearlyPackageName(name: string | null | undefined): boolean {
  const n = normalizeText(name);
  return n.includes('ετησι') || n.includes('annual') || n.includes('year');
}
export function isMonthlyPackageName(name: string | null | undefined): boolean {
  const n = normalizeText(name);
  return n.includes('μην') || n.includes('monthly') || n.includes('month');
}

// ── Primary type resolver — uses package_type field first, falls back to name ──
export function resolvePackageType(pkg: PackageRow): PackageType {
  if (pkg.package_type) return pkg.package_type;
  return packageTypeFromName(pkg.name);
}

export function packageTypeFromName(name: string | null | undefined): PackageType {
  if (isYearlyPackageName(name)) return 'yearly';
  return 'monthly';
}
export function typeLabel(t: PackageType): string {
  if (t === 'monthly') return 'Μηνιαίο';
  return 'Ετήσιο';
}
const GREEK_MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

export function formatMonthYearGreek(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [yStr, mStr] = dateStr.split('-');
  const y = Number(yStr), m = Number(mStr);
  if (!y || !m || m < 1 || m > 12) return dateStr;
  return `${GREEK_MONTHS[m - 1]} ${y}`;
}

export function formatMonthRangeGreek(startMonth: string | null | undefined, endMonth: string | null | undefined): string {
  const s = formatMonthYearGreek(startMonth);
  const e = formatMonthYearGreek(endMonth);
  if (s === '—' && e === '—') return '—';
  if (s === e) return s;
  return `${s} – ${e}`;
}

export function periodSummary(sub: SubscriptionRow | null): string {
  if (!sub) return '—';
  if (sub.ends_on) {
    const s = isoToDisplayDate(sub.starts_on), e = isoToDisplayDate(sub.ends_on);
    return s && e ? `${s} – ${e}` : s || '—';
  }
  return isoToDisplayDate(sub.starts_on) || '—';
}