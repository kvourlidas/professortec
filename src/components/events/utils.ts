export function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const s = start ? start.slice(0, 5) : '';
  const e = end ? end.slice(0, 5) : '';
  if (s && e) return `${s} – ${e}`;
  return s || e || '—';
}
