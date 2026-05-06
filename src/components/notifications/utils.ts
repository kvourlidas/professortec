export function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// Kept for call-site compatibility — global scrollbar CSS in index.css now handles styling.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getScrollbarStyle(_isDark: boolean) { return ''; }
