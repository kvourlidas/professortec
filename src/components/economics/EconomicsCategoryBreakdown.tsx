import { Tag } from 'lucide-react';
import { EconomicsPaginationBar } from './EconomicsPaginationBar';
import { money } from './utils';
import { PAGE_SIZE } from './constants';

interface EconomicsCategoryBreakdownProps {
  expenseByCategory: { category: string; amount: number }[];
  catPageRows: { category: string; amount: number }[];
  catPage: number;
  catTotalPages: number;
  onPrev: () => void;
  onNext: () => void;
  isDark: boolean;
}

export function EconomicsCategoryBreakdown({
  expenseByCategory, catPageRows, catPage, catTotalPages, onPrev, onNext, isDark,
}: EconomicsCategoryBreakdownProps) {
  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const cardHeaderCls = isDark
    ? 'flex items-center justify-between border-b border-slate-800/70 bg-slate-900/30 px-4 py-3'
    : 'flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3';

  const catItemCls = isDark
    ? 'rounded-xl border border-slate-800/60 bg-slate-900/30 px-3 py-2.5'
    : 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5';

  const catBarBgCls = isDark ? 'bg-slate-800/60' : 'bg-slate-200';

  return (
    <div className={`${cardCls} lg:col-span-4`}>
      <div className={cardHeaderCls}>
        <div className="flex items-center gap-2">
          <Tag className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}/>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Έξοδα ανά κατηγορία</span>
        </div>
        {expenseByCategory.length > PAGE_SIZE && (
          <EconomicsPaginationBar page={catPage} total={catTotalPages} onPrev={onPrev} onNext={onNext} isDark={isDark}/>
        )}
      </div>
      <div className="space-y-2 p-4">
        {expenseByCategory.length === 0 ? (
          <p className={`py-6 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν έξοδα στο φίλτρο.</p>
        ) : catPageRows.map(c => {
          const maxAmt = Math.max(1, ...expenseByCategory.map(x => x.amount));
          const w = Math.round((c.amount/maxAmt)*100);
          return (
            <div key={c.category} className={catItemCls}>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className={`truncate font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>{c.category}</span>
                <span className={`shrink-0 pl-2 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{money(c.amount)}</span>
              </div>
              <div className={`h-1.5 w-full overflow-hidden rounded-full ${catBarBgCls}`}>
                <div className={`h-1.5 rounded-full transition-all ${isDark ? 'bg-rose-400/60' : 'bg-rose-400'}`} style={{ width: `${w}%` }}/>
              </div>
            </div>
          );
        })}
        {expenseByCategory.length > PAGE_SIZE && (
          <p className={`pt-1 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Εμφάνιση {Math.min(expenseByCategory.length,(catPage-1)*PAGE_SIZE+1)}–{Math.min(expenseByCategory.length,catPage*PAGE_SIZE)} από {expenseByCategory.length}
          </p>
        )}
      </div>
    </div>
  );
}
