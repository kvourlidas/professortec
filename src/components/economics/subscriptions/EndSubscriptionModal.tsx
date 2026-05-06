import { Loader2, StopCircle } from 'lucide-react';
import type { StudentViewRow } from './types';

interface Props {
  target: StudentViewRow | null;
  ending: boolean;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EndSubscriptionModal({ target, ending, isDark, onCancel, onConfirm }: Props) {
  if (!target) return null;

  const modalCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl';

  const cancelCls = isDark
    ? 'rounded-lg border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/60 transition'
    : 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className={modalCls} style={isDark ? { background: 'var(--color-sidebar)' } : {}}>
        <div className="h-0.5 w-full bg-amber-500/60" />
        <div className="px-6 pt-5 pb-4">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
            Λήξη ωριαίας συνδρομής
          </h3>
          <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Θέλετε να τερματίσετε την ωριαία συνδρομή του{' '}
            <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>
              {target.student_name}
            </span>{' '}
            για το πακέτο{' '}
            <span className="font-semibold text-amber-400">«{target.sub?.package_name}»</span>;
          </p>
          <p className={`mt-1.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Η συνδρομή θα οριστεί ως ολοκληρωμένη με ημερομηνία λήξης σήμερα. Οι ώρες που έχουν ήδη καταγραφεί παραμένουν στον λογαριασμό.
          </p>
        </div>
        <div className={`flex justify-end gap-2.5 px-6 py-4 ${isDark ? 'border-t border-slate-800/70 bg-slate-900/20' : 'border-t border-slate-100 bg-slate-50'}`}>
          <button type="button" onClick={onCancel} disabled={ending} className={cancelCls}>
            Ακύρωση
          </button>
          <button type="button" onClick={onConfirm} disabled={ending}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 active:scale-[0.97] disabled:opacity-60 transition">
            {ending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
            Λήξη συνδρομής
          </button>
        </div>
      </div>
    </div>
  );
}
