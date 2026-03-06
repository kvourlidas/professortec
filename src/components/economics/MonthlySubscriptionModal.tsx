import { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';
import { useTheme } from '../../context/ThemeContext';

export type PeriodMode = 'range' | 'month';

type MonthOption = { value: string; label: string };

type Props = {
  open: boolean;
  studentName: string;
  packageName: string;
  yearOptions: string[];
  monthOptions: MonthOption[];
  initialMode: PeriodMode;
  initialMonth: string; // "01".."12"
  initialYear: string;  // "2025"
  initialStart: string; // dd/mm/yyyy
  initialEnd: string;   // dd/mm/yyyy
  onCancel: () => void;
  onSave: (payload: {
    mode: PeriodMode;
    month: string;
    year: string;
    startDisplay: string;
    endDisplay: string;
  }) => void;
};

export default function MonthlySubscriptionModal({
  open,
  studentName,
  packageName,
  yearOptions,
  monthOptions,
  initialMode,
  initialMonth,
  initialYear,
  initialStart,
  initialEnd,
  onCancel,
  onSave,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [mode, setMode] = useState<PeriodMode>(initialMode ?? 'month');
  const [month, setMonth] = useState(initialMonth ?? '');
  const [year, setYear] = useState(initialYear ?? '');
  const [start, setStart] = useState(initialStart ?? '');
  const [end, setEnd] = useState(initialEnd ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode ?? 'month');
    const safeYear = yearOptions.includes(initialYear) ? initialYear : yearOptions[0] ?? '';
    setYear(safeYear ?? '');
    setMonth(initialMonth ?? '');
    setStart(initialStart ?? '');
    setEnd(initialEnd ?? '');
    setLocalError(null);
  }, [open, initialMode, initialMonth, initialYear, initialStart, initialEnd, yearOptions]);

  const canSave = useMemo(() => {
    if (mode === 'month') return !!month.trim() && !!year.trim();
    return !!start.trim() && !!end.trim();
  }, [mode, month, year, start, end]);

  if (!open) return null;

  // ── Theme classes ──
  const modalCardCls = isDark
    ? 'w-full max-w-2xl rounded-xl border border-slate-700 shadow-xl'
    : 'w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl';

  const headerCls = isDark
    ? 'flex items-start justify-between gap-3 border-b border-slate-700/70 px-5 py-4'
    : 'flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4';

  const titleCls = isDark ? 'text-sm font-semibold text-slate-50' : 'text-sm font-semibold text-slate-800';
  const subtitleCls = isDark ? 'mt-0.5 text-xs text-slate-300' : 'mt-0.5 text-xs text-slate-500';
  const pkgNameCls = isDark ? 'text-slate-100' : 'text-slate-700';

  const closeBtnCls = isDark
    ? 'rounded-md border border-slate-700/70 bg-slate-900/30 p-2 text-slate-200 hover:bg-slate-800/40'
    : 'rounded-md border border-slate-200 bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition';

  const hintCls = isDark ? 'text-xs text-slate-300' : 'text-xs text-slate-500';

  const togglePanelCls = isDark
    ? 'flex flex-col min-w-[130px] rounded-lg border border-slate-700/70 bg-slate-900/20 p-1'
    : 'flex flex-col min-w-[130px] rounded-lg border border-slate-200 bg-slate-100 p-1';

  const toggleBtnCls = (active: boolean) => [
    'w-full flex items-center justify-start text-left px-2.5 py-1 text-[11px] rounded-md transition',
    active
      ? 'bg-[color:var(--color-accent)]/25 text-[color:var(--color-accent)]'
      : isDark
        ? 'text-slate-200 hover:bg-slate-800/40'
        : 'text-slate-600 hover:bg-slate-200',
  ].join(' ');

  const selectCls = isDark
    ? 'form-input select-accent px-2 py-1.5 text-[11px] rounded-lg border border-slate-700/70 bg-slate-900/60 text-slate-100 outline-none transition focus:border-[color:var(--color-accent)]/60'
    : 'form-input select-accent px-2 py-1.5 text-[11px] rounded-lg border border-slate-300 bg-white text-slate-700 outline-none transition focus:border-[color:var(--color-accent)]/60';

  const footerCls = isDark
    ? 'flex items-center justify-end gap-2 border-t border-slate-700/70 px-5 py-4'
    : 'flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-3 py-1.5 text-slate-200 hover:bg-slate-700/60';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <div
        className={modalCardCls}
        style={isDark ? { background: 'var(--color-sidebar)' } : {}}
      >
        {/* Header */}
        <div className={headerCls}>
          <div>
            <div className={titleCls}>Μηνιαίο πακέτο</div>
            <div className={subtitleCls}>
              Μαθητής:{' '}
              <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>
                {studentName}
              </span>
            </div>
            <div className={subtitleCls}>
              Πακέτο: <span className={pkgNameCls}>{packageName}</span>
            </div>
          </div>
          <button type="button" onClick={onCancel} className={closeBtnCls} aria-label="Κλείσιμο">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 overflow-visible px-5 py-4">
          {localError && (
            <div className="rounded border border-red-500/50 bg-red-950/20 px-3 py-2 text-xs text-red-200">
              {localError}
            </div>
          )}

          <div className={hintCls}>Επίλεξε τρόπο καταχώρησης: μήνας/έτος ή ημερομηνίες.</div>

          <div className="flex items-stretch gap-2">
            {/* Left toggle */}
            <div className={togglePanelCls}>
              <button type="button" onClick={() => setMode('month')} className={toggleBtnCls(mode === 'month')}>
                Μήνας
              </button>
              <button type="button" onClick={() => setMode('range')} className={toggleBtnCls(mode === 'range')}>
                Ημερομηνίες
              </button>
            </div>

            {/* Controls */}
            <div className="flex flex-1 flex-col justify-end min-h-[72px]">
              {mode === 'month' ? (
                <div className="flex items-center gap-2">
                  <select
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className={`w-[240px] ${selectCls}`}
                  >
                    <option value="">— Μήνας —</option>
                    {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <select
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className={`w-[140px] ${selectCls}`}
                  >
                    <option value="">— Έτος —</option>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              ) : (
                <div className="relative z-[70] flex items-center gap-2">
                  <div className="w-[180px]">
                    <AppDatePicker value={start} onChange={setStart} />
                  </div>
                  <div className="w-[180px]">
                    <AppDatePicker value={end} onChange={setEnd} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={footerCls}>
          <button type="button" onClick={onCancel} className={cancelBtnCls}>Άκυρο</button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              setLocalError(null);
              if (mode === 'month') {
                if (!month.trim() || !year.trim()) { setLocalError('Επέλεξε μήνα και έτος.'); return; }
              } else {
                if (!start.trim() || !end.trim()) { setLocalError('Βάλε ημερομηνία έναρξης και λήξης.'); return; }
              }
              onSave({ mode, month: month.trim(), year: year.trim(), startDisplay: start.trim(), endDisplay: end.trim() });
            }}
            className="btn-primary gap-2 px-3 py-1.5 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            Αποθήκευση
          </button>
        </div>
      </div>
    </div>
  );
}