// src/components/dashboard/DashboardCalendarSection.tsx

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../auth';
import type { RosterEntry } from '../private-program/types';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type {
  EventDropArg,
  EventContentArg,
  DatesSetArg,
  EventClickArg,
} from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import elLocale from '@fullcalendar/core/locales/el';

import AppDatePicker from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import StyledSelect from '../ui/StyledSelect';
import EventFormModal, {
  type EventFormState,
  type SchoolEventForEdit,
} from '../events/EventFormModal';
import {
  ModalFormField, ModalFieldIcon, ModalSelectChevron, ModalErrorBox,
  modalInputCls, modalSelectCls,
} from '../ui/ModalField';
import { CalendarDays, BookOpen, GraduationCap, X, Loader2, Layers, Euro, Ban, ArrowLeftRight, Check, AlertCircle, DoorOpen } from 'lucide-react';

/* ------------ Types (unchanged) ------------ */

type ClassRow = {
  id: string; school_id: string; title: string;
  subject: string | null; subject_id: string | null; tutor_id: string | null;
};
type TutorRow = { id: string; full_name: string | null };
type ProgramRow = { id: string; school_id: string; name: string; description: string | null };
type ProgramItemRow = {
  id: string; program_id: string; class_id: string | null; student_id: string | null; day_of_week: string;
  position: number | null; start_time: string | null; end_time: string | null;
  start_date: string | null; end_date: string | null; subject_id: string | null; tutor_id: string | null;
  charge_per_session: number | null; room: string | null;
};
type StudentRow = { id: string; full_name: string | null };
type ProgramItemOverrideRow = {
  id: string; program_item_id: string; override_date: string | null;
  start_time: string | null; end_time: string | null; is_deleted: boolean | null;
  is_inactive: boolean | null; holiday_active_override: boolean | null;
  charge_amount: number | null;
};
type HolidayRow = { id: string; school_id: string; date: string; name: string | null };
type SchoolEventRow = {
  id: string; school_id: string; name: string; description: string | null;
  date: string; start_time: string; end_time: string; created_at: string | null;
};
type SubjectRow = { id: string; school_id: string; name: string; level_id: string | null };
type ClassSubjectRow = { class_id: string; subject_id: string; school_id?: string | null };
type SubjectTutorLinkRow = { subject_id: string; tutor_id: string; school_id?: string | null };
type TestRow = {
  id: string; school_id: string; class_id: string | null; level_id: string | null; subject_id: string | null;
  test_date: string; start_time: string | null; end_time: string | null;
  title: string | null; description: string | null; active_during_holiday: boolean | null;
};
type LevelRow = { id: string; name: string };
type CalendarEventModal = {
  programItemId: string; originalDateStr: string; date: string;
  startTime: string; endTime: string;
  classId: string | null; studentId: string | null; subjectId: string | null; overrideId?: string; activeDuringHoliday: boolean;
  chargeAmount: string;
};
type TestModalState = {
  testId: string; classId: string | null; levelId: string | null; subjectId: string | null; date: string;
  startTime: string; endTime: string;
  title: string; activeDuringHoliday: boolean;
};
type AddExtraModalState = {
  date: string; classId: string | null; subjectId: string | null;
  startTime: string; endTime: string; room: string;
  roster: RosterEntry[];
};

/* ------------ Edge function helper ------------ */

async function callEdgeFunction(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const res = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.error) throw new Error(res.error.message ?? 'Edge function error');
  return res.data;
}

/* ------------ Helpers (unchanged) ------------ */

const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatLocalYMD = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;


function formatDateDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function parseDateDisplayToISO(display: string): string | null {
  const v = display.trim();
  if (!v) return null;
  const parts = v.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr); const month = Number(mStr); const year = Number(yStr);
  if (!day || !month || !year) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const INDEX_TO_WEEKDAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getNextDateForDow(from: Date, dow: number): Date {
  const d = new Date(from);
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/* -------- Shared modal shell -------- */
function ModalShell({ title, subtitle, icon, onClose, children, maxWidthClass = 'max-w-md' }: {
  title: string; subtitle?: string; icon?: React.ReactNode;
  onClose: () => void; children: React.ReactNode; maxWidthClass?: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full ${maxWidthClass} overflow-hidden rounded-2xl border shadow-2xl ${
        isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>{title}</h3>
              {subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'var(--ch-text-muted)' }}>{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------ Component ------------ */

type DashboardCalendarSectionProps = { schoolId: string | null };

export default function DashboardCalendarSection({ schoolId }: DashboardCalendarSectionProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isFrontistirio = profile?.account_type === 'frontistirio';

  // Login-page-styled field classes (see ../ui/ModalField.tsx), used by the program/test edit modals below.
  const inputCls = modalInputCls(isDark);
  const selectCls = modalSelectCls(isDark);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);
  const [overrides, setOverrides] = useState<ProgramItemOverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarView, setCalendarView] = useState<string>('timeGridWeek');
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(null);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<SchoolEventRow[]>([]);

  console.log(program, calendarView);
  const [schoolEventModalOpen, setSchoolEventModalOpen] = useState(false);
  const [schoolEventModalMode, setSchoolEventModalMode] = useState<'create' | 'edit'>('edit');
  const [schoolEventEditing, setSchoolEventEditing] = useState<SchoolEventForEdit | null>(null);
  const [schoolEventSaving, setSchoolEventSaving] = useState(false);
  const [schoolEventError, setSchoolEventError] = useState<string | null>(null);
  const [schoolEventDeleteTarget, setSchoolEventDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [schoolEventDeleting, setSchoolEventDeleting] = useState(false);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [subjectTutorLinks, setSubjectTutorLinks] = useState<SubjectTutorLinkRow[]>([]);

  const [eventModal, setEventModal] = useState<CalendarEventModal | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testModal, setTestModal] = useState<TestModalState | null>(null);
  const [savingTest, setSavingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testModalAssignments, setTestModalAssignments] = useState<{ studentId: string; studentName: string; subjectName: string | null; chargeAmount: string; existingChargeId?: string; existingAmount?: number }[]>([]);
  const [testModalAssignmentsLoading, setTestModalAssignmentsLoading] = useState(false);
  const [chargingTestStudentIds, setChargingTestStudentIds] = useState<Set<string>>(new Set());
  const [cancellingTestChargeIds, setCancellingTestChargeIds] = useState<Set<string>>(new Set());
  const [convertingSessionToTest, setConvertingSessionToTest] = useState(false);
  const [convertingTestToSession, setConvertingTestToSession] = useState(false);
  const [showConvertTestConfirm, setShowConvertTestConfirm] = useState(false);

  const [extraModal, setExtraModal] = useState<AddExtraModalState | null>(null);
  const [extraError, setExtraError] = useState<string | null>(null);
  const [savingExtra, setSavingExtra] = useState(false);

  /* -------- Holidays helpers -------- */
  const holidayDateSet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const holidayNameByDate = useMemo(() => {
    const m = new Map<string, string | null>();
    holidays.forEach((h) => m.set(h.date, h.name ?? null));
    return m;
  }, [holidays]);

  /* -------- Data loading (unchanged) -------- */
  useEffect(() => {
    if (!schoolId) { setLoading(false); setClasses([]); return; }
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('classes').select('id, school_id, title, subject, subject_id, tutor_id').eq('school_id', schoolId).order('title', { ascending: true });
      if (error) { console.error(error); setClasses([]); } else { setClasses((data ?? []) as ClassRow[]); }
      setLoading(false);
    };
    load();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setTutors([]); return; }
    supabase.from('tutors').select('id, full_name').eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true })
      .then(({ data, error }) => { if (error) { console.error(error); setTutors([]); } else { setTutors((data ?? []) as TutorRow[]); } });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setStudents([]); return; }
    supabase.from('students').select('id, full_name').eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true })
      .then(({ data, error }) => { if (error) { console.error(error); setStudents([]); } else { setStudents((data ?? []) as StudentRow[]); } });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setProgram(null); setProgramItems([]); setOverrides([]); return; }
    const loadProgram = async () => {
      const { data: programRows, error: programErr } = await supabase.from('programs').select('*').eq('school_id', schoolId).order('created_at', { ascending: true });
      if (programErr) { console.error(programErr); setProgram(null); setProgramItems([]); setOverrides([]); return; }
      let activeProgram: ProgramRow | null = (programRows?.[0] as ProgramRow) ?? null;
      if (!activeProgram) {
        const { data: created, error: createErr } = await supabase.from('programs').insert({ school_id: schoolId, name: 'Βασικό πρόγραμμα', description: null }).select('*').maybeSingle();
        if (createErr || !created) { console.error(createErr); setProgram(null); setProgramItems([]); setOverrides([]); return; }
        activeProgram = created as ProgramRow;
      }
      setProgram(activeProgram);
      const { data: itemData, error: itemErr } = await supabase.from('program_items').select('*').eq('program_id', activeProgram.id).order('day_of_week', { ascending: true }).order('position', { ascending: true });
      if (itemErr) { console.error(itemErr); setProgramItems([]); setOverrides([]); return; }
      const rows = (itemData ?? []) as ProgramItemRow[];
      setProgramItems(rows);
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: overrideData, error: overrideErr } = await supabase.from('program_item_overrides').select('*').in('program_item_id', ids);
        if (overrideErr) { console.error(overrideErr); setOverrides([]); } else { setOverrides((overrideData ?? []) as ProgramItemOverrideRow[]); }
      } else { setOverrides([]); }
    };
    loadProgram();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setHolidays([]); return; }
    supabase.from('school_holidays').select('*').eq('school_id', schoolId).order('date', { ascending: true })
      .then(({ data, error }) => { if (error) { console.error(error); setHolidays([]); } else { setHolidays((data ?? []) as HolidayRow[]); } });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setSchoolEvents([]); return; }
    supabase.from('school_events').select('*').eq('school_id', schoolId).order('date', { ascending: true }).order('start_time', { ascending: true })
      .then(({ data, error }) => { if (error) { console.error(error); setSchoolEvents([]); } else { setSchoolEvents((data ?? []) as SchoolEventRow[]); } });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setSubjects([]); setClassSubjects([]); setTests([]); setSubjectTutorLinks([]); setLevels([]); return; }
    const loadExtra = async () => {
      try {
        const [{ data: subjData, error: subjErr }, { data: classSubjData, error: classSubjErr }, { data: testsData, error: testsErr }, { data: stData, error: stErr }, { data: levelData, error: levelErr }] = await Promise.all([
          supabase.from('subjects').select('id, school_id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('class_subjects').select('class_id, subject_id, school_id').eq('school_id', schoolId),
          supabase.from('tests').select('id, school_id, class_id, level_id, subject_id, test_date, start_time, end_time, title, description, active_during_holiday').eq('school_id', schoolId).order('test_date', { ascending: true }),
          supabase.from('subject_tutors').select('subject_id, tutor_id, school_id').eq('school_id', schoolId),
          supabase.from('levels').select('id, name').eq('school_id', schoolId),
        ]);
        if (subjErr) { console.error(subjErr); setSubjects([]); } else { setSubjects((subjData ?? []) as SubjectRow[]); }
        if (classSubjErr) { console.error(classSubjErr); setClassSubjects([]); } else { setClassSubjects((classSubjData ?? []) as ClassSubjectRow[]); }
        if (testsErr) { console.error(testsErr); setTests([]); } else { setTests((testsData ?? []) as TestRow[]); }
        if (stErr) { console.error(stErr); setSubjectTutorLinks([]); } else { setSubjectTutorLinks((stData ?? []) as SubjectTutorLinkRow[]); }
        if (levelErr) { console.error(levelErr); setLevels([]); } else { setLevels((levelData ?? []) as LevelRow[]); }
      } catch (e) { console.error(e); setSubjects([]); setClassSubjects([]); setTests([]); setLevels([]); }
    };
    loadExtra();
  }, [schoolId]);

  const subjectById = useMemo(() => { const m = new Map<string, SubjectRow>(); subjects.forEach((s) => m.set(s.id, s)); return m; }, [subjects]);

  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];
    const cls = classes.find((c) => c.id === classId) ?? null;
    const attachedIds = new Set<string>();
    classSubjects.filter((cs) => cs.class_id === classId && cs.subject_id).forEach((cs) => attachedIds.add(cs.subject_id));
    if (cls?.subject_id) attachedIds.add(cls.subject_id);
    const attachedSubjects: SubjectRow[] = [];
    attachedIds.forEach((id) => { const subj = subjectById.get(id); if (subj) attachedSubjects.push(subj); });
    if (attachedSubjects.length >= 2) return attachedSubjects.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    let levelId: string | null = null;
    if (cls?.subject_id) { const mainSubj = subjectById.get(cls.subject_id); levelId = mainSubj?.level_id ?? null; }
    const extraSubjects = levelId ? subjects.filter((s) => s.level_id === levelId) : subjects;
    const merged = new Map<string, SubjectRow>();
    extraSubjects.forEach((s) => merged.set(s.id, s));
    attachedSubjects.forEach((s) => merged.set(s.id, s));
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
  };

  const resolveChargeForDate = (programItemId: string, dateStr: string): number | null => {
    const ov = overrides.find((o) => o.program_item_id === programItemId && o.override_date === dateStr);
    if (ov && ov.charge_amount != null) return ov.charge_amount;
    const item = programItems.find((pi) => pi.id === programItemId);
    return item?.charge_per_session ?? null;
  };

  /* -------- Build events (unchanged) -------- */
  const events = useMemo(() => {
    if (!viewRange) return [];
    const { start: viewStart, end: viewEnd } = viewRange;
    const out: any[] = [];
    const tutorMap: Record<string, string> = {};
    tutors.forEach((t) => { if (t.id && t.full_name) tutorMap[t.id] = t.full_name; });
    const tutorNamesBySubjectId = new Map<string, string[]>();
    subjectTutorLinks.forEach((link) => {
      const name = link.tutor_id ? tutorMap[link.tutor_id] : null;
      if (!link.subject_id || !name) return;
      const arr = tutorNamesBySubjectId.get(link.subject_id) ?? [];
      arr.push(name);
      tutorNamesBySubjectId.set(link.subject_id, arr);
    });
    tutorNamesBySubjectId.forEach((arr, key) => { arr.sort((a, b) => a.localeCompare(b, 'el-GR')); tutorNamesBySubjectId.set(key, arr); });
    const getTutorNameForSubject = (subjectId: string | null): string | null => {
      if (!subjectId) return null;
      const arr = tutorNamesBySubjectId.get(subjectId);
      if (!arr || arr.length === 0) return null;
      return arr[0];
    };
    const classMap = new Map<string, ClassRow>();
    classes.forEach((c) => classMap.set(c.id, c));
    const studentMap = new Map<string, StudentRow>();
    students.forEach((s) => studentMap.set(s.id, s));
    const levelMap = new Map<string, LevelRow>();
    levels.forEach((l) => levelMap.set(l.id, l));
    const programItemMap = new Map<string, ProgramItemRow>();
    programItems.forEach((pi) => programItemMap.set(pi.id, pi));
    const overrideMap = new Map<string, ProgramItemOverrideRow>();
    overrides.forEach((ov) => { if (!ov.override_date) return; const key = `${ov.program_item_id}-${ov.override_date}`; overrideMap.set(key, ov); });
    const usedOverrideIds = new Set<string>();
    const testsByKey = new Map<string, TestRow[]>();
    tests.forEach((t) => { const key = `${t.class_id}-${t.test_date}`; const arr = testsByKey.get(key) ?? []; arr.push(t); testsByKey.set(key, arr); });
    const hideStandaloneTestKeys = new Set<string>();

    programItems.forEach((item) => {
      const cls = item.class_id ? classMap.get(item.class_id) : undefined;
      const student = !cls && item.student_id ? studentMap.get(item.student_id) : undefined;
      if ((!cls && !student) || !item.day_of_week || !item.start_time || !item.end_time) return;
      const dow = WEEKDAY_TO_INDEX[item.day_of_week];
      if (dow === undefined) return;
      const patternStart = item.start_date ? new Date(item.start_date + 'T00:00:00') : null;
      const patternEnd = item.end_date ? new Date(item.end_date + 'T23:59:59') : null;
      const effectiveStart = patternStart && patternStart > viewStart ? patternStart : viewStart;
      const effectiveEnd = patternEnd && patternEnd < viewEnd ? patternEnd : viewEnd;
      if (effectiveStart > effectiveEnd) return;
      let currentDate = getNextDateForDow(effectiveStart, dow);
      const subjectIdForSlot = item.subject_id ?? cls?.subject_id ?? null;
      const tutorName = (item.tutor_id && tutorMap[item.tutor_id]) || getTutorNameForSubject(subjectIdForSlot) || (cls?.tutor_id && tutorMap[cls.tutor_id]) || null;
      while (currentDate <= effectiveEnd) {
        const dateStr = formatLocalYMD(currentDate);
        const next = new Date(currentDate); next.setDate(next.getDate() + 7);
        const isHoliday = holidayDateSet.has(dateStr);
        const holidayName = holidayNameByDate.get(dateStr) ?? null;
        const key = cls ? `${item.class_id}-${dateStr}` : `student-${item.student_id}-${dateStr}`;
        const override = overrideMap.get(`${item.id}-${dateStr}`);
        let isDeleted = false;
        let startTimeStr = item.start_time!;
        let endTimeStr = item.end_time!;
        let overrideId: string | undefined;
        const manualInactive = !!override?.is_inactive;
        const holidayActiveOverride = !!override?.holiday_active_override;
        const isInactive = manualInactive || (isHoliday && !holidayActiveOverride);
        const activeDuringHoliday = isHoliday ? holidayActiveOverride && !manualInactive : false;
        if (override) { usedOverrideIds.add(override.id); overrideId = override.id; if (override.is_deleted) isDeleted = true; if (override.start_time) startTimeStr = override.start_time; if (override.end_time) endTimeStr = override.end_time; }
        if (!isDeleted) {
          const [sH, sM] = startTimeStr.split(':').map(Number);
          const [eH, eM] = endTimeStr.split(':').map(Number);
          const start = new Date(currentDate); start.setHours(sH, sM, 0, 0);
          const end = new Date(currentDate); end.setHours(eH, eM, 0, 0);
          const testsForClassDate = cls ? (testsByKey.get(key) ?? []) : [];
          const shouldCombineTest = !isHoliday && testsForClassDate.length > 0;
          const combinedTest = shouldCombineTest ? testsForClassDate[0] : null;
          const titleBase = cls ? cls.title : (student?.full_name ?? 'Μαθητής');
          const title = combinedTest ? `${titleBase} · Διαγώνισμα` : titleBase;
          if (combinedTest) hideStandaloneTestKeys.add(key);
          out.push({ id: `${item.id}-${dateStr}`, title, start, end, editable: !isInactive, startEditable: !isInactive, durationEditable: !isInactive, classNames: [isInactive ? 'fc-event-inactive' : combinedTest ? 'fc-event-test' : 'fc-event-program'], extendedProps: { kind: 'program', programItemId: item.id, classId: cls?.id ?? null, studentId: student ? item.student_id : null, subjectId: item.subject_id ?? null, subject: (item.subject_id ? subjectById.get(item.subject_id)?.name : null) ?? cls?.subject ?? null, tutorName, room: item.room ?? null, overrideDate: dateStr, overrideId, isHoliday, holidayName, isInactive, activeDuringHoliday, testId: combinedTest?.id ?? null, testSubjectId: combinedTest?.subject_id ?? null } });
        }
        currentDate = next;
      }
    });

    overrides.forEach((ov) => {
      if (!ov.override_date || ov.is_deleted || usedOverrideIds.has(ov.id)) return;
      const item = programItemMap.get(ov.program_item_id);
      if (!item) return;
      const cls = item.class_id ? classMap.get(item.class_id) : undefined;
      const student = !cls && item.student_id ? studentMap.get(item.student_id) : undefined;
      if (!cls && !student) return;
      const overrideDateObj = new Date(ov.override_date + 'T00:00:00');
      if (overrideDateObj < viewStart || overrideDateObj > viewEnd) return;
      const dateStr = ov.override_date;
      const isHoliday = holidayDateSet.has(dateStr);
      const holidayName = holidayNameByDate.get(dateStr) ?? null;
      const manualInactive = !!ov.is_inactive;
      const holidayActiveOverride = !!ov.holiday_active_override;
      const isInactive = manualInactive || (isHoliday && !holidayActiveOverride);
      const activeDuringHoliday = isHoliday ? holidayActiveOverride && !manualInactive : false;
      const baseStartTime = ov.start_time ?? item.start_time;
      const baseEndTime = ov.end_time ?? item.end_time;
      if (!baseStartTime || !baseEndTime) return;
      const [sH, sM] = baseStartTime.split(':').map(Number);
      const [eH, eM] = baseEndTime.split(':').map(Number);
      const start = new Date(overrideDateObj); start.setHours(sH, sM, 0, 0);
      const end = new Date(overrideDateObj); end.setHours(eH, eM, 0, 0);
      const subjectIdForSlot = item.subject_id ?? cls?.subject_id ?? null;
      const tutorName = (item.tutor_id && tutorMap[item.tutor_id]) || getTutorNameForSubject(subjectIdForSlot) || (cls?.tutor_id && tutorMap[cls.tutor_id]) || null;
      const key = cls ? `${item.class_id}-${dateStr}` : `student-${item.student_id}-${dateStr}`;
      const testsForClassDate = cls ? (testsByKey.get(key) ?? []) : [];
      const shouldCombineTest = !isHoliday && testsForClassDate.length > 0;
      const combinedTest = shouldCombineTest ? testsForClassDate[0] : null;
      const titleBase = cls ? cls.title : (student?.full_name ?? 'Μαθητής');
      const title = combinedTest ? `${titleBase} · Διαγώνισμα` : titleBase;
      if (combinedTest) hideStandaloneTestKeys.add(key);
      out.push({ id: `${item.id}-${dateStr}-override`, title, start, end, editable: !isInactive, startEditable: !isInactive, durationEditable: !isInactive, classNames: [isInactive ? 'fc-event-inactive' : combinedTest ? 'fc-event-test' : 'fc-event-program'], extendedProps: { kind: 'program', programItemId: item.id, classId: cls?.id ?? null, studentId: student ? item.student_id : null, subjectId: item.subject_id ?? null, subject: (item.subject_id ? subjectById.get(item.subject_id)?.name : null) ?? cls?.subject ?? null, tutorName, room: item.room ?? null, overrideDate: dateStr, overrideId: ov.id, isHoliday, holidayName, isInactive, activeDuringHoliday, testId: combinedTest?.id ?? null, testSubjectId: combinedTest?.subject_id ?? null } });
    });

    tests.forEach((t) => {
      const key = `${t.class_id}-${t.test_date}`;
      if (hideStandaloneTestKeys.has(key)) return;
      const dateObj = new Date(t.test_date + 'T00:00:00');
      if (dateObj < viewStart || dateObj > viewEnd) return;
      const isHoliday = holidayDateSet.has(t.test_date);
      const holidayName = holidayNameByDate.get(t.test_date) ?? null;
      const activeDuringHoliday = isHoliday ? !!t.active_during_holiday : false;
      const isInactive = isHoliday && !activeDuringHoliday;
      const cls = t.class_id ? classMap.get(t.class_id) : undefined;
      const level = t.level_id ? levelMap.get(t.level_id) : undefined;
      const subj = t.subject_id ? subjectById.get(t.subject_id) : undefined;
      const baseStart = t.start_time ?? '09:00'; const baseEnd = t.end_time ?? '10:00';
      const [sH, sM] = baseStart.split(':').map(Number); const [eH, eM] = baseEnd.split(':').map(Number);
      const start = new Date(dateObj); start.setHours(sH, sM, 0, 0);
      const end = new Date(dateObj); end.setHours(eH, eM, 0, 0);
      const titleParts: string[] = [];
      if (cls?.title) titleParts.push(cls.title);
      else if (level?.name) titleParts.push(level.name);
      if (subj?.name) titleParts.push(subj.name);
      if (t.title) titleParts.push(t.title);
      const label = titleParts.length > 0 ? `Διαγώνισμα · ${titleParts.join(' · ')}` : 'Διαγώνισμα';
      out.push({ id: `test-${t.id}`, title: label, start, end, editable: !isInactive, startEditable: !isInactive, durationEditable: !isInactive, classNames: [isInactive ? 'fc-event-test-inactive' : 'fc-event-test'], extendedProps: { kind: 'test', testId: t.id, classId: t.class_id, subjectId: t.subject_id, isHoliday, holidayName, isInactive, activeDuringHoliday } });
    });

    schoolEvents.forEach((ev) => {
      const start = new Date(ev.date + 'T' + ev.start_time);
      const end = new Date(ev.date + 'T' + ev.end_time);
      if (start < viewStart || start > viewEnd) return;
      if (holidayDateSet.has(ev.date)) return;
      out.push({ id: `event-${ev.id}`, title: ev.name, start, end, editable: true, startEditable: true, durationEditable: true, classNames: ['fc-event-school'], extendedProps: { kind: 'schoolEvent', eventId: ev.id, description: ev.description } });
    });

    return out;
  }, [viewRange, programItems, classes, students, levels, tutors, subjectTutorLinks, overrides, holidays, holidayDateSet, holidayNameByDate, schoolEvents, tests, subjects, subjectById]);

  /* -------- Drag & drop (unchanged) -------- */
  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, oldEvent, revert } = arg;
    const isInactive = event.extendedProps['isInactive'] as boolean | undefined;
    if (isInactive) { revert(); return; }
    const kind = event.extendedProps['kind'] as 'program' | 'schoolEvent' | 'test' | undefined;
    if (!event.start || !event.end) { revert(); return; }
    const newDateStr = formatLocalYMD(event.start);
    const newStartTimeDb = `${pad2(event.start.getHours())}:${pad2(event.start.getMinutes())}:00`;
    const newEndTimeDb = `${pad2(event.end.getHours())}:${pad2(event.end.getMinutes())}:00`;

    if (kind === 'schoolEvent') {
      const eventId = event.extendedProps['eventId'] as string | undefined;
      if (!eventId) { revert(); return; }
      try {
        const ev = schoolEvents.find((e) => e.id === eventId);
        if (!ev) { revert(); return; }
        const result = await callEdgeFunction('events-update', { event_id: eventId, name: ev.name, description: ev.description ?? null, date: newDateStr, start_time: newStartTimeDb, end_time: newEndTimeDb });
        setSchoolEvents((prev) => prev.map((e) => (e.id === eventId ? (result.item as SchoolEventRow) : e)));
      } catch (err) { console.error(err); revert(); }
      return;
    }

    if (kind === 'test') {
      const testId = event.extendedProps['testId'] as string | undefined;
      if (!testId) { revert(); return; }
      try {
        const movedToHoliday = holidayDateSet.has(newDateStr);
        const test = tests.find((t) => t.id === testId);
        if (!test) { revert(); return; }
        const result = await callEdgeFunction('tests-update', { test_id: testId, class_id: test.class_id, subject_id: test.subject_id ?? null, test_date: newDateStr, start_time: newStartTimeDb, end_time: newEndTimeDb, title: test.title ?? null, active_during_holiday: movedToHoliday });
        setTests((prev) => prev.map((t) => (t.id === testId ? (result.item as TestRow) : t)));
      } catch (err) { console.error(err); revert(); }
      return;
    }

    const programItemId = event.extendedProps['programItemId'] as string | undefined;
    if (!programItemId || !oldEvent || !oldEvent.start) { revert(); return; }
    const oldDateStr = formatLocalYMD(oldEvent.start);

    const applyOverride = (prev: ProgramItemOverrideRow[], date: string, upserted: ProgramItemOverrideRow) => {
      const existing = prev.find((o) => o.program_item_id === programItemId && o.override_date === date);
      if (existing) return prev.map((o) => (o.id === existing.id ? upserted : o));
      return [...prev, upserted];
    };
    try {
      const movedToHoliday = holidayDateSet.has(newDateStr);
      const carriedCharge = resolveChargeForDate(programItemId, oldDateStr);
      if (oldDateStr === newDateStr) {
        const result = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: newDateStr, start_time: newStartTimeDb, end_time: newEndTimeDb, is_deleted: false, is_inactive: false, holiday_active_override: movedToHoliday, charge_amount: carriedCharge });
        setOverrides((prev) => applyOverride(prev, newDateStr, result.item as ProgramItemOverrideRow));
      } else {
        const oldResult = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: oldDateStr, start_time: null, end_time: null, is_deleted: true, is_inactive: false, holiday_active_override: false, charge_amount: null });
        setOverrides((prev) => applyOverride(prev, oldDateStr, oldResult.item as ProgramItemOverrideRow));
        const newResult = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: newDateStr, start_time: newStartTimeDb, end_time: newEndTimeDb, is_deleted: false, is_inactive: false, holiday_active_override: movedToHoliday, charge_amount: carriedCharge });
        setOverrides((prev) => applyOverride(prev, newDateStr, newResult.item as ProgramItemOverrideRow));
      }
    } catch (err) { console.error(err); revert(); }
  };

  /* -------- Render event content -------- */
  const renderEventContent = (arg: EventContentArg) => {
    const { event, view } = arg;
    const isMonth = view.type === 'dayGridMonth';
    const kind = event.extendedProps['kind'] as string | undefined;
    const subject = event.extendedProps['subject'] as string | null;
    const tutorName = event.extendedProps['tutorName'] as string | null;
    const room = event.extendedProps['room'] as string | null;
    const isInactive = !!event.extendedProps['isInactive'];
    const isHoliday = !!event.extendedProps['isHoliday'];
    const holidayName = (event.extendedProps['holidayName'] as string | null) ?? null;
    const start = event.start;
    const end = event.end;
    const fmt = new Intl.DateTimeFormat('el-GR', { hour: '2-digit', minute: '2-digit' });
    let timeRange = '';
    if (start && end) timeRange = `${fmt.format(start)}–${fmt.format(end)}`;
    else if (start) timeRange = fmt.format(start);
    const hasTest = kind === 'test' || !!event.extendedProps['testId'];
    const rawTitle = event.title ?? '';
    let mainTitle = rawTitle;
    if (hasTest) {
      if (/^Διαγώνισμα\s*·/u.test(rawTitle)) mainTitle = rawTitle.replace(/^Διαγώνισμα\s*·\s*/u, '').trim();
      else if (/\s*·\s*Διαγώνισμα\s*$/u.test(rawTitle)) mainTitle = rawTitle.replace(/\s*·\s*Διαγώνισμα\s*$/u, '').trim();
    }

    /* Month view — compact single-line pill */
    if (isMonth) {
      return (
        <div className="flex items-center gap-1 overflow-hidden px-0.5">
          {hasTest && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-red-400" />}
          {kind === 'schoolEvent' && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-violet-400" />}
          {timeRange && <span className="shrink-0 text-[9px] font-bold opacity-60">{timeRange.split('–')[0]}</span>}
          <span className="text-[10px] font-semibold truncate leading-tight">{mainTitle}</span>
        </div>
      );
    }

    /* Time-grid — full detail card */
    return (
      <div className="flex flex-col h-full overflow-hidden leading-tight" style={{ gap: '2px' }}>
        {timeRange && (
          <div className="text-[11px] font-bold" style={{ color: 'var(--color-accent)' }}>{timeRange}</div>
        )}
        {(isInactive || (isHoliday && !isInactive)) && (
          <div>
            {isInactive ? (
              <span className={`inline-flex items-center rounded px-1 py-px text-[8px] font-bold ${
                isDark ? 'bg-slate-600/30 text-slate-300 border border-slate-500/25' : 'bg-slate-100 text-slate-500 border border-slate-300/50'
              }`}>
                {isHoliday ? (holidayName || 'Αργία') : 'Ανενεργό'}
              </span>
            ) : (
              <span className="inline-flex items-center rounded px-1 py-px text-[8px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                {holidayName || 'Αργία'}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {hasTest && (
            <span className="inline-flex shrink-0 items-center rounded px-1 py-px text-[8px] font-bold bg-red-500/25 text-red-400 border border-red-500/25">
              Διαγώνισμα
            </span>
          )}
          {mainTitle && <span className="text-[13px] font-semibold truncate">{mainTitle}</span>}
        </div>
        {kind === 'program' && subject && (
          <div className="text-[11px] font-medium truncate" style={{ color: 'var(--color-text-main)' }}>{subject}</div>
        )}
        {kind === 'program' && tutorName && (
          <div className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{tutorName}</div>
        )}
        {kind === 'program' && room && (
          <div className="flex items-center gap-0.5 text-[11px] font-medium truncate" style={{ color: 'var(--color-accent)' }}>
            <DoorOpen className="h-3 w-3 shrink-0" />
            Αίθουσα {room}
          </div>
        )}
      </div>
    );
  };

  /* -------- School event modal helpers (unchanged) -------- */
  const openEditSchoolEventModal = (eventId: string) => {
    const row = schoolEvents.find((e) => e.id === eventId) ?? null;
    if (!row) return;
    setSchoolEventError(null); setSchoolEventModalMode('edit');
    setSchoolEventEditing({ id: row.id, name: row.name, description: row.description ?? '', date: row.date, start_time: row.start_time, end_time: row.end_time });
    setSchoolEventModalOpen(true);
  };

  const closeSchoolEventModal = () => {
    if (schoolEventSaving) return;
    setSchoolEventModalOpen(false); setSchoolEventEditing(null); setSchoolEventSaving(false); setSchoolEventError(null);
  };

  const handleSaveSchoolEvent = async (form: EventFormState) => {
    setSchoolEventError(null);
    if (!schoolId) { setSchoolEventError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    if (!form.name.trim()) { setSchoolEventError('Το όνομα του event είναι υποχρεωτικό.'); return; }
    if (!form.date) { setSchoolEventError('Η ημερομηνία είναι υποχρεωτική.'); return; }
    if (!form.startTime || !form.endTime) { setSchoolEventError('Η ώρα έναρξης και λήξης είναι υποχρεωτικές.'); return; }
    const name = form.name.trim();
    const description = form.description?.trim() || null;
    const date = form.date;
    const start_time = `${form.startTime}:00`;
    const end_time = `${form.endTime}:00`;
    setSchoolEventSaving(true);
    try {
      if (schoolEventModalMode === 'create') {
        const result = await callEdgeFunction('events-create', { name, description, date, start_time, end_time });
        setSchoolEvents((prev) => [result.item as SchoolEventRow, ...prev]);
        closeSchoolEventModal();
      } else {
        if (!schoolEventEditing) return;
        const result = await callEdgeFunction('events-update', { event_id: schoolEventEditing.id, name, description, date, start_time, end_time });
        setSchoolEvents((prev) => prev.map((ev) => (ev.id === schoolEventEditing!.id ? (result.item as SchoolEventRow) : ev)));
        closeSchoolEventModal();
      }
    } catch (err) {
      console.error(err);
      setSchoolEventError(schoolEventModalMode === 'create' ? 'Αποτυχία δημιουργίας event.' : 'Αποτυχία ενημέρωσης event.');
    } finally {
      setSchoolEventSaving(false);
    }
  };

  const handleConfirmDeleteSchoolEvent = async () => {
    if (!schoolEventDeleteTarget || !schoolId) return;
    setSchoolEventError(null); setSchoolEventDeleting(true);
    try {
      await callEdgeFunction('events-delete', { event_id: schoolEventDeleteTarget.id });
      setSchoolEvents((prev) => prev.filter((ev) => ev.id !== schoolEventDeleteTarget.id));
      setSchoolEventDeleteTarget(null); closeSchoolEventModal();
    } catch (err) {
      console.error(err);
      setSchoolEventError('Αποτυχία διαγραφής εκδήλωσης.');
    } finally {
      setSchoolEventDeleting(false);
    }
  };

  /* -------- Click handling (unchanged) -------- */
  const openTestModalFromEvent = async (event: any) => {
    const testId = event.extendedProps['testId'] as string | null | undefined;
    if (!testId || !event.start || !event.end) return;
    const testRow = tests.find((t) => t.id === testId) ?? null;
    const classId = (event.extendedProps['classId'] as string | undefined) ?? testRow?.class_id ?? null;
    const levelId = testRow?.level_id ?? null;
    const subjectId = (event.extendedProps['subjectId'] as string | undefined) ?? (event.extendedProps['testSubjectId'] as string | undefined) ?? testRow?.subject_id ?? null;
    const dateIso = formatLocalYMD(event.start);
    const isHoliday = holidayDateSet.has(dateIso);
    const start24 = `${pad2(event.start.getHours())}:${pad2(event.start.getMinutes())}`;
    const end24 = `${pad2(event.end.getHours())}:${pad2(event.end.getMinutes())}`;
    setTestError(null);
    setTestModal({ testId, classId, levelId, subjectId, date: formatDateDisplay(dateIso), startTime: start24, endTime: end24, title: testRow?.title ?? '', activeDuringHoliday: isHoliday ? !!testRow?.active_during_holiday : false });
    setTestModalAssignments([]);
    if (!classId && !levelId) {
      setTestModalAssignmentsLoading(true);
      const [{ data }, { data: chargesData }] = await Promise.all([
        supabase.from('test_results').select('student_id, subject_id').eq('test_id', testId),
        schoolId
          ? supabase.from('student_extra_charges').select('id, student_id, amount').eq('school_id', schoolId).eq('notes', `test:${testId}`).is('cancelled_at', null)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const chargeByStudent = new Map<string, { id: string; amount: number }>();
      (chargesData ?? []).forEach((row: any) => chargeByStudent.set(row.student_id, { id: row.id, amount: Number(row.amount) }));
      setTestModalAssignments((data ?? []).map((r: any) => {
        const charge = chargeByStudent.get(r.student_id);
        return {
          studentId: r.student_id,
          studentName: studentById.get(r.student_id)?.full_name ?? 'Άγνωστος',
          subjectName: r.subject_id ? subjectById.get(r.subject_id)?.name ?? null : null,
          chargeAmount: charge ? String(charge.amount) : '',
          existingChargeId: charge?.id,
          existingAmount: charge?.amount,
        };
      }));
      setTestModalAssignmentsLoading(false);
    }
    setShowDeleteConfirm(false); setEventModal(null);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const { event } = arg;
    const kind = event.extendedProps['kind'] as 'program' | 'schoolEvent' | 'test' | undefined;
    if (!event.start || !event.end) return;
    setEventModal(null); setTestModal(null); setExtraModal(null); setShowDeleteConfirm(false); setEventError(null); setTestError(null); setShowConvertTestConfirm(false);
    if (kind === 'schoolEvent') { const eventId = event.extendedProps['eventId'] as string | undefined; if (eventId) openEditSchoolEventModal(eventId); return; }
    if (kind === 'test') { openTestModalFromEvent(event); return; }
    if (kind === 'program') {
      const combinedTestId = event.extendedProps['testId'] as string | null;
      if (combinedTestId) { openTestModalFromEvent(event); return; }
      const programItemId = event.extendedProps['programItemId'] as string | undefined;
      if (!programItemId) return;
      const dateIso = formatLocalYMD(event.start);
      const overrideId = event.extendedProps['overrideId'] as string | null;
      const start24 = `${pad2(event.start.getHours())}:${pad2(event.start.getMinutes())}`;
      const end24 = `${pad2(event.end.getHours())}:${pad2(event.end.getMinutes())}`;
      const classIdProp = event.extendedProps['classId'] as string | undefined;
      const studentIdProp = (event.extendedProps['studentId'] as string | null | undefined) ?? null;
      const prefilledSubjectId = (event.extendedProps['subjectId'] as string | null | undefined) ?? null;
      const resolvedCharge = resolveChargeForDate(programItemId, dateIso);
      setEventModal({ programItemId, originalDateStr: dateIso, date: formatDateDisplay(dateIso), startTime: start24, endTime: end24, classId: classIdProp ?? null, studentId: studentIdProp, subjectId: prefilledSubjectId, overrideId: overrideId ?? undefined, activeDuringHoliday: !!event.extendedProps['activeDuringHoliday'], chargeAmount: resolvedCharge != null ? String(resolvedCharge) : '' });
      setShowDeleteConfirm(false);
    }
  };

  /* -------- Add extra (one-off) class from empty calendar space -------- */
  const handleDateClick = (arg: DateClickArg) => {
    setEventModal(null); setTestModal(null); setShowDeleteConfirm(false);
    const dateIso = formatLocalYMD(arg.date);
    const hasTime = arg.view.type !== 'dayGridMonth';
    const startTime = hasTime ? `${pad2(arg.date.getHours())}:${pad2(arg.date.getMinutes())}` : '';
    setExtraError(null);
    setExtraModal({ date: formatDateDisplay(dateIso), classId: null, subjectId: null, startTime, endTime: '', room: '', roster: [] });
  };

  const closeExtraModal = () => { if (savingExtra) return; setExtraModal(null); setExtraError(null); };

  const handleExtraFieldChange = (field: 'classId' | 'subjectId') => (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setExtraModal((prev) => {
      if (!prev) return prev;
      if (field === 'classId') return { ...prev, classId: value || null, subjectId: null };
      return { ...prev, subjectId: value || null };
    });
  };

  const addStudentToExtraRoster = (studentId: string) =>
    setExtraModal((prev) => (prev ? { ...prev, roster: [...prev.roster, { studentId, charge: '' }] } : prev));
  const removeStudentFromExtraRoster = (studentId: string) =>
    setExtraModal((prev) => (prev ? { ...prev, roster: prev.roster.filter((r) => r.studentId !== studentId) } : prev));
  const changeExtraRosterCharge = (studentId: string, value: string) =>
    setExtraModal((prev) => (prev ? { ...prev, roster: prev.roster.map((r) => (r.studentId === studentId ? { ...r, charge: value } : r)) } : prev));

  const handleSaveExtraClass = async () => {
    if (!extraModal) return;
    if (!extraModal.startTime || !extraModal.endTime) { setExtraError('Συμπληρώστε τις ώρες έναρξης και λήξης.'); return; }
    const dateISO = parseDateDisplayToISO(extraModal.date);
    if (!dateISO) { setExtraError('Μη έγκυρη ημερομηνία.'); return; }
    const dow = INDEX_TO_WEEKDAY[new Date(`${dateISO}T00:00:00`).getDay()];

    setSavingExtra(true); setExtraError(null);
    try {
      if (isFrontistirio) {
        if (!program) { setSavingExtra(false); return; }
        if (!extraModal.classId) { setExtraError('Επιλέξτε τμήμα.'); setSavingExtra(false); return; }
        if (!extraModal.subjectId) { setExtraError('Επιλέξτε μάθημα.'); setSavingExtra(false); return; }
        const itemsForDay = programItems.filter((i) => i.day_of_week === dow && i.program_id === program.id);
        const maxPos = itemsForDay.reduce((max, i) => Math.max(max, i.position ?? 0), 0);
        const data = await callEdgeFunction('program-create', {
          program_id: program.id,
          class_id: extraModal.classId,
          subject_id: extraModal.subjectId,
          tutor_id: null,
          day_of_week: dow,
          position: maxPos + 1,
          start_time: extraModal.startTime,
          end_time: extraModal.endTime,
          start_date: dateISO,
          end_date: dateISO,
          room: extraModal.room.trim() || null,
        });
        setProgramItems((prev) => [...prev, data.item as ProgramItemRow]);
      } else {
        if (extraModal.roster.length === 0) { setExtraError('Επιλέξτε τουλάχιστον έναν μαθητή.'); setSavingExtra(false); return; }
        const data = await callEdgeFunction('private-lesson-create', {
          subject_id: extraModal.subjectId,
          day_of_week: dow,
          start_time: extraModal.startTime,
          end_time: extraModal.endTime,
          start_date: dateISO,
          end_date: dateISO,
          room: extraModal.room.trim() || null,
          students: extraModal.roster.map((r) => ({
            student_id: r.studentId,
            charge_per_session: r.charge.trim() ? Number(r.charge.replace(',', '.')) : null,
          })),
        });
        setProgramItems((prev) => [...prev, ...(data.items as ProgramItemRow[])]);
      }
      setExtraModal(null);
    } catch (err) {
      console.error(err);
      setExtraError('Αποτυχία προσθήκης έκτακτου μαθήματος.');
    } finally {
      setSavingExtra(false);
    }
  };

  /* -------- Program override modal handlers (unchanged) -------- */
  const handleProgramFieldChange = (field: 'classId' | 'subjectId') => (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setEventModal((prev) => {
      if (!prev) return prev;
      if (field === 'classId') return { ...prev, classId: value || null, subjectId: null };
      if (field === 'subjectId') return { ...prev, subjectId: value || null };
      return prev;
    });
  };


  const handleEventModalSave = async () => {
    if (!eventModal) return;
    const { programItemId, originalDateStr, date, startTime, endTime, classId, studentId, subjectId, activeDuringHoliday, chargeAmount } = eventModal;
    if (!classId && !studentId) { setEventError('Επιλέξτε τμήμα.'); return; }
    const subjectOptions = classId ? getSubjectsForClass(classId) : [];
    if (subjectOptions.length > 0 && !subjectId) { setEventError('Επιλέξτε μάθημα για το τμήμα.'); return; }
    if (!date) { setEventError('Επιλέξτε ημερομηνία μαθήματος.'); return; }
    const newDateStr = parseDateDisplayToISO(date);
    if (!newDateStr) { setEventError('Μη έγκυρη ημερομηνία (π.χ. 12/05/2025).'); return; }
    if (!startTime || !endTime) { setEventError('Συμπληρώστε σωστά τις ώρες.'); return; }
    const trimmedCharge = chargeAmount.trim();
    const parsedCharge = trimmedCharge ? Number(trimmedCharge.replace(',', '.')) : null;
    if (parsedCharge !== null && (Number.isNaN(parsedCharge) || parsedCharge < 0)) { setEventError('Μη έγκυρο ποσό χρέωσης.'); return; }
    const startTimeDb = `${startTime}:00`; const endTimeDb = `${endTime}:00`;
    const isHoliday = holidayDateSet.has(newDateStr);
    const finalHolidayActiveOverride = isHoliday ? !!activeDuringHoliday : false;
    const applyOverride = (prev: ProgramItemOverrideRow[], date: string, upserted: ProgramItemOverrideRow) => {
      const ex = prev.find((o) => o.program_item_id === programItemId && o.override_date === date);
      if (ex) return prev.map((o) => (o.id === ex.id ? upserted : o));
      return [...prev, upserted];
    };
    try {
      setEventError(null);
      const item = programItems.find((pi) => pi.id === programItemId);
      let currentItem = item ?? null;
      if (item && classId !== item.class_id) {
        const result = await callEdgeFunction('program-update', { program_item_id: item.id, class_id: classId, subject_id: item.subject_id ?? null, tutor_id: item.tutor_id ?? null, day_of_week: item.day_of_week, start_time: item.start_time, end_time: item.end_time, start_date: item.start_date, end_date: item.end_date, room: item.room ?? null });
        currentItem = result.item as ProgramItemRow;
        setProgramItems((prev) => prev.map((pi) => (pi.id === programItemId ? currentItem! : pi)));
      }
      const finalSubjectId = subjectId ?? null;
      if (currentItem && finalSubjectId !== (currentItem.subject_id ?? null)) {
        const result = await callEdgeFunction('program-update', { program_item_id: currentItem.id, class_id: currentItem.class_id, student_id: currentItem.student_id ?? null, subject_id: finalSubjectId, tutor_id: currentItem.tutor_id ?? null, day_of_week: currentItem.day_of_week, start_time: currentItem.start_time, end_time: currentItem.end_time, start_date: currentItem.start_date, end_date: currentItem.end_date, room: currentItem.room ?? null });
        currentItem = result.item as ProgramItemRow;
        setProgramItems((prev) => prev.map((pi) => (pi.id === programItemId ? currentItem! : pi)));
      }
      const upsertOverrideForDate = async (targetDate: string) => {
        const result = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: targetDate, start_time: startTimeDb, end_time: endTimeDb, is_deleted: false, is_inactive: false, holiday_active_override: holidayDateSet.has(targetDate) ? finalHolidayActiveOverride : false, charge_amount: parsedCharge });
        setOverrides((prev) => applyOverride(prev, targetDate, result.item as ProgramItemOverrideRow));
      };
      if (newDateStr === originalDateStr) { await upsertOverrideForDate(newDateStr); }
      else {
        const oldResult = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: originalDateStr, start_time: null, end_time: null, is_deleted: true, is_inactive: false, holiday_active_override: false, charge_amount: null });
        setOverrides((prev) => applyOverride(prev, originalDateStr, oldResult.item as ProgramItemOverrideRow));
        await upsertOverrideForDate(newDateStr);
      }
      setEventModal(null); setShowDeleteConfirm(false);
    } catch (err) { console.error(err); setEventError('Αποτυχία αποθήκευσης. Προσπαθήστε ξανά.'); }
  };

  const handleEventModalDeleteForDay = async () => {
    if (!eventModal) return;
    const { programItemId, originalDateStr } = eventModal;
    try {
      setEventError(null);
      const result = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: originalDateStr, start_time: null, end_time: null, is_deleted: true, is_inactive: false, holiday_active_override: false, charge_amount: null });
      const upserted = result.item as ProgramItemOverrideRow;
      setOverrides((prev) => {
        const existing = prev.find((o) => o.program_item_id === programItemId && o.override_date === originalDateStr);
        if (existing) return prev.map((o) => (o.id === existing.id ? upserted : o));
        return [...prev, upserted];
      });
      setEventModal(null); setShowDeleteConfirm(false);
    } catch (err) { console.error(err); setEventError('Αποτυχία διαγραφής. Προσπαθήστε ξανά.'); }
  };

  // Idiaitera only: cancel this day's regular session occurrence and create a standalone test in its place.
  const handleConvertSessionToTest = async () => {
    if (!eventModal || !eventModal.studentId) return;
    const { programItemId, originalDateStr, startTime, endTime, subjectId, studentId, chargeAmount } = eventModal;
    if (!subjectId) { setEventError('Επιλέξτε μάθημα πριν τη μετατροπή σε διαγώνισμα.'); return; }
    const trimmedCharge = chargeAmount.trim();
    const parsedCharge = trimmedCharge ? Number(trimmedCharge.replace(',', '.')) : null;
    if (parsedCharge !== null && (Number.isNaN(parsedCharge) || parsedCharge <= 0)) { setEventError('Μη έγκυρο ποσό χρέωσης.'); return; }
    setConvertingSessionToTest(true); setEventError(null);
    try {
      const overrideResult = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: originalDateStr, start_time: null, end_time: null, is_deleted: true, is_inactive: false, holiday_active_override: false, charge_amount: null });
      setOverrides((prev) => {
        const existing = prev.find((o) => o.program_item_id === programItemId && o.override_date === originalDateStr);
        const upserted = overrideResult.item as ProgramItemOverrideRow;
        if (existing) return prev.map((o) => (o.id === existing.id ? upserted : o));
        return [...prev, upserted];
      });
      const testResult = await callEdgeFunction('tests-create', {
        class_id: null, level_id: null, subject_id: subjectId,
        test_date: originalDateStr, start_time: `${startTime}:00`, end_time: `${endTime}:00`,
        title: null, description: null,
        student_assignments: [{ student_id: studentId, subject_id: subjectId }],
      });
      const newTest = testResult.item as TestRow;
      setTests((prev) => [...prev, newTest]);
      if (parsedCharge != null && schoolId) {
        const { error: chargeErr } = await supabase.from('student_extra_charges').insert({
          school_id: schoolId, student_id: studentId, description: 'Διαγώνισμα',
          amount: Number(parsedCharge.toFixed(2)), notes: `test:${newTest.id}`,
        });
        if (chargeErr) console.error(chargeErr);
      }
      setEventModal(null); setShowDeleteConfirm(false);
    } catch (err) {
      console.error(err);
      setEventError('Αποτυχία μετατροπής σε διαγώνισμα.');
    } finally {
      setConvertingSessionToTest(false);
    }
  };

  const handleDatesSet = (arg: DatesSetArg) => { setCalendarView(arg.view.type); setViewRange({ start: arg.start, end: arg.end }); };

  /* -------- Test modal handlers (unchanged) -------- */
  const handleTestFieldChange = (field: keyof TestModalState) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value;
    setTestModal((prev) => {
      if (!prev) return prev;
      if (field === 'classId') return { ...prev, classId: value || null, subjectId: null };
      if (field === 'levelId') return { ...prev, levelId: value || null, subjectId: null };
      if (field === 'subjectId') return { ...prev, subjectId: value || null };
      return { ...prev, [field]: value as any };
    });
  };


  const handleTestModalSave = async () => {
    if (!testModal) return;
    const { testId, classId, levelId, subjectId, date, startTime, endTime, title, activeDuringHoliday } = testModal;
    const isPrivateTest = !classId && !levelId;
    const subjectOptions = levelId ? subjects.filter((s) => s.level_id === levelId) : classId ? getSubjectsForClass(classId) : [];
    if (!isPrivateTest && subjectOptions.length > 0 && !subjectId) { setTestError('Επιλέξτε μάθημα.'); return; }
    if (!date) { setTestError('Επιλέξτε ημερομηνία διαγωνίσματος.'); return; }
    const testDateISO = parseDateDisplayToISO(date);
    if (!testDateISO) { setTestError('Μη έγκυρη ημερομηνία (π.χ. 12/05/2025).'); return; }
    if (!startTime || !endTime) { setTestError('Συμπληρώστε σωστά τις ώρες.'); return; }
    const isHoliday = holidayDateSet.has(testDateISO);
    const finalActiveDuringHoliday = isHoliday ? !!activeDuringHoliday : false;
    setSavingTest(true); setTestError(null);
    try {
      const result = await callEdgeFunction('tests-update', { test_id: testId, class_id: classId, level_id: levelId, subject_id: subjectId ?? subjectOptions[0]?.id ?? null, test_date: testDateISO, start_time: `${startTime}:00`, end_time: `${endTime}:00`, title: title || null, active_during_holiday: finalActiveDuringHoliday });
      setTests((prev) => prev.map((t) => (t.id === testId ? (result.item as TestRow) : t)));
      setTestModal(null);
    } catch (err) { console.error(err); setTestError('Αποτυχία ενημέρωσης διαγωνίσματος.'); }
    finally { setSavingTest(false); }
  };

  const handleTestModalClose = () => { if (savingTest) return; setTestModal(null); setTestError(null); setShowDeleteConfirm(false); setTestModalAssignments([]); setShowConvertTestConfirm(false); };

  // Per-student test charges, tagged via notes: `test:<testId>` on student_extra_charges (same ledger used on the student card).
  const updateTestModalChargeAmount = (studentId: string, value: string) => {
    setTestModalAssignments((prev) => prev.map((a) => (a.studentId === studentId ? { ...a, chargeAmount: value } : a)));
  };

  const chargeTestModalStudent = async (studentId: string) => {
    if (!schoolId || !testModal) return;
    const a = testModalAssignments.find((x) => x.studentId === studentId);
    const amt = Number((a?.chargeAmount ?? '').trim().replace(',', '.'));
    if (!a?.chargeAmount?.trim() || Number.isNaN(amt) || amt <= 0) { setTestError('Μη έγκυρο ποσό χρέωσης.'); return; }
    setTestError(null);
    setChargingTestStudentIds((prev) => new Set(prev).add(studentId));
    try {
      const description = testModal.title?.trim() ? `Διαγώνισμα: ${testModal.title.trim()}` : 'Διαγώνισμα';
      const { data, error } = await supabase.from('student_extra_charges').insert({
        school_id: schoolId, student_id: studentId, description, amount: Number(amt.toFixed(2)), notes: `test:${testModal.testId}`,
      }).select('id, amount').single();
      if (error || !data) throw error ?? new Error('insert failed');
      setTestModalAssignments((prev) => prev.map((x) => (x.studentId === studentId ? { ...x, chargeAmount: String(data.amount), existingChargeId: data.id, existingAmount: Number(data.amount) } : x)));
    } catch (err) {
      console.error(err);
      setTestError('Αποτυχία χρέωσης.');
    } finally {
      setChargingTestStudentIds((prev) => { const n = new Set(prev); n.delete(studentId); return n; });
    }
  };

  const cancelTestModalCharge = async (studentId: string) => {
    const a = testModalAssignments.find((x) => x.studentId === studentId);
    if (!a?.existingChargeId) return;
    setCancellingTestChargeIds((prev) => new Set(prev).add(studentId));
    try {
      const { error } = await supabase.from('student_extra_charges').update({ cancelled_at: new Date().toISOString() }).eq('id', a.existingChargeId);
      if (error) throw error;
      setTestModalAssignments((prev) => prev.map((x) => (x.studentId === studentId ? { ...x, chargeAmount: '', existingChargeId: undefined, existingAmount: undefined } : x)));
    } catch (err) {
      console.error(err);
      setTestError('Αποτυχία ακύρωσης χρέωσης.');
    } finally {
      setCancellingTestChargeIds((prev) => { const n = new Set(prev); n.delete(studentId); return n; });
    }
  };

  // Idiaitera only: restore the matching weekly session occurrence and delete the test.
  // Grades cascade-delete with the test; any charges already made stay on the student's ledger untouched.
  const handleConvertTestToSession = async () => {
    if (!testModal || !testConvertTarget) return;
    const testDateISO = parseDateDisplayToISO(testModal.date);
    if (!testDateISO) return;
    setConvertingTestToSession(true); setTestError(null);
    try {
      const overrideResult = await callEdgeFunction('program-item-override-upsert', {
        program_item_id: testConvertTarget.id, override_date: testDateISO,
        start_time: `${testModal.startTime}:00`, end_time: `${testModal.endTime}:00`,
        is_deleted: false, is_inactive: false, holiday_active_override: false, charge_amount: null,
      });
      setOverrides((prev) => {
        const existing = prev.find((o) => o.program_item_id === testConvertTarget.id && o.override_date === testDateISO);
        const upserted = overrideResult.item as ProgramItemOverrideRow;
        if (existing) return prev.map((o) => (o.id === existing.id ? upserted : o));
        return [...prev, upserted];
      });
      await callEdgeFunction('tests-delete', { test_id: testModal.testId });
      setTests((prev) => prev.filter((t) => t.id !== testModal.testId));
      setTestModal(null); setTestModalAssignments([]); setShowConvertTestConfirm(false);
    } catch (err) {
      console.error(err);
      setTestError('Αποτυχία μετατροπής σε μάθημα.');
    } finally {
      setConvertingTestToSession(false);
    }
  };

  const handleEventModalClose = () => { setEventModal(null); setEventError(null); setShowDeleteConfirm(false); };
  const handleProgramAskDeleteForDay = () => setShowDeleteConfirm(true);
  const handleProgramCancelDeleteConfirm = () => setShowDeleteConfirm(false);

  const handleTestCancelForDay = async () => {
    if (!testModal) return;
    try {
      setSavingTest(true); setTestError(null);
      const test = tests.find((t) => t.id === testModal.testId);
      if (!test) return;
      const result = await callEdgeFunction('tests-update', { test_id: test.id, class_id: test.class_id, level_id: test.level_id, subject_id: test.subject_id ?? null, test_date: test.test_date, start_time: test.start_time, end_time: test.end_time, title: test.title ?? null, active_during_holiday: false });
      setSavingTest(false);
      setTests((prev) => prev.map((t) => (t.id === test.id ? (result.item as TestRow) : t)));
      setTestModal(null); setShowDeleteConfirm(false);
    } catch (e) { console.error(e); setSavingTest(false); setTestError('Αποτυχία ακύρωσης για τη μέρα.'); }
  };

  const programModalIsHoliday = useMemo(() => { if (!eventModal) return false; const iso = parseDateDisplayToISO(eventModal.date); if (!iso) return false; return holidayDateSet.has(iso); }, [eventModal, holidayDateSet]);
  const programModalHolidayName = useMemo(() => { if (!eventModal) return null; const iso = parseDateDisplayToISO(eventModal.date); if (!iso) return null; return holidayNameByDate.get(iso) ?? null; }, [eventModal, holidayNameByDate]);
  const testModalIsHoliday = useMemo(() => { if (!testModal) return false; const iso = parseDateDisplayToISO(testModal.date); if (!iso) return false; return holidayDateSet.has(iso); }, [testModal, holidayDateSet]);
  const testModalHolidayName = useMemo(() => { if (!testModal) return null; const iso = parseDateDisplayToISO(testModal.date); if (!iso) return null; return holidayNameByDate.get(iso) ?? null; }, [testModal, holidayNameByDate]);

  // A private test can only convert back into a regular session when it actually replaced one:
  // exactly one student, a matching weekly recurring slot for that student on that weekday, AND
  // a deleted override on that exact date proving a session occurrence was cancelled to make room
  // for this test. Tests created standalone from the start never cancelled a session, so there's
  // nothing to revert to even if the student happens to have a regular slot on that weekday.
  const testConvertTarget = useMemo(() => {
    if (!testModal || testModal.classId || testModal.levelId) return null;
    if (testModalAssignments.length !== 1) return null;
    const iso = parseDateDisplayToISO(testModal.date);
    if (!iso) return null;
    const dow = INDEX_TO_WEEKDAY[new Date(`${iso}T00:00:00`).getDay()];
    const studentId = testModalAssignments[0].studentId;
    const pi = programItems.find((item) => item.student_id === studentId && item.day_of_week === dow);
    if (!pi) return null;
    const wasConvertedFromSession = overrides.some((o) => o.program_item_id === pi.id && o.override_date === iso && o.is_deleted);
    return wasConvertedFromSession ? pi : null;
  }, [testModal, testModalAssignments, programItems, overrides]);

  const studentById = useMemo(() => { const m = new Map<string, StudentRow>(); students.forEach((s) => m.set(s.id, s)); return m; }, [students]);

  const programSubjectOptions = useMemo(() => {
    if (eventModal?.studentId) return [...subjects].sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    if (!eventModal?.classId) return [];
    return getSubjectsForClass(eventModal.classId);
  }, [eventModal?.classId, eventModal?.studentId, classes, classSubjects, subjects, subjectById]);
  const extraSubjectOptions = useMemo(() => {
    if (!isFrontistirio) return [...subjects].sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    if (!extraModal?.classId) return [];
    return getSubjectsForClass(extraModal.classId);
  }, [isFrontistirio, extraModal?.classId, classes, classSubjects, subjects, subjectById]);
  const extraAvailableStudents = useMemo(() => {
    const taken = new Set((extraModal?.roster ?? []).map((r) => r.studentId));
    return students.filter((s) => !taken.has(s.id));
  }, [students, extraModal?.roster]);
  const testSubjectOptions = useMemo(() => {
    if (testModal?.levelId) return subjects.filter((s) => s.level_id === testModal.levelId).sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    if (!testModal?.classId) return [];
    return getSubjectsForClass(testModal.classId);
  }, [testModal?.classId, testModal?.levelId, classes, classSubjects, subjects, subjectById]);

  // const requestDeleteSchoolEventFromModal = () => { if (!schoolEventEditing) return; setSchoolEventDeleteTarget({ id: schoolEventEditing.id, name: schoolEventEditing.name }); };

  /* ---- Modal footer helpers ---- */
  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60';
  const modalFooterCls = `flex items-center justify-between gap-2 border-t px-6 py-4 mt-4 ${
    isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'
  }`;

  /* -------- Return -------- */
  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--color-accent)' }}>
          <CalendarDays className="h-4 w-4" style={{ color: 'var(--color-on-accent)' }}/>
        </div>
        <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Πρόγραμμα Τμημάτων & Εκδηλώσεις</h2>
      </div>

      {loading ? (
        <div className={`flex items-center justify-center gap-3 rounded-2xl border py-12 backdrop-blur-md ${
          isDark ? 'border-slate-700/50 bg-slate-950/40' : 'border-slate-200 bg-white/60'
        }`}>
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Φόρτωση προγράμματος…</span>
        </div>
      ) : (
        <>
          {/* Calendar wrapper */}
          <div className={`overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
            isDark
              ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]'
              : 'border-slate-200 bg-white/80 ring-black/[0.02]'
          }`}>
            <div className="p-0">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                locale={elLocale}
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                height="auto"
                slotMinTime="08:00:00"
                slotMaxTime="24:00:00"
                allDaySlot={false}
                slotDuration="00:15:00"
                slotLabelInterval={{ hours: 1 }}
                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
                nowIndicator={true}
                eventMinHeight={28}
                dayMaxEventRows={5}
                moreLinkClick="popover"
                events={events}
                editable={true}
                eventStartEditable={true}
                eventDurationEditable={true}
                eventDrop={handleEventDrop}
                droppable={false}
                eventContent={renderEventContent}
                datesSet={handleDatesSet}
                eventClick={handleEventClick}
                dateClick={handleDateClick}
              />
            </div>
          </div>

          {/* School event modal (external component) */}
          <EventFormModal
            open={schoolEventModalOpen}
            mode={schoolEventModalMode}
            editingEvent={schoolEventEditing}
            error={schoolEventError}
            saving={schoolEventSaving}
            onClose={closeSchoolEventModal}
            onSubmit={handleSaveSchoolEvent}
          />

          {/* Delete school event */}
          {schoolEventDeleteTarget && (
            <ModalShell title="Διαγραφή εκδήλωσης" onClose={() => { if (!schoolEventDeleting) setSchoolEventDeleteTarget(null); }}>
              <div className="px-6 pt-4 pb-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                  <CalendarDays className="h-5 w-5 text-red-400" />
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Σίγουρα θέλετε να διαγράψετε την εκδήλωση{' '}
                  <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>«{schoolEventDeleteTarget.name}»</span>;
                  {' '}Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
                </p>
                <div className="mt-5 flex justify-end gap-2.5">
                  <button type="button" onClick={() => { if (!schoolEventDeleting) setSchoolEventDeleteTarget(null); }} disabled={schoolEventDeleting} className={`${cancelBtnCls} disabled:opacity-50`}>
                    Ακύρωση
                  </button>
                  <button type="button" onClick={handleConfirmDeleteSchoolEvent} disabled={schoolEventDeleting}
                    className="btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
                    {schoolEventDeleting ? <><Loader2 className="h-3 w-3 animate-spin" />Διαγραφή…</> : 'Διαγραφή'}
                  </button>
                </div>
              </div>
            </ModalShell>
          )}

          {/* Program edit modal */}
          {eventModal && !showDeleteConfirm && (
            <ModalShell title="Επεξεργασία μαθήματος" icon={<BookOpen className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />} onClose={handleEventModalClose} maxWidthClass="max-w-2xl">
              <div className="space-y-4 px-6 pb-2">
                {eventError && (
                  <ModalErrorBox isDark={isDark}>
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{eventError}
                  </ModalErrorBox>
                )}

                {eventModal.studentId ? (
                  <ModalFormField label="Μαθητής" isDark={isDark}>
                    <ModalFieldIcon icon={GraduationCap} isDark={isDark} />
                    <div className={`${inputCls} flex items-center`}>{studentById.get(eventModal.studentId)?.full_name ?? '—'}</div>
                  </ModalFormField>
                ) : (
                  <ModalFormField label="Τμήμα" isDark={isDark}>
                    <ModalFieldIcon icon={GraduationCap} isDark={isDark} />
                    <StyledSelect
                      isDark={isDark} className={selectCls}
                      value={eventModal.classId ?? ''}
                      onChange={(v) => handleProgramFieldChange('classId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                      options={[{ value: '', label: 'Επιλέξτε τμήμα' }, ...classes.map((c) => ({ value: c.id, label: c.title }))]}
                    />
                    <ModalSelectChevron isDark={isDark} />
                  </ModalFormField>
                )}

                <ModalFormField label="Μάθημα" isDark={isDark}>
                  <ModalFieldIcon icon={Layers} isDark={isDark} />
                  <StyledSelect
                    isDark={isDark} className={selectCls}
                    value={eventModal.subjectId ?? ''}
                    onChange={(v) => handleProgramFieldChange('subjectId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                    disabled={(!eventModal.classId && !eventModal.studentId) || programSubjectOptions.length === 0}
                    options={[
                      { value: '', label: programSubjectOptions.length === 0 ? 'Δεν υπάρχουν μαθήματα' : 'Επιλέξτε μάθημα' },
                      ...programSubjectOptions.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                  <ModalSelectChevron isDark={isDark} />
                </ModalFormField>

                {(() => {
                  const room = programItems.find((pi) => pi.id === eventModal.programItemId)?.room;
                  return room ? (
                    <ModalFormField label="Αίθουσα" isDark={isDark}>
                      <ModalFieldIcon icon={DoorOpen} isDark={isDark} />
                      <div className={`${inputCls} flex items-center`}>{room}</div>
                    </ModalFormField>
                  ) : null;
                })()}

                <ModalFormField label="Ημερομηνία" isDark={isDark}>
                  <AppDatePicker value={eventModal.date} onChange={(v) => setEventModal((p) => (p ? { ...p, date: v } : p))} placeholder="dd/mm/yyyy" variant="underline" />
                </ModalFormField>

                <div className="grid grid-cols-2 gap-3">
                  <ModalFormField label="Ώρα έναρξης" isDark={isDark}>
                    <TimePicker value={eventModal.startTime} onChange={(t) => setEventModal((p) => p ? { ...p, startTime: t } : p)} required />
                  </ModalFormField>
                  <ModalFormField label="Ώρα λήξης" isDark={isDark}>
                    <TimePicker value={eventModal.endTime} onChange={(t) => setEventModal((p) => p ? { ...p, endTime: t } : p)} required />
                  </ModalFormField>
                </div>

                {eventModal.studentId && (
                  <ModalFormField label="Χρέωση (€)" isDark={isDark}>
                    <ModalFieldIcon icon={Euro} isDark={isDark} />
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inputCls}
                      value={eventModal.chargeAmount}
                      onChange={(e) => { const v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''); setEventModal((p) => (p ? { ...p, chargeAmount: v } : p)); }}
                      placeholder="π.χ. 25 (προαιρετικό)"
                    />
                  </ModalFormField>
                )}

                {programModalIsHoliday && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-100">
                    <div>
                      <p className="font-semibold">{programModalHolidayName || 'Αργία'}</p>
                      <p className="opacity-80 mt-0.5">Θέλετε το μάθημα να γίνει παρόλο που είναι αργία;</p>
                    </div>
                    <label className="inline-flex items-center gap-2 shrink-0">
                      <input type="checkbox" checked={!!eventModal.activeDuringHoliday}
                        onChange={(e) => setEventModal((p) => p ? { ...p, activeDuringHoliday: e.target.checked } : p)} />
                      <span>Ενεργό</span>
                    </label>
                  </div>
                )}
              </div>

              <div className={`${modalFooterCls} flex-wrap`}>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleProgramAskDeleteForDay}
                    className="btn gap-1.5 bg-red-600/80 px-4 py-1.5 font-semibold text-white hover:bg-red-600 active:scale-[0.97]">
                    <Ban className="h-3.5 w-3.5" />Ακύρωση για αυτή τη μέρα
                  </button>
                  {eventModal.studentId && (
                    <button type="button" onClick={handleConvertSessionToTest} disabled={convertingSessionToTest}
                      title="Ακυρώνει το μάθημα αυτής της ημέρας και δημιουργεί διαγώνισμα στη θέση του"
                      className="btn-ghost gap-1.5 px-4 py-1.5 font-semibold">
                      {convertingSessionToTest ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Μετατροπή…</> : <><ArrowLeftRight className="h-3.5 w-3.5" />Μετατροπή σε διαγώνισμα</>}
                    </button>
                  )}
                </div>
                <button type="button" onClick={handleEventModalSave}
                  className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm active:scale-[0.97]">
                  <Check className="h-3.5 w-3.5" />Ενημέρωση
                </button>
              </div>
            </ModalShell>
          )}

          {/* Add extra (one-off) class modal */}
          {extraModal && (
            <ModalShell title="Έκτακτο μάθημα" subtitle="Προστίθεται μόνο για αυτή την ημερομηνία" icon={<BookOpen className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />} onClose={closeExtraModal} maxWidthClass="max-w-2xl">
              <div className="space-y-4 px-6 pb-2">
                {extraError && (
                  <ModalErrorBox isDark={isDark}>
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{extraError}
                  </ModalErrorBox>
                )}

                {isFrontistirio ? (
                  <ModalFormField label="Τμήμα" isDark={isDark}>
                    <ModalFieldIcon icon={GraduationCap} isDark={isDark} />
                    <StyledSelect
                      isDark={isDark} className={selectCls}
                      value={extraModal.classId ?? ''}
                      onChange={(v) => handleExtraFieldChange('classId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                      options={[{ value: '', label: 'Επιλέξτε τμήμα' }, ...classes.map((c) => ({ value: c.id, label: c.title }))]}
                    />
                    <ModalSelectChevron isDark={isDark} />
                  </ModalFormField>
                ) : (
                  <ModalFormField label="Μαθητές" isDark={isDark}>
                    <div className="space-y-2">
                      {extraModal.roster.length === 0 && (
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχουν προστεθεί μαθητές.</p>
                      )}
                      {extraModal.roster.map((r, idx) => (
                        <div key={r.studentId} className="flex items-center gap-2">
                          <span className={`w-4 shrink-0 text-right text-[11px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {idx + 1}
                          </span>
                          <span className={`flex-1 truncate text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                            {studentById.get(r.studentId)?.full_name ?? 'Μαθητής'}
                          </span>
                          <input
                            type="text" inputMode="decimal"
                            value={r.charge}
                            onChange={(e) => changeExtraRosterCharge(r.studentId, e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                            placeholder="€ (προαιρ.)"
                            className={`h-8 w-24 rounded-lg border px-2 text-xs outline-none transition ${
                              isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'
                            }`}
                          />
                          <button type="button" onClick={() => removeStudentFromExtraRoster(r.studentId)}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {extraAvailableStudents.length > 0 && (
                      <div className="relative mt-2.5">
                        <ModalFieldIcon icon={GraduationCap} isDark={isDark} />
                        <StyledSelect
                          isDark={isDark} className={selectCls}
                          value="" onChange={(v) => { if (v) addStudentToExtraRoster(v); }}
                          placeholder="Προσθήκη μαθητή…"
                          options={extraAvailableStudents.map((s) => ({ value: s.id, label: s.full_name ?? 'Μαθητής' }))}
                        />
                        <ModalSelectChevron isDark={isDark} />
                      </div>
                    )}
                  </ModalFormField>
                )}

                <ModalFormField label="Μάθημα" isDark={isDark}>
                  <ModalFieldIcon icon={Layers} isDark={isDark} />
                  <StyledSelect
                    isDark={isDark} className={selectCls}
                    value={extraModal.subjectId ?? ''}
                    onChange={(v) => handleExtraFieldChange('subjectId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                    disabled={isFrontistirio && (!extraModal.classId || extraSubjectOptions.length === 0)}
                    options={[
                      { value: '', label: isFrontistirio ? (extraSubjectOptions.length === 0 ? 'Δεν υπάρχουν μαθήματα' : 'Επιλέξτε μάθημα') : 'Επιλέξτε μάθημα (προαιρετικό)' },
                      ...extraSubjectOptions.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                  <ModalSelectChevron isDark={isDark} />
                </ModalFormField>

                <ModalFormField label="Ημερομηνία" isDark={isDark}>
                  <AppDatePicker value={extraModal.date} onChange={(v) => setExtraModal((p) => (p ? { ...p, date: v } : p))} placeholder="dd/mm/yyyy" variant="underline" />
                </ModalFormField>

                <div className="grid grid-cols-2 gap-3">
                  <ModalFormField label="Ώρα έναρξης" isDark={isDark}>
                    <TimePicker value={extraModal.startTime} onChange={(t) => setExtraModal((p) => p ? { ...p, startTime: t } : p)} required />
                  </ModalFormField>
                  <ModalFormField label="Ώρα λήξης" isDark={isDark}>
                    <TimePicker value={extraModal.endTime} onChange={(t) => setExtraModal((p) => p ? { ...p, endTime: t } : p)} required />
                  </ModalFormField>
                </div>

                {isFrontistirio && (
                  <ModalFormField label="Αίθουσα (προαιρετικό)" isDark={isDark}>
                    <ModalFieldIcon icon={DoorOpen} isDark={isDark} />
                    <input
                      type="text"
                      className={inputCls}
                      value={extraModal.room}
                      onChange={(e) => setExtraModal((p) => (p ? { ...p, room: e.target.value } : p))}
                      placeholder="π.χ. Αίθουσα 2"
                    />
                  </ModalFormField>
                )}
              </div>

              <div className={modalFooterCls}>
                <button type="button" onClick={closeExtraModal} disabled={savingExtra} className={`${cancelBtnCls} disabled:opacity-50`}>
                  Ακύρωση
                </button>
                <button type="button" onClick={handleSaveExtraClass} disabled={savingExtra}
                  className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm active:scale-[0.97] disabled:opacity-60">
                  {savingExtra ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Προσθήκη…</> : <><Check className="h-3.5 w-3.5" />Προσθήκη</>}
                </button>
              </div>
            </ModalShell>
          )}

          {/* Program delete confirm */}
          {eventModal && showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${
                isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white'
              }`}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
                  <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                    <CalendarDays className="h-5 w-5 text-red-400" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Ακύρωση μαθήματος</h3>
                </div>
                <div className="p-6">
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Θέλετε σίγουρα να ακυρώσετε το μάθημα μόνο για τη συγκεκριμένη ημερομηνία;</p>
                  <div className="mt-5 flex justify-end gap-2.5">
                    <button type="button" onClick={handleProgramCancelDeleteConfirm} className={`${cancelBtnCls} gap-1.5`}>
                      <X className="h-3.5 w-3.5" />Όχι
                    </button>
                    <button type="button" onClick={handleEventModalDeleteForDay}
                      className="btn gap-1.5 bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97]">
                      <Ban className="h-3.5 w-3.5" />Ναι, ακύρωση
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test edit modal */}
          {testModal && (
            <ModalShell title="Επεξεργασία διαγωνίσματος"
              icon={<span className="text-[10px] font-bold" style={{ color: 'var(--ch-icon)' }}>✎</span>}
              onClose={handleTestModalClose} maxWidthClass="max-w-2xl">
              <div className="space-y-4 px-6 pb-2">
                {testError && (
                  <ModalErrorBox isDark={isDark}>
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{testError}
                  </ModalErrorBox>
                )}

                {!testModal.classId && !testModal.levelId ? (
                  <ModalFormField label="Μαθητές" isDark={isDark}>
                    <div className={`flex w-full flex-col gap-1.5 rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700/70 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                      {testModalAssignmentsLoading ? (
                        <span className="text-xs opacity-70">Φόρτωση...</span>
                      ) : testModalAssignments.length === 0 ? (
                        <span className="text-xs opacity-70">—</span>
                      ) : (
                        testModalAssignments.map((a) => {
                          const isCharged = !!a.existingChargeId;
                          const isCharging = chargingTestStudentIds.has(a.studentId);
                          const isCancellingCharge = cancellingTestChargeIds.has(a.studentId);
                          return (
                            <div key={a.studentId} className="flex items-center gap-2 py-0.5">
                              <span className="min-w-0 flex-1 truncate text-xs">
                                {a.studentName}{a.subjectName ? ` · ${a.subjectName}` : ''}
                              </span>
                              {isCharged ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                                    style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                                    <Euro className="h-2.5 w-2.5" />{a.existingAmount?.toFixed(2)}
                                  </span>
                                  <button type="button" onClick={() => cancelTestModalCharge(a.studentId)} disabled={isCancellingCharge}
                                    title="Ακύρωση χρέωσης"
                                    className={`flex h-6 w-6 items-center justify-center rounded-md border transition disabled:opacity-40 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-500 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400' : 'border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:bg-red-50 hover:text-red-500'}`}>
                                    {isCancellingCharge ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-3 w-3" />}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex shrink-0 items-center gap-1">
                                  <input type="text" inputMode="decimal" placeholder="π.χ. 15"
                                    value={a.chargeAmount}
                                    onChange={(e) => updateTestModalChargeAmount(a.studentId, e.target.value)}
                                    className={`h-6 w-14 rounded-md border px-1.5 text-[11px] outline-none transition ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]'}`}
                                    disabled={isCharging}
                                  />
                                  <button type="button" onClick={() => chargeTestModalStudent(a.studentId)} disabled={isCharging || !a.chargeAmount.trim()}
                                    title="Χρέωση διαγωνίσματος"
                                    className={`flex h-6 w-6 items-center justify-center rounded-md border transition disabled:opacity-40 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-500 hover:border-[color:var(--color-accent)]/40 hover:bg-[color:var(--color-accent)]/10 hover:text-[color:var(--color-accent)]' : 'border-slate-200 bg-white text-slate-400 hover:border-[color:var(--color-accent)]/40 hover:bg-[color:var(--color-accent)]/10 hover:text-[color:var(--color-accent)]'}`}>
                                    {isCharging ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Euro className="h-3 w-3" />}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <button type="button" onClick={() => navigate('/program/tests')}
                      className="mt-1.5 text-[11px] underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>
                      Επεξεργασία μαθητών από τη σελίδα «Διαγωνίσματα»
                    </button>
                  </ModalFormField>
                ) : (
                  <>
                    {testModal.levelId !== null ? (
                      <ModalFormField label="Επίπεδο" isDark={isDark}>
                        <ModalFieldIcon icon={GraduationCap} isDark={isDark} />
                        <StyledSelect
                          isDark={isDark} className={selectCls}
                          value={testModal.levelId ?? ''}
                          onChange={(v) => handleTestFieldChange('levelId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                          options={[{ value: '', label: 'Επιλέξτε επίπεδο' }, ...levels.map((l) => ({ value: l.id, label: l.name }))]}
                        />
                        <ModalSelectChevron isDark={isDark} />
                      </ModalFormField>
                    ) : (
                      <ModalFormField label="Τμήμα" isDark={isDark}>
                        <ModalFieldIcon icon={GraduationCap} isDark={isDark} />
                        <StyledSelect
                          isDark={isDark} className={selectCls}
                          value={testModal.classId ?? ''}
                          onChange={(v) => handleTestFieldChange('classId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                          options={[{ value: '', label: 'Επιλέξτε τμήμα' }, ...classes.map((c) => ({ value: c.id, label: c.title }))]}
                        />
                        <ModalSelectChevron isDark={isDark} />
                      </ModalFormField>
                    )}

                    <ModalFormField label="Μάθημα" isDark={isDark}>
                      <ModalFieldIcon icon={Layers} isDark={isDark} />
                      <StyledSelect
                        isDark={isDark} className={selectCls}
                        value={testModal.subjectId ?? ''}
                        onChange={(v) => handleTestFieldChange('subjectId')({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>)}
                        disabled={(!testModal.classId && !testModal.levelId) || testSubjectOptions.length === 0}
                        options={[
                          { value: '', label: testSubjectOptions.length === 0 ? 'Δεν υπάρχουν μαθήματα' : 'Επιλέξτε μάθημα' },
                          ...testSubjectOptions.map((s) => ({ value: s.id, label: s.name })),
                        ]}
                      />
                      <ModalSelectChevron isDark={isDark} />
                    </ModalFormField>
                  </>
                )}

                <ModalFormField label="Ημερομηνία" isDark={isDark}>
                  <AppDatePicker value={testModal.date} onChange={(v) => setTestModal((p) => (p ? { ...p, date: v } : p))} placeholder="dd/mm/yyyy" variant="underline" />
                </ModalFormField>

                <div className="grid grid-cols-2 gap-3">
                  <ModalFormField label="Ώρα έναρξης" isDark={isDark}>
                    <TimePicker value={testModal.startTime} onChange={(t) => setTestModal((p) => p ? { ...p, startTime: t } : p)} required />
                  </ModalFormField>
                  <ModalFormField label="Ώρα λήξης" isDark={isDark}>
                    <TimePicker value={testModal.endTime} onChange={(t) => setTestModal((p) => p ? { ...p, endTime: t } : p)} required />
                  </ModalFormField>
                </div>

                {testModalIsHoliday && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-100">
                    <div>
                      <p className="font-semibold">{testModalHolidayName || 'Αργία'}</p>
                      <p className="opacity-80 mt-0.5">Θέλετε το διαγώνισμα να γίνει παρόλο που είναι αργία;</p>
                    </div>
                    <label className="inline-flex items-center gap-2 shrink-0">
                      <input type="checkbox" checked={!!testModal.activeDuringHoliday}
                        onChange={(e) => setTestModal((p) => p ? { ...p, activeDuringHoliday: e.target.checked } : p)} />
                      <span>Ενεργό</span>
                    </label>
                  </div>
                )}
              </div>

              <div className={`${modalFooterCls} flex-wrap`}>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleTestCancelForDay} disabled={savingTest}
                    className="btn gap-1.5 bg-red-600/80 px-4 py-1.5 font-semibold text-white hover:bg-red-600 active:scale-[0.97] disabled:opacity-50">
                    <Ban className="h-3.5 w-3.5" />Ακύρωση για αυτή τη μέρα
                  </button>
                  {!testModal.classId && !testModal.levelId && testConvertTarget && (
                    <button type="button" onClick={() => setShowConvertTestConfirm(true)} disabled={savingTest}
                      title="Διαγράφει το διαγώνισμα και επαναφέρει το τακτικό μάθημα αυτής της ημέρας"
                      className="btn-ghost gap-1.5 px-4 py-1.5 font-semibold">
                      <ArrowLeftRight className="h-3.5 w-3.5" />Μετατροπή σε μάθημα
                    </button>
                  )}
                </div>
                <button type="button" onClick={handleTestModalSave} disabled={savingTest}
                  className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm active:scale-[0.97]">
                  {savingTest ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Αποθήκευση…</> : <><Check className="h-3.5 w-3.5" />Ενημέρωση</>}
                </button>
              </div>
            </ModalShell>
          )}

          {/* Convert test → session confirm */}
          {testModal && showConvertTestConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${
                isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white'
              }`}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
                  <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                    <BookOpen className="h-5 w-5 text-red-400" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Μετατροπή σε μάθημα</h3>
                </div>
                <div className="p-6">
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Το διαγώνισμα θα διαγραφεί μαζί με τυχόν βαθμούς του. Τυχόν χρεώσεις που έχουν ήδη γίνει θα παραμείνουν στον λογαριασμό του μαθητή. Το τακτικό μάθημα αυτής της ημέρας θα επανέλθει.
                  </p>
                  <div className="mt-5 flex justify-end gap-2.5">
                    <button type="button" onClick={() => setShowConvertTestConfirm(false)} disabled={convertingTestToSession} className={`${cancelBtnCls} gap-1.5 disabled:opacity-50`}>
                      <X className="h-3.5 w-3.5" />Ακύρωση
                    </button>
                    <button type="button" onClick={handleConvertTestToSession} disabled={convertingTestToSession}
                      className="btn gap-1.5 bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
                      {convertingTestToSession ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Μετατροπή…</> : <><ArrowLeftRight className="h-3.5 w-3.5" />Ναι, μετατροπή</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}