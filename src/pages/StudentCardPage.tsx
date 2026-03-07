// src/pages/StudentCardPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, GraduationCap, User, Phone, Mail, Calendar,
  FileText, Layers, Pencil, Loader2, CheckCircle2, Lock,
  Users, BookOpen, CreditCard, UserCheck, AlertCircle, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import DatePickerField from '../components/ui/AppDatePicker';
import type { StudentRow, LevelRow, SubscriptionRow, ClassEnrollment, ProgramSlot } from '../components/students/types';
import { STUDENT_SELECT, formatDateToGreek, isoToDisplay, displayToIso } from '../components/students/types';

// ── Day / time helpers ─────────────────────────────────────────────────────

const DAYS = [
  { value: 'monday',    short: 'ΔΕΥ', label: 'Δευτέρα',   js: 1 },
  { value: 'tuesday',   short: 'ΤΡΙ', label: 'Τρίτη',     js: 2 },
  { value: 'wednesday', short: 'ΤΕΤ', label: 'Τετάρτη',   js: 3 },
  { value: 'thursday',  short: 'ΠΕΜ', label: 'Πέμπτη',    js: 4 },
  { value: 'friday',    short: 'ΠΑΡ', label: 'Παρασκευή', js: 5 },
  { value: 'saturday',  short: 'ΣΑΒ', label: 'Σάββατο',   js: 6 },
  { value: 'sunday',    short: 'ΚΥΡ', label: 'Κυριακή',   js: 0 },
];

function timeToMins(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmt24(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h}:${(m ?? '00').padStart(2, '0')}`;
}

function fmt12(t: string | null): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = Number(hStr); const m = Number(mStr ?? 0);
  const period = h < 12 ? 'πμ' : 'μμ';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function getNextClass(slots: ProgramSlot[]): { label: string; time: string; className: string } | null {
  if (!slots.length) return null;
  const now = new Date();
  const todayJs = now.getDay();
  const todayMins = now.getHours() * 60 + now.getMinutes();
  let best: { diff: number; slot: ProgramSlot } | null = null;
  for (const slot of slots) {
    const day = DAYS.find((d) => d.value === slot.day_of_week);
    if (!day) continue;
    let diff = day.js - todayJs;
    if (diff < 0) diff += 7;
    if (diff === 0 && timeToMins(slot.start_time) <= todayMins) diff = 7;
    if (!best || diff < best.diff || (diff === best.diff && timeToMins(slot.start_time) < timeToMins(best.slot.start_time))) {
      best = { diff, slot };
    }
  }
  if (!best) return null;
  const dayLabel = DAYS.find((d) => d.value === best!.slot.day_of_week)?.label ?? '';
  const when = best.diff === 0 ? 'Σήμερα' : best.diff === 1 ? 'Αύριο' : dayLabel;
  return { label: when, time: fmt12(best.slot.start_time), className: best.slot.class_title };
}

// ── Mini weekly calendar ───────────────────────────────────────────────────

const GRID_H = 300;

function WeeklyCalendar({ slots, isDark }: { slots: ProgramSlot[]; isDark: boolean }) {
  const todayJs = new Date().getDay();

  if (!slots.length) {
    return (
      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Δεν υπάρχει ωρολόγιο πρόγραμμα.
      </p>
    );
  }

  const allStart = slots.map((s) => timeToMins(s.start_time));
  const allEnd = slots.map((s) => s.end_time ? timeToMins(s.end_time) : timeToMins(s.start_time) + 60);
  const gridStartH = Math.max(7, Math.floor(Math.min(...allStart) / 60) - 1);
  const gridEndH = Math.min(23, Math.ceil(Math.max(...allEnd) / 60) + 1);
  const totalGridMins = (gridEndH - gridStartH) * 60;
  const pxPerMin = GRID_H / totalGridMins;

  const hourMarkers: number[] = [];
  for (let h = gridStartH; h <= gridEndH; h++) hourMarkers.push(h);

  const slotsByDay: Record<string, ProgramSlot[]> = {};
  DAYS.forEach((d) => { slotsByDay[d.value] = []; });
  slots.forEach((s) => { slotsByDay[s.day_of_week]?.push(s); });

  return (
    <div className="flex overflow-x-auto">
      {/* Time axis */}
      <div className="shrink-0 pr-2" style={{ position: 'relative', height: GRID_H }}>
        {hourMarkers.map((h) => (
          <div key={h}
            style={{ position: 'absolute', top: (h - gridStartH) * 60 * pxPerMin - 6, right: 0 }}
            className={`text-[9px] font-medium tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {h}:00
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div className="flex flex-1 gap-0.5 min-w-0">
        {DAYS.map((day) => {
          const isToday = day.js === todayJs;
          const daySlots = slotsByDay[day.value];

          return (
            <div key={day.value} className="flex-1 min-w-0 flex flex-col gap-0">
              {/* Day header */}
              <div className={`text-center text-[9px] font-bold uppercase tracking-wide mb-1 pb-1 border-b ${
                isToday
                  ? 'text-[color:var(--color-accent)] border-[color:var(--color-accent)]/40'
                  : isDark ? 'text-slate-600 border-slate-800/50' : 'text-slate-400 border-slate-200'
              }`}>
                {day.short}
              </div>

              {/* Time grid column */}
              <div className="relative flex-1 rounded-md overflow-hidden"
                style={{
                  height: GRID_H,
                  background: isToday
                    ? (isDark ? 'color-mix(in srgb, var(--color-accent) 6%, transparent)' : 'color-mix(in srgb, var(--color-accent) 5%, transparent)')
                    : (isDark ? 'rgba(15,23,42,0.3)' : 'rgba(241,245,249,0.5)'),
                  border: `1px solid ${isToday
                    ? 'color-mix(in srgb, var(--color-accent) 30%, transparent)'
                    : isDark ? 'rgba(51,65,85,0.3)' : 'rgba(203,213,225,0.5)'}`,
                }}>

                {/* Hour lines */}
                {hourMarkers.map((h) => (
                  <div key={h}
                    style={{ position: 'absolute', top: (h - gridStartH) * 60 * pxPerMin, left: 0, right: 0, height: 1 }}
                    className={isDark ? 'bg-slate-800/60' : 'bg-slate-200/70'}
                  />
                ))}

                {/* Class slots */}
                {daySlots.map((slot) => {
                  const startMins = timeToMins(slot.start_time);
                  const endMins = slot.end_time ? timeToMins(slot.end_time) : startMins + 60;
                  const top = (startMins - gridStartH * 60) * pxPerMin;
                  const height = Math.max(24, (endMins - startMins) * pxPerMin);

                  return (
                    <div key={slot.id}
                      style={{
                        position: 'absolute', top, left: 2, right: 2, height,
                        background: 'color-mix(in srgb, var(--color-accent) 22%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)',
                        borderRadius: 5,
                        overflow: 'hidden',
                        padding: '2px 4px',
                      }}>
                      <p className="text-[8px] font-semibold leading-tight truncate" style={{ color: 'var(--color-accent)' }}>
                        {slot.class_title}
                      </p>
                      {height > 30 && (
                        <p className={`text-[7px] leading-tight mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {fmt24(slot.start_time)}{slot.end_time ? `–${fmt24(slot.end_time)}` : ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared field components ────────────────────────────────────────────────

function ReadField({ label, value, isDark }: { label: string; value: string | null | undefined; isDark: boolean }) {
  return (
    <div>
      <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
      <div className={`rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-slate-700/40 bg-slate-900/30 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        {value?.trim() ? value : <span className={isDark ? 'italic text-slate-600' : 'italic text-slate-400'}>—</span>}
      </div>
    </div>
  );
}

function EditField({ label, icon, children, isDark }: { label: string; icon?: React.ReactNode; children: React.ReactNode; isDark: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {icon && <span className="opacity-60">{icon}</span>}{label}
      </label>
      {children}
    </div>
  );
}

function SectionRow({ title, icon, isDark, onEdit, editing, children }: {
  title: string; icon: React.ReactNode; isDark: boolean;
  onEdit?: () => void; editing?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{icon}</span>
          <h2 className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{title}</h2>
        </div>
        {onEdit && !editing && (
          <button type="button" onClick={onEdit}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${isDark ? 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
            <Pencil className="h-3 w-3" />Επεξεργασία
          </button>
        )}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

const divider = (isDark: boolean) => (
  <div className={`mx-0 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`} />
);

// ── Page ──────────────────────────────────────────────────────────────────

export default function StudentCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [classes, setClasses] = useState<ClassEnrollment[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ProgramSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Student edit ──
  const [editingStudent, setEditingStudent] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [studentSuccess, setStudentSuccess] = useState(false);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [levelId, setLevelId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // ── Parents edit ──
  const [editingParents, setEditingParents] = useState(false);
  const [savingParents, setSavingParents] = useState(false);
  const [parentsError, setParentsError] = useState<string | null>(null);
  const [parentsSuccess, setParentsSuccess] = useState(false);
  const [fatherName, setFatherName] = useState('');
  const [fatherDob, setFatherDob] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [fatherEmail, setFatherEmail] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherDob, setMotherDob] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [motherEmail, setMotherEmail] = useState('');

  const inputCls = `h-9 w-full rounded-lg border px-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const cancelBtnCls = `btn border px-4 py-1.5 text-xs disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`;

  const levelNameById = useMemo(() => new Map(levels.map((l) => [l.id, l.name])), [levels]);

  // ── Subscription derived values ──
  const activeSub = useMemo(() => subscriptions.find((s) => s.status === 'active') ?? null, [subscriptions]);
  const totalBalance = useMemo(() =>
    subscriptions.filter((s) => s.status === 'active').reduce((acc, s) => acc + Number(s.balance ?? 0), 0),
    [subscriptions]);
  const hasBalanceData = activeSub && activeSub.balance != null;
  const owes = hasBalanceData && totalBalance > 0;

  const nextClass = useMemo(() => getNextClass(scheduleSlots), [scheduleSlots]);

  // ── Load all data ──
  useEffect(() => {
    if (!id || !schoolId) return;
    const load = async () => {
      setLoading(true);
      const [stuRes, lvlRes, subRes, csRes, progRes] = await Promise.all([
        supabase.from('students').select(STUDENT_SELECT).eq('id', id).eq('school_id', schoolId).maybeSingle(),
        supabase.from('levels').select('id, school_id, name, created_at').eq('school_id', schoolId).order('name'),
        supabase.from('student_subscriptions_with_totals')
          .select('id, school_id, student_id, package_id, package_name, price, currency, status, starts_on, ends_on, created_at, balance, paid_amount, charge_amount')
          .eq('student_id', id).eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('class_students').select('class_id, classes(id, title, subject)').eq('student_id', id).eq('school_id', schoolId),
        supabase.from('programs').select('id').eq('school_id', schoolId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
      ]);

      if (stuRes.error || !stuRes.data) { setNotFound(true); setLoading(false); return; }
      const s = stuRes.data as StudentRow;
      setStudent(s);
      populateStudentForm(s);
      populateParentsForm(s);
      setLevels((lvlRes.data ?? []) as LevelRow[]);

      if (!subRes.error) setSubscriptions((subRes.data ?? []) as SubscriptionRow[]);
      else console.error('subscriptions error:', subRes.error);

      const csData = (csRes.data ?? []) as unknown as ClassEnrollment[];
      setClasses(csData);

      const classIds = csData.map((c) => c.class_id).filter(Boolean);
      const programId = (progRes.data as any)?.id;
      if (classIds.length > 0 && programId) {
        const { data: itemData, error: itemErr } = await supabase
          .from('program_items')
          .select('id, class_id, day_of_week, start_time, end_time')
          .eq('program_id', programId)
          .in('class_id', classIds);
        if (!itemErr) {
          const classInfoMap = new Map<string, { title: string; subject: string | null }>();
          csData.forEach((c) => { if (c.classes) classInfoMap.set(c.class_id, { title: c.classes.title, subject: c.classes.subject }); });
          setScheduleSlots((itemData ?? []).map((item: any) => ({
            id: item.id, class_id: item.class_id,
            class_title: classInfoMap.get(item.class_id)?.title ?? '—',
            class_subject: classInfoMap.get(item.class_id)?.subject ?? null,
            day_of_week: item.day_of_week, start_time: item.start_time, end_time: item.end_time,
          })));
        }
      }
      setLoading(false);
    };
    load();
  }, [id, schoolId]);

  function populateStudentForm(s: StudentRow) {
    setFullName(s.full_name ?? ''); setDateOfBirth(isoToDisplay(s.date_of_birth));
    setPhone(s.phone ?? ''); setEmail(s.email ?? '');
    setSpecialNotes(s.special_notes ?? ''); setLevelId(s.level_id ?? '');
    setNewPassword('');
  }

  function populateParentsForm(s: StudentRow) {
    setFatherName(s.father_name ?? ''); setFatherDob(isoToDisplay(s.father_date_of_birth));
    setFatherPhone(s.father_phone ?? ''); setFatherEmail(s.father_email ?? '');
    setMotherName(s.mother_name ?? ''); setMotherDob(isoToDisplay(s.mother_date_of_birth));
    setMotherPhone(s.mother_phone ?? ''); setMotherEmail(s.mother_email ?? '');
  }

  const handleSaveStudent = async () => {
    if (!student || !schoolId) return;
    const nameTrimmed = fullName.trim();
    if (!nameTrimmed) { setStudentError('Το ονοματεπώνυμο είναι υποχρεωτικό.'); return; }
    setSavingStudent(true); setStudentError(null);
    const { data, error } = await supabase.from('students').update({
      full_name: nameTrimmed, date_of_birth: displayToIso(dateOfBirth) || null,
      phone: phone.trim() || null, email: email.trim() || null,
      special_notes: specialNotes.trim() || null, level_id: levelId || null,
    }).eq('id', student.id).eq('school_id', schoolId).select(STUDENT_SELECT).maybeSingle();
    if (error || !data) { console.error(error); setStudentError('Αποτυχία αποθήκευσης.'); setSavingStudent(false); return; }
    setStudent(data as StudentRow);
    const np = newPassword.trim();
    if (np) {
      if (np.length < 6) { setStudentError('Ο κωδικός πρέπει ≥ 6 χαρακτήρες.'); setSavingStudent(false); return; }
      const { error: pwErr } = await supabase.functions.invoke('set-student-password', { body: { school_id: schoolId, student_id: student.id, new_password: np } });
      if (pwErr) console.error(pwErr);
    }
    setSavingStudent(false); setEditingStudent(false);
    setStudentSuccess(true); setTimeout(() => setStudentSuccess(false), 3000);
  };

  const handleSaveParents = async () => {
    if (!student || !schoolId) return;
    setSavingParents(true); setParentsError(null);
    const { data, error } = await supabase.from('students').update({
      father_name: fatherName.trim() || null, father_date_of_birth: displayToIso(fatherDob) || null,
      father_phone: fatherPhone.trim() || null, father_email: fatherEmail.trim() || null,
      mother_name: motherName.trim() || null, mother_date_of_birth: displayToIso(motherDob) || null,
      mother_phone: motherPhone.trim() || null, mother_email: motherEmail.trim() || null,
    }).eq('id', student.id).eq('school_id', schoolId).select(STUDENT_SELECT).maybeSingle();
    if (error || !data) { console.error(error); setParentsError('Αποτυχία αποθήκευσης.'); setSavingParents(false); return; }
    setStudent(data as StudentRow);
    setSavingParents(false); setEditingParents(false);
    setParentsSuccess(true); setTimeout(() => setParentsSuccess(false), 3000);
  };

  function statusBadge(status: SubscriptionRow['status']) {
    const map = {
      active: { label: 'Ενεργή', cls: isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700' },
      completed: { label: 'Ολοκληρώθηκε', cls: isDark ? 'border-slate-600/50 bg-slate-800/40 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500' },
      canceled: { label: 'Ακυρώθηκε', cls: isDark ? 'border-red-500/40 bg-red-950/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600' },
    };
    const { label, cls } = map[status] ?? map.completed;
    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Users className={`h-10 w-10 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Ο μαθητής δεν βρέθηκε.</p>
        <button onClick={() => navigate('/students')} className="btn-primary px-4 py-2 text-xs font-semibold">
          Επιστροφή στους μαθητές
        </button>
      </div>
    );
  }

  const levelName = student.level_id ? (levelNameById.get(student.level_id) ?? '—') : '—';

  const bigCard = `overflow-hidden rounded-2xl border ${isDark
    ? 'border-slate-700/50 bg-slate-950/40 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]'
    : 'border-slate-200 bg-white shadow-sm'}`;

  return (
    <div className="space-y-4 px-1">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => navigate('/students')}
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <GraduationCap className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{student.full_name}</h1>
              {/* Owes badge — always shown when subscription exists */}
              {hasBalanceData && (
                owes ? (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-red-500/40 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-600'}`}>
                    <AlertCircle className="h-3 w-3" />Οφείλει {totalBalance.toFixed(2)}€
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    <CheckCircle2 className="h-3 w-3" />Εξοφλημένος
                  </span>
                )
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {student.level_id && <span className={`inline-flex items-center gap-1 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><Layers className="h-3 w-3" />{levelName}</span>}
              {student.phone && <span className={`inline-flex items-center gap-1 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><Phone className="h-3 w-3" />{student.phone}</span>}
              {student.date_of_birth && <span className={`inline-flex items-center gap-1 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><Calendar className="h-3 w-3" />{formatDateToGreek(student.date_of_birth)}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Success toasts */}
      {studentSuccess && <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />Στοιχεία μαθητή αποθηκεύτηκαν.</div>}
      {parentsSuccess && <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />Στοιχεία γονέων αποθηκεύτηκαν.</div>}

      {/* ── Single card ── */}
      <div className={bigCard}>

        {/* ── Section 1: Student info ── */}
        <SectionRow title="Στοιχεία Μαθητή" icon={<User className="h-3.5 w-3.5" />} isDark={isDark}
          onEdit={() => { setStudentError(null); setEditingStudent(true); }} editing={editingStudent}>
          {studentError && (
            <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{studentError}
            </div>
          )}
          {editingStudent ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <EditField label="Ονοματεπώνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
                </EditField>
                <EditField label="Επίπεδο" icon={<Layers className="h-3 w-3" />} isDark={isDark}>
                  <select className={inputCls} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                    <option value="">Χωρίς επίπεδο</option>
                    {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </EditField>
                <EditField label="Ημ. Γέννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
                  <DatePickerField label="" value={dateOfBirth} onChange={setDateOfBirth} placeholder="24/12/2010" id="card-dob" />
                </EditField>
                <EditField label="Τηλέφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </EditField>
                <EditField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}>
                  <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
                </EditField>
                <EditField label="Σημειώσεις" icon={<FileText className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} />
                </EditField>
                <EditField label="Νέος Κωδικός" icon={<Lock className="h-3 w-3" />} isDark={isDark}>
                  <input type="password" className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Κενό = χωρίς αλλαγή" />
                </EditField>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setEditingStudent(false); populateStudentForm(student); setStudentError(null); }} disabled={savingStudent} className={cancelBtnCls}>Ακύρωση</button>
                <button type="button" onClick={handleSaveStudent} disabled={savingStudent} className="btn-primary gap-1.5 px-4 py-1.5 text-xs font-semibold disabled:opacity-60">
                  {savingStudent ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <ReadField label="Ονοματεπώνυμο" value={student.full_name} isDark={isDark} />
              <ReadField label="Επίπεδο" value={levelName} isDark={isDark} />
              <ReadField label="Ημ. Γέννησης" value={formatDateToGreek(student.date_of_birth)} isDark={isDark} />
              <ReadField label="Τηλέφωνο" value={student.phone} isDark={isDark} />
              <ReadField label="Email" value={student.email} isDark={isDark} />
              <ReadField label="Σημειώσεις" value={student.special_notes} isDark={isDark} />
            </div>
          )}
        </SectionRow>

        {divider(isDark)}

        {/* ── Section 2: Parents ── */}
        <SectionRow title="Στοιχεία Γονέων" icon={<UserCheck className="h-3.5 w-3.5" />} isDark={isDark}
          onEdit={() => { setParentsError(null); setEditingParents(true); }} editing={editingParents}>
          {parentsError && (
            <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{parentsError}
            </div>
          )}
          {editingParents ? (
            <div className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { title: 'Πατέρας', name: fatherName, setName: setFatherName, dob: fatherDob, setDob: setFatherDob, dobId: 'card-fdob', phone: fatherPhone, setPhone: setFatherPhone, email: fatherEmail, setEmail: setFatherEmail },
                  { title: 'Μητέρα', name: motherName, setName: setMotherName, dob: motherDob, setDob: setMotherDob, dobId: 'card-mdob', phone: motherPhone, setPhone: setMotherPhone, email: motherEmail, setEmail: setMotherEmail },
                ].map(({ title, name, setName, dob, setDob, dobId, phone: ph, setPhone: setPh, email: em, setEmail: setEm }) => (
                  <div key={title} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700/50 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`mb-2.5 text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
                    <div className="space-y-2.5">
                      <EditField label="Ονοματεπώνυμο" isDark={isDark}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></EditField>
                      <EditField label="Ημ. Γέννησης" isDark={isDark}><DatePickerField label="" value={dob} onChange={setDob} placeholder="24/12/1980" id={dobId} /></EditField>
                      <EditField label="Τηλέφωνο" isDark={isDark}><input className={inputCls} value={ph} onChange={(e) => setPh(e.target.value)} /></EditField>
                      <EditField label="Email" isDark={isDark}><input type="email" className={inputCls} value={em} onChange={(e) => setEm(e.target.value)} /></EditField>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setEditingParents(false); populateParentsForm(student); setParentsError(null); }} disabled={savingParents} className={cancelBtnCls}>Ακύρωση</button>
                <button type="button" onClick={handleSaveParents} disabled={savingParents} className="btn-primary gap-1.5 px-4 py-1.5 text-xs font-semibold disabled:opacity-60">
                  {savingParents ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: 'Πατέρας', name: student.father_name, dob: student.father_date_of_birth, phone: student.father_phone, email: student.father_email },
                { title: 'Μητέρα', name: student.mother_name, dob: student.mother_date_of_birth, phone: student.mother_phone, email: student.mother_email },
              ].map(({ title, name, dob, phone: ph, email: em }) => (
                <div key={title}>
                  <p className={`mb-2 text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
                  <div className="grid gap-2 grid-cols-2">
                    <ReadField label="Ονοματεπώνυμο" value={name} isDark={isDark} />
                    <ReadField label="Ημ. Γέννησης" value={formatDateToGreek(dob)} isDark={isDark} />
                    <ReadField label="Τηλέφωνο" value={ph} isDark={isDark} />
                    <ReadField label="Email" value={em} isDark={isDark} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionRow>

        {divider(isDark)}

        {/* ── Section 3: Subscription ── */}
        <SectionRow title="Συνδρομή" icon={<CreditCard className="h-3.5 w-3.5" />} isDark={isDark}>
          {subscriptions.length === 0 ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχει καταχωρημένη συνδρομή.</p>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div key={sub.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${isDark ? 'border-slate-700/50 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {statusBadge(sub.status)}
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sub.package_name}</span>
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{Number(sub.price).toFixed(2)}€</span>
                    {(sub.starts_on || sub.ends_on) && (
                      <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {sub.starts_on ? formatDateToGreek(sub.starts_on) : '—'} → {sub.ends_on ? formatDateToGreek(sub.ends_on) : '—'}
                      </span>
                    )}
                  </div>

                  {/* Balance status — always show for active subscriptions */}
                  {sub.status === 'active' && sub.balance != null && (
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${
                      Number(sub.balance) > 0
                        ? isDark ? 'border-red-500/40 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-600'
                        : isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}>
                      {Number(sub.balance) > 0
                        ? <><AlertCircle className="h-3 w-3" />Οφείλει {Number(sub.balance).toFixed(2)}€</>
                        : <><CheckCircle2 className="h-3 w-3" />Εξοφλημένο</>
                      }
                    </span>
                  )}
                  {sub.status === 'active' && sub.balance == null && sub.paid_amount != null && (
                    <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Πληρωμένο: {Number(sub.paid_amount).toFixed(2)}€
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionRow>

        {divider(isDark)}

        {/* ── Section 4: Program ── */}
        <SectionRow title="Πρόγραμμα" icon={<BookOpen className="h-3.5 w-3.5" />} isDark={isDark}>
          {/* Enrolled classes as pills */}
          {classes.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {classes.map((c) => {
                const cls = c.classes;
                if (!cls) return null;
                return (
                  <span key={c.class_id} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${isDark ? 'border-slate-700/50 bg-slate-900/30 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    <BookOpen className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                    {cls.title}
                    {cls.subject && <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'}`}>· {cls.subject}</span>}
                  </span>
                );
              })}
            </div>
          )}

          {/* Real weekly calendar */}
          <WeeklyCalendar slots={scheduleSlots} isDark={isDark} />

          {/* Next class strip */}
          {nextClass && (
            <div className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-2.5 ${isDark ? 'border-slate-700/50 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
              </div>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Επόμενο μάθημα</p>
                <p className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {nextClass.label}
                  {nextClass.time && <span className={`ml-1.5 font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>· {nextClass.time}</span>}
                  {nextClass.className && <span className={`ml-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>· {nextClass.className}</span>}
                </p>
              </div>
            </div>
          )}

          {classes.length === 0 && (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ο μαθητής δεν έχει ενταχθεί σε τμήμα.</p>
          )}
        </SectionRow>

      </div>
    </div>
  );
}
