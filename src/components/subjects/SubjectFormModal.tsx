import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { X, BookOpen, Layers, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalSelectChevron,
  ModalErrorBox, modalInputCls, modalSelectCls,
} from '../ui/ModalField.tsx';
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

  const inputCls = modalInputCls(isDark);
  const selectCls = modalSelectCls(isDark);

  const modalCardCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

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
              <BookOpen className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
                {mode === 'create' ? 'Νέο μάθημα' : 'Επεξεργασία μαθήματος'}
              </h2>
              {mode === 'edit' && editingSubject && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ch-text-muted)' }}>
                  {editingSubject.name}
                </p>
              )}
            </div>
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
          <div className="space-y-4 px-6 pb-2">
            <FormField label="Ονομα μαθηματος" isDark={isDark}>
              <FieldIcon icon={BookOpen} isDark={isDark} />
              <input
                className={inputCls}
                placeholder="π.χ. Αγγλικά"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Επιπεδο" hint="Κάθε μάθημα ανήκει σε ένα επίπεδο." isDark={isDark}>
              <FieldIcon icon={Layers} isDark={isDark} />
              <select
                className={selectCls}
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                required
              >
                <option value="">Επιλέξτε επίπεδο…</option>
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>{lvl.name}</option>
                ))}
              </select>
              <ModalSelectChevron isDark={isDark} />
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
