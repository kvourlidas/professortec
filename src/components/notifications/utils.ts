export function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export function getScrollbarStyle(isDark: boolean) {
  return `
    .notif-scroll::-webkit-scrollbar { width: 5px; }
    .notif-scroll::-webkit-scrollbar-track { background: ${isDark ? 'rgba(15,23,42,0.4)' : 'rgba(241,245,249,0.8)'}; border-radius: 99px; }
    .notif-scroll::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(100,116,139,0.45)' : 'rgba(148,163,184,0.55)'}; border-radius: 99px; }
    .notif-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.75); }
    .notif-scroll { scrollbar-width: thin; scrollbar-color: ${isDark ? 'rgba(100,116,139,0.45) rgba(15,23,42,0.4)' : 'rgba(148,163,184,0.55) rgba(241,245,249,0.8)'}; }
  `;
}
