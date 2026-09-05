// src/pages/TutorCardPage.tsx
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Phone, Mail, CreditCard, Hash, FileText, Tags,
  Loader2, Copy, Check, CalendarDays, BookOpenCheck, Clock, ChevronLeft, ChevronRight,
  Pencil, Trash2, UserCog, Users, CalendarRange, TrendingUp, Trophy, ClipboardCheck, Wallet,
  LayoutGrid, BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import TutorDeleteModal from '../components/tutors/TutorDeleteModal';
import StyledSelect from '../components/ui/StyledSelect';
import DatePickerField from '../components/ui/AppDatePicker';
import type { SpecialtyRow, TutorRow } from '../components/tutors/types';
import { TUTOR_SELECT } from '../components/tutors/types';
import { formatDateToGreek, isoToDisplay, displayToIso } from '../components/tutors/utils';
import { fetchTutorProgramItems, computeTutorHoursInRange, formatHoursMinutes, type TutorProgramItem } from '../components/tutors/tutorHours';
import TutorScheduleCalendar, { type TutorCalendarSlot, type TutorCalendarTest } from '../components/tutors/TutorScheduleCalendar';
import { monthKeyToRange, pad2, money } from '../components/economics/subscriptions/utils';
import { isSchoolYearCurrent } from '../components/school-info/types';
import { formatMonthLabel } from '../components/grades/utils';

type ClassLite = { id: string; title: string; subject_id: string | null };
type SubjectLite = { id: string; name: string; level_id: string | null };
type StudentLite = { id: string; full_name: string | null };
type SchoolYearOption = { id: string; name: string; start_date: string; end_date: string };
type StatsMode = 'month' | 'year' | 'total';
type GradesDateMode = 'all' | 'month' | 'schoolYear' | 'range';
type GradesTabMode = 'overall' | 'by-subject';

type TutorGradeRow = {
  id: string; test_id: string; test_name: string | null; test_date: string;
  start_time: string | null; end_time: string | null; class_title: string | null;
  subject_id: string | null; subject_name: string | null; grade: number | null; students_count: number | null;
};

type TutorPaymentRow = {
  id: string; period_year: number; period_month: number;
  base_gross: number; base_net: number; bonus_total: number;
  gross_total: number; net_total: number; status: 'draft' | 'paid' | 'canceled';
  paid_on: string | null; notes: string | null; created_at: string;
};
type PaymentProfileLite = { base_gross: number; base_net: number; currency: string };

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];
const GRADES_PER_PAGE = 5;
const PAYMENTS_PER_PAGE = 5;

// ── Shared field components — ported from StudentCardPage so both cards match ──

function DashCard({ title, icon, isDark, onEdit, editing, children }: {
  title: string; icon: ReactNode; isDark: boolean; onEdit?: () => void; editing?: boolean; children: ReactNode;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${isDark
      ? 'bg-slate-950/40 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]'
      : 'bg-white shadow-sm'}`}
      style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)' }}>
      <div className={`flex shrink-0 items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
            <span style={{ color: 'var(--ch-icon)' }}>{icon}</span>
          </div>
          <h2 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>{title}</h2>
        </div>
        {onEdit && !editing && (
          <button type="button" onClick={onEdit}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition ${isDark ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            <Pencil className="h-2.5 w-2.5" />Επεξεργασία
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CopyButton({ text, isDark }: { text: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" title="Αντιγραφή"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className={`ml-1 shrink-0 rounded p-0.5 transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ReadField({ label, value, isDark, copyable }: { label: string; value: string | null | undefined; isDark: boolean; copyable?: boolean }) {
  return (
    <div>
      <div className={`mb-0.5 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
      <div className={`flex items-center rounded-lg border px-2.5 py-1.5 text-xs ${isDark ? 'border-slate-700/40 bg-slate-900/30 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        {value?.trim() ? (
          <>
            <span className="flex-1 truncate">{value}</span>
            {copyable && <CopyButton text={value} isDark={isDark} />}
          </>
        ) : (
          <span className={isDark ? 'italic text-slate-600' : 'italic text-slate-400'}>—</span>
        )}
      </div>
    </div>
  );
}

function EditField({ label, icon, children, isDark }: { label: string; icon?: ReactNode; children: ReactNode; isDark: boolean }) {
  return (
    <div className="space-y-1">
      <label className={`flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>
        {icon && <span className="opacity-60">{icon}</span>}{label}
      </label>
      {children}
    </div>
  );
}

export default function TutorCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [tutor, setTutor] = useState<TutorRow | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyRow[]>([]);
  const [allSpecialties, setAllSpecialties] = useState<SpecialtyRow[]>([]);
  const [classes, setClasses] = useState<ClassLite[]>([]);
  const [subjects, setSubjects] = useState<SubjectLite[]>([]);
  const [programItems, setProgramItems] = useState<TutorProgramItem[]>([]);
  const [studentNameById, setStudentNameById] = useState<Map<string, string>>(new Map());
  const [tutorGrades, setTutorGrades] = useState<TutorGradeRow[]>([]);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Grades period filter + pagination ──
  const [gradesDateMode, setGradesDateMode] = useState<GradesDateMode>('all');
  const [gradesMonthValue, setGradesMonthValue] = useState('');
  const [gradesYearId, setGradesYearId] = useState<string | null>(null);
  const [gradesRangeStart, setGradesRangeStart] = useState('');
  const [gradesRangeEnd, setGradesRangeEnd] = useState('');
  const [gradesPage, setGradesPage] = useState(1);
  const [gradesTab, setGradesTab] = useState<GradesTabMode>('overall');
  const [gradesSubjectId, setGradesSubjectId] = useState<string | null>(null);

  // ── Economics ──
  const [paymentProfile, setPaymentProfile] = useState<PaymentProfileLite | null>(null);
  const [payments, setPayments] = useState<TutorPaymentRow[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState<TutorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Inline "Στοιχεία Καθηγητή" editing ──
  const [editingInfo, setEditingInfo] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [afm, setAfm] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [iban, setIban] = useState('');
  const [notes, setNotes] = useState('');
  const [editSpecialtyIds, setEditSpecialtyIds] = useState<Set<string>>(new Set());

  // ── Hours-tracking period ──
  const [statsMode, setStatsMode] = useState<StatsMode>('month');
  const [statsMonthKey, setStatsMonthKey] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; });
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
  const [statsYearId, setStatsYearId] = useState<string | null>(null);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursResult, setHoursResult] = useState<{ totalMinutes: number; sessionCount: number } | null>(null);

  useEffect(() => {
    if (!schoolId || !id) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      const [tutorRes, specialtyLinksRes, allSpecialtiesRes, subjectsRes, itemsRes, gradesRes, profileRes, paymentsRes] = await Promise.all([
        supabase.from('tutors').select(TUTOR_SELECT).eq('id', id).eq('school_id', schoolId).is('deleted_at', null).maybeSingle(),
        supabase.from('tutor_specialties').select('specialties(*)').eq('school_id', schoolId).eq('tutor_id', id),
        supabase.from('specialties').select('*').eq('school_id', schoolId).order('name', { ascending: true }),
        supabase.from('subjects').select('id, name, level_id').eq('school_id', schoolId),
        fetchTutorProgramItems(schoolId, id),
        supabase.from('tutor_test_grades')
          .select('id, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, students_count')
          .eq('school_id', schoolId).eq('tutor_id', id).order('test_date', { ascending: false }),
        supabase.from('tutor_payment_profiles').select('base_gross, base_net, currency').eq('school_id', schoolId).eq('tutor_id', id).maybeSingle(),
        supabase.from('tutor_payments')
          .select('id, period_year, period_month, base_gross, base_net, bonus_total, gross_total, net_total, status, paid_on, notes, created_at')
          .eq('school_id', schoolId).eq('tutor_id', id).order('created_at', { ascending: false }).limit(120),
      ]);
      if (cancelled) return;

      if (tutorRes.error || !tutorRes.data) {
        console.error(tutorRes.error);
        setError('Ο καθηγητής δεν βρέθηκε.');
        setLoading(false);
        return;
      }
      setTutor(tutorRes.data as TutorRow);
      setSpecialties(((specialtyLinksRes.data ?? []) as any[]).map((r) => r.specialties).filter(Boolean) as SpecialtyRow[]);
      setAllSpecialties((allSpecialtiesRes.data ?? []) as SpecialtyRow[]);
      setSubjects((subjectsRes.data ?? []) as SubjectLite[]);
      setProgramItems(itemsRes);
      setTutorGrades((gradesRes.data ?? []) as TutorGradeRow[]);
      setPaymentProfile((profileRes.data ?? null) as PaymentProfileLite | null);
      setPayments(((paymentsRes.data ?? []) as TutorPaymentRow[]).filter((p) => p.status !== 'canceled'));

      // The classes a tutor actually teaches are the ones scheduled to them via
      // program_items.tutor_id — not classes.tutor_id, which only tracks each
      // class's default/owning tutor and can disagree with who covers a given slot.
      const classIds = [...new Set(itemsRes.filter((it) => it.class_id).map((it) => it.class_id as string))];
      const { data: classesData } = classIds.length > 0
        ? await supabase.from('classes').select('id, title, subject_id').eq('school_id', schoolId).in('id', classIds)
        : { data: [] as ClassLite[] };
      if (cancelled) return;
      setClasses((classesData ?? []) as ClassLite[]);

      const studentIds = [...new Set(itemsRes.filter((it) => it.student_id).map((it) => it.student_id as string))];
      if (studentIds.length > 0) {
        const { data: studentsData } = await supabase.from('students').select('id, full_name').eq('school_id', schoolId).in('id', studentIds);
        if (!cancelled) {
          const m = new Map<string, string>();
          (studentsData ?? []).forEach((s: StudentLite) => m.set(s.id, s.full_name ?? '—'));
          setStudentNameById(m);
        }
      }

      const { data: holidaysData } = await supabase.from('school_holidays').select('date').eq('school_id', schoolId);
      if (!cancelled) setHolidayDates(new Set(((holidaysData ?? []) as { date: string }[]).map((h) => h.date)));

      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, id]);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from('school_years').select('id, name, start_date, end_date').eq('school_id', schoolId).order('start_date', { ascending: false });
      if (cancelled) return;
      const years = (data ?? []) as SchoolYearOption[];
      setSchoolYears(years);
      setStatsYearId((prev) => prev ?? years.find((y) => isSchoolYearCurrent(y))?.id ?? years[0]?.id ?? null);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !id) return;
    if (statsMode === 'year' && !statsYearId) { setHoursResult(null); return; }
    let cancelled = false;
    const load = async () => {
      setHoursLoading(true);
      let startISO = '1970-01-01', endISO = '2099-12-31';
      if (statsMode === 'month') {
        const range = monthKeyToRange(statsMonthKey);
        if (range) { startISO = range.startISO; endISO = range.endISO; }
      } else if (statsMode === 'year') {
        const year = schoolYears.find((y) => y.id === statsYearId);
        if (year) { startISO = year.start_date; endISO = year.end_date; }
      }
      const result = await computeTutorHoursInRange(schoolId, id, startISO, endISO);
      if (!cancelled) setHoursResult(result);
      setHoursLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, id, statsMode, statsMonthKey, statsYearId, schoolYears]);

  const shiftStatsMonth = (delta: number) => {
    setStatsMonthKey((k) => {
      const [yStr, mStr] = k.split('-');
      let y = Number(yStr), m = Number(mStr) + delta;
      while (m < 1) { m += 12; y -= 1; }
      while (m > 12) { m -= 12; y += 1; }
      return `${y}-${pad2(m)}`;
    });
  };

  const subjectNameById = useMemo(() => { const m = new Map<string, string>(); subjects.forEach((s) => m.set(s.id, s.name)); return m; }, [subjects]);
  const classById = useMemo(() => { const m = new Map<string, ClassLite>(); classes.forEach((c) => m.set(c.id, c)); return m; }, [classes]);

  const calendarSlots: TutorCalendarSlot[] = useMemo(() => programItems.map((item) => {
    const cls = item.class_id ? classById.get(item.class_id) : null;
    const subjectName = subjectNameById.get(item.subject_id ?? cls?.subject_id ?? '') ?? null;
    return {
      id: item.id,
      groupId: item.class_id ?? item.id,
      groupTitle: cls?.title ?? (item.student_id ? `Ιδιαίτερο — ${studentNameById.get(item.student_id) ?? '—'}` : '—'),
      groupSubtitle: subjectName,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      end_time: item.end_time,
      start_date: item.start_date,
      end_date: item.end_date,
    };
  }), [programItems, classById, subjectNameById, studentNameById]);

  const calendarTests: TutorCalendarTest[] = useMemo(() => tutorGrades.map((g) => ({
    id: g.id,
    test_date: g.test_date,
    title: g.test_name,
    label: g.class_title ?? g.subject_name ?? 'Διαγώνισμα',
    start_time: g.start_time,
    end_time: g.end_time,
  })), [tutorGrades]);

  // ── Grades period filter ──
  const gradesMonthOptions = useMemo(() => {
    const set = new Set<string>();
    tutorGrades.forEach((g) => { if (g.test_date) set.add(g.test_date.slice(0, 7)); });
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [tutorGrades]);
  const effectiveGradesMonth = gradesMonthValue || gradesMonthOptions[0] || '';
  const effectiveGradesYearId = gradesYearId || schoolYears[0]?.id || '';

  const periodFilteredGrades = useMemo(() => {
    if (gradesDateMode === 'month') {
      if (!effectiveGradesMonth) return [];
      return tutorGrades.filter((g) => g.test_date?.slice(0, 7) === effectiveGradesMonth);
    }
    if (gradesDateMode === 'schoolYear') {
      const year = schoolYears.find((y) => y.id === effectiveGradesYearId);
      if (!year) return [];
      return tutorGrades.filter((g) => g.test_date && g.test_date >= year.start_date && g.test_date <= year.end_date);
    }
    if (gradesDateMode === 'range') {
      const startISO = displayToIso(gradesRangeStart) || null;
      const endISO = displayToIso(gradesRangeEnd) || null;
      return tutorGrades.filter((g) => {
        if (startISO && (!g.test_date || g.test_date < startISO)) return false;
        if (endISO && (!g.test_date || g.test_date > endISO)) return false;
        return true;
      });
    }
    return tutorGrades;
  }, [tutorGrades, gradesDateMode, effectiveGradesMonth, effectiveGradesYearId, schoolYears, gradesRangeStart, gradesRangeEnd]);

  // Subject list stays stable across period changes — built from the tutor's full grade set.
  const gradesSubjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    tutorGrades.forEach((g) => { if (g.subject_id) map.set(g.subject_id, g.subject_name ?? 'Χωρίς μάθημα'); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'el'));
  }, [tutorGrades]);
  const effectiveGradesSubjectId = gradesSubjectId ?? gradesSubjectOptions[0]?.id ?? null;

  useEffect(() => {
    if (gradesTab !== 'by-subject' || gradesSubjectId || gradesSubjectOptions.length === 0) return;
    setGradesSubjectId(gradesSubjectOptions[0].id);
  }, [gradesTab, gradesSubjectOptions, gradesSubjectId]);

  const displayedGrades = useMemo(() => {
    if (gradesTab !== 'by-subject') return periodFilteredGrades;
    if (!effectiveGradesSubjectId) return [];
    return periodFilteredGrades.filter((g) => g.subject_id === effectiveGradesSubjectId);
  }, [periodFilteredGrades, gradesTab, effectiveGradesSubjectId]);

  const { gradesAvg, gradesCount, gradesHighest } = useMemo(() => {
    const valid = displayedGrades.filter((g) => typeof g.grade === 'number');
    if (valid.length === 0) return { gradesAvg: null as number | null, gradesCount: 0, gradesHighest: null as number | null };
    const sum = valid.reduce((acc, g) => acc + (g.grade as number), 0);
    return { gradesAvg: sum / valid.length, gradesCount: valid.length, gradesHighest: Math.max(...valid.map((g) => g.grade as number)) };
  }, [displayedGrades]);

  const gradesBySubject = useMemo(() => {
    const map = new Map<string, { name: string; grades: number[] }>();
    periodFilteredGrades.forEach((g) => {
      if (typeof g.grade !== 'number') return;
      const key = g.subject_id ?? '__none__';
      const name = g.subject_name ?? 'Χωρίς μάθημα';
      if (!map.has(key)) map.set(key, { name, grades: [] });
      map.get(key)!.grades.push(g.grade);
    });
    return [...map.values()]
      .map(({ name, grades }) => ({ name, count: grades.length, avg: grades.reduce((a, b) => a + b, 0) / grades.length }))
      .sort((a, b) => a.name.localeCompare(b.name, 'el'));
  }, [periodFilteredGrades]);

  const gradesPageCount = Math.max(1, Math.ceil(displayedGrades.length / GRADES_PER_PAGE));
  const pagedGrades = useMemo(
    () => displayedGrades.slice((gradesPage - 1) * GRADES_PER_PAGE, gradesPage * GRADES_PER_PAGE),
    [displayedGrades, gradesPage],
  );

  useEffect(() => { setGradesPage(1); }, [gradesDateMode, effectiveGradesMonth, effectiveGradesYearId, gradesRangeStart, gradesRangeEnd, gradesTab, effectiveGradesSubjectId]);

  // ── Payments pagination ──
  const totalReceived = useMemo(() => payments.reduce((sum, p) => sum + (p.net_total ?? 0), 0), [payments]);
  const paymentsPageCount = Math.max(1, Math.ceil(payments.length / PAYMENTS_PER_PAGE));
  const pagedPayments = useMemo(
    () => payments.slice((paymentsPage - 1) * PAYMENTS_PER_PAGE, paymentsPage * PAYMENTS_PER_PAGE),
    [payments, paymentsPage],
  );

  // ── Inline edit / delete (mirrors TutorsPage logic, scoped to this tutor) ──
  const populateInfoForm = (t: TutorRow, specialtyRows: SpecialtyRow[]) => {
    setFullName(t.full_name ?? '');
    setDateOfBirth(isoToDisplay(t.date_of_birth));
    setHireDate(isoToDisplay(t.hire_date));
    setAfm(t.afm ?? '');
    setPhone(t.phone ?? '');
    setEmail(t.email ?? '');
    setIban(t.iban ?? '');
    setNotes(t.notes ?? '');
    setEditSpecialtyIds(new Set(specialtyRows.map((s) => s.id)));
  };

  const startEditingInfo = () => {
    if (!tutor) return;
    setInfoError(null);
    populateInfoForm(tutor, specialties);
    setEditingInfo(true);
  };

  const toggleEditSpecialty = (id: string) => {
    setEditSpecialtyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSaveInfo = async () => {
    if (!schoolId || !tutor) return;
    const fullNameTrimmed = fullName.trim();
    if (!fullNameTrimmed) { setInfoError('Το ονοματεπώνυμο είναι υποχρεωτικό.'); return; }
    setSavingInfo(true); setInfoError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('tutors-update', {
        body: {
          tutor_id: tutor.id,
          full_name: fullNameTrimmed,
          date_of_birth: displayToIso(dateOfBirth) || null,
          hire_date: displayToIso(hireDate) || null,
          afm: afm.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          iban: iban.trim() || null,
          notes: notes.trim() || null,
        },
      });
      if (fnError || !data?.item) throw fnError ?? new Error('Update failed');
      const updated = data.item as TutorRow;
      setTutor(updated);

      const currentIds = new Set(specialties.map((s) => s.id));
      const nextIds = editSpecialtyIds;
      const toAdd = [...nextIds].filter((sid) => !currentIds.has(sid));
      const toRemove = [...currentIds].filter((sid) => !nextIds.has(sid));
      if (toAdd.length > 0) {
        await supabase.from('tutor_specialties').upsert(
          toAdd.map((specialtyId) => ({ school_id: schoolId, tutor_id: tutor.id, specialty_id: specialtyId })),
          { onConflict: 'tutor_id,specialty_id' },
        );
      }
      if (toRemove.length > 0) {
        await supabase.from('tutor_specialties').delete().eq('tutor_id', tutor.id).in('specialty_id', toRemove);
      }
      setSpecialties(allSpecialties.filter((s) => nextIds.has(s.id)));
      setEditingInfo(false);
    } catch (err) {
      console.error(err);
      setInfoError('Αποτυχία ενημέρωσης καθηγητή.');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError(null);
    try {
      const { error: fnError } = await supabase.functions.invoke('tutors-delete', { body: { tutor_id: deleteTarget.id } });
      if (fnError) throw fnError;
      navigate('/tutors');
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής καθηγητή.');
      setDeleting(false);
    }
  };

  const inputCls = `h-8 w-full rounded-lg border px-2.5 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const cancelBtnCls = `btn border px-3 py-1.5 text-xs disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Users className={`h-10 w-10 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{error ?? 'Ο καθηγητής δεν βρέθηκε.'}</p>
        <button type="button" onClick={() => navigate('/tutors')} className="btn-primary px-4 py-2 text-xs font-semibold">Επιστροφή</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/tutors')}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--color-accent)' }}>
            <UserCog className="h-3.5 w-3.5" style={{ color: 'var(--color-on-accent)' }} />
          </div>
          <div>
            <h1 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{tutor.full_name}</h1>
            {specialties.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {specialties.map((s) => (
                  <span key={s.id} className="inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button type="button" onClick={() => { setError(null); setDeleteTarget(tutor); }}
          title="Διαγραφή"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400' : 'border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-500'}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && !deleteTarget && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Personal info */}
        <DashCard title="Στοιχεία Καθηγητή" icon={<User className="h-3.5 w-3.5" />} isDark={isDark} onEdit={startEditingInfo} editing={editingInfo}>
          {infoError && (
            <div className={`mb-2.5 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{infoError}
            </div>
          )}
          {editingInfo ? (
            <div className="space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <EditField label="Ονοματεπώνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
                </EditField>
                <EditField label="Ημ. Γέννησης" isDark={isDark}>
                  <DatePickerField label="" value={dateOfBirth} onChange={setDateOfBirth} placeholder="24/12/1985" id="tutor-card-dob" variant="boxed" />
                </EditField>
                <EditField label="Ημ. Πρόσληψης" isDark={isDark}>
                  <DatePickerField label="" value={hireDate} onChange={setHireDate} placeholder="01/09/2020" id="tutor-card-hire" variant="boxed" />
                </EditField>
                <EditField label="ΑΦΜ" icon={<Hash className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} inputMode="numeric" maxLength={9} value={afm} onChange={(e) => setAfm(e.target.value.replace(/\D/g, '').slice(0, 9))} />
                </EditField>
                <EditField label="Τηλέφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </EditField>
                <EditField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}>
                  <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
                </EditField>
                <EditField label="IBAN" icon={<CreditCard className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} value={iban} onChange={(e) => setIban(e.target.value)} />
                </EditField>
              </div>
              <EditField label="Σημειώσεις" icon={<FileText className="h-3 w-3" />} isDark={isDark}>
                <textarea rows={3} className={`${inputCls} h-auto resize-none py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </EditField>
              <EditField label="Ειδικότητες" icon={<Tags className="h-3 w-3" />} isDark={isDark}>
                {allSpecialties.length === 0 ? (
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν ειδικότητες στο σχολείο.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {allSpecialties.map((s) => {
                      const active = editSpecialtyIds.has(s.id);
                      return (
                        <button key={s.id} type="button" onClick={() => toggleEditSpecialty(s.id)}
                          className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition"
                          style={active
                            ? { borderColor: 'var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }
                            : undefined}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </EditField>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setEditingInfo(false); setInfoError(null); }} disabled={savingInfo} className={cancelBtnCls}>Ακύρωση</button>
                <button type="button" onClick={handleSaveInfo} disabled={savingInfo} className="btn-primary gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                  {savingInfo ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                <ReadField label="Ημ. Γέννησης" value={formatDateToGreek(tutor.date_of_birth)} isDark={isDark} />
                <ReadField label="Ημ. Πρόσληψης" value={formatDateToGreek(tutor.hire_date)} isDark={isDark} />
                <ReadField label="ΑΦΜ" value={tutor.afm} isDark={isDark} />
                <ReadField label="Τηλέφωνο" value={tutor.phone} isDark={isDark} />
                <ReadField label="Email" value={tutor.email} isDark={isDark} copyable />
                <ReadField label="IBAN" value={tutor.iban} isDark={isDark} copyable />
              </div>
              {tutor.notes && (
                <div>
                  <div className={`mb-0.5 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Σημειώσεις</div>
                  <p className={`rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed ${isDark ? 'border-slate-700/40 bg-slate-900/30 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{tutor.notes}</p>
                </div>
              )}
            </div>
          )}
        </DashCard>

        {/* Hours tracking */}
        <DashCard title="Ώρες Διδασκαλίας" icon={<Clock className="h-3.5 w-3.5" />} isDark={isDark}>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {([['month', 'Μήνας'], ['year', 'Σχολικό Έτος'], ['total', 'Σύνολο']] as const).map(([mode, label]) => (
              <button key={mode} type="button" onClick={() => setStatsMode(mode)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  statsMode === mode ? 'text-white' : isDark ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
                style={statsMode === mode ? { background: 'var(--color-accent)', borderColor: 'var(--color-accent)' } : undefined}>
                {label}
              </button>
            ))}
          </div>

          {statsMode === 'month' && (
            <div className={`mb-3 flex items-center justify-center gap-3 rounded-xl border py-1.5 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
              <button type="button" onClick={() => shiftStatsMonth(-1)} className={`flex h-6 w-6 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className={`min-w-[9rem] text-center text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {MONTH_NAMES[Number(statsMonthKey.split('-')[1]) - 1]} {statsMonthKey.split('-')[0]}
              </span>
              <button type="button" onClick={() => shiftStatsMonth(1)} className={`flex h-6 w-6 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {statsMode === 'year' && (
            schoolYears.length > 0 ? (
              <div className="mb-3">
                <StyledSelect isDark={isDark} showChevron value={statsYearId ?? ''} onChange={setStatsYearId}
                  className={`h-8 w-full max-w-xs rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                  options={schoolYears.map((y) => ({ value: y.id, label: y.name }))} />
              </div>
            ) : (
              <p className={`mb-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχει οριστεί σχολικό έτος.</p>
            )
          )}

          {hoursLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className={`h-5 w-5 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
          ) : !hoursResult || hoursResult.sessionCount === 0 ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν βρέθηκαν διδαγμένα μαθήματα για αυτήν την περίοδο.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-blue-50'}`}>
                <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ώρες Διδασκαλίας</p>
                <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{formatHoursMinutes(hoursResult.totalMinutes)}</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'}`}>
                <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Μαθήματα</p>
                <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{hoursResult.sessionCount}</p>
              </div>
            </div>
          )}
        </DashCard>

        {/* Schedule */}
        <DashCard title="Πρόγραμμα" icon={<CalendarDays className="h-3.5 w-3.5" />} isDark={isDark}>
          {programItems.length === 0 ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχει προγραμματισμένα μαθήματα.</p>
          ) : (
            <TutorScheduleCalendar slots={calendarSlots} tests={calendarTests} holidayDates={holidayDates} isDark={isDark} />
          )}
        </DashCard>

        {/* Exams / grades */}
        <DashCard title="Διαγωνίσματα" icon={<BookOpenCheck className="h-3.5 w-3.5" />} isDark={isDark}>
          {tutorGrades.length === 0 ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχει καταχωρηθεί διαγώνισμα για αυτόν τον καθηγητή.</p>
          ) : (
            <div className="space-y-3">
              {/* Period filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <CalendarRange className="h-3 w-3" />Περίοδος
                </span>
                <StyledSelect
                  isDark={isDark} showChevron
                  className={`h-8 rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                  value={gradesDateMode}
                  onChange={(v) => setGradesDateMode(v as GradesDateMode)}
                  options={[
                    { value: 'all', label: 'Όλες οι περίοδοι' },
                    { value: 'month', label: 'Μήνας' },
                    { value: 'schoolYear', label: 'Σχολικό έτος' },
                    { value: 'range', label: 'Εύρος ημερομηνιών' },
                  ]}
                />
                {gradesDateMode === 'month' && (
                  gradesMonthOptions.length > 0 ? (
                    <StyledSelect
                      isDark={isDark} showChevron
                      className={`h-8 rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                      value={effectiveGradesMonth}
                      onChange={setGradesMonthValue}
                      options={gradesMonthOptions.map((m) => ({ value: m, label: formatMonthLabel(m) }))}
                    />
                  ) : <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν βαθμοί.</span>
                )}
                {gradesDateMode === 'schoolYear' && (
                  schoolYears.length > 0 ? (
                    <StyledSelect
                      isDark={isDark} showChevron
                      className={`h-8 rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                      value={effectiveGradesYearId}
                      onChange={setGradesYearId}
                      options={schoolYears.map((y) => ({ value: y.id, label: y.name }))}
                    />
                  ) : <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν οριστεί σχολικά έτη.</span>
                )}
                {gradesDateMode === 'range' && (
                  <div className="flex items-center gap-2">
                    <div className="w-32"><DatePickerField label="" value={gradesRangeStart} onChange={setGradesRangeStart} placeholder="Από" id="tutor-grades-from" variant="boxed" /></div>
                    <div className="w-32"><DatePickerField label="" value={gradesRangeEnd} onChange={setGradesRangeEnd} placeholder="Έως" id="tutor-grades-to" variant="boxed" /></div>
                  </div>
                )}
              </div>

              {/* View — overall vs. a single subject */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {([['overall', 'Γενικά', LayoutGrid], ['by-subject', 'Ανά μάθημα', BookOpen]] as const).map(([mode, label, Icon]) => (
                    <button key={mode} type="button" onClick={() => setGradesTab(mode)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                        gradesTab === mode ? 'text-white' : isDark ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                      style={gradesTab === mode ? { background: 'var(--color-accent)', borderColor: 'var(--color-accent)' } : undefined}>
                      <Icon className="h-3 w-3" />{label}
                    </button>
                  ))}
                </div>
                {gradesTab === 'by-subject' && (
                  gradesSubjectOptions.length > 0 ? (
                    <StyledSelect
                      isDark={isDark} showChevron
                      className={`h-8 rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                      value={effectiveGradesSubjectId ?? ''}
                      onChange={(v) => setGradesSubjectId(v || null)}
                      options={gradesSubjectOptions.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  ) : <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν μαθήματα με βαθμούς.</span>
                )}
              </div>

              {/* Stats — total average + per-subject breakdown */}
              {gradesCount === 0 ? (
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν βαθμολογημένα διαγωνίσματα για αυτήν την περίοδο.</p>
              ) : (
                <>
                  <div className={`grid grid-cols-3 divide-x rounded-xl border py-2 ${isDark ? 'divide-slate-800 border-slate-800/60 bg-slate-900/30' : 'divide-slate-200 border-slate-200 bg-slate-50'}`}>
                    <div className="flex flex-col items-center gap-1 px-2">
                      <span className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><ClipboardCheck className="h-3 w-3" />Σύνολο</span>
                      <p className={`text-base font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{gradesCount}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 px-2">
                      <span className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><TrendingUp className="h-3 w-3" />Μ.Ο.</span>
                      <p className="text-base font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>{gradesAvg !== null ? gradesAvg.toFixed(1) : '—'}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 px-2">
                      <span className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Trophy className="h-3 w-3" />Υψηλότερος</span>
                      <p className={`text-base font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{gradesHighest ?? '—'}</p>
                    </div>
                  </div>

                  {gradesTab === 'overall' && gradesBySubject.length > 1 && (
                    <div className="space-y-1">
                      <p className={`text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ανά μάθημα</p>
                      <div className="flex flex-wrap gap-1.5">
                        {gradesBySubject.map((s) => (
                          <span key={s.name} className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] ${isDark ? 'border-slate-800/60 bg-slate-900/30 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                            {s.name}
                            <span className="font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>{s.avg.toFixed(1)}</span>
                            <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>({s.count})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Paginated list */}
              <div className="space-y-2">
                {pagedGrades.map((g) => (
                  <div key={g.id} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-slate-800/60 bg-slate-900/30' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="min-w-0">
                      <p className={`truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{g.test_name || 'Διαγώνισμα'}</p>
                      <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                        {[g.subject_name, g.class_title].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`tabular-nums font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{formatDateToGreek(g.test_date)}</p>
                      <p className="tabular-nums font-bold" style={{ color: 'var(--color-accent)' }}>
                        {typeof g.grade === 'number' ? `Μ.Ο. ${g.grade.toFixed(1)}` : '—'}
                      </p>
                    </div>
                  </div>
                ))}
                {gradesPageCount > 1 && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Σελίδα {gradesPage} / {gradesPageCount}</p>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setGradesPage((p) => Math.max(1, p - 1))} disabled={gradesPage <= 1}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setGradesPage((p) => Math.min(gradesPageCount, p + 1))} disabled={gradesPage >= gradesPageCount}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DashCard>
      </div>

      {/* Economics */}
      <DashCard title="Οικονομικά" icon={<Wallet className="h-3.5 w-3.5" />} isDark={isDark}>
        <div className="space-y-3">
          {paymentProfile || payments.length > 0 ? (
            <div className={`grid gap-2 ${paymentProfile ? 'grid-cols-3' : 'grid-cols-1'}`}>
              {paymentProfile && (
                <>
                  <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-blue-50'}`}>
                    <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Μικτός Μισθός</p>
                    <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{money(paymentProfile.base_gross)} €</p>
                  </div>
                  <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50'}`}>
                    <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Καθαρός Μισθός</p>
                    <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{money(paymentProfile.base_net)} €</p>
                  </div>
                </>
              )}
              {payments.length > 0 && (
                <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-purple-500/30 bg-purple-950/20' : 'border-purple-200 bg-purple-50'}`}>
                  <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Σύνολο Εισπραχθέντων</p>
                  <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{money(totalReceived)} €</p>
                </div>
              )}
            </div>
          ) : (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχει οριστεί βασικός μισθός για αυτόν τον καθηγητή.</p>
          )}

          {payments.length === 0 ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν καταχωρημένες πληρωμές.</p>
          ) : (
            <div className="space-y-2">
              <p className={`text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ιστορικό πληρωμών</p>
              {pagedPayments.map((p) => (
                <div key={p.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${isDark ? 'border-slate-800/60 bg-slate-900/30' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="min-w-0">
                    <p className={`truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {MONTH_NAMES[p.period_month - 1] ?? p.period_month} {p.period_year}
                    </p>
                    <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                      {p.bonus_total > 0 ? `Μπόνους ${money(p.bonus_total)} €` : 'Χωρίς μπόνους'}
                      {p.notes ? ` · ${p.notes}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`tabular-nums font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{money(p.net_total)} €</p>
                    <p className={`tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>μικτά {money(p.gross_total)} €</p>
                  </div>
                </div>
              ))}
              {paymentsPageCount > 1 && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Σελίδα {paymentsPage} / {paymentsPageCount}</p>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))} disabled={paymentsPage <= 1}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setPaymentsPage((p) => Math.min(paymentsPageCount, p + 1))} disabled={paymentsPage >= paymentsPageCount}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DashCard>

      <TutorDeleteModal
        deleteTarget={deleteTarget}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
