import { money } from './utils';

interface IncomeExpenseDonutProps {
  income: number;
  expense: number;
  isDark: boolean;
}

export function IncomeExpenseDonut({ income, expense, isDark }: IncomeExpenseDonutProps) {
  const inc = Math.max(0, Number(income)||0);
  const exp = Math.max(0, Number(expense)||0);
  const total = inc + exp;
  const incPct = total > 0 ? (inc/total)*100 : 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-16 w-16 shrink-0 rounded-full"
        style={{ background: total > 0 ? `conic-gradient(rgba(52,211,153,0.85) 0 ${incPct}%, rgba(251,113,133,0.80) ${incPct}% 100%)` : 'conic-gradient(rgba(100,116,139,0.25) 0 100%)' }}>
        <div className={`absolute inset-2.5 rounded-full ring-1 ring-inset ${isDark ? 'bg-slate-950/80 ring-white/[0.04]' : 'bg-white ring-slate-100'}`}/>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400/80"/>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Έσοδα</span>
          <span className={`font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>{money(inc)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-400/80"/>
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Έξοδα</span>
          <span className={`font-semibold ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>{money(exp)}</span>
        </div>
      </div>
    </div>
  );
}
