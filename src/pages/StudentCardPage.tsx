// src/pages/StudentCardPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Phone, Mail, Calendar,
  FileText, Layers, Pencil, Loader2, CheckCircle2, Lock,
  Users, BookOpen, UserCheck, AlertCircle, ChevronLeft, ChevronRight,
  GraduationCap, TrendingUp, Wallet, Receipt,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import DatePickerField from '../components/ui/AppDatePicker';
import type { StudentRow, LevelRow, SubscriptionRow, ClassEnrollment, ProgramSlot } from '../components/students/types';
import { STUDENT_SELECT, formatDateToGreek, isoToDisplay, displayToIso } from '../components/students/types';

// ── Constants ──────────────────────────────────────────────────────────────

const DAYS = [
  { value: 'monday',    label: 'Δευτέρα',   js: 1 },
  { value: 'tuesday',   label: 'Τρίτη',     js: 2 },
  { value: 'wednesday', label: 'Τετάρτη',   js: 3 },
  { value: 'thursday',  label: 'Πέμπτη',    js: 4 },
  { value: 'friday',    label: 'Παρασκευή', js: 5 },
  { value: 'saturday',  label: 'Σάββατο',   js: 6 },
  { value: 'sunday',    label: 'Κυριακή',   js: 0 },
];

const MONTH_NAMES = [
  'Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος',
  'Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος',
];

const CLASS_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
const PAYMENTS_PER_PAGE = 5;

type PaymentRow = { subscription_id: string; amount: number; created_at: string | null };

// ── Helpers ────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmt12(t: string | null): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = Number(hStr); const m = Number(mStr ?? 0);
  const period = h < 12 ? 'πμ' : 'μμ';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('el-GR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function fmtDateLong(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const dayLabel = DAYS.find(x => x.js === d.getDay())?.label ?? '';
  return `${dayLabel} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// Monday-first grid index (Mon=0 … Sun=6)
const jsToGrid = (js: number) => (js === 0 ? 6 : js - 1);

// ── Calendar ───────────────────────────────────────────────────────────────

function MonthCalendar({ slots, isDark }: { slots: ProgramSlot[]; isDark: boolean }) {
  const today = new Date();
  const [year, setYear]     = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(toISODate(today));

  const uniqueClasses = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; title: string; subject: string | null }[] = [];
    slots.forEach(s => { if (!seen.has(s.class_id)) { seen.add(s.class_id); out.push({ id: s.class_id, title: s.class_title, subject: s.class_subject }); } });
    return out;
  }, [slots]);

  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    uniqueClasses.forEach((c, i) => m.set(c.id, CLASS_COLORS[i % CLASS_COLORS.length]));
    return m;
  }, [uniqueClasses]);

  const slotsByJsDay = useMemo(() => {
    const m = new Map<number, ProgramSlot[]>();
    slots.forEach(s => {
      const d = DAYS.find(d => d.value === s.day_of_week);
      if (!d) return;
      if (!m.has(d.js)) m.set(d.js, []);
      m.get(d.js)!.push(s);
    });
    return m;
  }, [slots]);

  const todayStr       = toISODate(today);
  const firstOfMonth   = new Date(year, month, 1);
  const lastOfMonth    = new Date(year, month + 1, 0);
  const startPad       = jsToGrid(firstOfMonth.getDay());

  // 42-cell grid (6 rows × 7 cols), filling prev/next month overflow
  const cells: { date: Date; current: boolean }[] = [];
  for (let i = startPad - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= lastOfMonth.getDate(); d++)
    cells.push({ date: new Date(year, month, d), current: true });
  while (cells.length < 42)
    cells.push({ date: new Date(year, month + 1, cells.length - startPad - lastOfMonth.getDate() + 1), current: false });

  const selJsDay    = selected ? new Date(selected + 'T12:00:00').getDay() : -1;
  const selSlots    = slotsByJsDay.get(selJsDay) ?? [];

  function prev() { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }
  function next() { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }

  const headerBg  = isDark ? 'bg-slate-900/60' : 'bg-slate-50';
  const border    = isDark ? 'border-slate-700/50' : 'border-slate-200';

  return (
    <div className={`rounded-xl border overflow-hidden ${border} ${isDark ? 'bg-slate-900/30' : 'bg-white'}`}>

      {/* ── Navigation ── */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${border} ${headerBg}`}>
        <button type="button" onClick={prev}
          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button type="button" onClick={next}
          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Day headers ── */}
      <div className={`grid grid-cols-7 border-b ${border} ${headerBg}`}>
        {['Δ','Τ','Τ','Π','Π','Σ','Κ'].map((h, i) => (
          <div key={i} className={`py-2 text-center text-[11px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-7 p-2 gap-y-0.5">
        {cells.map((cell, i) => {
          const dStr      = toISODate(cell.date);
          const jsDay     = cell.date.getDay();
          const daySlots  = cell.current ? (slotsByJsDay.get(jsDay) ?? []) : [];
          const isToday   = dStr === todayStr;
          const isSel     = dStr === selected;

          return (
            <button key={i} type="button" onClick={() => setSelected(dStr)}
              className="flex flex-col items-center py-1 rounded-lg transition group">
              <span
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition',
                  isSel
                    ? 'font-bold text-white'
                    : isToday
                    ? 'font-bold'
                    : cell.current
                    ? isDark ? 'text-slate-200 group-hover:bg-slate-800' : 'text-slate-700 group-hover:bg-slate-100'
                    : isDark ? 'text-slate-700' : 'text-slate-300',
                ].join(' ')}
                style={
                  isSel    ? { background: 'var(--color-accent)' }
                  : isToday ? { color: 'var(--color-accent)', outline: '2px solid var(--color-accent)', outlineOffset: '-2px' }
                  : undefined
                }>
                {cell.date.getDate()}
              </span>
              {/* class dots */}
              <span className="flex h-2 items-center gap-0.5 mt-0.5">
                {daySlots.slice(0, 3).map(s => (
                  <span key={s.id} className="h-1 w-1 rounded-full"
                    style={{ background: isSel ? 'rgba(255,255,255,0.65)' : (colorOf.get(s.class_id) ?? 'var(--color-accent)') }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Selected day info ── */}
      <div className={`border-t ${border} ${headerBg}`}>
        <div className={`flex items-center gap-2 px-4 py-2.5`}>
          <Calendar className={`h-3 w-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {selected ? fmtDateLong(selected) : '—'}
          </span>
          <span className={`ml-auto text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {selSlots.length === 0 ? 'Χωρίς μάθημα' : `${selSlots.length} μάθημα`}
          </span>
        </div>
        {selSlots.length > 0 && (
          <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'} border-t ${border}`}>
            {selSlots.map(slot => (
              <div key={slot.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colorOf.get(slot.class_id) ?? 'var(--color-accent)' }} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{slot.class_title}</p>
                  {slot.class_subject && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{slot.class_subject}</p>}
                </div>
                {slot.start_time && (
                  <span className={`text-[11px] tabular-nums font-medium shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {fmt12(slot.start_time)}{slot.end_time ? ` – ${fmt12(slot.end_time)}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Shared field components ────────────────────────────────────────────────

function ReadField({ label, value, isDark }: { label: string; value: string | null | undefined; isDark: boolean }) {
  return (
    <div>
      <div className={`mb-0.5 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
      <div className={`rounded-lg border px-2.5 py-1.5 text-xs ${isDark ? 'border-slate-700/40 bg-slate-900/30 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        {value?.trim() ? value : <span className={isDark ? 'italic text-slate-600' : 'italic text-slate-400'}>—</span>}
      </div>
    </div>
  );
}

function EditField({ label, icon, children, isDark }: { label: string; icon?: React.ReactNode; children: React.ReactNode; isDark: boolean }) {
  return (
    <div className="space-y-1">
      <label className={`flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {icon && <span className="opacity-60">{icon}</span>}{label}
      </label>
      {children}
    </div>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────

function DashCard({ title, icon, isDark, onEdit, editing, accentTop, children }: {
  title: string; icon: React.ReactNode; isDark: boolean;
  onEdit?: () => void; editing?: boolean; accentTop?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${isDark
      ? 'border-slate-700/50 bg-slate-950/40 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]'
      : 'border-slate-200 bg-white shadow-sm'}`}>
      {accentTop && <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
          <h2 className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{title}</h2>
        </div>
        {onEdit && !editing && (
          <button type="button" onClick={onEdit}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition ${isDark ? 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
            <Pencil className="h-2.5 w-2.5" />Επεξεργασία
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────────────────

function StatTile({ label, value, color, isDark }: { label: string; value: string; color: 'green'|'red'|'blue'|'neutral'; isDark: boolean }) {
  const bg = { green: isDark?'border-emerald-500/30 bg-emerald-950/30':'border-emerald-200 bg-emerald-50', red: isDark?'border-rose-500/30 bg-rose-950/30':'border-rose-200 bg-rose-50', blue: isDark?'border-blue-500/30 bg-blue-950/20':'border-blue-200 bg-blue-50', neutral: isDark?'border-slate-700/50 bg-slate-900/30':'border-slate-200 bg-slate-50' };
  const vc = { green: isDark?'text-emerald-300':'text-emerald-700', red: isDark?'text-rose-300':'text-rose-700', blue: isDark?'text-blue-300':'text-blue-700', neutral: isDark?'text-slate-200':'text-slate-700' };
  return (
    <div className={`rounded-xl border px-3 py-2 ${bg[color]}`}>
      <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark?'text-slate-500':'text-slate-400'}`}>{label}</p>
      <p className={`text-sm font-bold tabular-nums ${vc[color]}`}>{value}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function StudentCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [student, setStudent]         = useState<StudentRow | null>(null);
  const [levels, setLevels]           = useState<LevelRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments]       = useState<PaymentRow[]>([]);
  const [classes, setClasses]         = useState<ClassEnrollment[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ProgramSlot[]>([]);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);

  // payment pagination per subscription
  const [payPages, setPayPages] = useState<Record<string, number>>({});

  const [editingStudent, setEditingStudent] = useState(false);
  const [savingStudent, setSavingStudent]   = useState(false);
  const [studentError, setStudentError]     = useState<string | null>(null);
  const [studentSuccess, setStudentSuccess] = useState(false);
  const [fullName, setFullName]             = useState('');
  const [dateOfBirth, setDateOfBirth]       = useState('');
  const [phone, setPhone]                   = useState('');
  const [email, setEmail]                   = useState('');
  const [specialNotes, setSpecialNotes]     = useState('');
  const [levelId, setLevelId]               = useState('');
  const [newPassword, setNewPassword]       = useState('');

  const [editingParents, setEditingParents] = useState(false);
  const [savingParents, setSavingParents]   = useState(false);
  const [parentsError, setParentsError]     = useState<string | null>(null);
  const [parentsSuccess, setParentsSuccess] = useState(false);
  const [fatherName, setFatherName]         = useState('');
  const [fatherDob, setFatherDob]           = useState('');
  const [fatherPhone, setFatherPhone]       = useState('');
  const [fatherEmail, setFatherEmail]       = useState('');
  const [motherName, setMotherName]         = useState('');
  const [motherDob, setMotherDob]           = useState('');
  const [motherPhone, setMotherPhone]       = useState('');
  const [motherEmail, setMotherEmail]       = useState('');

  const inputCls = `h-8 w-full rounded-lg border px-2.5 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const cancelBtnCls = `btn border px-3 py-1.5 text-xs disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`;

  const levelNameById = useMemo(() => new Map(levels.map(l => [l.id, l.name])), [levels]);

  const activeSub      = useMemo(() => subscriptions.find(s => s.status === 'active') ?? null, [subscriptions]);
  const totalCharged   = useMemo(() => subscriptions.reduce((a, s) => a + Number(s.charge_amount ?? s.price ?? 0), 0), [subscriptions]);
  const totalPaid      = useMemo(() => payments.reduce((a, p) => a + Number(p.amount ?? 0), 0), [payments]);
  const totalBalance   = useMemo(() => subscriptions.filter(s => s.status === 'active').reduce((a, s) => a + Number(s.balance ?? 0), 0), [subscriptions]);
  const hasBalanceData = activeSub && activeSub.balance != null;
  const owes           = hasBalanceData && totalBalance > 0;

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
      setStudent(s); populateStudentForm(s); populateParentsForm(s);
      setLevels((lvlRes.data ?? []) as LevelRow[]);
      const subs = (subRes.data ?? []) as SubscriptionRow[];
      if (!subRes.error) setSubscriptions(subs);
      const subIds = subs.map(s => s.id);
      if (subIds.length > 0) {
        const { data: payData } = await supabase
          .from('student_subscription_payments')
          .select('subscription_id, amount, created_at')
          .eq('school_id', schoolId).in('subscription_id', subIds)
          .order('created_at', { ascending: false });
        setPayments((payData ?? []) as PaymentRow[]);
      }
      const csData = (csRes.data ?? []) as unknown as ClassEnrollment[];
      setClasses(csData);
      const classIds = csData.map(c => c.class_id).filter(Boolean);
      const programId = (progRes.data as any)?.id;
      if (classIds.length > 0 && programId) {
        const { data: itemData, error: itemErr } = await supabase
          .from('program_items').select('id, class_id, day_of_week, start_time, end_time, subject')
          .eq('program_id', programId).in('class_id', classIds);
        if (!itemErr) {
          const classInfoMap = new Map<string, { title: string; subject: string | null }>();
          csData.forEach(c => { if (c.classes) classInfoMap.set(c.class_id, { title: c.classes.title, subject: c.classes.subject }); });
          setScheduleSlots((itemData ?? []).map((item: any) => ({
            id: item.id, class_id: item.class_id,
            class_title: classInfoMap.get(item.class_id)?.title ?? '—',
            class_subject: item.subject ?? classInfoMap.get(item.class_id)?.subject ?? null,
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
    setSpecialNotes(s.special_notes ?? ''); setLevelId(s.level_id ?? ''); setNewPassword('');
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
      active:    { label: 'Ενεργή',      cls: isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700' },
      completed: { label: 'Ολοκλ.',      cls: isDark ? 'border-slate-600/50 bg-slate-800/40 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500' },
      canceled:  { label: 'Ακυρώθηκε',  cls: isDark ? 'border-red-500/40 bg-red-950/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600' },
    };
    const { label, cls } = map[status] ?? map.completed;
    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
  }

  function getPayPage(subId: string) { return payPages[subId] ?? 0; }
  function setPayPage(subId: string, page: number) { setPayPages(p => ({ ...p, [subId]: page })); }

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
        <button onClick={() => navigate('/students')} className="btn-primary px-4 py-2 text-xs font-semibold">Επιστροφή</button>
      </div>
    );
  }

  const levelName = student.level_id ? (levelNameById.get(student.level_id) ?? '—') : '—';

  return (
    <div className="space-y-4 px-1">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/students')}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
          <GraduationCap className="h-3.5 w-3.5" style={{ color: 'var(--color-input-bg)' }} />
        </div>
        <h1 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{student.full_name}</h1>
        {hasBalanceData && (
          owes
            ? <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-red-500/40 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-600'}`}><AlertCircle className="h-2.5 w-2.5" />Οφείλει {totalBalance.toFixed(2)}€</span>
            : <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-2.5 w-2.5" />Εξοφλημένος</span>
        )}
      </div>

      {studentSuccess && <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-3 w-3 shrink-0" />Στοιχεία μαθητή αποθηκεύτηκαν.</div>}
      {parentsSuccess && <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-3 w-3 shrink-0" />Στοιχεία γονέων αποθηκεύτηκαν.</div>}

      {/* ── Grid ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* ── Left: info + parents + economics ── */}
        <div className="flex flex-col gap-4">

          {/* Student info */}
          <DashCard title="Στοιχεία Μαθητή" icon={<User className="h-3.5 w-3.5" />} isDark={isDark} accentTop
            onEdit={() => { setStudentError(null); setEditingStudent(true); }} editing={editingStudent}>
            {studentError && (
              <div className={`mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{studentError}
              </div>
            )}
            {editingStudent ? (
              <div className="space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <EditField label="Ονοματεπώνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}><input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)} autoFocus /></EditField>
                  <EditField label="Επίπεδο" icon={<Layers className="h-3 w-3" />} isDark={isDark}>
                    <select className={inputCls} value={levelId} onChange={e => setLevelId(e.target.value)}>
                      <option value="">Χωρίς επίπεδο</option>
                      {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </EditField>
                  <EditField label="Ημ. Γέννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}><DatePickerField label="" value={dateOfBirth} onChange={setDateOfBirth} placeholder="24/12/2010" id="card-dob" /></EditField>
                  <EditField label="Τηλέφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}><input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} /></EditField>
                  <EditField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}><input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} /></EditField>
                  <EditField label="Σημειώσεις" icon={<FileText className="h-3 w-3" />} isDark={isDark}><input className={inputCls} value={specialNotes} onChange={e => setSpecialNotes(e.target.value)} /></EditField>
                  <EditField label="Νέος Κωδικός" icon={<Lock className="h-3 w-3" />} isDark={isDark}><input type="password" className={inputCls} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Κενό = χωρίς αλλαγή" /></EditField>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditingStudent(false); populateStudentForm(student); setStudentError(null); }} disabled={savingStudent} className={cancelBtnCls}>Ακύρωση</button>
                  <button type="button" onClick={handleSaveStudent} disabled={savingStudent} className="btn-primary gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                    {savingStudent ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                <ReadField label="Ονοματεπώνυμο" value={student.full_name} isDark={isDark} />
                <ReadField label="Επίπεδο" value={levelName} isDark={isDark} />
                <ReadField label="Ημ. Γέννησης" value={formatDateToGreek(student.date_of_birth)} isDark={isDark} />
                <ReadField label="Τηλέφωνο" value={student.phone} isDark={isDark} />
                <ReadField label="Email" value={student.email} isDark={isDark} />
                <ReadField label="Σημειώσεις" value={student.special_notes} isDark={isDark} />
              </div>
            )}
          </DashCard>

          {/* Parents */}
          <DashCard title="Στοιχεία Γονέων" icon={<UserCheck className="h-3.5 w-3.5" />} isDark={isDark}
            onEdit={() => { setParentsError(null); setEditingParents(true); }} editing={editingParents}>
            {parentsError && (
              <div className={`mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{parentsError}
              </div>
            )}
            {editingParents ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { title:'Πατέρας', name:fatherName, setName:setFatherName, dob:fatherDob, setDob:setFatherDob, dobId:'card-fdob', phone:fatherPhone, setPhone:setFatherPhone, email:fatherEmail, setEmail:setFatherEmail },
                    { title:'Μητέρα',  name:motherName, setName:setMotherName, dob:motherDob, setDob:setMotherDob, dobId:'card-mdob', phone:motherPhone, setPhone:setMotherPhone, email:motherEmail, setEmail:setMotherEmail },
                  ].map(({ title, name, setName, dob, setDob, dobId, phone: ph, setPhone: setPh, email: em, setEmail: setEm }) => (
                    <div key={title} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700/50 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
                      <p className={`mb-2 text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
                      <div className="space-y-2">
                        <EditField label="Ονοματεπώνυμο" isDark={isDark}><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></EditField>
                        <EditField label="Ημ. Γέννησης" isDark={isDark}><DatePickerField label="" value={dob} onChange={setDob} placeholder="24/12/1980" id={dobId} /></EditField>
                        <EditField label="Τηλέφωνο" isDark={isDark}><input className={inputCls} value={ph} onChange={e => setPh(e.target.value)} /></EditField>
                        <EditField label="Email" isDark={isDark}><input type="email" className={inputCls} value={em} onChange={e => setEm(e.target.value)} /></EditField>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditingParents(false); populateParentsForm(student); setParentsError(null); }} disabled={savingParents} className={cancelBtnCls}>Ακύρωση</button>
                  <button type="button" onClick={handleSaveParents} disabled={savingParents} className="btn-primary gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                    {savingParents ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { title:'Πατέρας', name:student.father_name, dob:student.father_date_of_birth, phone:student.father_phone, email:student.father_email },
                  { title:'Μητέρα',  name:student.mother_name, dob:student.mother_date_of_birth, phone:student.mother_phone, email:student.mother_email },
                ].map(({ title, name, dob, phone: ph, email: em }) => (
                  <div key={title}>
                    <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
                    <div className="grid gap-1.5 grid-cols-2">
                      <ReadField label="Ονοματεπώνυμο" value={name} isDark={isDark} />
                      <ReadField label="Ημ. Γέννησης" value={formatDateToGreek(dob)} isDark={isDark} />
                      <ReadField label="Τηλέφωνο" value={ph} isDark={isDark} />
                      <ReadField label="Email" value={em} isDark={isDark} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashCard>

          {/* Economics */}
          <DashCard title="Οικονομικά & Ιστορικό" icon={<Wallet className="h-3.5 w-3.5" />} isDark={isDark} accentTop>
            {subscriptions.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2">
                <StatTile label="Χρέωση"    value={`${totalCharged.toFixed(2)}€`} color="blue"  isDark={isDark} />
                <StatTile label="Πληρωμένο" value={`${totalPaid.toFixed(2)}€`}    color="green" isDark={isDark} />
                <StatTile label="Υπόλοιπο"  value={`${totalBalance.toFixed(2)}€`} color={totalBalance > 0 ? 'red' : 'green'} isDark={isDark} />
              </div>
            )}
            {subscriptions.length === 0 ? (
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχει καταχωρημένη συνδρομή.</p>
            ) : (
              <div className="space-y-3">
                {subscriptions.map(sub => {
                  const subPayments = payments.filter(p => p.subscription_id === sub.id);
                  const subPaid     = subPayments.reduce((a, p) => a + Number(p.amount ?? 0), 0);
                  const page        = getPayPage(sub.id);
                  const pageCount   = Math.max(1, Math.ceil(subPayments.length / PAYMENTS_PER_PAGE));
                  const pagePays    = subPayments.slice(page * PAYMENTS_PER_PAGE, (page + 1) * PAYMENTS_PER_PAGE);

                  return (
                    <div key={sub.id} className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                      {/* header */}
                      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          {statusBadge(sub.status)}
                          <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sub.package_name}</span>
                        </div>
                        {(sub.starts_on || sub.ends_on) && (
                          <span className={`text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {sub.starts_on ? formatDateToGreek(sub.starts_on) : '—'} → {sub.ends_on ? formatDateToGreek(sub.ends_on) : '—'}
                          </span>
                        )}
                      </div>
                      {/* financials */}
                      <div className={`grid grid-cols-3 gap-px ${isDark ? 'bg-slate-800/40' : 'bg-slate-200'}`}>
                        {[
                          { label:'Χρέωση',    val:`${Number(sub.charge_amount ?? sub.price ?? 0).toFixed(2)}€`, color: isDark?'text-slate-200':'text-slate-700' },
                          { label:'Πληρωμένο', val:`${subPaid.toFixed(2)}€`,                                     color: isDark?'text-emerald-300':'text-emerald-700' },
                          { label:'Υπόλοιπο',  val:`${Number(sub.balance ?? 0).toFixed(2)}€`,                    color: Number(sub.balance??0)>0?(isDark?'text-rose-300':'text-rose-600'):(isDark?'text-emerald-300':'text-emerald-700') },
                        ].map(({ label, val, color }) => (
                          <div key={label} className={`px-2 py-2 text-center ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                            <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark?'text-slate-500':'text-slate-400'}`}>{label}</p>
                            <p className={`text-[11px] font-bold tabular-nums ${color}`}>{val}</p>
                          </div>
                        ))}
                      </div>
                      {/* payment rows */}
                      {subPayments.length > 0 ? (
                        <>
                          <div className={`divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 ${isDark ? 'bg-slate-900/20' : 'bg-slate-50/80'}`}>
                              <Receipt className={`h-2.5 w-2.5 ${isDark?'text-slate-500':'text-slate-400'}`} />
                              <span className={`text-[9px] font-semibold uppercase tracking-wider ${isDark?'text-slate-500':'text-slate-400'}`}>Πληρωμές ({subPayments.length})</span>
                            </div>
                            {pagePays.map((p, i) => (
                              <div key={i} className={`flex items-center justify-between px-3 py-2 ${isDark?'bg-slate-950/20':'bg-white'}`}>
                                <div className="flex items-center gap-2">
                                  <span className={`h-1.5 w-1.5 rounded-full ${isDark?'bg-emerald-400':'bg-emerald-500'}`} />
                                  <span className={`text-[11px] tabular-nums ${isDark?'text-slate-400':'text-slate-500'}`}>{fmtDateTime(p.created_at)}</span>
                                </div>
                                <span className={`text-xs font-semibold tabular-nums ${isDark?'text-emerald-300':'text-emerald-700'}`}>+{Number(p.amount).toFixed(2)}€</span>
                              </div>
                            ))}
                          </div>
                          {/* pagination */}
                          {pageCount > 1 && (
                            <div className={`flex items-center justify-between gap-2 px-3 py-2 border-t ${isDark ? 'border-slate-800/60 bg-slate-900/30' : 'border-slate-100 bg-slate-50'}`}>
                              <button type="button" disabled={page <= 0} onClick={() => setPayPage(sub.id, page - 1)}
                                className={`flex h-6 w-6 items-center justify-center rounded border transition disabled:opacity-30 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                                <ChevronLeft className="h-3 w-3" />
                              </button>
                              <span className={`text-[10px] ${isDark?'text-slate-500':'text-slate-400'}`}>{page + 1} / {pageCount}</span>
                              <button type="button" disabled={page >= pageCount - 1} onClick={() => setPayPage(sub.id, page + 1)}
                                className={`flex h-6 w-6 items-center justify-center rounded border transition disabled:opacity-30 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </>
                      ) : sub.status === 'active' ? (
                        <div className={`flex items-center gap-2 px-3 py-2.5 ${isDark?'bg-slate-950/20':'bg-white'}`}>
                          <TrendingUp className={`h-3 w-3 ${isDark?'text-slate-600':'text-slate-400'}`} />
                          <span className={`text-[11px] ${isDark?'text-slate-600':'text-slate-400'}`}>Δεν έχουν καταχωρηθεί πληρωμές.</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </DashCard>
        </div>

        {/* ── Right: program + calendar ── */}
        <div className="flex flex-col gap-4">

          <DashCard title="Πρόγραμμα" icon={<BookOpen className="h-3.5 w-3.5" />} isDark={isDark}>
            {classes.length > 0 && (
              <div className={`mb-3 flex flex-wrap gap-1.5 pb-3 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
                {classes.map(c => {
                  if (!c.classes) return null;
                  return (
                    <span key={c.class_id} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${isDark ? 'border-slate-700/50 bg-slate-900/30 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      <BookOpen className="h-3 w-3 shrink-0" style={{ color: 'var(--color-accent)' }} />
                      {c.classes.title}
                      {c.classes.subject && <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'}`}>· {c.classes.subject}</span>}
                    </span>
                  );
                })}
              </div>
            )}
            <MonthCalendar slots={scheduleSlots} isDark={isDark} />
            {classes.length === 0 && scheduleSlots.length === 0 && (
              <p className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ο μαθητής δεν έχει ενταχθεί σε τμήμα.</p>
            )}
          </DashCard>

        </div>
      </div>
    </div>
  );
}
