import { Bell, History, RefreshCw } from 'lucide-react';
import type { Kind, NotificationRow } from './types';
import { KIND_LABELS, KIND_COLORS, KIND_COLORS_LIGHT } from './constants';
import { formatDt } from './utils';

interface NotificationHistoryProps {
  historyLoading: boolean;
  historyError: string | null;
  historyItems: NotificationRow[];
  onRefresh: () => void;
  isDark: boolean;
}

export function NotificationHistory({
  historyLoading, historyError, historyItems, onRefresh, isDark,
}: NotificationHistoryProps) {
  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const historyCardHeaderCls = isDark
    ? 'flex items-center justify-between gap-3 border-b border-slate-700/60 bg-slate-900/30 px-5 py-3.5'
    : 'flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5';

  const historyIconBoxCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100';

  const refreshBtnCls = isDark
    ? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-700/60'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50';

  const historySkeletonCls = isDark
    ? 'animate-pulse rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3'
    : 'animate-pulse rounded-xl border border-slate-200 bg-slate-50 px-4 py-3';

  const historyItemCls = isDark
    ? 'rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3 transition hover:bg-slate-800/30'
    : 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100';

  const emptyBoxCls = isDark
    ? 'flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';

  return (
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
        <button type="button" onClick={onRefresh} className={refreshBtnCls}>
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
  );
}
