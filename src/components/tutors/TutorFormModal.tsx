import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { X, GraduationCap, User, Calendar, Hash, Phone, Mail, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import DatePickerField from '../ui/AppDatePicker';
import type { ModalMode, TutorFormState, TutorRow } from './types';
import { emptyForm } from './types';
import { isoToDisplay } from './utils';

type TutorFormModalProps = {
  open: boolean;
  mode: ModalMode;
  editingTutor: TutorRow | null;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: TutorFormState) => Promise<void>;
};

function FormField({ label, icon, children, isDark }: {
  label: string; icon?: React.ReactNode; children: React.ReactNode; isDark: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

export default function TutorFormModal({
  open,
  mode,
  editingTutor,
  error,
  saving,
  onClose,
  onSubmit,
}: TutorFormModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [form, setForm] = useState<TutorFormState>(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && editingTutor) {
      setForm({
        fullName: editingTutor.full_name ?? '',
        dateOfBirth: editingTutor.date_of_birth ? isoToDisplay(editingTutor.date_of_birth) : '',
        afm: editingTutor.afm ?? '',
        phone: editingTutor.phone ?? '',
        email: editingTutor.email ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, editingTutor]);

  if (!open) return null;

  const handleChange = (field: keyof TutorFormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const inputCls = `h-9 w-full rounded-lg border px-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const modalBg = isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white';
  const cancelBtnCls = `btn border px-4 py-1.5 disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`;
  const closeBtnCls = `flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;
  const modalFooterCls = `flex justify-end gap-2.5 border-t px-6 py-4 mt-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
        {/* Accent top stripe */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}
            >
              <GraduationCap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                {mode === 'create' ? 'Νέος καθηγητής' : 'Επεξεργασία καθηγητή'}
              </h2>
              {mode === 'edit' && editingTutor && (
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{editingTutor.full_name}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className={closeBtnCls}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className={`mx-6 mb-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 pb-2">
            <FormField label="Ονοματεπωνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}>
              <input className={inputCls} placeholder="π.χ. Γιάννης Παπαδόπουλος" value={form.fullName} onChange={handleChange('fullName')} required />
            </FormField>
            <FormField label="Ημερομηνια γεννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
              <DatePickerField label="" value={form.dateOfBirth} onChange={(value) => setForm((prev) => ({ ...prev, dateOfBirth: value }))} placeholder="π.χ. 24/12/1985" id="tutor-dob" />
            </FormField>
            <FormField label="ΑΦΜ" icon={<Hash className="h-3 w-3" />} isDark={isDark}>
              <input className={inputCls} placeholder="π.χ. 123456789" value={form.afm} onChange={handleChange('afm')} />
            </FormField>
            <FormField label="Τηλεφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}>
              <input className={inputCls} placeholder="π.χ. 6900000000" value={form.phone} onChange={handleChange('phone')} />
            </FormField>
            <FormField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}>
              <input type="email" className={inputCls} placeholder="π.χ. tutor@example.com" value={form.email} onChange={handleChange('email')} />
            </FormField>
          </div>

          <div className={modalFooterCls}>
            <button type="button" onClick={onClose} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
            <button type="submit" disabled={saving}
              className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
              {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : mode === 'create' ? 'Αποθήκευση' : 'Ενημέρωση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
