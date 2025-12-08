// src/components/ui/EditDeleteButtons.tsx
import type { FC } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

type EditDeleteButtonsProps = {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
};

const EditDeleteButtons: FC<EditDeleteButtonsProps> = ({
  onEdit,
  onDelete,
  editLabel = 'Επεξεργασία',
  deleteLabel = 'Διαγραφή',
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Edit icon button */}
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        title={editLabel}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-500 text-blue-500 transition-colors hover:border-blue-400 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:ring-offset-1 focus:ring-offset-slate-900"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {/* Delete icon button */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        title={deleteLabel}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-500 text-red-500 transition-colors hover:border-red-400 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/80 focus:ring-offset-1 focus:ring-offset-slate-900"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default EditDeleteButtons;
