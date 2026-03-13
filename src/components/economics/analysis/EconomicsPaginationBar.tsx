import { ChevronLeft, ChevronRight } from 'lucide-react';

interface EconomicsPaginationBarProps {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  isDark: boolean;
}

export function EconomicsPaginationBar({ page, total, onPrev, onNext, isDark }: EconomicsPaginationBarProps) {
  const btnCls = isDark
    ? 'flex h-6 w-6 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/40 text-slate-400 transition hover:bg-slate-800/50 hover:text-slate-200 disabled:opacity-30'
    : 'flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30';

  const textCls = isDark ? 'min-w-[48px] text-center text-[11px] text-slate-400' : 'min-w-[48px] text-center text-[11px] text-slate-500';

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onPrev} disabled={page <= 1} className={btnCls}><ChevronLeft className="h-3 w-3"/></button>
      <span className={textCls}><span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{page}</span> / {total}</span>
      <button type="button" onClick={onNext} disabled={page >= total} className={btnCls}><ChevronRight className="h-3 w-3"/></button>
    </div>
  );
}
