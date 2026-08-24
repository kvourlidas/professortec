import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { X, GraduationCap, User, Hash, Phone, Mail, CreditCard, Loader2, AlertCircle, Tags, ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import DatePickerField from '../ui/AppDatePicker';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon,
  ModalErrorBox, modalInputCls,
} from '../ui/ModalField.tsx';
import type { ModalMode, SpecialtyRow, TutorFormState, TutorRow } from './types';
import { emptyForm } from './types';
import { isoToDisplay } from './utils';

type TutorFormModalProps = {
  open: boolean;
  mode: ModalMode;
  editingTutor: TutorRow | null;
  allSpecialties: SpecialtyRow[];
  initialSpecialtyIds: string[];
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: TutorFormState, specialtyIds: string[]) => Promise<void>;
};

export default function TutorFormModal({
  open,
  mode,
  editingTutor,
  allSpecialties,
  initialSpecialtyIds,
  error,
  saving,
  onClose,
  onSubmit,
}: TutorFormModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [form, setForm] = useState<TutorFormState>(emptyForm);
  const [specialtyIds, setSpecialtyIds] = useState<Set<string>>(new Set());
  const [specialtiesOpen, setSpecialtiesOpen] = useState(false);
  const specialtiesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!specialtiesOpen) return;
    const onDown = (e: MouseEvent) => {
      if (specialtiesRef.current && !specialtiesRef.current.contains(e.target as Node)) setSpecialtiesOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [specialtiesOpen]);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && editingTutor) {
      setForm({
        fullName: editingTutor.full_name ?? '',
        dateOfBirth: editingTutor.date_of_birth ? isoToDisplay(editingTutor.date_of_birth) : '',
        afm: editingTutor.afm ?? '',
        phone: editingTutor.phone ?? '',
        email: editingTutor.email ?? '',
        iban: editingTutor.iban ?? '',
        notes: editingTutor.notes ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setSpecialtyIds(new Set(initialSpecialtyIds));
  }, [open, mode, editingTutor, initialSpecialtyIds]);

  if (!open) return null;

  const handleChange = (field: keyof TutorFormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleSpecialty = (id: string) => {
    setSpecialtyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(form, [...specialtyIds]);
  };

  const inputCls = modalInputCls(isDark);
  const textareaCls = `w-full resize-none border-b bg-transparent px-0 py-2 text-sm outline-none transition-colors duration-200 ${isDark ? 'border-white/15 text-slate-100 placeholder-slate-600 focus:border-[color:var(--color-accent)]' : 'border-slate-300 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'}`;
  const modalBg = isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white';
  const cancelBtnCls = `btn border px-4 py-1.5 disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`;
  const modalFooterCls = `flex justify-end gap-2.5 border-t px-6 py-4 mt-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;
  const dividerCls = `flex items-center gap-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <GraduationCap className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>
                {mode === 'create' ? 'Νέος καθηγητής' : 'Επεξεργασία καθηγητή'}
              </h2>
              {mode === 'edit' && editingTutor && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ch-text-muted)' }}>{editingTutor.full_name}</p>
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

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-4 px-6 pb-2">

              {/* ── Basic info ── */}
              <FormField label="Ονοματεπωνυμο" isDark={isDark}>
                <FieldIcon icon={User} isDark={isDark} />
                <input className={inputCls} placeholder="π.χ. Γιάννης Παπαδόπουλος" value={form.fullName} onChange={handleChange('fullName')} required />
              </FormField>
              <FormField label="Ημερομηνια γεννησης" isDark={isDark}>
                <DatePickerField label="" value={form.dateOfBirth} onChange={(value) => setForm((prev) => ({ ...prev, dateOfBirth: value }))} placeholder="π.χ. 24/12/1985" id="tutor-dob" variant="underline" />
              </FormField>
              <FormField label="ΑΦΜ" isDark={isDark}>
                <FieldIcon icon={Hash} isDark={isDark} />
                <input className={inputCls} placeholder="π.χ. 123456789" value={form.afm} onChange={handleChange('afm')} />
              </FormField>
              <FormField label="Τηλεφωνο" isDark={isDark}>
                <FieldIcon icon={Phone} isDark={isDark} />
                <input className={inputCls} placeholder="π.χ. 6900000000" value={form.phone} onChange={handleChange('phone')} />
              </FormField>
              <FormField label="Email" isDark={isDark}>
                <FieldIcon icon={Mail} isDark={isDark} />
                <input type="email" className={inputCls} placeholder="π.χ. tutor@example.com" value={form.email} onChange={handleChange('email')} />
              </FormField>

              {/* ── Specialties ── */}
              <FormField label="Ειδικότητες" isDark={isDark}
                hint={allSpecialties.length === 0 ? 'Δεν έχουν οριστεί ειδικότητες. Προσθέστε από το κουμπί «Ειδικότητες».' : undefined}>
                <div ref={specialtiesRef} className="relative">
                  <FieldIcon icon={Tags} isDark={isDark} />
                  <button
                    type="button"
                    onClick={() => allSpecialties.length > 0 && setSpecialtiesOpen((v) => !v)}
                    disabled={allSpecialties.length === 0}
                    className={`${inputCls} flex items-center justify-between gap-2 pr-7 text-left disabled:opacity-60`}
                  >
                    <span className="truncate">
                      {specialtyIds.size === 0
                        ? <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>Επιλέξτε ειδικότητες</span>
                        : allSpecialties.filter((s) => specialtyIds.has(s.id)).map((s) => s.name).join(', ')}
                    </span>
                  </button>
                  <ChevronDown className={`pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-transform ${specialtiesOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />

                  {specialtiesOpen && allSpecialties.length > 0 && (
                    <div className={`absolute left-0 top-full z-50 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl border shadow-2xl ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
                    }`}>
                      {allSpecialties.map((s) => {
                        const checked = specialtyIds.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSpecialty(s.id)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors ${
                              isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                                checked ? 'border-transparent' : isDark ? 'border-slate-600' : 'border-slate-300'
                              }`}
                              style={checked ? { background: 'var(--color-accent)' } : undefined}
                            >
                              {checked && <Check className="h-2 w-2 text-white" strokeWidth={3.5} />}
                            </span>
                            <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </FormField>

              {/* ── Divider ── */}
              <div className={dividerCls}>
                <div className="flex-1 border-t border-current" />
                <span className="text-[10px] font-semibold uppercase tracking-widest">Οικονομικά &amp; Σημειώσεις</span>
                <div className="flex-1 border-t border-current" />
              </div>

              {/* ── IBAN ── */}
              <FormField label="IBAN" isDark={isDark}>
                <FieldIcon icon={CreditCard} isDark={isDark} />
                <input
                  className={inputCls}
                  placeholder="π.χ. GR1601101250000000012300695"
                  value={form.iban}
                  onChange={handleChange('iban')}
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormField>

              {/* ── Notes ── */}
              <FormField label="Σημειωσεις" isDark={isDark}>
                <textarea
                  className={textareaCls}
                  placeholder="Προαιρετικές σημειώσεις για τον καθηγητή..."
                  value={form.notes}
                  onChange={handleChange('notes')}
                  rows={3}
                />
              </FormField>

            </div>
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