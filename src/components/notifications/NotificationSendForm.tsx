import React from 'react';
import { Send, ChevronDown, Loader2 } from 'lucide-react';
import type { Kind } from './types';
import { KIND_LABELS } from './constants';

interface NotificationSendFormProps {
  title: string;
  onTitleChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
  kind: Kind;
  onKindChange: (v: Kind) => void;
  kindLabelSelected: string;
  loadingSend: boolean;
  errorMsg: string | null;
  resultMsg: string | null;
  onSend: () => void;
  isDark: boolean;
}

export function NotificationSendForm({
  title, onTitleChange, body, onBodyChange, kind, onKindChange,
  kindLabelSelected, loadingSend, errorMsg, resultMsg, onSend, isDark,
}: NotificationSendFormProps) {
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

  const labelCls = `text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className={cardCls}>
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
        <div className="space-y-1.5">
          <label className={labelCls}>Τίτλος</label>
          <input className={inputCls} value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="π.χ. Ανακοίνωση" />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Μήνυμα</label>
          <textarea value={body} onChange={(e) => onBodyChange(e.target.value)} placeholder="Γράψε το μήνυμα…" rows={6} className={textareaCls} />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Τύπος</label>
          <div className="relative">
            <select value={kind} onChange={(e) => onKindChange(e.target.value as Kind)} className={selectCls}>
              {(Object.entries(KIND_LABELS) as [Kind, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          </div>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Επιλεγμένο: <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{kindLabelSelected}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Θα σταλεί σε <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>όλους</span> τους μαθητές.
          </p>
          <button onClick={onSend} disabled={loadingSend}
            className="btn-primary gap-2 rounded-xl px-5 py-2.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60">
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
  );
}
