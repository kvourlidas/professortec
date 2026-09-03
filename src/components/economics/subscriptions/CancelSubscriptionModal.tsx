import { Ban, Loader2 } from 'lucide-react';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import type { StudentViewRow } from './types';

interface Props {
  target: StudentViewRow | null;
  cancelling: boolean;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CancelSubscriptionModal({ target, cancelling, isDark, onCancel, onConfirm }: Props) {
  useEscapeToClose(!!target, onCancel);

  if (!target) return null;

  const smallModalCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl';

  const cancelBtnCls = isDark
    ? 'rounded-lg border border-slate-700/60 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/60 transition'
    : 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className={smallModalCls} style={isDark ? { background: 'var(--color-sidebar)' } : {}}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
            <Ban className="h-5 w-5 text-red-400" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Ακύρωση συνδρομής</h3>
          <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Είσαι σίγουρος ότι θέλεις να ακυρώσεις τη συνδρομή του{' '}
            <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{target.student_name}</span>{' '}
            για το πακέτο <span className="font-semibold text-amber-400">«{target.sub?.package_name}»</span>;
          </p>
        </div>
        <div className={`flex justify-end gap-2.5 px-6 py-4 ${isDark ? 'border-t border-slate-800/70 bg-slate-900/20' : 'border-t border-slate-100 bg-slate-50'}`}>
          <button type="button" onClick={onCancel} disabled={cancelling} className={cancelBtnCls}>Άκυρο</button>
          <button type="button" onClick={onConfirm} disabled={cancelling}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
            {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}Ακύρωση
          </button>
        </div>
      </div>
    </div>
  );
}
