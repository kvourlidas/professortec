import { useState } from 'react';
import { Bell, History, RefreshCw, ChevronLeft, ChevronRight, Users, GraduationCap, Globe, X } from 'lucide-react';
import type { NotificationRow } from './types';
import { formatDt } from './utils';

interface NotificationHistoryProps {
  historyLoading: boolean;
  historyError: string | null;
  historyItems: NotificationRow[];
  onRefresh: () => void;
  isDark: boolean;
}

const PAGE_SIZE = 4;

// ── Recipients modal ──────────────────────────────────────────────────────────
function RecipientsModal({
  n,
  isDark,
  onClose,
}: {
  n: NotificationRow;
  isDark: boolean;
  onClose: () => void;
}) {
  const mode = n.recipient_mode ?? 'all';
  const names = n.recipient_names ?? [];
  const modeLabel = mode === 'students' ? 'Μαθητές' : mode === 'classes' ? 'Τμήματα' : 'Όλοι οι μαθητές';
  const Icon = mode === 'students' ? Users : mode === 'classes' ? GraduationCap : Globe;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={[
          'relative w-full max-w-xs overflow-hidden rounded-2xl shadow-2xl',
          isDark
            ? 'border border-slate-700/60 bg-slate-900'
            : 'border border-slate-200 bg-white',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent line */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 25%, transparent))' }} />

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div>
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              Παραλήπτες
            </p>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {modeLabel}{mode !== 'all' && names.length > 0 ? ` · ${names.length}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Notification preview */}
        <div className={`border-b px-5 py-3.5 ${isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50'}`}>
          <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{n.title}</p>
          <p className={`mt-0.5 text-[11px] line-clamp-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{n.body}</p>
          <p className={`mt-1.5 text-[10px] tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{formatDt(n.created_at)}</p>
        </div>

        {/* Recipients list */}
        <div className="px-5 py-4">
          {mode === 'all' ? (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Globe className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
              Στάλθηκε σε όλους τους μαθητές
            </div>
          ) : names.length === 0 ? (
            <p className={`text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν δεδομένα.</p>
          ) : (
            <div
              className="space-y-1 max-h-52 overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(100,116,139,0.3) transparent' : 'rgba(148,163,184,0.3) transparent' }}
            >
              {names.map((name, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--color-accent)' }} />
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`border-t px-5 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-xl py-2 text-xs font-semibold transition ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Κλείσιμο
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recipient badge ───────────────────────────────────────────────────────────
function RecipientBadge({ n, isDark, onClick }: { n: NotificationRow; isDark: boolean; onClick: () => void }) {
  const mode = n.recipient_mode ?? 'all';
  const names = n.recipient_names ?? [];

  let label: string;
  let Icon: React.ElementType;
  if (mode === 'students') { label = `${names.length} Μαθητές`; Icon = Users; }
  else if (mode === 'classes') { label = `${names.length} Τμήματα`; Icon = GraduationCap; }
  else { label = 'Όλοι'; Icon = Globe; }

  const isClickable = mode !== 'all' || true; // always clickable for consistency

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all',
        isDark
          ? 'border-slate-600/50 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-700/60'
          : 'border-slate-300 bg-slate-100 text-slate-600 hover:border-slate-400 hover:bg-slate-200',
      ].join(' ')}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function NotificationHistory({
  historyLoading, historyError, historyItems, onRefresh, isDark,
}: NotificationHistoryProps) {
  const [page, setPage] = useState(1);
  const [modalItem, setModalItem] = useState<NotificationRow | null>(null);

  const pageCount = Math.max(1, Math.ceil(historyItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = historyItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const cardCls = isDark
    ? 'flex flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const headerCls = isDark
    ? 'flex items-center justify-between gap-3 border-b border-slate-700/60 bg-slate-900/30 px-5 py-3.5'
    : 'flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5';

  const iconBoxCls = isDark
    ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50'
    : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100';

  const refreshBtnCls = isDark
    ? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-700/60'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50';

  const skeletonCls = isDark
    ? 'animate-pulse rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3'
    : 'animate-pulse rounded-xl border border-slate-200 bg-slate-50 px-4 py-3';

  const itemCls = isDark
    ? 'rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3 transition hover:bg-slate-800/30'
    : 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100';

  const emptyBoxCls = isDark
    ? 'flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';

  const paginationBtnCls = (disabled: boolean) => [
    'inline-flex h-7 w-7 items-center justify-center rounded-lg border transition',
    disabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer',
    isDark
      ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200'
      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700',
  ].join(' ');

  return (
    <>
      <div className={cardCls}>
        {/* Header */}
        <div className={headerCls}>
          <div className="flex items-center gap-2.5">
            <div className={iconBoxCls}>
              <History className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                Ιστορικό αποστολών
              </span>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {historyItems.length > 0 ? `${historyItems.length} ειδοποιήσεις` : 'Τελευταίες αποστολές'}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => { onRefresh(); setPage(1); }} className={refreshBtnCls}>
            <RefreshCw className="h-3 w-3" />
            Ανανέωση
          </button>
        </div>

        {/* Error */}
        {historyError && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{historyError}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 p-5">
          {historyLoading ? (
            <div className="space-y-2">
              {[...Array(PAGE_SIZE)].map((_, i) => (
                <div key={i} className={skeletonCls}>
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
              {paged.map((n) => (
                <div key={n.id} className={itemCls}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{n.title}</p>
                      <p className={`mt-1 line-clamp-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{n.body}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <RecipientBadge n={n} isDark={isDark} onClick={() => setModalItem(n)} />
                      <span className={`text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatDt(n.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!historyLoading && historyItems.length > PAGE_SIZE && (
          <div className={`flex items-center justify-between border-t px-5 py-3 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'font-medium text-slate-300' : 'font-medium text-slate-600'}>
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, historyItems.length)}
              </span>
              {' '}από{' '}
              <span className={isDark ? 'font-medium text-slate-300' : 'font-medium text-slate-600'}>
                {historyItems.length}
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className={paginationBtnCls(safePage <= 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className={`rounded-lg border px-3 py-1 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-900/20 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{safePage}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className={paginationBtnCls(safePage >= pageCount)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalItem && (
        <RecipientsModal n={modalItem} isDark={isDark} onClose={() => setModalItem(null)} />
      )}
    </>
  );
}