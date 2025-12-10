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
  date: string;        // "YYYY-MM-DD"
  start_time: string;  // "HH:MM:SS"
  end_time: string;    // "HH:MM:SS"
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
};

type CalendarEventModal = {
  programItemId: string;
  originalDateStr: string; // "YYYY-MM-DD" when event was clicked
  date: string; // "dd/mm/yyyy" for AppDatePicker
  startTime: string; // "HH:MM" (12h input)
  startPeriod: 'AM' | 'PM';
  endTime: string; // "HH:MM" (12h input)
  endPeriod: 'AM' | 'PM';
  classId: string | null;
  subjectId: string | null;
  overrideId?: string;
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
  if (period === 'PM') {
    h += 12;
  } else if (period === 'AM' && h === 12) {
    h = 0;
  }

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
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return { time: '', period: 'AM' };
  }
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

  // NEW: subjects, class_subjects, tests
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);

  // PROGRAM event modal
  const [eventModal, setEventModal] = useState<CalendarEventModal | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // NEW: Test edit modal
  const [testModal, setTestModal] = useState<TestModalState | null>(null);
  const [savingTest, setSavingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  /* -------- Data loading -------- */

  // Load classes
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

  // Load tutors
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

  // Load program + items + overrides
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
            setOverrides(
              (overrideData ?? []) as ProgramItemOverrideRow[],
            );
          }
        } else {
          setOverrides([]);
        }
      }
    };

    loadProgram();
  }, [schoolId]);

  // Load holidays
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

  // Load school events
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

  // NEW: Load subjects, class_subjects, tests
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
              'id, school_id, class_id, subject_id, test_date, start_time, end_time, title, description',
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
          setClassSubjects(
            (classSubjData ?? []) as ClassSubjectRow[],
          );
        } else {
          setClassSubjects(
            (classSubjData ?? []) as ClassSubjectRow[],
          );
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

  // SAME logic as ProgramPage / TestsPage
  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];

    const cls = classes.find((c) => c.id === classId) ?? null;

    const attachedIds = new Set<string>();

    classSubjects
      .filter((cs) => cs.class_id === classId && cs.subject_id)
      .forEach((cs) => attachedIds.add(cs.subject_id));

    if (cls?.subject_id) {
      attachedIds.add(cls.subject_id);
    }

    const attachedSubjects: SubjectRow[] = [];
    attachedIds.forEach((id) => {
      const subj = subjectById.get(id);
      if (subj) attachedSubjects.push(subj);
    });

    if (attachedSubjects.length >= 2) {
      return attachedSubjects.sort((a, b) =>
        a.name.localeCompare(b.name, 'el-GR'),
      );
    }

    let levelId: string | null = null;
    if (cls?.subject_id) {
      const mainSubj = subjectById.get(cls.subject_id);
      levelId = mainSubj?.level_id ?? null;
    }

    let extraSubjects: SubjectRow[];
    if (levelId) {
      extraSubjects = subjects.filter((s) => s.level_id === levelId);
    } else {
      extraSubjects = subjects;
    }

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

    const holidaySet = new Set(holidays.map((h) => h.date));

    const tutorMap: Record<string, string> = {};
    tutors.forEach((t) => {
      if (t.id && t.full_name) {
        tutorMap[t.id] = t.full_name;
      }
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

    // For tests: group per (class_id, test_date) and track which (class, date) already has program
    const testsByKey = new Map<string, TestRow[]>();
    tests.forEach((t) => {
      const key = `${t.class_id}-${t.test_date}`;
      const arr = testsByKey.get(key) ?? [];
      arr.push(t);
      testsByKey.set(key, arr);
    });

    const programClassDateSet = new Set<string>();

    // 1) PROGRAM pattern-based events (plus combined tests)
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
      const effectiveEnd =
        patternEndDate < viewEnd ? patternEndDate : viewEnd;

      if (effectiveStart > effectiveEnd) return;

      let currentDate = getNextDateForDow(effectiveStart, dow);

      const tutorName =
        cls.tutor_id && tutorMap[cls.tutor_id]
          ? tutorMap[cls.tutor_id]
          : null;

      while (currentDate <= effectiveEnd) {
        const dateStr = formatLocalYMD(currentDate);
        const next = new Date(currentDate);
        next.setDate(next.getDate() + 7);

        if (holidaySet.has(dateStr)) {
          currentDate = next;
          continue;
        }

        const key = `${item.class_id}-${dateStr}`;
        programClassDateSet.add(key);

        const override = overrideMap.get(`${item.id}-${dateStr}`);

        let isDeleted = false;
        let startTimeStr = item.start_time!;
        let endTimeStr = item.end_time!;
        let overrideId: string | undefined;

        if (override) {
          usedOverrideIds.add(override.id);
          overrideId = override.id;
          if (override.is_deleted) {
            isDeleted = true;
          }
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

          // Check if there is at least one test for this class & date
          const testsForClassDate = testsByKey.get(key) ?? [];
          const combinedTest = testsForClassDate[0]; // we handle first one

          const titleBase = cls.title;
          const title = combinedTest
            ? `${titleBase} · Διαγώνισμα`
            : titleBase;

          out.push({
            id: `${item.id}-${dateStr}`,
            title,
            start,
            end,
            extendedProps: {
              kind: 'program',
              programItemId: item.id,
              classId: cls.id,
              subject: cls.subject,
              tutorName,
              overrideDate: override ? dateStr : null,
              overrideId: overrideId ?? null,
              // NEW: combined test info (if exists)
              testId: combinedTest ? combinedTest.id : null,
              testSubjectId: combinedTest ? combinedTest.subject_id : null,
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
      if (holidaySet.has(dateStr)) return;

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
        cls.tutor_id && tutorMap[cls.tutor_id]
          ? tutorMap[cls.tutor_id]
          : null;

      const key = `${item.class_id}-${dateStr}`;
      programClassDateSet.add(key);

      const testsForClassDate = testsByKey.get(key) ?? [];
      const combinedTest = testsForClassDate[0];

      const titleBase = cls.title;
      const title = combinedTest
        ? `${titleBase} · Διαγώνισμα`
        : titleBase;

      out.push({
        id: `${item.id}-${dateStr}-override`,
        title,
        start,
        end,
        extendedProps: {
          kind: 'program',
          programItemId: item.id,
          classId: cls.id,
          subject: cls.subject,
          tutorName,
          overrideDate: dateStr,
          overrideId: ov.id,
          testId: combinedTest ? combinedTest.id : null,
          testSubjectId: combinedTest ? combinedTest.subject_id : null,
        },
      });
    });

    // 3) Standalone TEST events (when there is no class that day)
    tests.forEach((t) => {
      const key = `${t.class_id}-${t.test_date}`;
      if (programClassDateSet.has(key)) {
        // already combined with class above
        return;
      }

      const dateObj = new Date(t.test_date + 'T00:00:00');
      if (dateObj < viewStart || dateObj > viewEnd) return;
      if (holidaySet.has(t.test_date)) return;

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
        extendedProps: {
          kind: 'test',
          testId: t.id,
          classId: t.class_id,
          subjectId: t.subject_id,
        },
      });
    });

    // 4) SCHOOL EVENTS
    schoolEvents.forEach((ev) => {
      const start = new Date(ev.date + 'T' + ev.start_time);
      const end = new Date(ev.date + 'T' + ev.end_time);

      if (start < viewStart || start > viewEnd) return;
      if (holidaySet.has(ev.date)) return;

      out.push({
        id: `event-${ev.id}`,
        title: ev.name,
        start,
        end,
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
    schoolEvents,
    tests,
    subjects,
  ]);

  /* -------- Drag & drop handling -------- */

  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, oldEvent, revert } = arg;

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
          prev.map((ev) =>
            ev.id === eventId ? (data as SchoolEventRow) : ev,
          ),
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
        const { data, error } = await supabase
          .from('tests')
          .update({
            test_date: newDateStr,
            start_time: newStartTimeDb,
            end_time: newEndTimeDb,
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
          prev.map((t) =>
            t.id === testId ? (data as TestRow) : t,
          ),
        );
      } catch (err) {
        console.error('Failed to handle test eventDrop', err);
        revert();
      }

      return;
    }

    // PROGRAM EVENTS (existing logic with overrides)
    const programItemId = event.extendedProps['programItemId'] as
      | string
      | undefined;

    if (!programItemId || !oldEvent || !oldEvent.start) {
      revert();
      return;
    }

    const oldDateStr = formatLocalYMD(oldEvent.start);

    try {
      if (oldDateStr === newDateStr) {
        const existing = overrides.find(
          (o) =>
            o.program_item_id === programItemId &&
            o.override_date === newDateStr,
        );

        if (existing) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              start_time: newStartTimeDb,
              end_time: newEndTimeDb,
              is_deleted: false,
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
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [
            ...prev,
            data as ProgramItemOverrideRow,
          ]);
        }
      } else {
        // different day
        const existingOld = overrides.find(
          (o) =>
            o.program_item_id === programItemId &&
            o.override_date === oldDateStr,
        );

        if (existingOld) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              is_deleted: true,
              start_time: null,
              end_time: null,
            })
            .eq('id', existingOld.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) =>
              o.id === existingOld.id
                ? (data as ProgramItemOverrideRow)
                : o,
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
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [
            ...prev,
            data as ProgramItemOverrideRow,
          ]);
        }

        const existingNew = overrides.find(
          (o) =>
            o.program_item_id === programItemId &&
            o.override_date === newDateStr,
        );

        if (existingNew) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              start_time: newStartTimeDb,
              end_time: newEndTimeDb,
              is_deleted: false,
            })
            .eq('id', existingNew.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) =>
              o.id === existingNew.id
                ? (data as ProgramItemOverrideRow)
                : o,
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
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [
            ...prev,
            data as ProgramItemOverrideRow,
          ]);
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

    const start = event.start;
    const end = event.end;

    const formatter = new Intl.DateTimeFormat('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    let timeRange = '';
    if (start && end) {
      timeRange = `${formatter.format(start)} – ${formatter.format(end)}`;
    } else if (start) {
      timeRange = formatter.format(start);
    }

    // 👉 Check if this event is a test (standalone) or a class that has a test
    const hasTest =
      kind === 'test' || !!event.extendedProps['testId'];

    const rawTitle = event.title ?? '';
    let mainTitle = rawTitle;

    // 👉 Strip the word "Διαγώνισμα" from the text title so we can show it as a badge
    if (hasTest) {
      if (/^Διαγώνισμα\s*·/u.test(rawTitle)) {
        // "Διαγώνισμα · XXX"
        mainTitle = rawTitle.replace(/^Διαγώνισμα\s*·\s*/u, '').trim();
      } else if (/\s*·\s*Διαγώνισμα\s*$/u.test(rawTitle)) {
        // "XXX · Διαγώνισμα"
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

        {/* Title row with Διαγώνισμα badge */}
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

          {mainTitle && (
            <span className="font-semibold">
              {mainTitle}
            </span>
          )}
        </div>

        {kind === 'program' && subject && (
          <div className="mt-0.5">
            {subject}
          </div>
        )}

        {kind === 'program' && tutorName && (
          <div className="mt-0.5 opacity-90">
            <span>{tutorName}</span>
          </div>
        )}
      </div>
    );
  };

  /* -------- Click handling (PROGRAM + TEST) -------- */

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

    const start24 = `${pad2(event.start.getHours())}:${pad2(
      event.start.getMinutes(),
    )}`;
    const end24 = `${pad2(event.end.getHours())}:${pad2(
      event.end.getMinutes(),
    )}`;

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
    });
    setShowDeleteConfirm(false);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const { event } = arg;
    const kind = event.extendedProps['kind'] as
      | 'program'
      | 'schoolEvent'
      | 'test'
      | undefined;

    if (!event.start || !event.end) return;

    // TEST event → open test modal
    if (kind === 'test') {
      openTestModalFromEvent(event);
      return;
    }

    // PROGRAM event with combined test → open test modal instead of override
    if (kind === 'program') {
      const testId = event.extendedProps['testId'] as string | null;
      if (testId) {
        openTestModalFromEvent(event);
        return;
      }

      // PROGRAM override modal
      const programItemId = event.extendedProps['programItemId'] as
        | string
        | undefined;

      if (!programItemId) return;

      const dateIso = formatLocalYMD(event.start);
      const overrideId = event.extendedProps['overrideId'] as string | null;

      const start24 = `${pad2(event.start.getHours())}:${pad2(
        event.start.getMinutes(),
      )}`;
      const end24 = `${pad2(event.end.getHours())}:${pad2(
        event.end.getMinutes(),
      )}`;

      const { time: startTime, period: startPeriod } = convert24To12(start24);
      const { time: endTime, period: endPeriod } = convert24To12(end24);

      const classIdProp = event.extendedProps['classId'] as
        | string
        | undefined;

      const clsRow = classIdProp
        ? classes.find((c) => c.id === classIdProp) ?? null
        : null;

      const prefilledSubjectId = clsRow?.subject_id ?? null;

      setEventError(null);
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
      });
      setShowDeleteConfirm(false);
      return;
    }

    // SCHOOL EVENTS: no modal for now
  };

  /* -------- PROGRAM override modal handlers -------- */

  const handleProgramFieldChange =
    (field: 'classId' | 'subjectId') =>
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setEventModal((prev) => {
        if (!prev) return prev;
        if (field === 'classId') {
          return { ...prev, classId: value || null, subjectId: null };
        }
        if (field === 'subjectId') {
          return { ...prev, subjectId: value || null };
        }
        return prev;
      });
    };

  const handleEventTimeChange =
    (field: 'startTime' | 'endTime') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const formatted = formatTimeInput(e.target.value);
      setEventModal((prev) =>
        prev ? { ...prev, [field]: formatted } : prev,
      );
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

    try {
      setEventError(null);

      // 1) Update program_items.class_id if changed
      const item = programItems.find((pi) => pi.id === programItemId);
      if (item && classId && classId !== item.class_id) {
        const { data: updatedItem, error: itemErr } = await supabase
          .from('program_items')
          .update({ class_id: classId })
          .eq('id', programItemId)
          .select('*')
          .single();

        if (itemErr || !updatedItem)
          throw itemErr ?? new Error('No data');

        setProgramItems((prev) =>
          prev.map((pi) =>
            pi.id === programItemId
              ? (updatedItem as ProgramItemRow)
              : pi,
          ),
        );
      }

      // 2) Update class subject if changed
      if (classId) {
        const cls = classes.find((c) => c.id === classId) ?? null;
        const oldSubjectId = cls?.subject_id ?? null;
        const finalSubjectId =
          subjectId ?? subjectOptions[0]?.id ?? null;

        if (finalSubjectId && finalSubjectId !== oldSubjectId) {
          const subjRow = subjectById.get(finalSubjectId);
          const subjectName = subjRow?.name ?? null;

          const { data: updatedClass, error: classErr } = await supabase
            .from('classes')
            .update({
              subject_id: finalSubjectId,
              subject: subjectName,
            })
            .eq('id', classId)
            .select(
              'id, school_id, title, subject, subject_id, tutor_id',
            )
            .maybeSingle();

          if (classErr || !updatedClass)
            throw classErr ?? new Error('No data');

          setClasses((prev) =>
            prev.map((c) =>
              c.id === classId
                ? (updatedClass as ClassRow)
                : c,
            ),
          );
        }
      }

      // 3) Update / create overrides for new times/date
      if (newDateStr === originalDateStr) {
        // same day -> just ensure override for time
        const existing = overrides.find(
          (o) =>
            o.program_item_id === programItemId &&
            o.override_date === newDateStr,
        );

        if (existing) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              start_time: startTimeDb,
              end_time: endTimeDb,
              is_deleted: false,
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) =>
              o.id === existing.id
                ? (data as ProgramItemOverrideRow)
                : o,
            ),
          );
        } else {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .insert({
              program_item_id: programItemId,
              override_date: newDateStr,
              start_time: startTimeDb,
              end_time: endTimeDb,
              is_deleted: false,
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [
            ...prev,
            data as ProgramItemOverrideRow,
          ]);
        }
      } else {
        // different day -> mark old day as deleted and create/update new day override
        const existingOld = overrides.find(
          (o) =>
            o.program_item_id === programItemId &&
            o.override_date === originalDateStr,
        );

        if (existingOld) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              is_deleted: true,
              start_time: null,
              end_time: null,
            })
            .eq('id', existingOld.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) =>
              o.id === existingOld.id
                ? (data as ProgramItemOverrideRow)
                : o,
            ),
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
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [
            ...prev,
            data as ProgramItemOverrideRow,
          ]);
        }

        const existingNew = overrides.find(
          (o) =>
            o.program_item_id === programItemId &&
            o.override_date === newDateStr,
        );

        if (existingNew) {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .update({
              start_time: startTimeDb,
              end_time: endTimeDb,
              is_deleted: false,
            })
            .eq('id', existingNew.id)
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) =>
            prev.map((o) =>
              o.id === existingNew.id
                ? (data as ProgramItemOverrideRow)
                : o,
            ),
          );
        } else {
          const { data, error } = await supabase
            .from('program_item_overrides')
            .insert({
              program_item_id: programItemId,
              override_date: newDateStr,
              start_time: startTimeDb,
              end_time: endTimeDb,
              is_deleted: false,
            })
            .select()
            .single();

          if (error || !data) throw error ?? new Error('No data');

          setOverrides((prev) => [
            ...prev,
            data as ProgramItemOverrideRow,
          ]);
        }
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
        (o) =>
          o.program_item_id === programItemId &&
          o.override_date === originalDateStr,
      );

      if (existing) {
        const { data, error } = await supabase
          .from('program_item_overrides')
          .update({
            is_deleted: true,
            start_time: null,
            end_time: null,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error || !data) throw error ?? new Error('No data');

        setOverrides((prev) =>
          prev.map((o) =>
            o.id === existing.id
              ? (data as ProgramItemOverrideRow)
              : o,
          ),
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
          })
          .select()
          .single();

        if (error || !data) throw error ?? new Error('No data');

        setOverrides((prev) => [
          ...prev,
          data as ProgramItemOverrideRow,
        ]);
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
    (
      e: ChangeEvent<
        HTMLSelectElement | HTMLInputElement
      >,
    ) => {
      const value = e.target.value;
      setTestModal((prev) => {
        if (!prev) return prev;
        if (field === 'classId') {
          return { ...prev, classId: value || null, subjectId: null };
        }
        if (field === 'subjectId') {
          return { ...prev, subjectId: value || null };
        }
        return { ...prev, [field]: value as any };
      });
    };

  const handleTestTimeChange =
    (field: 'startTime' | 'endTime') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const formatted = formatTimeInput(e.target.value);
      setTestModal((prev) =>
        prev ? { ...prev, [field]: formatted } : prev,
      );
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

    setSavingTest(true);
    setTestError(null);

    const payload = {
      class_id: classId,
      subject_id: subjectId ?? subjectOptions[0]?.id,
      test_date: testDateISO,
      start_time: `${start24}:00`,
      end_time: `${end24}:00`,
      title: title || null,
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

    setTests((prev) =>
      prev.map((t) => (t.id === testId ? (data as TestRow) : t)),
    );
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
      const { error } = await supabase
        .from('tests')
        .delete()
        .eq('id', testId);

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

  /* -------- Render -------- */

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
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
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
      )}

      {/* PROGRAM override / edit modal – same sections as test modal (without title) */}
      {eventModal && !showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl space-y-3"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-50">
                Επεξεργασία μαθήματος
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEventModal(null);
                  setShowDeleteConfirm(false);
                  setEventError(null);
                }}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            {eventError && (
              <div className="rounded border border-red-500 bg-red-900/40 px-3 py-1.5 text-[11px] text-red-100">
                {eventError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Τμήμα */}
              <div>
                <label className="form-label text-slate-100">
                  Τμήμα *
                </label>
                <select
                  className="form-input"
                  value={eventModal.classId ?? ''}
                  onChange={handleProgramFieldChange('classId')}
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="">Επιλέξτε τμήμα</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Μάθημα */}
              <div>
                <label className="form-label text-slate-100">
                  Μάθημα για το τμήμα *
                </label>
                {(() => {
                  const options = eventModal.classId
                    ? getSubjectsForClass(eventModal.classId)
                    : [];
                  return (
                    <>
                      <select
                        className="form-input select-accent"
                        value={eventModal.subjectId ?? ''}
                        onChange={handleProgramFieldChange('subjectId')}
                        disabled={
                          options.length === 0 || !eventModal.classId
                        }
                        style={{
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="">
                          {options.length === 0
                            ? 'Δεν έχουν οριστεί μαθήματα'
                            : 'Επιλέξτε μάθημα'}
                        </option>
                        {options.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {options.length === 0 && eventModal.classId && (
                        <p className="mt-1 text-[10px] text-amber-300">
                          Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Ημερομηνία μαθήματος */}
              <div>
                <label className="form-label text-slate-100">
                  Ημερομηνία μαθήματος *
                </label>
                <AppDatePicker
                  value={eventModal.date}
                  onChange={(newValue) =>
                    setEventModal((prev) =>
                      prev ? { ...prev, date: newValue } : prev,
                    )
                  }
                  placeholder="π.χ. 12/05/2025"
                />
              </div>

              {/* Ώρες */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">
                    Ώρα έναρξης
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 08:00"
                      value={eventModal.startTime}
                      onChange={handleEventTimeChange('startTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={eventModal.startPeriod}
                      onChange={(e) =>
                        setEventModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                startPeriod: e.target
                                  .value as 'AM' | 'PM',
                              }
                            : prev,
                        )
                      }
                      className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label text-slate-100">
                    Ώρα λήξης
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 09:30"
                      value={eventModal.endTime}
                      onChange={handleEventTimeChange('endTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={eventModal.endPeriod}
                      onChange={(e) =>
                        setEventModal((prev) =>
                          prev
                            ? {
                                ...prev,
                                endPeriod: e.target.value as 'AM' | 'PM',
                              }
                            : prev,
                        )
                      }
                      className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500"
                >
                  Διαγραφή μόνο για αυτή την ημέρα
                </button>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEventModal(null);
                      setShowDeleteConfirm(false);
                      setEventError(null);
                    }}
                    className="btn-ghost"
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
                    className="btn-primary"
                  >
                    Αποθήκευση
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation – for PROGRAM events */}
      {eventModal && showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl space-y-3"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-50">
                Διαγραφή μαθήματος
              </h2>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-100">
              Σίγουρα θέλεις να διαγράψεις το μάθημα για την ημερομηνία{' '}
              <span className="font-semibold">
                {formatDateDisplay(eventModal.originalDateStr)}
              </span>
              ; Η ενέργεια αυτή επηρεάζει μόνο αυτή την ημέρα και δεν μπορεί
              να ανακληθεί.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-ghost"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleEventModalDeleteForDay}
                className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Διαγραφή
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEST edit modal */}
      {testModal && !showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl space-y-3"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-50">
                Επεξεργασία διαγωνίσματος
              </h2>
              <button
                type="button"
                onClick={handleTestModalClose}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            {testError && (
              <div className="rounded border border-red-500 bg-red-900/40 px-3 py-1.5 text-[11px] text-red-100">
                {testError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Τμήμα */}
              <div>
                <label className="form-label text-slate-100">
                  Τμήμα *
                </label>
                <select
                  className="form-input"
                  value={testModal.classId ?? ''}
                  onChange={handleTestFieldChange('classId')}
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="">Επιλέξτε τμήμα</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Μάθημα */}
              <div>
                <label className="form-label text-slate-100">
                  Μάθημα για το τμήμα *
                </label>
                {(() => {
                  const options = getSubjectsForClass(testModal.classId);
                  return (
                    <>
                      <select
                        className="form-input select-accent"
                        value={testModal.subjectId ?? ''}
                        onChange={handleTestFieldChange('subjectId')}
                        disabled={options.length === 0 || !testModal.classId}
                        style={{
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="">
                          {options.length === 0
                            ? 'Δεν έχουν οριστεί μαθήματα'
                            : 'Επιλέξτε μάθημα'}
                        </option>
                        {options.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {options.length === 0 && testModal.classId && (
                        <p className="mt-1 text-[10px] text-amber-300">
                          Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Ημερομηνία */}
              <div>
                <label className="form-label text-slate-100">
                  Ημερομηνία διαγωνίσματος *
                </label>
                <AppDatePicker
                  value={testModal.date}
                  onChange={(newValue) =>
                    setTestModal((prev) =>
                      prev ? { ...prev, date: newValue } : prev,
                    )
                  }
                  placeholder="π.χ. 12/05/2025"
                />
              </div>

              {/* Ώρες */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">
                    Ώρα έναρξης
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 08:00"
                      value={testModal.startTime}
                      onChange={handleTestTimeChange('startTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={testModal.startPeriod}
                      onChange={handleTestFieldChange('startPeriod')}
                      className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label text-slate-100">
                    Ώρα λήξης
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 09:30"
                      value={testModal.endTime}
                      onChange={handleTestTimeChange('endTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={testModal.endPeriod}
                      onChange={handleTestFieldChange('endPeriod')}
                      className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Τίτλος */}
              <div>
                <label className="form-label text-slate-100">
                  Τίτλος (προαιρετικό)
                </label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. Διαγώνισμα Κεφαλαίου 3"
                  value={testModal.title}
                  onChange={handleTestFieldChange('title')}
                />
              </div>

              {/* Buttons */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500"
                >
                  Διαγραφή διαγωνίσματος
                </button>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleTestModalClose}
                    className="btn-ghost"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                    disabled={savingTest}
                  >
                    Ακύρωση
                  </button>
                  <button
                    type="button"
                    onClick={handleTestModalSave}
                    className="btn-primary"
                    disabled={savingTest}
                  >
                    {savingTest ? 'Αποθήκευση…' : 'Αποθήκευση'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEST delete confirmation */}
      {testModal && showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl space-y-3"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-slate-50">
                Διαγραφή διαγωνίσματος
              </h2>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-100">
              Σίγουρα θέλεις να διαγράψεις αυτό το διαγώνισμα για την ημερομηνία{' '}
              <span className="font-semibold">
                {testModal.date}
              </span>
              ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-ghost"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleTestDelete}
                className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Διαγραφή
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
