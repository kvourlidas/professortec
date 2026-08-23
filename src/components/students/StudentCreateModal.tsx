import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  User, Phone, Mail, Lock, Loader2,
  X, GraduationCap, Layers, UserCheck,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import DatePickerField from '../ui/AppDatePicker.tsx';
import {
  ModalFormField as FormField, ModalFieldIcon as FieldIcon, ModalSelectChevron,
  ModalToggleEyeBtn as ToggleEyeBtn, ModalErrorBox, modalInputCls, modalSelectCls,
} from '../ui/ModalField.tsx';
import type { StudentRow, LevelRow } from './types.ts';
import { displayToIso } from './types.ts';

type TabKey = 'student' | 'parents';

interface Props {
  schoolId: string;
  levels: LevelRow[];
  onCreated: (student: StudentRow) => void;
  onClose: () => void;
}

export default function StudentCreateModal({ schoolId, levels, onCreated, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState<TabKey>('student');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [levelId, setLevelId] = useState('');
  const [password, setPassword] = useState('');

  const [fatherName, setFatherName] = useState('');
  const [fatherDob, setFatherDob] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [fatherEmail, setFatherEmail] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherDob, setMotherDob] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [motherEmail, setMotherEmail] = useState('');


  const [passwordVisible, setPasswordVisible] = useState(false);

  const inputCls = modalInputCls(isDark);
  const selectCls = modalSelectCls(isDark);
  const modalBg = isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white';
  const parentBoxCls = `rounded-xl border p-4 ${isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`;
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nameTrimmed = fullName.trim();
    if (!nameTrimmed) return;

    if (password.trim().length < 6) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.');
      return;
    }

    const emailTrimmed = email.trim();
    const phoneTrimmed = phone.trim();

    if (!emailTrimmed && !phoneTrimmed) {
      setError('Βάλε Email ή Τηλέφωνο για να μπορεί να κάνει login στο mobile app.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      full_name: nameTrimmed,
      date_of_birth: displayToIso(dateOfBirth) || null,
      phone: phoneTrimmed || null,
      email: emailTrimmed || null,

      level_id: levelId || null,
      father_name: fatherName.trim() || null,
      father_date_of_birth: displayToIso(fatherDob) || null,
      father_phone: fatherPhone.trim() || null,
      father_email: fatherEmail.trim() || null,
      mother_name: motherName.trim() || null,
      mother_date_of_birth: displayToIso(motherDob) || null,
      mother_phone: motherPhone.trim() || null,
      mother_email: motherEmail.trim() || null,
    };

    try {
      const { data, error: fnError } = await supabase.functions.invoke('student-create', {
        body: payload,
      });

      if (fnError || !data?.item) {
        console.error(fnError ?? data);
        setError('Αποτυχία δημιουργίας μαθητή.');
        return;
      }

      const created = data.item as StudentRow;
      onCreated(created);

      const { error: createUserError } = await supabase.functions.invoke('create-student-user', {
        body: {
          school_id: schoolId,
          student_id: created.id,
          email: payload.email,
          phone: payload.phone,
          password: password.trim(),
        },
      });

      if (createUserError) {
        console.error('create-student-user error:', createUserError);
      }
    } finally {
      setSaving(false);
    }
  };

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
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Νέος μαθητής</h2>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 px-6 pt-4 pb-0 mb-3 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgb(226 232 240)' }}>
          {(['student', 'parents'] as TabKey[]).map((t) => {
            const active = tab === t;
            const label = t === 'student' ? 'Μαθητής' : 'Γονείς';
            const Icon = t === 'student' ? User : UserCheck;
            return (
              <button key={t} type="button" onClick={() => setTab(t)}
                className="relative flex items-center gap-1.5 pb-2.5 text-xs font-bold tracking-tight transition-colors duration-150"
                style={{ color: active ? (isDark ? '#fff' : '#000') : (isDark ? 'rgb(100 116 139)' : 'rgb(148 163 184)') }}>
                <Icon className="h-3.5 w-3.5" />{label}
                <span className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full transition-opacity duration-200"
                  style={{ background: 'var(--color-accent)', opacity: active ? 1 : 0 }} />
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <ModalErrorBox isDark={isDark}>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
          </ModalErrorBox>
        )}

        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto px-6 pb-2">
            {tab === 'student' ? (
              <div className="space-y-4">
                <FormField label="Ονοματεπώνυμο" isDark={isDark}>
                  <FieldIcon icon={User} isDark={isDark} />
                  <input className={inputCls} placeholder="π.χ. Γιάννης Παπαδόπουλος" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
                </FormField>
                <FormField label="Επίπεδο" isDark={isDark}>
                  <FieldIcon icon={Layers} isDark={isDark} />
                  <select className={selectCls} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                    <option value="">Χωρίς επίπεδο</option>
                    {levels.map((lvl) => <option key={lvl.id} value={lvl.id}>{lvl.name}</option>)}
                  </select>
                  <ModalSelectChevron isDark={isDark} />
                </FormField>
                <FormField label="Ημερομηνία γέννησης" isDark={isDark}>
                  <DatePickerField label="" value={dateOfBirth} onChange={setDateOfBirth} placeholder="π.χ. 24/12/2010" id="create-student-dob" variant="underline" />
                </FormField>
                <FormField label="Τηλέφωνο" isDark={isDark}>
                  <FieldIcon icon={Phone} isDark={isDark} />
                  <input className={inputCls} placeholder="π.χ. 6900000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </FormField>
                <FormField label="Email" isDark={isDark}>
                  <FieldIcon icon={Mail} isDark={isDark} />
                  <input type="email" className={inputCls} placeholder="π.χ. student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormField>

                <FormField label="Κωδικός" hint="Θα δημιουργηθεί λογαριασμός για login στο mobile app." isDark={isDark}>
                  <FieldIcon icon={Lock} isDark={isDark} />
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    className={`${inputCls} pr-8`}
                    placeholder="Τουλάχιστον 6 χαρακτήρες"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <ToggleEyeBtn show={passwordVisible} toggle={() => setPasswordVisible((v) => !v)} isDark={isDark} />
                </FormField>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { title: 'Πατέρας', name: fatherName, setName: setFatherName, dob: fatherDob, setDob: setFatherDob, dobId: 'create-father-dob', phone: fatherPhone, setPhone: setFatherPhone, email: fatherEmail, setEmail: setFatherEmail },
                  { title: 'Μητέρα', name: motherName, setName: setMotherName, dob: motherDob, setDob: setMotherDob, dobId: 'create-mother-dob', phone: motherPhone, setPhone: setMotherPhone, email: motherEmail, setEmail: setMotherEmail },
                ].map(({ title, name, setName, dob, setDob, dobId, phone: ph, setPhone: setPh, email: em, setEmail: setEm }) => (
                  <div key={title} className={parentBoxCls}>
                    <p className={`mb-3 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{title}</p>
                    <div className="space-y-3">
                      <FormField label="Ονοματεπώνυμο" isDark={isDark}>
                        <FieldIcon icon={User} isDark={isDark} />
                        <input className={inputCls} placeholder={`π.χ. ${title === 'Πατέρας' ? 'Δημήτρης' : 'Μαρία'} Παπαδόπουλος`} value={name} onChange={(e) => setName(e.target.value)} />
                      </FormField>
                      <FormField label="Ημερομηνία γέννησης" isDark={isDark}>
                        <DatePickerField label="" value={dob} onChange={setDob} placeholder="π.χ. 24/12/1980" id={dobId} variant="underline" />
                      </FormField>
                      <FormField label="Τηλέφωνο" isDark={isDark}>
                        <FieldIcon icon={Phone} isDark={isDark} />
                        <input className={inputCls} placeholder="π.χ. 6900000000" value={ph} onChange={(e) => setPh(e.target.value)} />
                      </FormField>
                      <FormField label="Email" isDark={isDark}>
                        <FieldIcon icon={Mail} isDark={isDark} />
                        <input type="email" className={inputCls} placeholder="π.χ. parent@example.com" value={em} onChange={(e) => setEm(e.target.value)} />
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`flex justify-end gap-2.5 border-t px-6 py-4 mt-3 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`}>
            <button type="button" onClick={onClose} disabled={saving}
              className={`btn border px-4 py-1.5 disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
              Ακύρωση
            </button>
            <button type="submit" disabled={saving}
              className="btn-primary gap-1.5 px-4 py-1.5 font-semibold disabled:opacity-60">
              {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
