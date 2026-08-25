import { useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Check } from 'lucide-react';
import AppDatePicker from '../../ui/AppDatePicker';
import { useOutsideClose } from '../useOutsideClose';
import { monthLabelEl } from '../utils';
import type { Mode } from '../types';

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
  schoolYearId: string;
  onSchoolYearIdChange: (id: string) => void;
  schoolYearsOptions: { value: string; label: string }[];
  isDark: boolean;
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'month', label: 'Μήνας' },
  { value: 'year', label: 'Έτος' },
  { value: 'schoolYear', label: 'Σχολικό έτος' },
  { value: 'range', label: 'Εύρος' },
];

export function EconomicsFilterBar({
  mode, onModeChange, month, onMonthChange, year, onYearChange,
  rangeStart, onRangeStartChange, rangeEnd, onRangeEndChange,
  monthsOptions, yearsOptions, schoolYearId, onSchoolYearIdChange, schoolYearsOptions, isDark,
}: EconomicsFilterBarProps) {
  const [openMonth, setOpenMonth] = useState(false);
  const [openYear, setOpenYear] = useState(false);
  const [openSchoolYear, setOpenSchoolYear] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const monthWrapRef = useRef<HTMLDivElement | null>(null);
  const yearWrapRef = useRef<HTMLDivElement | null>(null);
  const schoolYearWrapRef = useRef<HTMLDivElement | null>(null);
  useOutsideClose([monthWrapRef, yearWrapRef, schoolYearWrapRef], () => { setOpenMonth(false); setOpenYear(false); setOpenSchoolYear(false); }, openMonth || openYear || openSchoolYear);

  const dropdownBtnCls = (open: boolean) => [
    'inline-flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all duration-150',
    isDark
      ? `border ${open ? 'border-[color:var(--color-accent)]/60 bg-slate-800 text-slate-100 shadow-lg shadow-black/30' : 'border-slate-700/60 bg-slate-900/60 text-slate-200 hover:border-slate-600 hover:bg-slate-800/80'}`
      : `border ${open ? 'border-[color:var(--color-accent)]/50 bg-white text-slate-800 shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-sm'}`,
  ].join(' ');

  const dropdownPanelCls = isDark
    ? 'absolute left-0 z-[200] mt-2 w-full overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/50'
    : 'absolute left-0 z-[200] mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80';

  const dropdownItemCls = (active: boolean) => [
    'group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition-all duration-100',
    active
      ? (isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold')
      : (isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'),
  ].join(' ');
  const dropdownItemStyle = (hovered: boolean) => (hovered ? { backgroundColor: 'color-mix(in srgb, var(--color-accent) 16%, transparent)' } : undefined);

  const DropdownShell = ({
    label, open, onToggle, children, widthClass,
  }: {
    label: string; open: boolean; onToggle: () => void; children: React.ReactNode; widthClass?: string;
  }) => (
    <div className="relative">
      <button type="button" onClick={onToggle} className={`${dropdownBtnCls(open)} ${widthClass ?? 'w-[152px]'}`} aria-haspopup="listbox" aria-expanded={open}>
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-[color:var(--color-accent)]' : isDark ? 'text-slate-500' : 'text-slate-400'}`}/>
      </button>
      {open && (
        <div className={dropdownPanelCls} role="listbox">
          <div className="dropdown-scrollbar max-h-64 overflow-auto p-1.5">{children}</div>
        </div>
      )}
    </div>
  );

  const pillWrapCls = isDark
    ? 'flex items-center gap-0.5 rounded-xl border border-slate-700/60 bg-slate-900/60 p-1'
    : 'flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-sm';

  const pillBtnCls = (active: boolean) => [
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
    active
      ? isDark ? 'bg-slate-700 text-white shadow-sm shadow-black/30' : 'bg-white text-slate-800 shadow-sm shadow-slate-200'
      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700',
  ].join(' ');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className={pillWrapCls}>
        <CalendarDays className={`ml-1.5 mr-0.5 h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        {MODES.map(m => (
          <button key={m.value} type="button" onClick={() => onModeChange(m.value)} className={pillBtnCls(mode === m.value)}>{m.label}</button>
        ))}
      </div>

      {mode === 'month' && (
        <div className="flex items-center gap-2">
          <div ref={monthWrapRef}>
            <DropdownShell label={monthLabelEl(month)} open={openMonth} onToggle={() => { setOpenYear(false); setOpenMonth(v => !v); }} widthClass="w-[152px]">
              {monthsOptions.map(m => (
                <button key={m.value} type="button" role="option" aria-selected={m.value === month}
                  onClick={() => { onMonthChange(m.value); setOpenMonth(false); }}
                  onMouseEnter={() => setHoveredMonth(m.value)} onMouseLeave={() => setHoveredMonth(h => (h === m.value ? null : h))}
                  style={dropdownItemStyle(hoveredMonth === m.value)}
                  className={dropdownItemCls(m.value === month)}>
                  {m.label}{m.value === month && <Check size={13} className="shrink-0 text-[color:var(--color-accent)]" />}
                </button>
              ))}
            </DropdownShell>
          </div>
          <div ref={yearWrapRef}>
            <DropdownShell label={String(year)} open={openYear} onToggle={() => { setOpenMonth(false); setOpenYear(v => !v); }} widthClass="w-[90px]">
              {yearsOptions.map(y => (
                <button key={y.value} type="button" role="option" aria-selected={y.value === year}
                  onClick={() => { onYearChange(y.value); setOpenYear(false); }}
                  onMouseEnter={() => setHoveredYear(y.value)} onMouseLeave={() => setHoveredYear(h => (h === y.value ? null : h))}
                  style={dropdownItemStyle(hoveredYear === y.value)}
                  className={dropdownItemCls(y.value === year)}>
                  {y.label}{y.value === year && <Check size={13} className="shrink-0 text-[color:var(--color-accent)]" />}
                </button>
              ))}
            </DropdownShell>
          </div>
        </div>
      )}

      {mode === 'year' && (
        <div ref={yearWrapRef}>
          <DropdownShell label={String(year)} open={openYear} onToggle={() => { setOpenMonth(false); setOpenYear(v => !v); }} widthClass="w-[90px]">
            {yearsOptions.map(y => (
              <button key={y.value} type="button" role="option" aria-selected={y.value === year} onClick={() => { onYearChange(y.value); setOpenYear(false); }} className={dropdownItemCls(y.value === year)}>
                {y.label}{y.value === year && <Check size={13} className="shrink-0 text-[color:var(--color-accent)]" />}
              </button>
            ))}
          </DropdownShell>
        </div>
      )}

      {mode === 'schoolYear' && (
        <div ref={schoolYearWrapRef}>
          <DropdownShell
            label={schoolYearsOptions.find(y => y.value === schoolYearId)?.label ?? 'Επιλέξτε έτος'}
            open={openSchoolYear} onToggle={() => { setOpenMonth(false); setOpenYear(false); setOpenSchoolYear(v => !v); }} widthClass="w-[160px]">
            {schoolYearsOptions.length === 0 && (
              <p className={`px-3 py-2 text-[12px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Χωρίς σχολικά έτη</p>
            )}
            {schoolYearsOptions.map(y => (
              <button key={y.value} type="button" role="option" aria-selected={y.value === schoolYearId} onClick={() => { onSchoolYearIdChange(y.value); setOpenSchoolYear(false); }} className={dropdownItemCls(y.value === schoolYearId)}>
                {y.label}{y.value === schoolYearId && <Check size={13} className="shrink-0 text-[color:var(--color-accent)]" />}
              </button>
            ))}
          </DropdownShell>
        </div>
      )}

      {mode === 'range' && (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'border-slate-700/50 bg-slate-900/60' : 'border-slate-200 bg-white shadow-sm'}`}>
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Από</span>
          <div className="min-w-[160px]"><AppDatePicker value={rangeStart} onChange={onRangeStartChange} /></div>
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Έως</span>
          <div className="min-w-[160px]"><AppDatePicker value={rangeEnd} onChange={onRangeEndChange} /></div>
        </div>
      )}
    </div>
  );
}
