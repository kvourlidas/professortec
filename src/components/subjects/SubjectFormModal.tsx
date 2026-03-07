import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { X, BookOpen, Layers, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { LevelRow, ModalMode, SubjectRow } from './types';

type SubjectFormModalProps = {
  open: boolean;
  mode: ModalMode;
  editingSubject: SubjectRow | null;
  levels: LevelRow[];
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (name: string, levelId: string) => Promise<void>;
};

function FormField({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SubjectFormModal({
  open,
  mode,
  editingSubject,
  levels,
  error,
  saving,
  onClose,
  onSubmit,
}: SubjectFormModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [subjectName, setSubjectName] = useState('');
  const [levelId, setLevelId] = useState('');

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && editingSubject) {
      setSubjectName(editingSubject.name ?? '');
      setLevelId(editingSubject.level_id ?? '');
    } else {
      setSubjectName('');
      setLevelId('');
    }
  }, [open, mode, editingSubject]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(subjectName, levelId);
  };

  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const modalCardCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

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
              <BookOpen className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className={modalTitleCls}>
                {mode === 'create' ? 'Νέο μάθημα' : 'Επεξεργασία μαθήματος'}
              </h2>
              {mode === 'edit' && editingSubject && (
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {editingSubject.name}
                </p>
              )}
            </div>
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
          <div className="space-y-4 px-6 pb-2">
            <FormField label="Όνομα μαθήματος" icon={<BookOpen className="h-3 w-3" />}>
              <input
                className={inputCls}
                placeholder="π.χ. Αγγλικά"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Επίπεδο" icon={<Layers className="h-3 w-3" />}>
              <select
                className={inputCls}
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                required
              >
                <option value="">Επιλέξτε επίπεδο…</option>
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                ))}
              </select>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Κάθε μάθημα ανήκει σε ένα επίπεδο.
              </p>
            </FormField>
          </div>

          <div className={modalFooterCls}>
            <button type="button" onClick={onClose} disabled={saving} className={cancelBtnCls}>
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
            >
              {saving
                ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</>
                : mode === 'create' ? 'Αποθήκευση' : 'Ενημέρωση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
