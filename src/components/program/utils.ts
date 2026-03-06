export const pad2 = (n: number) => n.toString().padStart(2, '0');

export function convert12To24(time: string, period: 'AM' | 'PM'): string | null {
  const t = time.trim();
  if (!t) return null;
  const [hStr, mStr = '00'] = t.split(':');
  let h = Number(hStr); let m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  h = h % 12;
  if (period === 'PM') h += 12;
  else if (period === 'AM' && h === 12) h = 0;
  return `${pad2(h)}:${pad2(m)}`;
}

export function convert24To12(time: string | null): { time: string; period: 'AM' | 'PM' } {
  if (!time) return { time: '', period: 'AM' };
  const [hStr, mStr = '00'] = time.split(':');
  let h = Number(hStr); const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return { time: '', period: 'AM' };
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { time: `${pad2(h)}:${pad2(m)}`, period };
}

export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [hStr, mStr = '00'] = t.split(':');
  const h = Number(hStr); const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDateDisplay(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function parseDateDisplayToISO(display: string): string | null {
  const v = display.trim();
  if (!v) return null;
  const parts = v.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr); const month = Number(mStr); const year = Number(yStr);
  if (!day || !month || !year) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function formatTimeDisplay(t: string | null): string {
  if (!t) return '—';
  return t.slice(0, 5);
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
