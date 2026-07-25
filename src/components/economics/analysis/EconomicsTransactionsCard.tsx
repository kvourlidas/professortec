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

  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const cardHeaderCls = isDark
    ? 'flex items-center justify-between border-b border-slate-800/70 bg-slate-900/30 px-4 py-3'
    : 'flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3';

  const txHeaderCls = isDark
    ? 'grid grid-cols-12 border-b border-slate-800/60 bg-slate-900/20 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest'
    : 'grid grid-cols-12 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest';

  const txDivideCls = isDark ? 'divide-y divide-slate-800/40' : 'divide-y divide-slate-100';

  const incomeChipCls = isDark
    ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300'
    : 'border-emerald-300 bg-emerald-50 text-emerald-700';

  const expenseChipCls = isDark
    ? 'border-rose-800/50 bg-rose-950/40 text-rose-300'
    : 'border-rose-300 bg-rose-50 text-rose-700';

  const txAmountIncomeCls = isDark ? 'text-emerald-400' : 'text-emerald-600';
  const txAmountExpenseCls = isDark ? 'text-rose-400' : 'text-rose-600';

  return (
    <div className={`${cardCls} lg:col-span-8`}>
      <div className={cardHeaderCls} style={{ background: 'var(--ch-bg)', borderColor: 'var(--ch-divider)' }}>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--ch-icon)' }}/>
          <span className="text-xs font-semibold" style={{ color: 'var(--ch-text)' }}>Κινήσεις (έσοδα / έξοδα)</span>
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
          <div className={txHeaderCls} style={{ color: 'color-mix(in srgb, var(--color-accent) 70%, white)' }}>
            <div className="col-span-2">Ημερομηνία</div>
            <div className="col-span-2">Τύπος</div>
            <div className="col-span-6">Περιγραφή</div>
            <div className="col-span-2 text-right">Ποσό</div>
          </div>
          <div className={txDivideCls}>
            {txPageRows.map(r => (
              <div
                key={`${r.source}-${r.id}`}
                className={`grid grid-cols-12 items-center px-4 py-2.5 text-xs transition-colors cursor-default select-none ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row: r }); }}
              >
                <div className={`col-span-2 tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.date}</div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.kind === 'income' ? incomeChipCls : expenseChipCls}`}>
                    {r.kind === 'income' ? 'Έσοδο' : 'Έξοδο'}
                  </span>
                </div>
                <div className={`col-span-6 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {r.label}{r.notes && <span className={isDark ? 'text-slate-600' : 'text-slate-400'}> — {r.notes}</span>}
                </div>
                <div className={`col-span-2 text-right font-semibold tabular-nums ${r.kind === 'income' ? txAmountIncomeCls : txAmountExpenseCls}`}>
                  {r.kind === 'income' ? '+' : '−'} {money(r.amount)}
                </div>
              </div>
            ))}
          </div>
          {txRows.length > PAGE_SIZE && (
            <div className={`border-t px-4 py-2.5 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
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
