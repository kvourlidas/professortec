import { Users } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import type { TutorRow } from './types';

type TutorDeleteModalProps = {
  deleteTarget: TutorRow | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export default function TutorDeleteModal({
  deleteTarget,
  deleting,
  onCancel,
  onConfirm,
}: TutorDeleteModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEscapeToClose(!!deleteTarget, onCancel);

  if (!deleteTarget) return null;

  const modalBg = isDark ? 'border-slate-700/60' : 'border-slate-200';
  const cancelBtnCls = `btn border px-4 py-1.5 disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`} style={{ background: 'var(--color-sidebar)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
            <Users className="h-5 w-5 text-red-400" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
            Διαγραφή καθηγητή
          </h3>
        </div>
        <div className="p-6">
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Σίγουρα θέλετε να διαγράψετε τον καθηγητή{' '}
            <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              «{deleteTarget.full_name}»
            </span>;{' '}
            Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <button type="button" onClick={onCancel} disabled={deleting} className={cancelBtnCls}>
              Ακύρωση
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60"
            >
              {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
