// src/components/ui/EditDeleteButtons.tsx
import { Pencil, Trash2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

export default function EditDeleteButtons({ onEdit, onDelete, disabled }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const editCls = isDark
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/30 text-slate-500 transition hover:border-blue-500/40 hover:bg-blue-500/15 hover:text-blue-400 disabled:opacity-40'
    : 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-blue-300 hover:bg-blue-100 hover:text-blue-500 disabled:opacity-40';

  const deleteCls = isDark
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/30 text-slate-500 transition hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-40'
    : 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-500 disabled:opacity-40';

  return (
    <>
      <button type="button" onClick={onEdit} disabled={disabled} className={editCls} title="Επεξεργασία">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onDelete} disabled={disabled} className={deleteCls} title="Διαγραφή">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );
}