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
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/15 text-blue-400 transition hover:bg-blue-500/25 hover:border-blue-400/50 disabled:opacity-40'
    : 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-blue-200 bg-blue-100 text-blue-500 transition hover:bg-blue-200 hover:border-blue-300 disabled:opacity-40';

  const deleteCls = isDark
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400 transition hover:bg-rose-500/25 hover:border-rose-400/50 disabled:opacity-40'
    : 'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-100 text-rose-500 transition hover:bg-rose-200 hover:border-rose-300 disabled:opacity-40';

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