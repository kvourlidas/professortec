export function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTime(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

export function getScrollbarStyle(isDark: boolean): string {
  return `
    .grades-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .grades-scroll::-webkit-scrollbar-track { background: ${isDark ? 'rgba(15,23,42,0.4)' : 'rgba(241,245,249,0.8)'}; border-radius: 99px; }
    .grades-scroll::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(100,116,139,0.5)' : 'rgba(148,163,184,0.6)'}; border-radius: 99px; }
    .grades-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.8); }
    .grades-scroll { scrollbar-width: thin; scrollbar-color: ${isDark ? 'rgba(100,116,139,0.5) rgba(15,23,42,0.4)' : 'rgba(148,163,184,0.6) rgba(241,245,249,0.8)'}; }
  `;
}
