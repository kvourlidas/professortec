import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { X, Layers } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

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

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(name);
  };

  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const modalCardCls = isDark
    ? 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const modalTitleCls = isDark ? 'text-sm font-semibold text-slate-50' : 'text-sm font-semibold text-slate-800';

  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-4';

  const cancelBtnCls = isDark
    ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50'
    : 'btn border border-slate-300 bg-white px-4 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50';

  const formLabelCls = isDark
    ? 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400'
    : 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        {/* Accent top stripe */}
        <div
          className="h-0.5 w-full"
          style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{
                background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
              }}
            >
              <Layers className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h2 className={modalTitleCls}>
              {editingId == null ? 'Νέο επίπεδο' : 'Επεξεργασία επιπέδου'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className={modalCloseBtnCls}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="px-6 pb-2">
            <div className="space-y-1.5">
              <label className={formLabelCls}>
                <span className="opacity-70"><Layers className="h-3 w-3" /></span>
                Ονομα επιπεδου *
              </label>
              <input
                className={inputCls}
                placeholder="π.χ. B2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
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
