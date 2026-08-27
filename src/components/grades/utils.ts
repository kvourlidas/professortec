export function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

const GREEK_MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

// value: 'YYYY-MM'
export function formatMonthLabel(value: string): string {
  const [y, m] = value.split('-');
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${GREEK_MONTHS[idx]} ${y}` : value;
}

// Kept for call-site compatibility — global scrollbar CSS in index.css now handles styling.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getScrollbarStyle(_isDark: boolean): string { return ''; }
