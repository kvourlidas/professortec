import { ChevronLeft, ChevronRight, MessageSquareText } from 'lucide-react';
import { Stars } from './Stars';
import type { RowVM } from './types';

interface FeedbackTableProps {
  loading: boolean;
  rows: RowVM[];
  total: number;
  page: number;
  pageCount: number;
  showingFrom: number;
  showingTo: number;
  onPrev: () => void;
  onNext: () => void;
  isDark: boolean;
}

const PAGE_SIZE = 10;

export function FeedbackTable({
  loading, rows, total, page, pageCount,
  showingFrom, showingTo, onPrev, onNext, isDark,
}: FeedbackTableProps) {
  const tableCardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const theadRowCls = isDark ? 'border-b border-slate-700/60 bg-slate-900/40' : 'border-b border-slate-200 bg-slate-50';
  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const trHoverCls = isDark ? 'group transition-colors hover:bg-white/[0.025]' : 'group transition-colors hover:bg-slate-50';

  const paginationBarCls = isDark
    ? 'flex items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-900/20 px-5 py-3'
    : 'flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3';

  const paginationBtnCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/30 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30';

  const paginationPageCls = isDark
    ? 'rounded-lg border border-slate-700/60 bg-slate-900/20 px-3 py-1 text-[11px] text-slate-300'
    : 'rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600';

  const emptyBoxCls = isDark
    ? 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';

  return (
    <div className={tableCardCls}>
      {loading ? (
        <div className={`space-y-0 divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
              <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
              <div className={`h-3 w-1/2 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className={emptyBoxCls}>
            <MessageSquareText className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>Δεν υπάρχουν αξιολογήσεις ακόμα.</p>
            <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Όταν οι μαθητές αφήσουν feedback, θα εμφανιστεί εδώ.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className={theadRowCls}>
                {['ΟΝΟΜΑΤΕΠΩΝΥΜΟ', 'ΑΞΙΟΛΟΓΗΣΗ', 'FEEDBACK'].map((label) => (
                  <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={tbodyDivideCls}>
              {rows.map((r) => (
                <tr key={r.studentId} className={trHoverCls}>
                  <td className="px-5 py-3.5">
                    <span className={`font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>
                      {r.fullName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.rating > 0
                      ? <Stars value={r.rating} />
                      : <span className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>—</span>}
                  </td>
                  <td className="px-5 py-3.5 max-w-lg">
                    {r.feedback.trim()
                      ? <p className={`whitespace-pre-wrap text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{r.feedback}</p>
                      : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className={paginationBarCls}>
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span>{' '}
            από <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{total}</span> αξιολογήσεις
          </p>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onPrev} disabled={page <= 1} className={paginationBtnCls}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className={paginationPageCls}>
              <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
              <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
            </div>
            <button type="button" onClick={onNext} disabled={page >= pageCount} className={paginationBtnCls}>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}