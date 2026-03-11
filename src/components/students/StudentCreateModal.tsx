import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  User, Phone, Mail, Calendar, FileText, Lock, Loader2,
  X, GraduationCap, Layers, UserCheck, Eye, EyeOff,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import DatePickerField from '../ui/AppDatePicker.tsx';
import type { StudentRow, LevelRow } from './types.ts';
import { displayToIso } from './types.ts';

type TabKey = 'student' | 'parents';

interface Props {
  schoolId: string;
  levels: LevelRow[];
  onCreated: (student: StudentRow) => void;
  onClose: () => void;
}

function FormField({ label, icon, hint, children, isDark }: {
  label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode; isDark: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  );
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
  const [specialNotes, setSpecialNotes] = useState('');
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

  const inputCls = `h-9 w-full rounded-lg border px-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const modalBg = isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white';
  const parentBoxCls = `rounded-xl border p-4 ${isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`;
  const closeBtnCls = `flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;

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
      special_notes: specialNotes.trim() || null,
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
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <GraduationCap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Νέος μαθητής</h2>
          </div>
          <button type="button" onClick={onClose} className={closeBtnCls}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-6 pb-3">
          {(['student', 'parents'] as TabKey[]).map((t) => {
            const active = tab === t;
            const label = t === 'student' ? 'Μαθητής' : 'Γονείς';
            const Icon = t === 'student' ? User : UserCheck;
            return (
              <button key={t} type="button" onClick={() => setTab(t)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                style={active ? {
                  backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                  color: 'var(--color-accent)',
                } : {
                  backgroundColor: 'transparent',
                  borderColor: isDark ? 'rgb(71 85 105 / 0.5)' : 'rgb(203 213 225)',
                  color: isDark ? 'rgb(148 163 184)' : 'rgb(100 116 139)',
                }}>
                <Icon className="h-3 w-3" />{label}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className={`mx-6 mb-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto px-6 pb-2">
            {tab === 'student' ? (
              <div className="space-y-4">
                <FormField label="Ονοματεπωνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} placeholder="π.χ. Γιάννης Παπαδόπουλος" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
                </FormField>
                <FormField label="Επιπεδο" icon={<Layers className="h-3 w-3" />} isDark={isDark}>
                  <select className={inputCls} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                    <option value="">Χωρίς επίπεδο</option>
                    {levels.map((lvl) => <option key={lvl.id} value={lvl.id}>{lvl.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Ημερομηνια γεννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
                  <DatePickerField label="" value={dateOfBirth} onChange={setDateOfBirth} placeholder="π.χ. 24/12/2010" id="create-student-dob" />
                </FormField>
                <FormField label="Τηλεφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} placeholder="π.χ. 6900000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </FormField>
                <FormField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}>
                  <input type="email" className={inputCls} placeholder="π.χ. student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormField>
                <FormField label="Ειδικες σημειωσεις" icon={<FileText className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} placeholder="π.χ. αλλεργίες / παρατηρήσεις" value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} />
                </FormField>
                <FormField
                  label="Κωδικος"
                  icon={<Lock className="h-3 w-3" />}
                  hint="Θα δημιουργηθεί λογαριασμός για login στο mobile app."
                  isDark={isDark}
                >
                  <div className="relative">
                    <input
                      type={passwordVisible ? "text" : "password"}
                      className={`${inputCls} pr-9`}
                      placeholder="Τουλάχιστον 6 χαρακτήρες"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />

                    <button
                      type="button"
                      onClick={() => setPasswordVisible((v) => !v)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md transition ${isDark
                          ? "text-slate-400 hover:text-slate-200"
                          : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      {passwordVisible ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
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
                      <FormField label="Ονοματεπωνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}>
                        <input className={inputCls} placeholder={`π.χ. ${title === 'Πατέρας' ? 'Δημήτρης' : 'Μαρία'} Παπαδόπουλος`} value={name} onChange={(e) => setName(e.target.value)} />
                      </FormField>
                      <FormField label="Ημερομηνια γεννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
                        <DatePickerField label="" value={dob} onChange={setDob} placeholder="π.χ. 24/12/1980" id={dobId} />
                      </FormField>
                      <FormField label="Τηλεφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}>
                        <input className={inputCls} placeholder="π.χ. 6900000000" value={ph} onChange={(e) => setPh(e.target.value)} />
                      </FormField>
                      <FormField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}>
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
