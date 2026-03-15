import { Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { SubscriptionTableRow } from './SubscriptionTableRow';
import type { PackageRow, StudentViewRow } from './types';

interface Props {
  rows: StudentViewRow[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageCount: number;
  showingFrom: number;
  showingTo: number;
  isDark: boolean;
  packageById: Map<string, PackageRow>;
  onPageChange: (p: number) => void;
  onOpenAssign: () => void;
  onPayment: (row: StudentViewRow) => void;
  onRenew: (row: StudentViewRow) => void;
  onDelete: (row: StudentViewRow) => void;
}

export function SubscriptionsTable({
  rows, loading, totalCount, page, pageCount, showingFrom, showingTo, isDark, packageById,
  onPageChange, onOpenAssign, onPayment, onRenew, onDelete,
}: Props) {
  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const theadCls = isDark
    ? 'border-b border-slate-800/60 bg-slate-900/40 text-[10px] font-semibold uppercase tracking-widest'
    : 'border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-widest';

  const paginationBarCls = isDark
    ? 'flex items-center justify-between gap-3 border-t border-slate-800/60 bg-slate-900/20 px-4 py-3'
    : 'flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3';

  const paginationBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/40 text-slate-400 transition hover:bg-slate-800/50 hover:text-slate-200 disabled:opacity-30'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30';

  return (
    <div className={cardCls}>
      {/* Table header bar */}
      <div className={`flex items-center justify-between px-5 py-3.5 ${isDark ? 'border-b border-slate-800/60 bg-slate-900/30' : 'border-b border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Ενεργές συνδρομές</span>
          {!loading && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-slate-700/60 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
              {totalCount}
            </span>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${isDark ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
          <CheckCircle2 className="h-3 w-3" />Ενεργά μόνο
        </span>
      </div>

      <div className="overflow-x-auto ss-thin">
        {loading ? (
          <div className={`flex items-center gap-2.5 px-6 py-10 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-accent)' }} />Φόρτωση…
          </div>
        ) : rows.length === 0 ? (
          <div className={`flex flex-col items-center gap-3 py-14 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Briefcase className="h-8 w-8 opacity-30" />
            <p className="text-sm">Δεν βρέθηκαν ενεργές συνδρομές.</p>
            <button type="button" onClick={onOpenAssign} className="text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>
              Ανάθεση πρώτης συνδρομής
            </button>
          </div>
        ) : (
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className={theadCls} style={{ color: 'color-mix(in srgb, var(--color-accent) 70%, white)' }}>
                <th className="px-4 py-3 text-left">Μαθητής</th>
                <th className="px-4 py-3 text-left">Πακέτο</th>
                <th className="px-4 py-3 text-left">Διάστημα</th>
                <th className="px-4 py-3 text-right">Τιμή</th>
                <th className="px-4 py-3 text-right">Πληρώθηκε</th>
                <th className="px-4 py-3 text-right">Υπόλοιπο</th>
                <th className="px-4 py-3 text-left">Κατάσταση</th>
                <th className="px-4 py-3 text-right">Ενέργειες</th>
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-slate-800/40' : 'divide-y divide-slate-100'}>
              {rows.map(r => (
                <SubscriptionTableRow
                  key={`${r.student_id}-${r.sub?.id}`}
                  row={r}
                  isDark={isDark}
                  packageById={packageById}
                  onPayment={onPayment}
                  onRenew={onRenew}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && totalCount > 0 && (
        <div className={paginationBarCls}>
          <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Εμφάνιση{' '}
            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span>{' '}
            από{' '}
            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{totalCount}</span>
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className={paginationBtnCls}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className={`min-w-[56px] text-center text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{page}</span> / {pageCount}
            </span>
            <button type="button" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} className={paginationBtnCls}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
