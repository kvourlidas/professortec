import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Send, Sparkles, History, RefreshCw, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';

type Kind = 'general' | 'message' | 'schedule' | 'test';

const KIND_LABELS: Record<Kind, string> = {
  general: 'Γενικό',
  message: 'Μήνυμα',
  schedule: 'Πρόγραμμα',
  test: 'Διαγώνισμα',
};

const KIND_COLORS: Record<Kind, string> = {
  general: 'border-slate-600/50 bg-slate-800/60 text-slate-300',
  message: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  schedule: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  test: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
};

// Light mode equivalents for kind badges
const KIND_COLORS_LIGHT: Record<Kind, string> = {
  general: 'border-slate-300 bg-slate-100 text-slate-600',
  message: 'border-blue-300 bg-blue-50 text-blue-600',
  schedule: 'border-emerald-300 bg-emerald-50 text-emerald-600',
  test: 'border-amber-300 bg-amber-50 text-amber-600',
};

type NotificationRow = { id: string; title: string; body: string; kind: string; created_at: string };

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function FormField({ label, labelCls, children }: { label: string; labelCls: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export default function SendNotificationsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Kind>('general');
  const [loadingSend, setLoadingSend] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<NotificationRow[]>([]);

  const kindLabelSelected = useMemo(() => KIND_LABELS[kind], [kind]);

  // ── Dynamic classes ──
  const inputCls = isDark
    ? 'h-10 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-3.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const textareaCls = isDark
    ? 'w-full resize-none rounded-xl border border-slate-700/70 bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const selectCls = isDark
    ? 'h-10 w-full appearance-none rounded-xl border border-slate-700/70 bg-slate-900/60 pl-3.5 pr-9 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-10 w-full appearance-none rounded-xl border border-slate-300 bg-white pl-3.5 pr-9 text-xs text-slate-800 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const cardHeaderCls = isDark
    ? 'flex items-center gap-3 border-b border-slate-700/60 bg-slate-900/30 px-5 py-3.5'
    : 'flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5';

  const historyCardHeaderCls = isDark
    ? 'flex items-center justify-between gap-3 border-b border-slate-700/60 bg-slate-900/30 px-5 py-3.5'
    : 'flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5';

  const historyIconBoxCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100';

  const refreshBtnCls = isDark
    ? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-700/60'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50';

  const labelCls = `text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  const historySkeletonCls = isDark
    ? 'animate-pulse rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3'
    : 'animate-pulse rounded-xl border border-slate-200 bg-slate-50 px-4 py-3';

  const historyItemCls = isDark
    ? 'rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3 transition hover:bg-slate-800/30'
    : 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100';

  const emptyBoxCls = isDark
    ? 'flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';

  const broadcastBadgeCls = isDark
    ? 'hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-1.5'
    : 'hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5';

  const scrollbarStyle = `
    .notif-scroll::-webkit-scrollbar { width: 5px; }
    .notif-scroll::-webkit-scrollbar-track { background: ${isDark ? 'rgba(15,23,42,0.4)' : 'rgba(241,245,249,0.8)'}; border-radius: 99px; }
    .notif-scroll::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(100,116,139,0.45)' : 'rgba(148,163,184,0.55)'}; border-radius: 99px; }
    .notif-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.75); }
    .notif-scroll { scrollbar-width: thin; scrollbar-color: ${isDark ? 'rgba(100,116,139,0.45) rgba(15,23,42,0.4)' : 'rgba(148,163,184,0.55) rgba(241,245,249,0.8)'}; }
  `;

  const loadHistory = async () => {
    setHistoryError(null); setHistoryLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_school_notifications_history', { p_limit: 15 });
      if (error) { console.error(error); setHistoryError(error.message || 'Αποτυχία φόρτωσης ιστορικού.'); setHistoryItems([]); return; }
      setHistoryItems((data as NotificationRow[]) ?? []);
    } catch (e: any) {
      console.error(e); setHistoryError(e?.message ?? 'Κάτι πήγε στραβά.'); setHistoryItems([]);
    } finally { setHistoryLoading(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  const send = async () => {
    setResultMsg(null); setErrorMsg(null);
    if (!title.trim() || !body.trim()) { setErrorMsg('Συμπλήρωσε τίτλο και μήνυμα.'); return; }
    setLoadingSend(true);
    try {
      const { data, error } = await supabase.rpc('send_school_notification', { p_title: title.trim(), p_body: body.trim(), p_kind: kind, p_data: { screen: 'home' } });
      if (error) { console.error(error); setErrorMsg(error.message || 'Αποτυχία αποστολής.'); return; }
      const count = Number(data ?? 0);
      setResultMsg(`Στάλθηκε σε ${count} μαθητές.`);
      setTitle(''); setBody(''); setKind('general');
      await loadHistory();
    } catch (e: any) {
      console.error(e); setErrorMsg(e?.message ?? 'Κάτι πήγε στραβά.');
    } finally { setLoadingSend(false); }
  };

  return (
    <div className="space-y-6 px-1">
      <style>{scrollbarStyle}</style>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <Bell className="h-4.5 w-4.5 text-black" />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Ειδοποιήσεις μαθητών
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Στείλε ανακοίνωση σε όλους τους μαθητές της σχολής σου (mobile app).
            </p>
          </div>
        </div>
        <div className={broadcastBadgeCls}>
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>School broadcast</span>
        </div>
      </div>

      {/* ── 2-column grid ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* ── LEFT: Send form ── */}
        <div className={cardCls}>
          {/* Accent bar */}
          <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

          <div className={cardHeaderCls}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <Send className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
              Νέα ειδοποίηση
            </span>
          </div>

          <div className="space-y-4 p-5">
            <FormField label="Τίτλος" labelCls={labelCls}>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="π.χ. Ανακοίνωση" />
            </FormField>

            <FormField label="Μήνυμα" labelCls={labelCls}>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Γράψε το μήνυμα…" rows={6} className={textareaCls} />
            </FormField>

            <FormField label="Τύπος" labelCls={labelCls}>
              <div className="relative">
                <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={selectCls}>
                  {(Object.entries(KIND_LABELS) as [Kind, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              </div>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Επιλεγμένο: <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{kindLabelSelected}</span>
              </p>
            </FormField>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Θα σταλεί σε <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>όλους</span> τους μαθητές.
              </p>
              <button onClick={send} disabled={loadingSend}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-accent)' }}>
                {loadingSend ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Αποστολή…</> : <><Send className="h-3.5 w-3.5" />Στείλε ειδοποίηση</>}
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{errorMsg}
              </div>
            )}
            {resultMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-200">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{resultMsg}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: History ── */}
        <div className={cardCls}>
          <div className={historyCardHeaderCls}>
            <div className="flex items-center gap-2.5">
              <div className={historyIconBoxCls}>
                <History className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                  Ιστορικό αποστολών
                </span>
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Τελευταίες 15 ειδοποιήσεις</p>
              </div>
            </div>
            <button type="button" onClick={loadHistory} className={refreshBtnCls}>
              <RefreshCw className="h-3 w-3" />
              Ανανέωση
            </button>
          </div>

          {historyError && (
            <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{historyError}
            </div>
          )}

          <div className="notif-scroll max-h-[520px] overflow-y-auto p-5">
            {historyLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={historySkeletonCls}>
                    <div className={`h-3 w-2/3 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    <div className={`mt-2 h-2.5 w-full rounded-full ${isDark ? 'bg-slate-800/70' : 'bg-slate-200/70'}`} />
                  </div>
                ))}
              </div>
            ) : historyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className={emptyBoxCls}>
                  <Bell className={`h-5 w-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν αποστολές ακόμα.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyItems.map((n) => {
                  const k = (n.kind as Kind) ?? 'general';
                  const badgeCls = isDark
                    ? (KIND_COLORS[k] ?? KIND_COLORS.general)
                    : (KIND_COLORS_LIGHT[k] ?? KIND_COLORS_LIGHT.general);
                  return (
                    <div key={n.id} className={historyItemCls}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{n.title}</p>
                          <p className={`mt-1 line-clamp-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{n.body}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeCls}`}>
                            {KIND_LABELS[k] ?? n.kind}
                          </span>
                          <span className={`text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatDt(n.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}