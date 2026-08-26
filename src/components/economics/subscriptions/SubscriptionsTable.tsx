import { Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
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
  variant: 'active' | 'expired';
  onPageChange: (p: number) => void;
  onOpenAssign: () => void;
  onGoToStudent: (row: StudentViewRow) => void;
  onRenew: (row: StudentViewRow) => void;
  onCancel: (row: StudentViewRow) => void;
}

export function SubscriptionsTable({
  rows, loading, totalCount, page, pageCount, showingFrom, showingTo, isDark, packageById,
  variant, onPageChange, onOpenAssign, onGoToStudent, onRenew, onCancel,
}: Props) {
  const isExpiredVariant = variant === 'expired';

  const cardCls = '';
  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';

  const paginationBarCls = 'flex items-center justify-between gap-3 pt-3';

  const paginationBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30'
    : 'flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30';

  const headerLabel  = isExpiredVariant ? 'Ληγμένες & ανανεωμένες συνδρομές' : 'Ενεργές συνδρομές';
  const emptyMessage = isExpiredVariant ? 'Δεν βρέθηκαν ληγμένες συνδρομές.' : 'Δεν βρέθηκαν ενεργές συνδρομές.';

  const badgeCls = isExpiredVariant
    ? (isDark ? 'border-rose-500/20 bg-rose-500/10 text-rose-400' : 'border-rose-200 bg-rose-50 text-rose-600')
    : (isDark ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-600');

  return (
    <div className={cardCls}>
      {/* Section header */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {headerLabel}
          </span>
          {!loading && (
            <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {totalCount}
            </span>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${badgeCls}`}>
          {isExpiredVariant ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {isExpiredVariant ? 'Ληγμένα' : 'Ενεργά'}
        </span>
      </div>

      <div className="overflow-x-auto ss-thin">
        {loading ? (
          <div className={`flex items-center gap-2.5 px-1 py-10 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-accent)' }} />Φόρτωση…
          </div>
        ) : rows.length === 0 ? (
          <div className={`flex flex-col items-center gap-3 py-14 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <Briefcase className="h-8 w-8 opacity-30" />
            <p className="text-sm">{emptyMessage}</p>
            {!isExpiredVariant && (
              <button type="button" onClick={onOpenAssign} className="text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>
                Ανάθεση πρώτης συνδρομής
              </button>
            )}
          </div>
        ) : (
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-accent)' }}>
                <th style={{ width: '1%' }} className={`whitespace-nowrap px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>#</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Μαθητης</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Πακετο</th>
                <th className={`px-4 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Διαστημα</th>
                <th className={`px-4 pb-3 text-right text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Τιμη</th>
                <th className={`px-4 pb-3 text-right text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>Ενεργειες</th>
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200'}>
              {rows.map((r, i) => (
                <SubscriptionTableRow
                  key={`${r.student_id}-${r.sub?.id}`}
                  rowNumber={showingFrom + i}
                  row={r}
                  isDark={isDark}
                  packageById={packageById}
                  onGoToStudent={onGoToStudent}
                  onRenew={onRenew}
                  onCancel={onCancel}
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