import { useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';
import { useOutsideClose } from './useOutsideClose';
import { monthLabelEl } from './utils';
import type { Mode } from './types';

interface EconomicsFilterBarProps {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  month: number;
  onMonthChange: (m: number) => void;
  year: number;
  onYearChange: (y: number) => void;
  rangeStart: string;
  onRangeStartChange: (v: string) => void;
  rangeEnd: string;
  onRangeEndChange: (v: string) => void;
  monthsOptions: { value: number; label: string }[];
  yearsOptions: { value: number; label: string }[];
  isDark: boolean;
}

export function EconomicsFilterBar({
  mode, onModeChange, month, onMonthChange, year, onYearChange,
  rangeStart, onRangeStartChange, rangeEnd, onRangeEndChange,
  monthsOptions, yearsOptions, isDark,
}: EconomicsFilterBarProps) {
  const [openMonth, setOpenMonth] = useState(false);
  const [openYear, setOpenYear] = useState(false);
  const monthWrapRef = useRef<HTMLDivElement | null>(null);
  const yearWrapRef = useRef<HTMLDivElement | null>(null);
  useOutsideClose([monthWrapRef, yearWrapRef], () => { setOpenMonth(false); setOpenYear(false); }, openMonth || openYear);

  const filterBarCls = isDark
    ? 'flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 backdrop-blur'
    : 'flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm';

  const filterSelectCls = isDark
    ? 'rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 outline-none focus:border-[color:var(--color-accent)]'
    : 'rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[color:var(--color-accent)]';

  const dropdownBtnCls = isDark
    ? 'inline-flex items-center justify-between gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-200 transition hover:border-slate-600 hover:bg-slate-800/60'
    : 'inline-flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-700 transition hover:border-slate-400 hover:bg-slate-50';

  const dropdownPanelCls = isDark
    ? 'absolute left-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/95 shadow-2xl backdrop-blur-xl'
    : 'absolute left-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl';

  const dropdownItemCls = (active: boolean) => isDark
    ? `w-full rounded-lg px-3 py-2 text-left text-[11px] transition ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.05]'}`
    : `w-full rounded-lg px-3 py-2 text-left text-[11px] transition ${active ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`;

  const DropdownShell = ({ label, open, onToggle, children, widthClass }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode; widthClass?: string }) => (
    <div className="relative">
      <button type="button" onClick={onToggle} className={`${dropdownBtnCls} ${widthClass ?? 'w-[150px]'}`} aria-haspopup="dialog" aria-expanded={open}>
        <span className="truncate">{label}</span>
        <ChevronDown size={13} className="shrink-0 text-slate-400"/>
      </button>
      {open && <div className={dropdownPanelCls} role="dialog">{children}</div>}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={filterBarCls}>
        <CalendarDays className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}/>
        <select value={mode} onChange={e => onModeChange(e.target.value as Mode)} className={filterSelectCls}>
          <option value="month">Μηνιαία</option>
          <option value="year">Ετήσια</option>
          <option value="range">Εύρος ημερομηνιών</option>
        </select>
      </div>

      {mode === 'month' && (
        <div className={filterBarCls}>
          <div ref={monthWrapRef}>
            <DropdownShell label={monthLabelEl(month)} open={openMonth} onToggle={() => { setOpenYear(false); setOpenMonth(v=>!v); }} widthClass="w-[148px]">
              <div className="max-h-64 overflow-auto p-1">
                {monthsOptions.map(m => (
                  <button key={m.value} type="button" onClick={() => { onMonthChange(m.value); setOpenMonth(false); }} className={dropdownItemCls(m.value===month)}>{m.label}</button>
                ))}
              </div>
            </DropdownShell>
          </div>
          <div ref={yearWrapRef}>
            <DropdownShell label={String(year)} open={openYear} onToggle={() => { setOpenMonth(false); setOpenYear(v=>!v); }} widthClass="w-[80px]">
              <div className="max-h-64 overflow-auto p-1">
                {yearsOptions.map(y => (
                  <button key={y.value} type="button" onClick={() => { onYearChange(y.value); setOpenYear(false); }} className={dropdownItemCls(y.value===year)}>{y.label}</button>
                ))}
              </div>
            </DropdownShell>
          </div>
        </div>
      )}

      {mode === 'year' && (
        <div className={filterBarCls}>
          <div ref={yearWrapRef}>
            <DropdownShell label={String(year)} open={openYear} onToggle={() => { setOpenMonth(false); setOpenYear(v=>!v); }} widthClass="w-[80px]">
              <div className="max-h-64 overflow-auto p-1">
                {yearsOptions.map(y => (
                  <button key={y.value} type="button" onClick={() => { onYearChange(y.value); setOpenYear(false); }} className={dropdownItemCls(y.value===year)}>{y.label}</button>
                ))}
              </div>
            </DropdownShell>
          </div>
        </div>
      )}

      {mode === 'range' && (
        <div className={`flex flex-wrap items-center gap-2 ${filterBarCls}`}>
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Από</span>
          <div className="min-w-[160px]"><AppDatePicker value={rangeStart as never} onChange={(v: never) => onRangeStartChange(v)}/></div>
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Έως</span>
          <div className="min-w-[160px]"><AppDatePicker value={rangeEnd as never} onChange={(v: never) => onRangeEndChange(v)}/></div>
        </div>
      )}
    </div>
  );
}
