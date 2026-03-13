import { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import AppDatePicker from '../../ui/AppDatePicker';
import { useTheme } from '../../../context/ThemeContext';

type Props = {
  open: boolean;
  studentName: string;
  packageName: string;
  initialStart: string; // dd/mm/yyyy
  initialEnd: string;   // dd/mm/yyyy
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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

  const modalCardCls = isDark
    ? 'w-full max-w-xl rounded-xl border border-slate-700 shadow-xl'
    : 'w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl';

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

  const footerCls = isDark
    ? 'flex items-center justify-end gap-2 border-t border-slate-700/70 px-5 py-4'
    : 'flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-3 py-1.5 text-slate-200 hover:bg-slate-700/60';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
      <div className={modalCardCls} style={isDark ? { background: 'var(--color-sidebar)' } : {}}>
        <div className={headerCls}>
          <div>
            <div className={titleCls}>Ετήσιο πακέτο</div>
            <div className={subtitleCls}>Μαθητής:{' '}<span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{studentName}</span></div>
            <div className={subtitleCls}>Πακέτο: <span className={pkgNameCls}>{packageName}</span></div>
          </div>
          <button type="button" onClick={onCancel} className={closeBtnCls} aria-label="Κλείσιμο"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 overflow-visible px-5 py-4">
          {localError && (
            <div className="rounded border border-red-500/50 bg-red-950/20 px-3 py-2 text-xs text-red-200">{localError}</div>
          )}
          <div className={hintCls}>Διάστημα συνδρομής (έναρξη / λήξη)</div>
          <div className="relative z-[70] flex items-center gap-3">
            <div className="w-[170px]"><AppDatePicker value={start} onChange={setStart} /></div>
            <div className="w-[170px]"><AppDatePicker value={end} onChange={setEnd} /></div>
          </div>
        </div>

        <div className={footerCls}>
          <button type="button" onClick={onCancel} className={cancelBtnCls}>Άκυρο</button>
          <button type="button" disabled={!canSave}
            onClick={() => {
              setLocalError(null);
              if (!start.trim() || !end.trim()) { setLocalError('Βάλε ημερομηνία έναρξης και λήξης.'); return; }
              onSave(start.trim(), end.trim());
            }}
            className="btn-primary gap-2 px-3 py-1.5 font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
            <Save className="h-4 w-4" />Αποθήκευση
          </button>
        </div>
      </div>
    </div>
  );
}
