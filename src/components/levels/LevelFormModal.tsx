import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { X, Layers, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon,
  ModalErrorBox, modalInputCls,
} from '../ui/ModalField.tsx';

type LevelFormModalProps = {
  open: boolean;
  editingId: string | null;
  initialName: string;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export default function LevelFormModal({
  open,
  editingId,
  initialName,
  error,
  saving,
  onClose,
  onSubmit,
}: LevelFormModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  useEscapeToClose(open, onClose);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(name);
  };

  const inputCls = modalInputCls(isDark);

  const modalCardCls = isDark
    ? 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-4';

  const cancelBtnCls = isDark
    ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50'
    : 'btn border border-slate-300 bg-white px-4 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <Layers className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
              {editingId == null ? 'Νέο επίπεδο' : 'Επεξεργασία επιπέδου'}
            </h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <ModalErrorBox isDark={isDark}>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
          </ModalErrorBox>
        )}

        <form onSubmit={handleSubmit}>
          <div className="px-6 pb-2">
            <FormField label="Ονομα επιπεδου *" isDark={isDark}>
              <FieldIcon icon={Layers} isDark={isDark} />
              <input
                className={inputCls}
                placeholder="π.χ. B2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </FormField>
          </div>

          <div className={modalFooterCls}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={cancelBtnCls}
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
            >
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
