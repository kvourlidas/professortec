import { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';

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
  initialYear: string; // "2025"

  initialStart: string; // dd/mm/yyyy
  initialEnd: string; // dd/mm/yyyy

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
  }, [
    open,
    initialMode,
    initialMonth,
    initialYear,
    initialStart,
    initialEnd,
    yearOptions,
  ]);

  const canSave = useMemo(() => {
    if (mode === 'month') return !!month.trim() && !!year.trim();
    return !!start.trim() && !!end.trim();
  }, [mode, month, year, start, end]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-700 shadow-xl"
        style={{ background: 'var(--color-sidebar)' }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-50">
              Μηνιαίο πακέτο
            </div>
            <div className="mt-0.5 text-xs text-slate-300">
              Μαθητής:{' '}
              <span className="font-semibold text-[color:var(--color-accent)]">
                {studentName}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-300">
              Πακέτο: <span className="text-slate-100">{packageName}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-700/70 bg-slate-900/30 p-2 text-slate-200 hover:bg-slate-800/40"
            aria-label="Κλείσιμο"
            title="Κλείσιμο"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-visible">
          {localError && (
            <div className="rounded border border-red-500/50 bg-red-950/20 px-3 py-2 text-xs text-red-100">
              {localError}
            </div>
          )}

          <div className="text-xs text-slate-300">
            Επίλεξε τρόπο καταχώρησης: μήνας/έτος ή ημερομηνίες.
          </div>

          <div className="flex items-stretch gap-2">
            {/* left vertical toggle */}
            <div className="flex flex-col min-w-[130px] rounded-lg border border-slate-700/70 bg-slate-900/20 p-1">
              <button
                type="button"
                onClick={() => setMode('month')}
                className={[
                  'w-full flex items-center justify-start text-left px-2.5 py-1 text-[11px] rounded-md transition',
                  mode === 'month'
                    ? 'bg-[color:var(--color-accent)]/25 text-[color:var(--color-accent)]'
                    : 'text-slate-200 hover:bg-slate-800/40',
                ].join(' ')}
              >
                Μήνας
              </button>
              <button
                type="button"
                onClick={() => setMode('range')}
                className={[
                  'w-full flex items-center justify-start text-left px-2.5 py-1 text-[11px] rounded-md transition',
                  mode === 'range'
                    ? 'bg-[color:var(--color-accent)]/25 text-[color:var(--color-accent)]'
                    : 'text-slate-200 hover:bg-slate-800/40',
                ].join(' ')}
              >
                Ημερομηνίες
              </button>
            </div>

            {/* controls (aligned to bottom) */}
            <div className="flex-1 flex flex-col justify-end min-h-[72px]">
              {mode === 'month' ? (
                <div className="flex items-center gap-2">
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="form-input select-accent w-[240px] px-2 py-1.5 text-[11px]"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    <option value="">— Μήνας —</option>
                    {monthOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="form-input select-accent w-[140px] px-2 py-1.5 text-[11px]"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    <option value="">— Έτος —</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
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

        <div className="flex items-center justify-end gap-2 border-t border-slate-700/70 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-700/70 bg-slate-900/30 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800/40"
          >
            Άκυρο
          </button>

          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              setLocalError(null);

              if (mode === 'month') {
                if (!month.trim() || !year.trim()) {
                  setLocalError('Επέλεξε μήνα και έτος.');
                  return;
                }
              } else {
                if (!start.trim() || !end.trim()) {
                  setLocalError('Βάλε ημερομηνία έναρξης και λήξης.');
                  return;
                }
              }

              onSave({
                mode,
                month: month.trim(),
                year: year.trim(),
                startDisplay: start.trim(),
                endDisplay: end.trim(),
              });
            }}
            className={[
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold',
              canSave
                ? 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/28'
                : 'border-slate-700/70 bg-slate-900/30 text-slate-500 cursor-not-allowed',
            ].join(' ')}
          >
            <Save className="h-4 w-4" />
            Αποθήκευση
          </button>
        </div>
      </div>
    </div>
  );
}
