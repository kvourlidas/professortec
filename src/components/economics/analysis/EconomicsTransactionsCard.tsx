import { useState } from 'react';
import { Ban, TrendingUp } from 'lucide-react';
import { EconomicsPaginationBar } from './EconomicsPaginationBar';
import { money } from '../utils';
import { PAGE_SIZE } from '../constants';
import type { TxRow } from '../types';

interface EconomicsTransactionsCardProps {
  txRows: TxRow[];
  txPageRows: TxRow[];
  txPage: number;
  txTotalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onCancel?: (row: TxRow) => void;
  busy?: boolean;
  isDark: boolean;
}

export function EconomicsTransactionsCard({
  txRows, txPageRows, txPage, txTotalPages, onPrev, onNext, onCancel, isDark,
}: EconomicsTransactionsCardProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: TxRow } | null>(null);

  const cardHeaderCls = 'flex items-center justify-between pb-3';

  const txHeaderCls = 'grid grid-cols-12 text-xs font-bold uppercase tracking-wide';

  const txDivideCls = isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200';
  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';
  const trHoverCls = isDark ? 'transition-colors hover:bg-slate-900/40' : 'transition-colors hover:bg-slate-50/80';

  const incomeChipCls = isDark
    ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300'
    : 'border-emerald-300 bg-emerald-50 text-emerald-700';

  const expenseChipCls = isDark
    ? 'border-rose-800/50 bg-rose-950/40 text-rose-300'
    : 'border-rose-300 bg-rose-50 text-rose-700';

  const txAmountIncomeCls = isDark ? 'text-emerald-400' : 'text-emerald-600';
  const txAmountExpenseCls = isDark ? 'text-rose-400' : 'text-rose-600';

  return (
    <div>
      <div className={cardHeaderCls}>
        <div className="flex items-center gap-2">
          <TrendingUp className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Κινήσεις (έσοδα / έξοδα)</span>
        </div>
        {txRows.length > PAGE_SIZE && (
          <EconomicsPaginationBar page={txPage} total={txTotalPages} onPrev={onPrev} onNext={onNext} isDark={isDark}/>
        )}
      </div>

      {txRows.length === 0 ? (
        <div className={`flex items-center justify-center py-12 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Δεν υπάρχουν κινήσεις στο φίλτρο.
        </div>
      ) : (
        <>
          <div className={txHeaderCls} style={{ borderBottom: '2px solid var(--color-accent)' }}>
            <div style={{ width: '1%' }} className={`col-span-1 whitespace-nowrap px-3 pb-3 ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>#</div>
            <div className={`col-span-2 px-3 pb-3 ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Ημερομηνία</div>
            <div className={`col-span-2 px-3 pb-3 ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Τύπος</div>
            <div className={`col-span-5 px-3 pb-3 ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>Περιγραφή</div>
            <div className={`col-span-2 px-3 pb-3 text-right ${isDark ? 'text-white' : 'text-black'}`}>Ποσό</div>
          </div>
          <div className={txDivideCls}>
            {txPageRows.map((r, i) => (
              <div
                key={`${r.source}-${r.id}`}
                className={`grid grid-cols-12 items-center py-2.5 text-xs cursor-default select-none ${trHoverCls}`}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row: r }); }}
              >
                <div className={`col-span-1 whitespace-nowrap px-3 tabular-nums ${colDivider} ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{(txPage - 1) * PAGE_SIZE + i + 1}</div>
                <div className={`col-span-2 px-3 tabular-nums ${colDivider} ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.date}</div>
                <div className={`col-span-2 px-3 ${colDivider}`}>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.kind === 'income' ? incomeChipCls : expenseChipCls}`}>
                    {r.kind === 'income' ? 'Έσοδο' : 'Έξοδο'}
                  </span>
                </div>
                <div className={`col-span-5 px-3 truncate ${colDivider} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {r.label}{r.notes && <span className={isDark ? 'text-slate-600' : 'text-slate-400'}> — {r.notes}</span>}
                </div>
                <div className={`col-span-2 px-3 text-right font-semibold tabular-nums ${r.kind === 'income' ? txAmountIncomeCls : txAmountExpenseCls}`}>
                  {r.kind === 'income' ? '+' : '−'} {money(r.amount)}
                </div>
              </div>
            ))}
          </div>
          {txRows.length > PAGE_SIZE && (
            <div className="pt-3">
              <p className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Εμφάνιση {Math.min(txRows.length, (txPage - 1) * PAGE_SIZE + 1)}–{Math.min(txRows.length, txPage * PAGE_SIZE)} από {txRows.length}
              </p>
            </div>
          )}
        </>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
          onContextMenu={e => { e.preventDefault(); setContextMenu(null); }}
        >
          <div
            className={`absolute z-50 min-w-[160px] overflow-hidden rounded-xl border shadow-2xl ${isDark ? 'border-white/10 bg-slate-900/95' : 'border-slate-200 bg-white/95'}`}
            style={{ left: contextMenu.x, top: contextMenu.y, backdropFilter: 'blur(16px)' }}
            onClick={e => e.stopPropagation()}
          >
            {onCancel && (
              <button
                type="button"
                onClick={() => { onCancel(contextMenu.row); setContextMenu(null); }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium transition-colors ${isDark ? 'text-red-400 hover:bg-red-950/40' : 'text-red-600 hover:bg-red-50'}`}
              >
                <Ban className="h-3.5 w-3.5" />
                Ακύρωση κίνησης
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
