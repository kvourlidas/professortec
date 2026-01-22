// PART 1/3
// src/components/dashboard/DashboardCalendarSection.tsx

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';

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
import EventFormModal, {
  type EventFormState,
  type SchoolEventForEdit,
} from '../events/EventFormModal';

/* ------------ Types ------------ */

type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null;
};

type TutorRow = {
  id: string;
  full_name: string | null;
};

type ProgramRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
};

type ProgramItemRow = {
  id: string;
  program_id: string;
  class_id: string;
  day_of_week: string;
  position: number | null;
  start_time: string | null; // "HH:MM:SS"
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
};

type ProgramItemOverrideRow = {
  id: string;
  program_item_id: string;
  override_date: string | null; // "YYYY-MM-DD"
  start_time: string | null; // "HH:MM:SS"
  end_time: string | null;
  is_deleted: boolean | null;

  // ✅ new columns
  is_inactive: boolean | null;
  holiday_active_override: boolean | null;
};

type HolidayRow = {
  id: string;
  school_id: string;
  date: string; // "YYYY-MM-DD"
  name: string | null;
};

type SchoolEventRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS"
  end_time: string; // "HH:MM:SS"
  created_at: string | null;
};

/* ---- Subjects / Tests ---- */

type SubjectRow = {
  id: string;
  school_id: string;
  name: string;
  level_id: string | null;
};

type ClassSubjectRow = {
  class_id: string;
  subject_id: string;
  school_id?: string | null;
};

type TestRow = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  test_date: string; // "YYYY-MM-DD"
  start_time: string | null; // "HH:MM[:SS]" or null
  end_time: string | null;
  title: string | null;
  description: string | null;

  // (unchanged for tests table)
  active_during_holiday: boolean | null;
};

type CalendarEventModal = {
  programItemId: string;
  originalDateStr: string; // "YYYY-MM-DD" when event was clicked
  date: string; // "dd/mm/yyyy" for AppDatePicker
  startTime: string; // "HH:MM"
  startPeriod: 'AM' | 'PM';
  endTime: string; // "HH:MM"
  endPeriod: 'AM' | 'PM';
  classId: string | null;
  subjectId: string | null;
  overrideId?: string;

  // maps to holiday_active_override for program overrides
  activeDuringHoliday: boolean;
};

type TestModalState = {
  testId: string;
  classId: string | null;
  subjectId: string | null;
  date: string; // "dd/mm/yyyy"
  startTime: string;
  startPeriod: 'AM' | 'PM';
  endTime: string;
  endPeriod: 'AM' | 'PM';
  title: string;

  // tests table (active_during_holiday)
  activeDuringHoliday: boolean;
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

const formatLocalYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
};

/** 12h "HH:MM" + AM/PM -> 24h "HH:MM" */
function convert12To24(time: string, period: 'AM' | 'PM'): string | null {
  const t = time.trim();
  if (!t) return null;

  const [hStr, mStr = '00'] = t.split(':');
  let h = Number(hStr);
  let m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  h = h % 12;
  if (period === 'PM') h += 12;

  return `${pad2(h)}:${pad2(m)}`;
}

/** 24h "HH:MM[:SS]" -> 12h + AM/PM */
function convert24To12(
  time: string | null,
): { time: string; period: 'AM' | 'PM' } {
  if (!time) return { time: '', period: 'AM' };
  const [hStr, mStr = '00'] = time.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return { time: '', period: 'AM' };

  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { time: `${pad2(h)}:${pad2(m)}`, period };
}

/** keeps only digits and inserts ":" after HH */
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** "YYYY-MM-DD" -> "dd/mm/yyyy" */
function formatDateDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "dd/mm/yyyy" -> "YYYY-MM-DD" */
function parseDateDisplayToISO(display: string): string | null {
  const v = display.trim();
  if (!v) return null;
  const parts = v.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr);
  const month = Number(mStr);
  const year = Number(yStr);
  if (!day || !month || !year) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function getNextDateForDow(from: Date, dow: number): Date {
  const d = new Date(from);
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

type DashboardCalendarSectionProps = {
  schoolId: string | null;
};

export default function DashboardCalendarSection({
  schoolId,
}: DashboardCalendarSectionProps) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);
  const [overrides, setOverrides] = useState<ProgramItemOverrideRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [calendarView, setCalendarView] = useState<string>('timeGridWeek');
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(
    null,
  );

  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<SchoolEventRow[]>([]);

  // SCHOOL EVENT modal (same as EventsPage)
  const [schoolEventModalOpen, setSchoolEventModalOpen] = useState(false);
  const [schoolEventModalMode, setSchoolEventModalMode] = useState<
    'create' | 'edit'
  >('edit');
  const [schoolEventEditing, setSchoolEventEditing] =
    useState<SchoolEventForEdit | null>(null);
  const [schoolEventSaving, setSchoolEventSaving] = useState(false);
  const [schoolEventError, setSchoolEventError] = useState<string | null>(null);

  // Delete confirm (same style as EventsPage)
  const [schoolEventDeleteTarget, setSchoolEventDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [schoolEventDeleting, setSchoolEventDeleting] = useState(false);

  // subjects / class_subjects / tests
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);

  // PROGRAM event modal
  const [eventModal, setEventModal] = useState<CalendarEventModal | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Test edit modal
  const [testModal, setTestModal] = useState<TestModalState | null>(null);
  const [savingTest, setSavingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  /* -------- Holidays helpers -------- */

  const holidayDateSet = useMemo(() => {
    return new Set(holidays.map((h) => h.date));
  }, [holidays]);

  const holidayNameByDate = useMemo(() => {
    const m = new Map<string, string | null>();
    holidays.forEach((h) => m.set(h.date, h.name ?? null));
    return m;
  }, [holidays]);

  /* -------- Data loading -------- */

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      setClasses([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('id, school_id, title, subject, subject_id, tutor_id')
        .eq('school_id', schoolId)
        .order('title', { ascending: true });

      if (error) {
        console.error('Failed to load classes for dashboard', error);
        setClasses([]);
      } else {
        setClasses((data ?? []) as ClassRow[]);
      }
      setLoading(false);
    };

    load();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setTutors([]);
      return;
    }

    const loadTutors = async () => {
      const { data, error } = await supabase
        .from('tutors')
        .select('id, full_name')
        .eq('school_id', schoolId)
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Failed to load tutors for dashboard', error);
        setTutors([]);
      } else {
        setTutors((data ?? []) as TutorRow[]);
      }
    };

    loadTutors();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setProgram(null);
      setProgramItems([]);
      setOverrides([]);
      return;
    }

    const loadProgram = async () => {
      const { data: programRows, error: programErr } = await supabase
        .from('programs')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (programErr) {
        console.error('Failed to load programs for dashboard', programErr);
        setProgram(null);
        setProgramItems([]);
        setOverrides([]);
        return;
      }

      let activeProgram: ProgramRow | null =
        (programRows?.[0] as ProgramRow) ?? null;

      if (!activeProgram) {
        const { data: created, error: createErr } = await supabase
          .from('programs')
          .insert({
            school_id: schoolId,
            name: 'Βασικό πρόγραμμα',
            description: null,
          })
          .select('*')
          .maybeSingle();

        if (createErr || !created) {
          console.error(
            'Failed to create default program for dashboard',
            createErr,
          );
          setProgram(null);
          setProgramItems([]);
          setOverrides([]);
          return;
        }

        activeProgram = created as ProgramRow;
      }

      setProgram(activeProgram);

      const { data: itemData, error: itemErr } = await supabase
        .from('program_items')
        .select('*')
        .eq('program_id', activeProgram.id)
        .order('day_of_week', { ascending: true })
        .order('position', { ascending: true });

      if (itemErr) {
        console.error('Failed to load program_items for dashboard', itemErr);
        setProgramItems([]);
        setOverrides([]);
      } else {
        const rows = (itemData ?? []) as ProgramItemRow[];
        setProgramItems(rows);

        if (rows.length > 0) {
          const ids = rows.map((r) => r.id);
          const { data: overrideData, error: overrideErr } = await supabase
            .from('program_item_overrides')
            .select('*')
            .in('program_item_id', ids);

          if (overrideErr) {
            console.error(
              'Failed to load program_item_overrides for dashboard',
              overrideErr,
            );
            setOverrides([]);
          } else {
            setOverrides((overrideData ?? []) as ProgramItemOverrideRow[]);
          }
        } else {
          setOverrides([]);
        }
      }
    };

    loadProgram();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setHolidays([]);
      return;
    }

    const loadHolidays = async () => {
      const { data, error } = await supabase
        .from('school_holidays')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: true });

      if (error) {
        console.error('Failed to load school holidays for dashboard', error);
        setHolidays([]);
      } else {
        setHolidays((data ?? []) as HolidayRow[]);
      }
    };

    loadHolidays();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setSchoolEvents([]);
      return;
    }

    const loadEvents = async () => {
      const { data, error } = await supabase
        .from('school_events')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Failed to load school events for dashboard', error);
        setSchoolEvents([]);
      } else {
        setSchoolEvents((data ?? []) as SchoolEventRow[]);
      }
    };

    loadEvents();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) {
      setSubjects([]);
      setClassSubjects([]);
      setTests([]);
      return;
    }

    const loadExtra = async () => {
      try {
        const [
          { data: subjData, error: subjErr },
          { data: classSubjData, error: classSubjErr },
          { data: testsData, error: testsErr },
        ] = await Promise.all([
          supabase
            .from('subjects')
            .select('id, school_id, name, level_id')
            .eq('school_id', schoolId)
            .order('name', { ascending: true }),
          supabase
            .from('class_subjects')
            .select('class_id, subject_id, school_id')
            .eq('school_id', schoolId),
          supabase
            .from('tests')
            .select(
              'id, school_id, class_id, subject_id, test_date, start_time, end_time, title, description, active_during_holiday',
            )
            .eq('school_id', schoolId)
            .order('test_date', { ascending: true }),
        ]);

        if (subjErr) {
          console.error('Failed to load subjects for dashboard', subjErr);
          setSubjects([]);
        } else {
          setSubjects((subjData ?? []) as SubjectRow[]);
        }

        if (classSubjErr) {
          console.error(
            'Failed to load class_subjects for dashboard',
            classSubjErr,
          );
          setClassSubjects([]);
        } else {
          setClassSubjects((classSubjData ?? []) as ClassSubjectRow[]);
        }

        if (testsErr) {
          console.error('Failed to load tests for dashboard', testsErr);
          setTests([]);
        } else {
          setTests((testsData ?? []) as TestRow[]);
        }
      } catch (e) {
        console.error('Dashboard extra load error (subjects/tests)', e);
        setSubjects([]);
        setClassSubjects([]);
        setTests([]);
      }
    };

    loadExtra();
  }, [schoolId]);

  /* -------- Helpers for subjects / tests -------- */

  const subjectById = useMemo(() => {
    const m = new Map<string, SubjectRow>();
    subjects.forEach((s) => m.set(s.id, s));
    return m;
  }, [subjects]);

  // SAME logic as ProgramPage / TestsPage (do not change)
  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];

    const cls = classes.find((c) => c.id === classId) ?? null;

    const attachedIds = new Set<string>();

    classSubjects
      .filter((cs) => cs.class_id === classId && cs.subject_id)
      .forEach((cs) => attachedIds.add(cs.subject_id));

    if (cls?.subject_id) attachedIds.add(cls.subject_id);

    const attachedSubjects: SubjectRow[] = [];
    attachedIds.forEach((id) => {
      const subj = subjectById.get(id);
      if (subj) attachedSubjects.push(subj);
    });

    if (attachedSubjects.length >= 2) {
      return attachedSubjects.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    }

    let levelId: string | null = null;
    if (cls?.subject_id) {
      const mainSubj = subjectById.get(cls.subject_id);
      levelId = mainSubj?.level_id ?? null;
    }

    const extraSubjects = levelId
      ? subjects.filter((s) => s.level_id === levelId)
      : subjects;

    const merged = new Map<string, SubjectRow>();
    extraSubjects.forEach((s) => merged.set(s.id, s));
    attachedSubjects.forEach((s) => merged.set(s.id, s));

    const result = Array.from(merged.values());
    result.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    return result;
  };

  /* -------- Build events for FullCalendar -------- */

  const events = useMemo(() => {
    if (!viewRange) return [];

    const { start: viewStart, end: viewEnd } = viewRange;
    const out: any[] = [];

    const tutorMap: Record<string, string> = {};
    tutors.forEach((t) => {
      if (t.id && t.full_name) tutorMap[t.id] = t.full_name;
    });

    const classMap = new Map<string, ClassRow>();
    classes.forEach((c) => classMap.set(c.id, c));

    const programItemMap = new Map<string, ProgramItemRow>();
    programItems.forEach((pi) => programItemMap.set(pi.id, pi));

    const overrideMap = new Map<string, ProgramItemOverrideRow>();
    overrides.forEach((ov) => {
      if (!ov.override_date) return;
      const key = `${ov.program_item_id}-${ov.override_date}`;
      overrideMap.set(key, ov);
    });

    const usedOverrideIds = new Set<string>();

    // For tests: group per (class_id, test_date)
    const testsByKey = new Map<string, TestRow[]>();
    tests.forEach((t) => {
      const key = `${t.class_id}-${t.test_date}`;
      const arr = testsByKey.get(key) ?? [];
      arr.push(t);
      testsByKey.set(key, arr);
    });

    // Hide standalone tests ONLY when we intentionally combine them with a class (non-holiday)
    const hideStandaloneTestKeys = new Set<string>();

    const inactiveColors = {
      backgroundColor: 'rgba(148, 163, 184, 0.18)',
      borderColor: 'rgba(148, 163, 184, 0.45)',
      textColor: '#e2e8f0',
    };

    // 1) PROGRAM pattern-based events
    programItems.forEach((item) => {
      const cls = classMap.get(item.class_id);
      if (!cls) return;
      if (!item.day_of_week || !item.start_time || !item.end_time) return;

      const dow = WEEKDAY_TO_INDEX[item.day_of_week];
      if (dow === undefined) return;

      const patternStartDate = item.start_date
        ? new Date(item.start_date + 'T00:00:00')
        : new Date('1970-01-01T00:00:00');
      const patternEndDate = item.end_date
        ? new Date(item.end_date + 'T23:59:59')
        : new Date('2999-12-31T23:59:59');

      const effectiveStart =
        patternStartDate > viewStart ? patternStartDate : viewStart;
      const effectiveEnd = patternEndDate < viewEnd ? patternEndDate : viewEnd;
      if (effectiveStart > effectiveEnd) return;

      let currentDate = getNextDateForDow(effectiveStart, dow);

      const tutorName =
        cls.tutor_id && tutorMap[cls.tutor_id] ? tutorMap[cls.tutor_id] : null;

      while (currentDate <= effectiveEnd) {
        const dateStr = formatLocalYMD(currentDate);
        const next = new Date(currentDate);
        next.setDate(next.getDate() + 7);

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
        const activeDuringHoliday = isHoliday
          ? holidayActiveOverride && !manualInactive
          : false;

        if (override) {
          usedOverrideIds.add(override.id);
          overrideId = override.id;
          if (override.is_deleted) isDeleted = true;
          if (override.start_time) startTimeStr = override.start_time;
          if (override.end_time) endTimeStr = override.end_time;
        }

        if (!isDeleted) {
          const [sH, sM] = startTimeStr.split(':').map(Number);
          const [eH, eM] = endTimeStr.split(':').map(Number);

          const start = new Date(currentDate);
          start.setHours(sH, sM, 0, 0);
          const end = new Date(currentDate);
          end.setHours(eH, eM, 0, 0);

          // Combine tests ONLY on non-holiday days
          const testsForClassDate = testsByKey.get(key) ?? [];
          const shouldCombineTest = !isHoliday && testsForClassDate.length > 0;
          const combinedTest = shouldCombineTest ? testsForClassDate[0] : null;

          const titleBase = cls.title;
          const title = combinedTest ? `${titleBase} · Διαγώνισμα` : titleBase;

          if (combinedTest) hideStandaloneTestKeys.add(key);

          out.push({
            id: `${item.id}-${dateStr}`,
            title,
            start,
            end,
            editable: !isInactive,
            startEditable: !isInactive,
            durationEditable: !isInactive,
            ...(isInactive ? inactiveColors : {}),
            extendedProps: {
              kind: 'program',
              programItemId: item.id,
              classId: cls.id,
              subject: cls.subject,
              tutorName,
              overrideDate: dateStr,
              overrideId,
              isHoliday,
              holidayName,
              isInactive,
              activeDuringHoliday,
              testId: combinedTest?.id ?? null,
              testSubjectId: combinedTest?.subject_id ?? null,
            },
          });
        }

        currentDate = next;
      }
    });

    // 2) PROGRAM overrides creating one-off events on a different weekday
    overrides.forEach((ov) => {
      if (!ov.override_date) return;
      if (ov.is_deleted) return;
      if (usedOverrideIds.has(ov.id)) return;

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
      const activeDuringHoliday = isHoliday
        ? holidayActiveOverride && !manualInactive
        : false;

      const baseStartTime = ov.start_time ?? item.start_time;
      const baseEndTime = ov.end_time ?? item.end_time;
      if (!baseStartTime || !baseEndTime) return;

      const [sH, sM] = baseStartTime.split(':').map(Number);
      const [eH, eM] = baseEndTime.split(':').map(Number);

      const start = new Date(overrideDateObj);
      start.setHours(sH, sM, 0, 0);
      const end = new Date(overrideDateObj);
      end.setHours(eH, eM, 0, 0);

      const tutorName =
        cls.tutor_id && tutorMap[cls.tutor_id] ? tutorMap[cls.tutor_id] : null;

      const key = `${item.class_id}-${dateStr}`;
      const testsForClassDate = testsByKey.get(key) ?? [];
      const shouldCombineTest = !isHoliday && testsForClassDate.length > 0;
      const combinedTest = shouldCombineTest ? testsForClassDate[0] : null;

      const titleBase = cls.title;
      const title = combinedTest ? `${titleBase} · Διαγώνισμα` : titleBase;

      if (combinedTest) hideStandaloneTestKeys.add(key);

      out.push({
        id: `${item.id}-${dateStr}-override`,
        title,
        start,
        end,
        editable: !isInactive,
        startEditable: !isInactive,
        durationEditable: !isInactive,
        ...(isInactive ? inactiveColors : {}),
        extendedProps: {
          kind: 'program',
          programItemId: item.id,
          classId: cls.id,
          subject: cls.subject,
          tutorName,
          overrideDate: dateStr,
          overrideId: ov.id,
          isHoliday,
          holidayName,
          isInactive,
          activeDuringHoliday,
          testId: combinedTest?.id ?? null,
          testSubjectId: combinedTest?.subject_id ?? null,
        },
      });
    });

    // 3) Standalone TEST events
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

      const baseStart = t.start_time ?? '09:00';
      const baseEnd = t.end_time ?? '10:00';

      const [sH, sM] = baseStart.split(':').map(Number);
      const [eH, eM] = baseEnd.split(':').map(Number);

      const start = new Date(dateObj);
      start.setHours(sH, sM, 0, 0);
      const end = new Date(dateObj);
      end.setHours(eH, eM, 0, 0);

      const titleParts: string[] = [];
      if (cls?.title) titleParts.push(cls.title);
      if (subj?.name) titleParts.push(subj.name);
      if (t.title) titleParts.push(t.title);
      const label =
        titleParts.length > 0
          ? `Διαγώνισμα · ${titleParts.join(' · ')}`
          : 'Διαγώνισμα';

      out.push({
        id: `test-${t.id}`,
        title: label,
        start,
        end,
        editable: !isInactive,
        startEditable: !isInactive,
        durationEditable: !isInactive,
        ...(isInactive ? inactiveColors : {}),
        extendedProps: {
          kind: 'test',
          testId: t.id,
          classId: t.class_id,
          subjectId: t.subject_id,
          isHoliday,
          holidayName,
          isInactive,
          activeDuringHoliday,
        },
      });
    });

    // 4) SCHOOL EVENTS (kept hidden on holidays)
    schoolEvents.forEach((ev) => {
      const start = new Date(ev.date + 'T' + ev.start_time);
      const end = new Date(ev.date + 'T' + ev.end_time);

      if (start < viewStart || start > viewEnd) return;
      if (holidayDateSet.has(ev.date)) return;

      out.push({
        id: `event-${ev.id}`,
        title: ev.name,
        start,
        end,
        editable: true,
        startEditable: true,
        durationEditable: true,
        extendedProps: {
          kind: 'schoolEvent',
          eventId: ev.id,
          description: ev.description,
        },
      });
    });

    return out;
  }, [
    viewRange,
    programItems,
    classes,
    tutors,
    overrides,
    holidays,
    holidayDateSet,
    holidayNameByDate,
    schoolEvents,
    tests,
    subjects,
    subjectById,
  ]);

  /* -------- Drag & drop handling -------- */

  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, oldEvent, revert } = arg;

    const isInactive = event.extendedProps['isInactive'] as boolean | undefined;
    if (isInactive) {
      revert();
      return;
    }

    const kind = event.extendedProps['kind'] as
      | 'program'
      | 'schoolEvent'
      | 'test'
      | undefined;

    if (!event.start || !event.end) {
      revert();
      return;
    }

    const newDateStr = formatLocalYMD(event.start);
    const newStartTimeDb = `${pad2(event.start.getHours())}:${pad2(
      event.start.getMinutes(),
    )}:00`;
    const newEndTimeDb = `${pad2(event.end.getHours())}:${pad2(
      event.end.getMinutes(),
    )}:00`;

    // SCHOOL EVENTS
    if (kind === 'schoolEvent') {
      const eventId = event.extendedProps['eventId'] as string | undefined;
      if (!eventId) {
        revert();
        return;
      }

      try {
        const { data, error } = await supabase
          .from('school_events')
          .update({
            date: newDateStr,
            start_time: newStartTimeDb,
            end_time: newEndTimeDb,
          })
          .eq('id', eventId)
          .select('*')
          .maybeSingle();

        if (error || !data) {
          console.error('Failed to update school_event on drag', error);
          revert();
          return;
        }

        setSchoolEvents((prev) =>
          prev.map((ev) => (ev.id === eventId ? (data as SchoolEventRow) : ev)),
        );
      } catch (err) {
        console.error('Failed to handle school_event eventDrop', err);
        revert();
      }

      return;
    }

    // TEST EVENTS drag & drop
    if (kind === 'test') {
      const testId = event.extendedProps['testId'] as string | undefined;
      if (!testId) {
        revert();
        return;
      }

      try {
        const movedToHoliday = holidayDateSet.has(newDateStr);

        const { data, error } = await supabase
          .from('tests')
          .update({
            test_date: newDateStr,
            start_time: newStartTimeDb,
            end_time: newEndTimeDb,
            // behavior: drag to holiday => active
            active_during_holiday: movedToHoliday ? true : false,
          })
          .eq('id', testId)
          .select('*')
          .maybeSingle();

        if (error || !data) {
          console.error('Failed to update test on drag', error);
          revert();
          return;
        }

        setTests((prev) =>
          prev.map((t) => (t.id === testId ? (data as TestRow) : t)),
        );
      } catch (err) {
        console.error('Failed to handle test eventDrop', err);
        revert();
      }

      return;
    }

    // PROGRAM EVENTS (overrides)
    const programItemId = event.extendedProps['programItemId'] as
      | string
      | undefined;

    if (!programItemId || !oldEvent || !oldEvent.start) {
      revert();
      return;
    }

    const oldDateStr = formatLocalYMD(oldEvent.start);

    try {
      const movedToHoliday = holidayDateSet.has(newDateStr);

      if (oldDateStr === newDateStr) {
        const existing = overrides.find(
          (o) =>
            o.program_item_id === programItemId && o.override_date === newDateStr,
        );

        if (existing) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              start_time: newStartTimeDb,
              end_time: newEndTimeDb,
              is_deleted: false,
              is_inactive: false,
              holiday_active_override: movedToHoliday ? true : false,
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) =>
              o.id === existing.id ? (data as ProgramItemOverrideRow) : o,
            ),
          );
        } else {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .insert({
              program_item_id: programItemId,
              override_date: newDateStr,
              start_time: newStartTimeDb,
              end_time: newEndTimeDb,
              is_deleted: false,
              is_inactive: false,
              holiday_active_override: movedToHoliday ? true : false,
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [...prev, data as ProgramItemOverrideRow]);
        }
      } else {
        // different day: mark old as deleted and create/update new
        const existingOld = overrides.find(
          (o) =>
            o.program_item_id === programItemId && o.override_date === oldDateStr,
        );

        if (existingOld) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              is_deleted: true,
              start_time: null,
              end_time: null,
              is_inactive: false,
              holiday_active_override: false,
            })
            .eq('id', existingOld.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) =>
              o.id === existingOld.id ? (data as ProgramItemOverrideRow) : o,
            ),
          );
        } else {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .insert({
              program_item_id: programItemId,
              override_date: oldDateStr,
              is_deleted: true,
              start_time: null,
              end_time: null,
              is_inactive: false,
              holiday_active_override: false,
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [...prev, data as ProgramItemOverrideRow]);
        }

        const existingNew = overrides.find(
          (o) =>
            o.program_item_id === programItemId && o.override_date === newDateStr,
        );

        if (existingNew) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              start_time: newStartTimeDb,
              end_time: newEndTimeDb,
              is_deleted: false,
              is_inactive: false,
              holiday_active_override: movedToHoliday ? true : false,
            })
            .eq('id', existingNew.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) =>
              o.id === existingNew.id ? (data as ProgramItemOverrideRow) : o,
            ),
          );
        } else {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .insert({
              program_item_id: programItemId,
              override_date: newDateStr,
              start_time: newStartTimeDb,
              end_time: newEndTimeDb,
              is_deleted: false,
              is_inactive: false,
              holiday_active_override: movedToHoliday ? true : false,
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [...prev, data as ProgramItemOverrideRow]);
        }
      }
    } catch (err) {
      console.error('Failed to handle eventDrop override', err);
      revert();
    }
  };

  /* -------- Render event content -------- */

  const renderEventContent = (arg: EventContentArg) => {
    const { event } = arg;
    const kind = event.extendedProps['kind'] as string | undefined;

    const subject = event.extendedProps['subject'] as string | null;
    const tutorName = event.extendedProps['tutorName'] as string | null;

    const isInactive = !!event.extendedProps['isInactive'];

    const isHoliday = !!event.extendedProps['isHoliday'];
    const holidayName =
      (event.extendedProps['holidayName'] as string | null) ?? null;

    const start = event.start;
    const end = event.end;

    const formatter = new Intl.DateTimeFormat('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let timeRange = '';
    if (start && end) timeRange = `${formatter.format(start)} – ${formatter.format(end)}`;
    else if (start) timeRange = formatter.format(start);

    const hasTest = kind === 'test' || !!event.extendedProps['testId'];

    const rawTitle = event.title ?? '';
    let mainTitle = rawTitle;

    if (hasTest) {
      if (/^Διαγώνισμα\s*·/u.test(rawTitle)) {
        mainTitle = rawTitle.replace(/^Διαγώνισμα\s*·\s*/u, '').trim();
      } else if (/\s*·\s*Διαγώνισμα\s*$/u.test(rawTitle)) {
        mainTitle = rawTitle.replace(/\s*·\s*Διαγώνισμα\s*$/u, '').trim();
      }
    }

    return (
      <div className="flex flex-col text-[12px] leading-tight">
        {timeRange && (
          <div className="font-semibold text-[13px] text-[#ffc947]">
            {timeRange}
          </div>
        )}

        {/* Holiday label: only holiday name */}
        {isHoliday && (
          <div className="mt-0.5">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-semibold ${isInactive
                  ? 'border-slate-400/50 bg-slate-500/10 text-slate-200'
                  : 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                }`}
            >
              {holidayName || 'Αργία'}
            </span>
          </div>
        )}

        {!isHoliday && isInactive && (
          <div className="mt-0.5">
            <span className="inline-flex items-center rounded-full border border-slate-400/50 bg-slate-500/10 px-2 py-[1px] text-[10px] font-semibold text-slate-200">
              Ανενεργό
            </span>
          </div>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {hasTest && (
            <span
              className="inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-semibold
              text-red-100 bg-gradient-to-r from-red-500/30 via-red-600/30 to-red-700/30
              border border-red-500/60 shadow-sm"
            >
              Διαγώνισμα
            </span>
          )}

          {mainTitle && <span className="font-semibold">{mainTitle}</span>}
        </div>

        {kind === 'program' && subject && <div className="mt-0.5">{subject}</div>}

        {kind === 'program' && tutorName && (
          <div className="mt-0.5 opacity-90">
            <span>{tutorName}</span>
          </div>
        )}
      </div>
    );
  };

  /* -------- SCHOOL EVENT modal helpers -------- */

  const openEditSchoolEventModal = (eventId: string) => {
    const row = schoolEvents.find((e) => e.id === eventId) ?? null;
    if (!row) return;

    setSchoolEventError(null);
    setSchoolEventModalMode('edit');
    setSchoolEventEditing({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      date: row.date,
      start_time: row.start_time,
      end_time: row.end_time,
    });
    setSchoolEventModalOpen(true);
  };

  const closeSchoolEventModal = () => {
    if (schoolEventSaving) return;
    setSchoolEventModalOpen(false);
    setSchoolEventEditing(null);
    setSchoolEventSaving(false);
    setSchoolEventError(null);
  };

  const handleSaveSchoolEvent = async (form: EventFormState) => {
    setSchoolEventError(null);

    if (!schoolId) {
      setSchoolEventError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id).');
      return;
    }

    if (!form.name.trim()) {
      setSchoolEventError('Το όνομα του event είναι υποχρεωτικό.');
      return;
    }
    if (!form.date) {
      setSchoolEventError('Η ημερομηνία είναι υποχρεωτική.');
      return;
    }
    if (!form.startTime || !form.endTime) {
      setSchoolEventError('Η ώρα έναρξης και λήξης είναι υποχρεωτικές.');
      return;
    }

    const payload = {
      school_id: schoolId,
      name: form.name.trim(),
      description: form.description?.trim() || null,
      date: form.date,
      start_time: `${form.startTime}:00`,
      end_time: `${form.endTime}:00`,
    };

    setSchoolEventSaving(true);

    if (schoolEventModalMode === 'create') {
      const { data, error } = await supabase
        .from('school_events')
        .insert(payload)
        .select('*')
        .maybeSingle();

      setSchoolEventSaving(false);

      if (error || !data) {
        console.error(error);
        setSchoolEventError('Αποτυχία δημιουργίας event.');
        return;
      }

      setSchoolEvents((prev) => [data as SchoolEventRow, ...prev]);
      closeSchoolEventModal();
      return;
    }

    if (!schoolEventEditing) {
      setSchoolEventSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from('school_events')
      .update({
        name: payload.name,
        description: payload.description,
        date: payload.date,
        start_time: payload.start_time,
        end_time: payload.end_time,
      })
      .eq('id', schoolEventEditing.id)
      .select('*')
      .maybeSingle();

    setSchoolEventSaving(false);

    if (error || !data) {
      console.error(error);
      setSchoolEventError('Αποτυχία ενημέρωσης event.');
      return;
    }

    setSchoolEvents((prev) =>
      prev.map((ev) =>
        ev.id === schoolEventEditing.id ? (data as SchoolEventRow) : ev,
      ),
    );
    closeSchoolEventModal();
  };

  const handleConfirmDeleteSchoolEvent = async () => {
    if (!schoolEventDeleteTarget || !schoolId) return;

    setSchoolEventError(null);
    setSchoolEventDeleting(true);

    const { error } = await supabase
      .from('school_events')
      .delete()
      .eq('id', schoolEventDeleteTarget.id)
      .eq('school_id', schoolId);

    setSchoolEventDeleting(false);

    if (error) {
      console.error(error);
      setSchoolEventError('Αποτυχία διαγραφής εκδήλωσης.');
      return;
    }

    setSchoolEvents((prev) =>
      prev.filter((ev) => ev.id !== schoolEventDeleteTarget.id),
    );
    setSchoolEventDeleteTarget(null);
    closeSchoolEventModal();
  };

  /* -------- Click handling (PROGRAM + TEST + SCHOOL EVENT) -------- */

  const openTestModalFromEvent = (event: any) => {
    const testId = event.extendedProps['testId'] as string | null | undefined;
    if (!testId || !event.start || !event.end) return;

    const testRow = tests.find((t) => t.id === testId) ?? null;

    const classId =
      (event.extendedProps['classId'] as string | undefined) ??
      testRow?.class_id ??
      null;

    const subjectId =
      (event.extendedProps['subjectId'] as string | undefined) ??
      (event.extendedProps['testSubjectId'] as string | undefined) ??
      testRow?.subject_id ??
      null;

    const dateIso = formatLocalYMD(event.start);
    const isHoliday = holidayDateSet.has(dateIso);

    const start24 = `${pad2(event.start.getHours())}:${pad2(event.start.getMinutes())}`;
    const end24 = `${pad2(event.end.getHours())}:${pad2(event.end.getMinutes())}`;

    const { time: startTime, period: startPeriod } = convert24To12(start24);
    const { time: endTime, period: endPeriod } = convert24To12(end24);

    setTestError(null);
    setTestModal({
      testId,
      classId,
      subjectId,
      date: formatDateDisplay(dateIso),
      startTime,
      startPeriod,
      endTime,
      endPeriod,
      title: testRow?.title ?? '',
      activeDuringHoliday: isHoliday ? !!testRow?.active_during_holiday : false,
    });

    // ensure program delete confirm is not shown
    setShowDeleteConfirm(false);
    setEventModal(null);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const { event } = arg;
    const kind = event.extendedProps['kind'] as
      | 'program'
      | 'schoolEvent'
      | 'test'
      | undefined;

    if (!event.start || !event.end) return;

    // always close others first to avoid “empty overlay”
    setEventModal(null);
    setTestModal(null);
    setShowDeleteConfirm(false);
    setEventError(null);
    setTestError(null);

    if (kind === 'schoolEvent') {
      const eventId = event.extendedProps['eventId'] as string | undefined;
      if (eventId) openEditSchoolEventModal(eventId);
      return;
    }

    // test (standalone)
    if (kind === 'test') {
      openTestModalFromEvent(event);
      return;
    }

    // program
    if (kind === 'program') {
      // combined test inside class slot
      const combinedTestId = event.extendedProps['testId'] as string | null;
      if (combinedTestId) {
        openTestModalFromEvent(event);
        return;
      }

      const programItemId = event.extendedProps['programItemId'] as string | undefined;
      if (!programItemId) return;

      const dateIso = formatLocalYMD(event.start);
      const overrideId = event.extendedProps['overrideId'] as string | null;

      const start24 = `${pad2(event.start.getHours())}:${pad2(event.start.getMinutes())}`;
      const end24 = `${pad2(event.end.getHours())}:${pad2(event.end.getMinutes())}`;

      const { time: startTime, period: startPeriod } = convert24To12(start24);
      const { time: endTime, period: endPeriod } = convert24To12(end24);

      const classIdProp = event.extendedProps['classId'] as string | undefined;
      const clsRow = classIdProp ? classes.find((c) => c.id === classIdProp) ?? null : null;
      const prefilledSubjectId = clsRow?.subject_id ?? null;

      setEventModal({
        programItemId,
        originalDateStr: dateIso,
        date: formatDateDisplay(dateIso),
        startTime,
        startPeriod,
        endTime,
        endPeriod,
        classId: classIdProp ?? null,
        subjectId: prefilledSubjectId,
        overrideId: overrideId ?? undefined,
        activeDuringHoliday: !!event.extendedProps['activeDuringHoliday'],
      });

      setShowDeleteConfirm(false);
    }
  };

  /* -------- PROGRAM override modal handlers -------- */

  const handleProgramFieldChange =
    (field: 'classId' | 'subjectId') =>
      (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setEventModal((prev) => {
          if (!prev) return prev;
          if (field === 'classId') return { ...prev, classId: value || null, subjectId: null };
          if (field === 'subjectId') return { ...prev, subjectId: value || null };
          return prev;
        });
      };

  const handleEventTimeChange =
    (field: 'startTime' | 'endTime') =>
      (e: ChangeEvent<HTMLInputElement>) => {
        const formatted = formatTimeInput(e.target.value);
        setEventModal((prev) => (prev ? { ...prev, [field]: formatted } : prev));
      };

  const handleEventModalSave = async () => {
    if (!eventModal) return;

    const {
      programItemId,
      originalDateStr,
      date,
      startTime,
      startPeriod,
      endTime,
      endPeriod,
      classId,
      subjectId,
      activeDuringHoliday,
    } = eventModal;

    if (!classId) {
      setEventError('Επιλέξτε τμήμα.');
      return;
    }

    const subjectOptions = getSubjectsForClass(classId);
    if (subjectOptions.length > 0 && !subjectId) {
      setEventError('Επιλέξτε μάθημα για το τμήμα.');
      return;
    }

    if (!date) {
      setEventError('Επιλέξτε ημερομηνία μαθήματος.');
      return;
    }

    const newDateStr = parseDateDisplayToISO(date);
    if (!newDateStr) {
      setEventError('Μη έγκυρη ημερομηνία (π.χ. 12/05/2025).');
      return;
    }

    const start24 = convert12To24(startTime, startPeriod);
    const end24 = convert12To24(endTime, endPeriod);

    if (!start24 || !end24) {
      setEventError('Συμπληρώστε σωστά τις ώρες (π.χ. 08:00).');
      return;
    }

    const startTimeDb = `${start24}:00`;
    const endTimeDb = `${end24}:00`;

    const isHoliday = holidayDateSet.has(newDateStr);
    const finalHolidayActiveOverride = isHoliday ? !!activeDuringHoliday : false;

    try {
      setEventError(null);

      // 1) Update program_items.class_id if changed
      const item = programItems.find((pi) => pi.id === programItemId);
      if (item && classId !== item.class_id) {
        const { data: updatedItem, error: itemErr } = await supabase
          .from('program_items')
          .update({ class_id: classId })
          .eq('id', programItemId)
          .select('*')
          .single();

        if (itemErr || !updatedItem) throw itemErr ?? new Error('No data');

        setProgramItems((prev) =>
          prev.map((pi) => (pi.id === programItemId ? (updatedItem as ProgramItemRow) : pi)),
        );
      }

      // 2) Update class subject if changed (keeps your existing behavior)
      const subjectOptionsNow = getSubjectsForClass(classId);
      const cls = classes.find((c) => c.id === classId) ?? null;
      const oldSubjectId = cls?.subject_id ?? null;
      const finalSubjectId = subjectId ?? subjectOptionsNow[0]?.id ?? null;

      if (finalSubjectId && finalSubjectId !== oldSubjectId) {
        const subjRow = subjectById.get(finalSubjectId);
        const subjectName = subjRow?.name ?? null;

        const { data: updatedClass, error: classErr } = await supabase
          .from('classes')
          .update({ subject_id: finalSubjectId, subject: subjectName })
          .eq('id', classId)
          .select('id, school_id, title, subject, subject_id, tutor_id')
          .maybeSingle();

        if (classErr || !updatedClass) throw classErr ?? new Error('No data');

        setClasses((prev) =>
          prev.map((c) => (c.id === classId ? (updatedClass as ClassRow) : c)),
        );
      }

      // 3) Update / create overrides (+ holiday override flag)
      const upsertOverrideForDate = async (targetDate: string) => {
        const existing = overrides.find(
          (o) => o.program_item_id === programItemId && o.override_date === targetDate,
        );

        if (existing) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              start_time: startTimeDb,
              end_time: endTimeDb,
              is_deleted: false,
              is_inactive: false,
              holiday_active_override: holidayDateSet.has(targetDate)
                ? finalHolidayActiveOverride
                : false,
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) => (o.id === existing.id ? (data as ProgramItemOverrideRow) : o)),
          );
          return;
        }

        const { data, error } = await supabase
          .from('program_item_overrides')
          .insert({
            program_item_id: programItemId,
            override_date: targetDate,
            start_time: startTimeDb,
            end_time: endTimeDb,
            is_deleted: false,
            is_inactive: false,
            holiday_active_override: holidayDateSet.has(targetDate)
              ? finalHolidayActiveOverride
              : false,
          })
          .select()
          .single();

        if (error || !data) throw error ?? new Error('No data');

        setOverrides((prev) => [...prev, data as ProgramItemOverrideRow]);
      };

      if (newDateStr === originalDateStr) {
        await upsertOverrideForDate(newDateStr);
      } else {
        // mark old as deleted
        const existingOld = overrides.find(
          (o) => o.program_item_id === programItemId && o.override_date === originalDateStr,
        );

        if (existingOld) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              is_deleted: true,
              start_time: null,
              end_time: null,
              is_inactive: false,
              holiday_active_override: false,
            })
            .eq('id', existingOld.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) => (o.id === existingOld.id ? (data as ProgramItemOverrideRow) : o)),
          );
        } else {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .insert({
              program_item_id: programItemId,
              override_date: originalDateStr,
              is_deleted: true,
              start_time: null,
              end_time: null,
              is_inactive: false,
              holiday_active_override: false,
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [...prev, data as ProgramItemOverrideRow]);
        }

        await upsertOverrideForDate(newDateStr);
      }

      setEventModal(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to save event override via modal', err);
      setEventError('Αποτυχία αποθήκευσης. Προσπαθήστε ξανά.');
    }
  };

  const handleEventModalDeleteForDay = async () => {
    if (!eventModal) return;
    const { programItemId, originalDateStr } = eventModal;

    try {
      setEventError(null);

      const existing = overrides.find(
        (o) => o.program_item_id === programItemId && o.override_date === originalDateStr,
      );

      if (existing) {
        const { data, error } = await supabase
          .from('program_item_overrides')
          .update({
            is_deleted: true,
            start_time: null,
            end_time: null,
            is_inactive: false,
            holiday_active_override: false,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error || !data) throw error ?? new Error('No data');

        setOverrides((prev) =>
          prev.map((o) => (o.id === existing.id ? (data as ProgramItemOverrideRow) : o)),
        );
      } else {
        const { data, error } = await supabase
          .from('program_item_overrides')
          .insert({
            program_item_id: programItemId,
            override_date: originalDateStr,
            is_deleted: true,
            start_time: null,
            end_time: null,
            is_inactive: false,
            holiday_active_override: false,
          })
          .select()
          .single();

        if (error || !data) throw error ?? new Error('No data');

        setOverrides((prev) => [...prev, data as ProgramItemOverrideRow]);
      }

      setEventModal(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete event occurrence via modal', err);
      setEventError('Αποτυχία διαγραφής. Προσπαθήστε ξανά.');
    }
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setCalendarView(arg.view.type);
    setViewRange({ start: arg.start, end: arg.end });
  };

  /* -------- TEST modal handlers -------- */

  const handleTestFieldChange =
    (field: keyof TestModalState) =>
      (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const value = e.target.value;
        setTestModal((prev) => {
          if (!prev) return prev;
          if (field === 'classId') return { ...prev, classId: value || null, subjectId: null };
          if (field === 'subjectId') return { ...prev, subjectId: value || null };
          return { ...prev, [field]: value as any };
        });
      };

  const handleTestTimeChange =
    (field: 'startTime' | 'endTime') =>
      (e: ChangeEvent<HTMLInputElement>) => {
        const formatted = formatTimeInput(e.target.value);
        setTestModal((prev) => (prev ? { ...prev, [field]: formatted } : prev));
      };

  const handleTestModalSave = async () => {
    if (!testModal) return;

    const {
      testId,
      classId,
      subjectId,
      date,
      startTime,
      startPeriod,
      endTime,
      endPeriod,
      title,
      activeDuringHoliday,
    } = testModal;

    if (!classId) {
      setTestError('Επιλέξτε τμήμα.');
      return;
    }

    const subjectOptions = getSubjectsForClass(classId);
    if (subjectOptions.length > 0 && !subjectId) {
      setTestError('Επιλέξτε μάθημα για το τμήμα.');
      return;
    }

    if (!date) {
      setTestError('Επιλέξτε ημερομηνία διαγωνίσματος.');
      return;
    }

    const testDateISO = parseDateDisplayToISO(date);
    if (!testDateISO) {
      setTestError('Μη έγκυρη ημερομηνία (π.χ. 12/05/2025).');
      return;
    }

    const start24 = convert12To24(startTime, startPeriod);
    const end24 = convert12To24(endTime, endPeriod);

    if (!start24 || !end24) {
      setTestError('Συμπληρώστε σωστά τις ώρες (π.χ. 08:00).');
      return;
    }

    const isHoliday = holidayDateSet.has(testDateISO);
    const finalActiveDuringHoliday = isHoliday ? !!activeDuringHoliday : false;

    setSavingTest(true);
    setTestError(null);

    const payload = {
      class_id: classId,
      subject_id: subjectId ?? subjectOptions[0]?.id,
      test_date: testDateISO,
      start_time: `${start24}:00`,
      end_time: `${end24}:00`,
      title: title || null,
      active_during_holiday: finalActiveDuringHoliday,
    };

    const { data, error } = await supabase
      .from('tests')
      .update(payload)
      .eq('id', testId)
      .select('*')
      .maybeSingle();

    setSavingTest(false);

    if (error || !data) {
      console.error('Failed to update test', error);
      setTestError('Αποτυχία ενημέρωσης διαγωνίσματος.');
      return;
    }

    setTests((prev) => prev.map((t) => (t.id === testId ? (data as TestRow) : t)));
    setTestModal(null);
  };

  const handleTestModalClose = () => {
    if (savingTest) return;
    setTestModal(null);
    setTestError(null);
    setShowDeleteConfirm(false);
  };

  const handleTestDelete = async () => {
    if (!testModal) return;
    const { testId } = testModal;

    try {
      setTestError(null);
      const { error } = await supabase.from('tests').delete().eq('id', testId);
      if (error) throw error;

      setTests((prev) => prev.filter((t) => t.id !== testId));
      setTestModal(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete test', err);
      setTestError('Αποτυχία διαγραφής διαγωνίσματος. Προσπαθήστε ξανά.');
      setShowDeleteConfirm(false);
    }
  };

  // PART 1/3 ends here
  // (Return JSX + all modal markup is in PART 2/3 and PART 3/3)
 // PART 2+3 (merged) — helpers + the ONLY return (and closes the component)

// Close PROGRAM modal
const handleEventModalClose = () => {
  setEventModal(null);
  setEventError(null);
  setShowDeleteConfirm(false);
};

// PROGRAM: open confirm for “cancel for this day”
const handleProgramAskDeleteForDay = () => {
  setShowDeleteConfirm(true);
};

const handleProgramCancelDeleteConfirm = () => {
  setShowDeleteConfirm(false);
};

// TEST: “Ακύρωση για αυτή τη μέρα” => force active_during_holiday=false
const handleTestCancelForDay = async () => {
  if (!testModal) return;

  const testDateISO = parseDateDisplayToISO(testModal.date);
  if (!testDateISO) {
    setTestError('Μη έγκυρη ημερομηνία.');
    return;
  }

  try {
    setSavingTest(true);
    setTestError(null);

    const { data, error } = await supabase
      .from('tests')
      .update({ active_during_holiday: false })
      .eq('id', testModal.testId)
      .select('*')
      .maybeSingle();

    setSavingTest(false);

    if (error || !data) {
      console.error(error);
      setTestError('Αποτυχία ακύρωσης για τη μέρα.');
      return;
    }

    setTests((prev) =>
      prev.map((t) => (t.id === testModal.testId ? (data as TestRow) : t)),
    );
    setTestModal(null);
    setShowDeleteConfirm(false);
  } catch (e) {
    console.error(e);
    setSavingTest(false);
    setTestError('Αποτυχία ακύρωσης για τη μέρα.');
  }
};

// PROGRAM: is current date holiday?
const programModalIsHoliday = useMemo(() => {
  if (!eventModal) return false;
  const iso = parseDateDisplayToISO(eventModal.date);
  if (!iso) return false;
  return holidayDateSet.has(iso);
}, [eventModal, holidayDateSet]);

const programModalHolidayName = useMemo(() => {
  if (!eventModal) return null;
  const iso = parseDateDisplayToISO(eventModal.date);
  if (!iso) return null;
  return holidayNameByDate.get(iso) ?? null;
}, [eventModal, holidayNameByDate]);

// TEST: is current date holiday?
const testModalIsHoliday = useMemo(() => {
  if (!testModal) return false;
  const iso = parseDateDisplayToISO(testModal.date);
  if (!iso) return false;
  return holidayDateSet.has(iso);
}, [testModal, holidayDateSet]);

const testModalHolidayName = useMemo(() => {
  if (!testModal) return null;
  const iso = parseDateDisplayToISO(testModal.date);
  if (!iso) return null;
  return holidayNameByDate.get(iso) ?? null;
}, [testModal, holidayNameByDate]);

// Subjects options for current modals
const programSubjectOptions = useMemo(() => {
  if (!eventModal?.classId) return [];
  return getSubjectsForClass(eventModal.classId);
}, [eventModal?.classId, classes, classSubjects, subjects, subjectById]);

const testSubjectOptions = useMemo(() => {
  if (!testModal?.classId) return [];
  return getSubjectsForClass(testModal.classId);
}, [testModal?.classId, classes, classSubjects, subjects, subjectById]);

// SCHOOL EVENT: trigger external delete confirm
const requestDeleteSchoolEventFromModal = () => {
  if (!schoolEventEditing) return;
  setSchoolEventDeleteTarget({
    id: schoolEventEditing.id,
    name: schoolEventEditing.name,
  });
};

// ✅ the ONLY return
return (
  <section className="space-y-3">
    <h2 className="text-sm font-semibold text-slate-50">
      Πρόγραμμα Τμημάτων & Εκδηλώσεις
    </h2>

    {loading ? (
      <div className="py-6 text-xs text-slate-200 border border-slate-700 rounded-md flex items-center justify-center">
        Φόρτωση προγράμματος…
      </div>
    ) : (
      <>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={elLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          height="auto"
          slotMinTime="08:00:00"
          slotMaxTime="22:00:00"
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

        {/* SCHOOL EVENT modal */}
        <EventFormModal
          open={schoolEventModalOpen}
          mode={schoolEventModalMode}
          editingEvent={schoolEventEditing}
          error={schoolEventError}
          saving={schoolEventSaving}
          onClose={closeSchoolEventModal}
          onSubmit={handleSaveSchoolEvent}
        />

        {/* Delete confirm for School Event */}
        {schoolEventDeleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div
              className="w-full max-w-md rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
              style={{ background: 'var(--color-sidebar)' }}
            >
              <h3 className="mb-2 text-sm font-semibold text-slate-50">
                Διαγραφή εκδήλωσης
              </h3>

              <p className="mb-4 text-xs text-slate-200">
                Σίγουρα θέλετε να διαγράψετε την εκδήλωση{' '}
                <span className="font-semibold text-[color:var(--color-accent)]">
                  «{schoolEventDeleteTarget.name}»
                </span>
                ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
              </p>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (schoolEventDeleting) return;
                    setSchoolEventDeleteTarget(null);
                  }}
                  className="btn-ghost px-3 py-1"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  disabled={schoolEventDeleting}
                >
                  Ακύρωση
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDeleteSchoolEvent}
                  disabled={schoolEventDeleting}
                  className="rounded-md px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  {schoolEventDeleting ? 'Διαγραφή…' : 'Διαγραφή'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PROGRAM modal */}
        {eventModal && !showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div
              className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl space-y-3"
              style={{ background: 'var(--color-sidebar)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-50">
                  Επεξεργασία μαθήματος
                </h3>
                <button
                  type="button"
                  className="text-xs text-slate-200 hover:text-white"
                  onClick={handleEventModalClose}
                >
                  Κλείσιμο
                </button>
              </div>

              {eventError && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {eventError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-slate-200">Τμήμα *</label>
                <select
                  value={eventModal.classId ?? ''}
                  onChange={handleProgramFieldChange('classId')}
                  className="w-full rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-3 py-2 text-xs text-slate-50 outline-none"
                >
                  <option value="">Επιλέξτε τμήμα</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-200">Μάθημα *</label>
                <select
                  value={eventModal.subjectId ?? ''}
                  onChange={handleProgramFieldChange('subjectId')}
                  className="w-full rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-3 py-2 text-xs text-slate-50 outline-none"
                  disabled={!eventModal.classId || programSubjectOptions.length === 0}
                >
                  <option value="">
                    {programSubjectOptions.length === 0
                      ? 'Δεν υπάρχουν μαθήματα'
                      : 'Επιλέξτε μάθημα'}
                  </option>
                  {programSubjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-200">Ημερομηνία *</label>
                <AppDatePicker
                  value={eventModal.date}
                  onChange={(v) =>
                    setEventModal((p) => (p ? { ...p, date: v } : p))
                  }
                  placeholder="dd/mm/yyyy"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-200">Ώρα έναρξης *</label>
                  <div className="flex gap-2">
                    <input
                      value={eventModal.startTime}
                      onChange={handleEventTimeChange('startTime')}
                      className="w-full rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-3 py-2 text-xs text-slate-50 outline-none"
                      placeholder="09:00"
                    />
                    <select
                      value={eventModal.startPeriod}
                      onChange={(e) =>
                        setEventModal((p) =>
                          p ? { ...p, startPeriod: e.target.value as 'AM' | 'PM' } : p,
                        )
                      }
                      className="rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-2 py-2 text-xs text-slate-50 outline-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-200">Ώρα λήξης *</label>
                  <div className="flex gap-2">
                    <input
                      value={eventModal.endTime}
                      onChange={handleEventTimeChange('endTime')}
                      className="w-full rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-3 py-2 text-xs text-slate-50 outline-none"
                      placeholder="10:00"
                    />
                    <select
                      value={eventModal.endPeriod}
                      onChange={(e) =>
                        setEventModal((p) =>
                          p ? { ...p, endPeriod: e.target.value as 'AM' | 'PM' } : p,
                        )
                      }
                      className="rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-2 py-2 text-xs text-slate-50 outline-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {programModalIsHoliday && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {programModalHolidayName || 'Αργία'}
                      </div>
                      <div className="opacity-90">
                        Θέλετε το μάθημα να γίνει παρόλο που είναι αργία;
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!eventModal.activeDuringHoliday}
                        onChange={(e) =>
                          setEventModal((p) =>
                            p ? { ...p, activeDuringHoliday: e.target.checked } : p,
                          )
                        }
                      />
                      <span>Ενεργό</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleProgramAskDeleteForDay}
                  className="rounded-md px-3 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  Ακύρωση για αυτή τη μέρα
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleEventModalClose}
                    className="btn-ghost rounded-md px-3 py-2 text-xs"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    Ακύρωση
                  </button>

                  <button
                    type="button"
                    onClick={handleEventModalSave}
                    className="rounded-md px-3 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    Ενημέρωση
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROGRAM Delete confirmation */}
        {eventModal && showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div
              className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl space-y-3"
              style={{ background: 'var(--color-sidebar)' }}
            >
              <h3 className="text-sm font-semibold text-slate-50">
                Ακύρωση μαθήματος για αυτή τη μέρα
              </h3>

              <p className="text-xs text-slate-200">
                Θέλετε σίγουρα να ακυρώσετε το μάθημα μόνο για τη συγκεκριμένη ημερομηνία;
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleProgramCancelDeleteConfirm}
                  className="btn-ghost rounded-md px-3 py-2 text-xs"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  Όχι
                </button>

                <button
                  type="button"
                  onClick={handleEventModalDeleteForDay}
                  className="rounded-md px-3 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  Ναι, ακύρωση
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TEST edit modal */}
        {testModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div
              className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl space-y-3"
              style={{ background: 'var(--color-sidebar)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-50">
                  Επεξεργασία διαγωνίσματος
                </h3>
                <button
                  type="button"
                  className="text-xs text-slate-200 hover:text-white"
                  onClick={handleTestModalClose}
                >
                  Κλείσιμο
                </button>
              </div>

              {testError && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {testError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-slate-200">Τμήμα *</label>
                <select
                  value={testModal.classId ?? ''}
                  onChange={handleTestFieldChange('classId')}
                  className="w-full rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-3 py-2 text-xs text-slate-50 outline-none"
                >
                  <option value="">Επιλέξτε τμήμα</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-200">Μάθημα *</label>
                <select
                  value={testModal.subjectId ?? ''}
                  onChange={handleTestFieldChange('subjectId')}
                  className="w-full rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-3 py-2 text-xs text-slate-50 outline-none"
                  disabled={!testModal.classId || testSubjectOptions.length === 0}
                >
                  <option value="">
                    {testSubjectOptions.length === 0 ? 'Δεν υπάρχουν μαθήματα' : 'Επιλέξτε μάθημα'}
                  </option>
                  {testSubjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-200">Ημερομηνία *</label>
                <AppDatePicker
                  value={testModal.date}
                  onChange={(v) => setTestModal((p) => (p ? { ...p, date: v } : p))}
                  placeholder="dd/mm/yyyy"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-200">Ώρα έναρξης *</label>
                  <div className="flex gap-2">
                    <input
                      value={testModal.startTime}
                      onChange={handleTestTimeChange('startTime')}
                      className="w-full rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-3 py-2 text-xs text-slate-50 outline-none"
                      placeholder="09:00"
                    />
                    <select
                      value={testModal.startPeriod}
                      onChange={(e) =>
                        setTestModal((p) =>
                          p ? { ...p, startPeriod: e.target.value as 'AM' | 'PM' } : p,
                        )
                      }
                      className="rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-2 py-2 text-xs text-slate-50 outline-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-200">Ώρα λήξης *</label>
                  <div className="flex gap-2">
                    <input
                      value={testModal.endTime}
                      onChange={handleTestTimeChange('endTime')}
                      className="w-full rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-3 py-2 text-xs text-slate-50 outline-none"
                      placeholder="10:00"
                    />
                    <select
                      value={testModal.endPeriod}
                      onChange={(e) =>
                        setTestModal((p) =>
                          p ? { ...p, endPeriod: e.target.value as 'AM' | 'PM' } : p,
                        )
                      }
                      className="rounded-md border border-slate-600 bg-[var(--color-input-bg)] px-2 py-2 text-xs text-slate-50 outline-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {testModalIsHoliday && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {testModalHolidayName || 'Αργία'}
                      </div>
                      <div className="opacity-90">
                        Θέλετε το διαγώνισμα να γίνει παρόλο που είναι αργία;
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!testModal.activeDuringHoliday}
                        onChange={(e) =>
                          setTestModal((p) =>
                            p ? { ...p, activeDuringHoliday: e.target.checked } : p,
                          )
                        }
                      />
                      <span>Ενεργό</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestCancelForDay}
                  disabled={savingTest}
                  className="rounded-md px-3 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  Ακύρωση για αυτή τη μέρα
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleTestModalClose}
                    disabled={savingTest}
                    className="btn-ghost rounded-md px-3 py-2 text-xs"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    Ακύρωση
                  </button>

                  <button
                    type="button"
                    onClick={handleTestModalSave}
                    disabled={savingTest}
                    className="rounded-md px-3 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    {savingTest ? 'Αποθήκευση…' : 'Ενημέρωση'}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestDelete}
                    disabled={savingTest}
                    className="rounded-md px-3 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: '#7f1d1d' }}
                  >
                    Διαγραφή
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

// ✅ THIS was missing in your file — without it you get the red error at the end
}
