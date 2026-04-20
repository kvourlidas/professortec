// src/components/dashboard/DashboardCalendarSection.tsx

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';

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
import elLocale from '@fullcalendar/core/locales/el';

import AppDatePicker from '../ui/AppDatePicker';
import TimePicker from '../ui/TimePicker';
import EventFormModal, {
  type EventFormState,
  type SchoolEventForEdit,
} from '../events/EventFormModal';
import { CalendarDays, Clock, BookOpen, GraduationCap, X, Loader2, Layers } from 'lucide-react';

/* ------------ Types (unchanged) ------------ */

type ClassRow = {
  id: string; school_id: string; title: string;
  subject: string | null; subject_id: string | null; tutor_id: string | null;
};
type TutorRow = { id: string; full_name: string | null };
type ProgramRow = { id: string; school_id: string; name: string; description: string | null };
type ProgramItemRow = {
  id: string; program_id: string; class_id: string; day_of_week: string;
  position: number | null; start_time: string | null; end_time: string | null;
  start_date: string | null; end_date: string | null; subject_id: string | null; tutor_id: string | null;
};
type ProgramItemOverrideRow = {
  id: string; program_item_id: string; override_date: string | null;
  start_time: string | null; end_time: string | null; is_deleted: boolean | null;
  is_inactive: boolean | null; holiday_active_override: boolean | null;
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
  id: string; school_id: string; class_id: string; subject_id: string;
  test_date: string; start_time: string | null; end_time: string | null;
  title: string | null; description: string | null; active_during_holiday: boolean | null;
};
type CalendarEventModal = {
  programItemId: string; originalDateStr: string; date: string;
  startTime: string; endTime: string;
  classId: string | null; subjectId: string | null; overrideId?: string; activeDuringHoliday: boolean;
};
type TestModalState = {
  testId: string; classId: string | null; subjectId: string | null; date: string;
  startTime: string; endTime: string;
  title: string; activeDuringHoliday: boolean;
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

function getNextDateForDow(from: Date, dow: number): Date {
  const d = new Date(from);
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/* ------------ Component ------------ */

type DashboardCalendarSectionProps = { schoolId: string | null };

export default function DashboardCalendarSection({ schoolId }: DashboardCalendarSectionProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Dynamic classes based on theme
  const inputCls = `h-9 w-full rounded-lg border px-3 text-sm outline-none transition disabled:opacity-60 ${
    isDark
      ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
      : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
  }`;
  const selectCls = inputCls;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
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
  const [subjectTutorLinks, setSubjectTutorLinks] = useState<SubjectTutorLinkRow[]>([]);

  const [eventModal, setEventModal] = useState<CalendarEventModal | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testModal, setTestModal] = useState<TestModalState | null>(null);
  const [savingTest, setSavingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

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
    supabase.from('tutors').select('id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true })
      .then(({ data, error }) => { if (error) { console.error(error); setTutors([]); } else { setTutors((data ?? []) as TutorRow[]); } });
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
    if (!schoolId) { setSubjects([]); setClassSubjects([]); setTests([]); setSubjectTutorLinks([]); return; }
    const loadExtra = async () => {
      try {
        const [{ data: subjData, error: subjErr }, { data: classSubjData, error: classSubjErr }, { data: testsData, error: testsErr }, { data: stData, error: stErr }] = await Promise.all([
          supabase.from('subjects').select('id, school_id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('class_subjects').select('class_id, subject_id, school_id').eq('school_id', schoolId),
          supabase.from('tests').select('id, school_id, class_id, subject_id, test_date, start_time, end_time, title, description, active_during_holiday').eq('school_id', schoolId).order('test_date', { ascending: true }),
          supabase.from('subject_tutors').select('subject_id, tutor_id, school_id').eq('school_id', schoolId),
        ]);
        if (subjErr) { console.error(subjErr); setSubjects([]); } else { setSubjects((subjData ?? []) as SubjectRow[]); }
        if (classSubjErr) { console.error(classSubjErr); setClassSubjects([]); } else { setClassSubjects((classSubjData ?? []) as ClassSubjectRow[]); }
        if (testsErr) { console.error(testsErr); setTests([]); } else { setTests((testsData ?? []) as TestRow[]); }
        if (stErr) { console.error(stErr); setSubjectTutorLinks([]); } else { setSubjectTutorLinks((stData ?? []) as SubjectTutorLinkRow[]); }
      } catch (e) { console.error(e); setSubjects([]); setClassSubjects([]); setTests([]); }
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
    const programItemMap = new Map<string, ProgramItemRow>();
    programItems.forEach((pi) => programItemMap.set(pi.id, pi));
    const overrideMap = new Map<string, ProgramItemOverrideRow>();
    overrides.forEach((ov) => { if (!ov.override_date) return; const key = `${ov.program_item_id}-${ov.override_date}`; overrideMap.set(key, ov); });
    const usedOverrideIds = new Set<string>();
    const testsByKey = new Map<string, TestRow[]>();
    tests.forEach((t) => { const key = `${t.class_id}-${t.test_date}`; const arr = testsByKey.get(key) ?? []; arr.push(t); testsByKey.set(key, arr); });
    const hideStandaloneTestKeys = new Set<string>();
    const inactiveColors = isDark
      ? { backgroundColor: 'rgba(148, 163, 184, 0.18)', borderColor: 'rgba(148, 163, 184, 0.45)', textColor: '#e2e8f0' }
      : { backgroundColor: 'rgba(100, 116, 139, 0.12)', borderColor: 'rgba(100, 116, 139, 0.35)', textColor: '#475569' };

    programItems.forEach((item) => {
      const cls = classMap.get(item.class_id);
      if (!cls || !item.day_of_week || !item.start_time || !item.end_time) return;
      const dow = WEEKDAY_TO_INDEX[item.day_of_week];
      if (dow === undefined) return;
      const patternStartDate = item.start_date ? new Date(item.start_date + 'T00:00:00') : new Date('1970-01-01T00:00:00');
      const patternEndDate = item.end_date ? new Date(item.end_date + 'T23:59:59') : new Date('2999-12-31T23:59:59');
      const effectiveStart = patternStartDate > viewStart ? patternStartDate : viewStart;
      const effectiveEnd = patternEndDate < viewEnd ? patternEndDate : viewEnd;
      if (effectiveStart > effectiveEnd) return;
      let currentDate = getNextDateForDow(effectiveStart, dow);
      const subjectIdForSlot = item.subject_id ?? cls.subject_id ?? null;
      const tutorName = (item.tutor_id && tutorMap[item.tutor_id]) || getTutorNameForSubject(subjectIdForSlot) || (cls.tutor_id && tutorMap[cls.tutor_id]) || null;
      while (currentDate <= effectiveEnd) {
        const dateStr = formatLocalYMD(currentDate);
        const next = new Date(currentDate); next.setDate(next.getDate() + 7);
        const isHoliday = holidayDateSet.has(dateStr);
        const holidayName = holidayNameByDate.get(dateStr) ?? null;
        const key = `${item.class_id}-${dateStr}`;
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
          const testsForClassDate = testsByKey.get(key) ?? [];
          const shouldCombineTest = !isHoliday && testsForClassDate.length > 0;
          const combinedTest = shouldCombineTest ? testsForClassDate[0] : null;
          const titleBase = cls.title;
          const title = combinedTest ? `${titleBase} · Διαγώνισμα` : titleBase;
          if (combinedTest) hideStandaloneTestKeys.add(key);
          out.push({ id: `${item.id}-${dateStr}`, title, start, end, editable: !isInactive, startEditable: !isInactive, durationEditable: !isInactive, ...(isInactive ? inactiveColors : {}), extendedProps: { kind: 'program', programItemId: item.id, classId: cls.id, subjectId: item.subject_id ?? null, subject: (item.subject_id ? subjectById.get(item.subject_id)?.name : null) ?? cls.subject ?? null, tutorName, overrideDate: dateStr, overrideId, isHoliday, holidayName, isInactive, activeDuringHoliday, testId: combinedTest?.id ?? null, testSubjectId: combinedTest?.subject_id ?? null } });
        }
        currentDate = next;
      }
    });

    overrides.forEach((ov) => {
      if (!ov.override_date || ov.is_deleted || usedOverrideIds.has(ov.id)) return;
      const item = programItemMap.get(ov.program_item_id);
      if (!item) return;
      const cls = classMap.get(item.class_id);
      if (!cls) return;
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
      const subjectIdForSlot = item.subject_id ?? cls.subject_id ?? null;
      const tutorName = (item.tutor_id && tutorMap[item.tutor_id]) || getTutorNameForSubject(subjectIdForSlot) || (cls.tutor_id && tutorMap[cls.tutor_id]) || null;
      const key = `${item.class_id}-${dateStr}`;
      const testsForClassDate = testsByKey.get(key) ?? [];
      const shouldCombineTest = !isHoliday && testsForClassDate.length > 0;
      const combinedTest = shouldCombineTest ? testsForClassDate[0] : null;
      const titleBase = cls.title;
      const title = combinedTest ? `${titleBase} · Διαγώνισμα` : titleBase;
      if (combinedTest) hideStandaloneTestKeys.add(key);
      out.push({ id: `${item.id}-${dateStr}-override`, title, start, end, editable: !isInactive, startEditable: !isInactive, durationEditable: !isInactive, ...(isInactive ? inactiveColors : {}), extendedProps: { kind: 'program', programItemId: item.id, classId: cls.id, subjectId: item.subject_id ?? null, subject: (item.subject_id ? subjectById.get(item.subject_id)?.name : null) ?? cls.subject ?? null, tutorName, overrideDate: dateStr, overrideId: ov.id, isHoliday, holidayName, isInactive, activeDuringHoliday, testId: combinedTest?.id ?? null, testSubjectId: combinedTest?.subject_id ?? null } });
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
      const cls = classMap.get(t.class_id);
      const subj = subjectById.get(t.subject_id);
      const baseStart = t.start_time ?? '09:00'; const baseEnd = t.end_time ?? '10:00';
      const [sH, sM] = baseStart.split(':').map(Number); const [eH, eM] = baseEnd.split(':').map(Number);
      const start = new Date(dateObj); start.setHours(sH, sM, 0, 0);
      const end = new Date(dateObj); end.setHours(eH, eM, 0, 0);
      const titleParts: string[] = [];
      if (cls?.title) titleParts.push(cls.title);
      if (subj?.name) titleParts.push(subj.name);
      if (t.title) titleParts.push(t.title);
      const label = titleParts.length > 0 ? `Διαγώνισμα · ${titleParts.join(' · ')}` : 'Διαγώνισμα';
      out.push({ id: `test-${t.id}`, title: label, start, end, editable: !isInactive, startEditable: !isInactive, durationEditable: !isInactive, ...(isInactive ? inactiveColors : {}), extendedProps: { kind: 'test', testId: t.id, classId: t.class_id, subjectId: t.subject_id, isHoliday, holidayName, isInactive, activeDuringHoliday } });
    });

    schoolEvents.forEach((ev) => {
      const start = new Date(ev.date + 'T' + ev.start_time);
      const end = new Date(ev.date + 'T' + ev.end_time);
      if (start < viewStart || start > viewEnd) return;
      if (holidayDateSet.has(ev.date)) return;
      out.push({ id: `event-${ev.id}`, title: ev.name, start, end, editable: true, startEditable: true, durationEditable: true, extendedProps: { kind: 'schoolEvent', eventId: ev.id, description: ev.description } });
    });

    return out;
  }, [viewRange, programItems, classes, tutors, subjectTutorLinks, overrides, holidays, holidayDateSet, holidayNameByDate, schoolEvents, tests, subjects, subjectById, isDark]);

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
      if (oldDateStr === newDateStr) {
        const result = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: newDateStr, start_time: newStartTimeDb, end_time: newEndTimeDb, is_deleted: false, is_inactive: false, holiday_active_override: movedToHoliday });
        setOverrides((prev) => applyOverride(prev, newDateStr, result.item as ProgramItemOverrideRow));
      } else {
        const oldResult = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: oldDateStr, start_time: null, end_time: null, is_deleted: true, is_inactive: false, holiday_active_override: false });
        setOverrides((prev) => applyOverride(prev, oldDateStr, oldResult.item as ProgramItemOverrideRow));
        const newResult = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: newDateStr, start_time: newStartTimeDb, end_time: newEndTimeDb, is_deleted: false, is_inactive: false, holiday_active_override: movedToHoliday });
        setOverrides((prev) => applyOverride(prev, newDateStr, newResult.item as ProgramItemOverrideRow));
      }
    } catch (err) { console.error(err); revert(); }
  };

  /* -------- Render event content -------- */
  const renderEventContent = (arg: EventContentArg) => {
    const { event } = arg;
    const kind = event.extendedProps['kind'] as string | undefined;
    const subject = event.extendedProps['subject'] as string | null;
    const tutorName = event.extendedProps['tutorName'] as string | null;
    const isInactive = !!event.extendedProps['isInactive'];
    const isHoliday = !!event.extendedProps['isHoliday'];
    const holidayName = (event.extendedProps['holidayName'] as string | null) ?? null;
    const start = event.start; const end = event.end;
    const formatter = new Intl.DateTimeFormat('el-GR', { hour: '2-digit', minute: '2-digit' });
    let timeRange = '';
    if (start && end) timeRange = `${formatter.format(start)} – ${formatter.format(end)}`;
    else if (start) timeRange = formatter.format(start);
    const hasTest = kind === 'test' || !!event.extendedProps['testId'];
    const rawTitle = event.title ?? '';
    let mainTitle = rawTitle;
    if (hasTest) {
      if (/^Διαγώνισμα\s*·/u.test(rawTitle)) mainTitle = rawTitle.replace(/^Διαγώνισμα\s*·\s*/u, '').trim();
      else if (/\s*·\s*Διαγώνισμα\s*$/u.test(rawTitle)) mainTitle = rawTitle.replace(/\s*·\s*Διαγώνισμα\s*$/u, '').trim();
    }

    const timeColor = isDark ? '#ffc947' : '#b45309';

    return (
      <div className="flex flex-col gap-0.5 text-[11px] leading-tight">
        {timeRange && (
          <div className="font-semibold text-[12px]" style={{ color: timeColor }}>{timeRange}</div>
        )}
        {isHoliday && (
          <span className={`inline-flex w-fit items-center rounded-full border px-1.5 py-[1px] text-[9px] font-semibold ${
            isInactive
              ? isDark ? 'border-slate-400/50 bg-slate-500/10 text-slate-300' : 'border-slate-300/50 bg-slate-200/40 text-slate-500'
              : 'border-emerald-400/50 bg-emerald-500/10 text-emerald-600'
          }`}>
            {holidayName || 'Αργία'}
          </span>
        )}
        {!isHoliday && isInactive && (
          <span className={`inline-flex w-fit items-center rounded-full border px-1.5 py-[1px] text-[9px] font-semibold ${
            isDark ? 'border-slate-400/50 bg-slate-500/10 text-slate-300' : 'border-slate-300/60 bg-slate-100 text-slate-500'
          }`}>
            Ανενεργό
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {hasTest && (
            <span className="inline-flex items-center rounded-full border border-red-500/60 bg-gradient-to-r from-red-500/30 via-red-600/30 to-red-700/30 px-1.5 py-[1px] text-[9px] font-semibold text-red-100 shadow-sm">
              Διαγώνισμα
            </span>
          )}
          {mainTitle && <span className="font-semibold">{mainTitle}</span>}
        </div>
        {kind === 'program' && subject && <div className="text-[10px] opacity-80">{subject}</div>}
        {kind === 'program' && tutorName && <div className="text-[10px] opacity-70">{tutorName}</div>}
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
  const openTestModalFromEvent = (event: any) => {
    const testId = event.extendedProps['testId'] as string | null | undefined;
    if (!testId || !event.start || !event.end) return;
    const testRow = tests.find((t) => t.id === testId) ?? null;
    const classId = (event.extendedProps['classId'] as string | undefined) ?? testRow?.class_id ?? null;
    const subjectId = (event.extendedProps['subjectId'] as string | undefined) ?? (event.extendedProps['testSubjectId'] as string | undefined) ?? testRow?.subject_id ?? null;
    const dateIso = formatLocalYMD(event.start);
    const isHoliday = holidayDateSet.has(dateIso);
    const start24 = `${pad2(event.start.getHours())}:${pad2(event.start.getMinutes())}`;
    const end24 = `${pad2(event.end.getHours())}:${pad2(event.end.getMinutes())}`;
    setTestError(null);
    setTestModal({ testId, classId, subjectId, date: formatDateDisplay(dateIso), startTime: start24, endTime: end24, title: testRow?.title ?? '', activeDuringHoliday: isHoliday ? !!testRow?.active_during_holiday : false });
    setShowDeleteConfirm(false); setEventModal(null);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const { event } = arg;
    const kind = event.extendedProps['kind'] as 'program' | 'schoolEvent' | 'test' | undefined;
    if (!event.start || !event.end) return;
    setEventModal(null); setTestModal(null); setShowDeleteConfirm(false); setEventError(null); setTestError(null);
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
      const prefilledSubjectId = (event.extendedProps['subjectId'] as string | null | undefined) ?? null;
      setEventModal({ programItemId, originalDateStr: dateIso, date: formatDateDisplay(dateIso), startTime: start24, endTime: end24, classId: classIdProp ?? null, subjectId: prefilledSubjectId, overrideId: overrideId ?? undefined, activeDuringHoliday: !!event.extendedProps['activeDuringHoliday'] });
      setShowDeleteConfirm(false);
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
    const { programItemId, originalDateStr, date, startTime, endTime, classId, subjectId, activeDuringHoliday } = eventModal;
    if (!classId) { setEventError('Επιλέξτε τμήμα.'); return; }
    const subjectOptions = getSubjectsForClass(classId);
    if (subjectOptions.length > 0 && !subjectId) { setEventError('Επιλέξτε μάθημα για το τμήμα.'); return; }
    if (!date) { setEventError('Επιλέξτε ημερομηνία μαθήματος.'); return; }
    const newDateStr = parseDateDisplayToISO(date);
    if (!newDateStr) { setEventError('Μη έγκυρη ημερομηνία (π.χ. 12/05/2025).'); return; }
    if (!startTime || !endTime) { setEventError('Συμπληρώστε σωστά τις ώρες.'); return; }
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
        const result = await callEdgeFunction('program-update', { program_item_id: item.id, class_id: classId, subject_id: item.subject_id ?? null, tutor_id: item.tutor_id ?? null, day_of_week: item.day_of_week, start_time: item.start_time, end_time: item.end_time, start_date: item.start_date, end_date: item.end_date });
        currentItem = result.item as ProgramItemRow;
        setProgramItems((prev) => prev.map((pi) => (pi.id === programItemId ? currentItem! : pi)));
      }
      const finalSubjectId = subjectId ?? null;
      if (currentItem && finalSubjectId !== (currentItem.subject_id ?? null)) {
        const result = await callEdgeFunction('program-update', { program_item_id: currentItem.id, class_id: currentItem.class_id, subject_id: finalSubjectId, tutor_id: currentItem.tutor_id ?? null, day_of_week: currentItem.day_of_week, start_time: currentItem.start_time, end_time: currentItem.end_time, start_date: currentItem.start_date, end_date: currentItem.end_date });
        currentItem = result.item as ProgramItemRow;
        setProgramItems((prev) => prev.map((pi) => (pi.id === programItemId ? currentItem! : pi)));
      }
      const upsertOverrideForDate = async (targetDate: string) => {
        const result = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: targetDate, start_time: startTimeDb, end_time: endTimeDb, is_deleted: false, is_inactive: false, holiday_active_override: holidayDateSet.has(targetDate) ? finalHolidayActiveOverride : false });
        setOverrides((prev) => applyOverride(prev, targetDate, result.item as ProgramItemOverrideRow));
      };
      if (newDateStr === originalDateStr) { await upsertOverrideForDate(newDateStr); }
      else {
        const oldResult = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: originalDateStr, start_time: null, end_time: null, is_deleted: true, is_inactive: false, holiday_active_override: false });
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
      const result = await callEdgeFunction('program-item-override-upsert', { program_item_id: programItemId, override_date: originalDateStr, start_time: null, end_time: null, is_deleted: true, is_inactive: false, holiday_active_override: false });
      const upserted = result.item as ProgramItemOverrideRow;
      setOverrides((prev) => {
        const existing = prev.find((o) => o.program_item_id === programItemId && o.override_date === originalDateStr);
        if (existing) return prev.map((o) => (o.id === existing.id ? upserted : o));
        return [...prev, upserted];
      });
      setEventModal(null); setShowDeleteConfirm(false);
    } catch (err) { console.error(err); setEventError('Αποτυχία διαγραφής. Προσπαθήστε ξανά.'); }
  };

  const handleDatesSet = (arg: DatesSetArg) => { setCalendarView(arg.view.type); setViewRange({ start: arg.start, end: arg.end }); };

  /* -------- Test modal handlers (unchanged) -------- */
  const handleTestFieldChange = (field: keyof TestModalState) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value;
    setTestModal((prev) => {
      if (!prev) return prev;
      if (field === 'classId') return { ...prev, classId: value || null, subjectId: null };
      if (field === 'subjectId') return { ...prev, subjectId: value || null };
      return { ...prev, [field]: value as any };
    });
  };


  const handleTestModalSave = async () => {
    if (!testModal) return;
    const { testId, classId, subjectId, date, startTime, endTime, title, activeDuringHoliday } = testModal;
    if (!classId) { setTestError('Επιλέξτε τμήμα.'); return; }
    const subjectOptions = getSubjectsForClass(classId);
    if (subjectOptions.length > 0 && !subjectId) { setTestError('Επιλέξτε μάθημα για το τμήμα.'); return; }
    if (!date) { setTestError('Επιλέξτε ημερομηνία διαγωνίσματος.'); return; }
    const testDateISO = parseDateDisplayToISO(date);
    if (!testDateISO) { setTestError('Μη έγκυρη ημερομηνία (π.χ. 12/05/2025).'); return; }
    if (!startTime || !endTime) { setTestError('Συμπληρώστε σωστά τις ώρες.'); return; }
    const isHoliday = holidayDateSet.has(testDateISO);
    const finalActiveDuringHoliday = isHoliday ? !!activeDuringHoliday : false;
    setSavingTest(true); setTestError(null);
    try {
      const result = await callEdgeFunction('tests-update', { test_id: testId, class_id: classId, subject_id: subjectId ?? subjectOptions[0]?.id ?? null, test_date: testDateISO, start_time: `${startTime}:00`, end_time: `${endTime}:00`, title: title || null, active_during_holiday: finalActiveDuringHoliday });
      setTests((prev) => prev.map((t) => (t.id === testId ? (result.item as TestRow) : t)));
      setTestModal(null);
    } catch (err) { console.error(err); setTestError('Αποτυχία ενημέρωσης διαγωνίσματος.'); }
    finally { setSavingTest(false); }
  };

  const handleTestModalClose = () => { if (savingTest) return; setTestModal(null); setTestError(null); setShowDeleteConfirm(false); };

  const handleTestDelete = async () => {
    if (!testModal) return;
    try {
      setTestError(null);
      await callEdgeFunction('tests-delete', { test_id: testModal.testId });
      setTests((prev) => prev.filter((t) => t.id !== testModal.testId));
      setTestModal(null); setShowDeleteConfirm(false);
    } catch (err) { console.error(err); setTestError('Αποτυχία διαγραφής διαγωνίσματος. Προσπαθήστε ξανά.'); setShowDeleteConfirm(false); }
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
      const result = await callEdgeFunction('tests-update', { test_id: test.id, class_id: test.class_id, subject_id: test.subject_id ?? null, test_date: test.test_date, start_time: test.start_time, end_time: test.end_time, title: test.title ?? null, active_during_holiday: false });
      setSavingTest(false);
      setTests((prev) => prev.map((t) => (t.id === test.id ? (result.item as TestRow) : t)));
      setTestModal(null); setShowDeleteConfirm(false);
    } catch (e) { console.error(e); setSavingTest(false); setTestError('Αποτυχία ακύρωσης για τη μέρα.'); }
  };

  const programModalIsHoliday = useMemo(() => { if (!eventModal) return false; const iso = parseDateDisplayToISO(eventModal.date); if (!iso) return false; return holidayDateSet.has(iso); }, [eventModal, holidayDateSet]);
  const programModalHolidayName = useMemo(() => { if (!eventModal) return null; const iso = parseDateDisplayToISO(eventModal.date); if (!iso) return null; return holidayNameByDate.get(iso) ?? null; }, [eventModal, holidayNameByDate]);
  const testModalIsHoliday = useMemo(() => { if (!testModal) return false; const iso = parseDateDisplayToISO(testModal.date); if (!iso) return false; return holidayDateSet.has(iso); }, [testModal, holidayDateSet]);
  const testModalHolidayName = useMemo(() => { if (!testModal) return null; const iso = parseDateDisplayToISO(testModal.date); if (!iso) return null; return holidayNameByDate.get(iso) ?? null; }, [testModal, holidayNameByDate]);

  const programSubjectOptions = useMemo(() => { if (!eventModal?.classId) return []; return getSubjectsForClass(eventModal.classId); }, [eventModal?.classId, classes, classSubjects, subjects, subjectById]);
  const testSubjectOptions = useMemo(() => { if (!testModal?.classId) return []; return getSubjectsForClass(testModal.classId); }, [testModal?.classId, classes, classSubjects, subjects, subjectById]);

  // const requestDeleteSchoolEventFromModal = () => { if (!schoolEventEditing) return; setSchoolEventDeleteTarget({ id: schoolEventEditing.id, name: schoolEventEditing.name }); };

  /* -------- Shared form components -------- */
  function FormField({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
      <div className="space-y-1.5">
        <label className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {icon && <span className="opacity-70">{icon}</span>}
          {label}
        </label>
        {children}
      </div>
    );
  }

  /* -------- Shared modal shell -------- */
  const ModalShell = ({ title, subtitle, icon, onClose, children, accentBar = true }: {
    title: string; subtitle?: string; icon?: React.ReactNode;
    onClose: () => void; children: React.ReactNode; accentBar?: boolean;
  }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${
        isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white'
      }`}>
        {accentBar && <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                {icon}
              </div>
            )}
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{title}</h3>
              {subtitle && <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
              isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300 hover:text-slate-600'
            }`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );


  /* ---- Modal footer helpers ---- */
  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60';
  const modalFooterCls = `flex items-center justify-between gap-2 border-t px-6 py-4 mt-4 ${
    isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'
  }`;
  const errorBannerCls = `flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
    isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'
  }`;

  /* -------- Return -------- */
  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
          <CalendarDays className="h-4 w-4" style= {{ color: 'var(--color-input-bg)'}}/>
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
            <div className="p-3">
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
                events={events}
                editable={true}
                eventStartEditable={true}
                eventDurationEditable={true}
                eventDrop={handleEventDrop}
                droppable={false}
                eventContent={renderEventContent}
                datesSet={handleDatesSet}
                eventClick={handleEventClick}
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
            <ModalShell title="Διαγραφή εκδήλωσης" onClose={() => { if (!schoolEventDeleting) setSchoolEventDeleteTarget(null); }} accentBar={false}>
              <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500 -mt-0.5" />
              <div className="px-6 pb-6">
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
            <ModalShell title="Επεξεργασία μαθήματος" icon={<BookOpen className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />} onClose={handleEventModalClose}>
              <div className="space-y-4 px-6 pb-2">
                {eventError && <div className={errorBannerCls}><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{eventError}</div>}

                <FormField label="Τμήμα" icon={<GraduationCap className="h-3 w-3" />}>
                  <select value={eventModal.classId ?? ''} onChange={handleProgramFieldChange('classId')} className={selectCls}>
                    <option value="">Επιλέξτε τμήμα</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </FormField>

                <FormField label="Μάθημα" icon={<Layers className="h-3 w-3" />}>
                  <select value={eventModal.subjectId ?? ''} onChange={handleProgramFieldChange('subjectId')} className={selectCls} disabled={!eventModal.classId || programSubjectOptions.length === 0}>
                    <option value="">{programSubjectOptions.length === 0 ? 'Δεν υπάρχουν μαθήματα' : 'Επιλέξτε μάθημα'}</option>
                    {programSubjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormField>

                <FormField label="Ημερομηνία" icon={<CalendarDays className="h-3 w-3" />}>
                  <AppDatePicker value={eventModal.date} onChange={(v) => setEventModal((p) => (p ? { ...p, date: v } : p))} placeholder="dd/mm/yyyy" />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Ώρα έναρξης" icon={<Clock className="h-3 w-3" />}>
                    <TimePicker value={eventModal.startTime} onChange={(t) => setEventModal((p) => p ? { ...p, startTime: t } : p)} required />
                  </FormField>
                  <FormField label="Ώρα λήξης" icon={<Clock className="h-3 w-3" />}>
                    <TimePicker value={eventModal.endTime} onChange={(t) => setEventModal((p) => p ? { ...p, endTime: t } : p)} required />
                  </FormField>
                </div>

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

              <div className={modalFooterCls}>
                <button type="button" onClick={handleProgramAskDeleteForDay}
                  className="btn bg-red-600/80 px-3 py-1.5 font-semibold text-white hover:bg-red-600 active:scale-[0.97]">
                  Ακύρωση για αυτή τη μέρα
                </button>
                <div className="flex gap-2.5">
                  <button type="button" onClick={handleEventModalSave}
                    className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97]">
                    Ενημέρωση
                  </button>
                </div>
              </div>
            </ModalShell>
          )}

          {/* Program delete confirm */}
          {eventModal && showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${
                isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white'
              }`}>
                <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
                <div className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                    <CalendarDays className="h-5 w-5 text-red-400" />
                  </div>
                  <h3 className={`mb-1 text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Ακύρωση μαθήματος</h3>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Θέλετε σίγουρα να ακυρώσετε το μάθημα μόνο για τη συγκεκριμένη ημερομηνία;</p>
                  <div className="mt-5 flex justify-end gap-2.5">
                    <button type="button" onClick={handleProgramCancelDeleteConfirm} className={cancelBtnCls}>Όχι</button>
                    <button type="button" onClick={handleEventModalDeleteForDay}
                      className="btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97]">
                      Ναι, ακύρωση
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test edit modal */}
          {testModal && (
            <ModalShell title="Επεξεργασία διαγωνίσματος"
              icon={<span className="text-[10px] font-bold" style={{ color: 'var(--color-accent)' }}>✎</span>}
              onClose={handleTestModalClose}>
              <div className="space-y-4 px-6 pb-2">
                {testError && <div className={errorBannerCls}><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{testError}</div>}

                <FormField label="Τμήμα" icon={<GraduationCap className="h-3 w-3" />}>
                  <select value={testModal.classId ?? ''} onChange={handleTestFieldChange('classId')} className={selectCls}>
                    <option value="">Επιλέξτε τμήμα</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </FormField>

                <FormField label="Μάθημα" icon={<Layers className="h-3 w-3" />}>
                  <select value={testModal.subjectId ?? ''} onChange={handleTestFieldChange('subjectId')} className={selectCls} disabled={!testModal.classId || testSubjectOptions.length === 0}>
                    <option value="">{testSubjectOptions.length === 0 ? 'Δεν υπάρχουν μαθήματα' : 'Επιλέξτε μάθημα'}</option>
                    {testSubjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormField>

                <FormField label="Ημερομηνία" icon={<CalendarDays className="h-3 w-3" />}>
                  <AppDatePicker value={testModal.date} onChange={(v) => setTestModal((p) => (p ? { ...p, date: v } : p))} placeholder="dd/mm/yyyy" />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Ώρα έναρξης" icon={<Clock className="h-3 w-3" />}>
                    <TimePicker value={testModal.startTime} onChange={(t) => setTestModal((p) => p ? { ...p, startTime: t } : p)} required />
                  </FormField>
                  <FormField label="Ώρα λήξης" icon={<Clock className="h-3 w-3" />}>
                    <TimePicker value={testModal.endTime} onChange={(t) => setTestModal((p) => p ? { ...p, endTime: t } : p)} required />
                  </FormField>
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

              <div className={modalFooterCls}>
                <button type="button" onClick={handleTestCancelForDay} disabled={savingTest}
                  className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600 active:scale-[0.97] disabled:opacity-50">
                  Ακύρωση για αυτή τη μέρα
                </button>
                <div className="flex gap-2.5">
                  <button type="button" onClick={handleTestModalClose} disabled={savingTest} className={`${cancelBtnCls} disabled:opacity-50`}>
                    Ακύρωση
                  </button>
                  <button type="button" onClick={handleTestModalSave} disabled={savingTest}
                    className="btn-primary gap-1.5 px-3 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                    {savingTest ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση…</> : 'Ενημέρωση'}
                  </button>
                  <button type="button" onClick={handleTestDelete} disabled={savingTest}
                    className="rounded-lg bg-red-900/70 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-800 active:scale-[0.97] disabled:opacity-50">
                    Διαγραφή
                  </button>
                </div>
              </div>
            </ModalShell>
          )}
        </>
      )}
    </section>
  );
}