import { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';

type Props = {
  open: boolean;
  studentName: string;
  packageName: string;
  initialStart: string; // dd/mm/yyyy
  initialEnd: string; // dd/mm/yyyy
  onCancel: () => void;
  onSave: (startDisplay: string, endDisplay: string) => void;
};

export default function YearlySubscriptionModal({
  open,
  studentName,
  packageName,
  initialStart,
  initialEnd,
  onCancel,
  onSave,
}: Props) {
  const [start, setStart] = useState(initialStart ?? '');
  const [end, setEnd] = useState(initialEnd ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStart(initialStart ?? '');
    setEnd(initialEnd ?? '');
    setLocalError(null);
  }, [open, initialStart, initialEnd]);

  const canSave = useMemo(() => !!start.trim() && !!end.trim(), [start, end]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <div
        className="w-full max-w-xl rounded-xl border border-slate-700 shadow-xl"
        style={{ background: 'var(--color-sidebar)' }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-700/70 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-50">
              Ετήσιο πακέτο
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
            Διάστημα συνδρομής (έναρξη / λήξη)
          </div>

          <div className="relative z-[70] flex items-center gap-3">
            <div className="w-[170px]">
              <AppDatePicker value={start} onChange={setStart} />
            </div>
            <div className="w-[170px]">
              <AppDatePicker value={end} onChange={setEnd} />
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
              if (!start.trim() || !end.trim()) {
                setLocalError('Βάλε ημερομηνία έναρξης και λήξης.');
                return;
              }
              onSave(start.trim(), end.trim());
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
