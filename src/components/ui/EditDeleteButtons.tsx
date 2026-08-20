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

  // Minimal — ghost icon buttons, no border/bg box until hovered.
  const editCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40';

  const deleteCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40';

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