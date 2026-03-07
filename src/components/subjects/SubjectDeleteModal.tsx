import { BookOpen } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { SubjectRow } from './types';

type SubjectDeleteModalProps = {
  deleteTarget: SubjectRow | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export default function SubjectDeleteModal({
  deleteTarget,
  deleting,
  onCancel,
  onConfirm,
}: SubjectDeleteModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!deleteTarget) return null;

  const modalCardCls = isDark
    ? 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const cancelBtnCls = isDark
    ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50'
    : 'btn border border-slate-300 bg-white px-4 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
        <div className="p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
            <BookOpen className="h-5 w-5 text-red-400" />
          </div>
          <h3 className={`mb-1 text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
            Διαγραφή μαθήματος
          </h3>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Σίγουρα θέλετε να διαγράψετε το μάθημα{' '}
            <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              «{deleteTarget.name}»
            </span>;{' '}
            Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
          </p>
          <div className="mt-6 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className={cancelBtnCls}
            >
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
