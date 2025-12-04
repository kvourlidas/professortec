import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

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
import StatWidget from '../components/StatWidget';
import elLocale from '@fullcalendar/core/locales/el';

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
  start_date: string | null; // "YYYY-MM-DD"
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

type DashboardStats = {
  studentsCount: number;
  monthlyIncome: number;
  yearlyIncome: number;
};

type DashboardNote = {
  id: string;
  school_id: string;
  content: string;
  color: string;
  created_at: string | null;
  is_urgent: boolean;
};

const NOTE_COLORS = [
  { value: '#f97316', label: 'Πορτοκαλί' },
  { value: '#3b82f6', label: 'Μπλε' },
  { value: '#22c55e', label: 'Πράσινο' },
  { value: '#eab308', label: 'Κίτρινο' },
  { value: '#f97373', label: 'Κόκκινο' },
];

const NOTES_PER_PAGE = 5;

const pad2 = (n: number) => n.toString().padStart(2, '0');

// 🔧 helper: local date → "YYYY-MM-DD" (no UTC shift)
const formatLocalYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
};

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

type CalendarEventModal = {
  programItemId: string;
  dateStr: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  overrideId?: string;
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);
  const [overrides, setOverrides] = useState<ProgramItemOverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    studentsCount: 0,
    monthlyIncome: 0,
    yearlyIncome: 0,
  });

  // --- calendar view state (for month/week handling) ---
  const [calendarView, setCalendarView] = useState<string>('timeGridWeek');
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(
    null,
  );

  // modal for editing / deleting specific occurrence
  const [eventModal, setEventModal] = useState<CalendarEventModal | null>(null);

  // NOTES
  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<string>(NOTE_COLORS[0].value);
  const [noteUrgent, setNoteUrgent] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesPage, setNotesPage] = useState(1);

  // Weekday from Date -> string
  const weekdayFromDate = (d: Date): string => {
    const map: Record<number, string> = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    return map[d.getDay()];
  };

  // Load classes (basic info only)
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
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

  // Load program + program_items + overrides
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

  // Placeholder stats
  useEffect(() => {
    const loadStats = async () => {
      if (!schoolId) return;

      setStats({
        studentsCount: 0,
        monthlyIncome: 0,
        yearlyIncome: 0,
      });
    };

    loadStats();
  }, [schoolId]);

  // Load notes
  useEffect(() => {
    if (!schoolId) {
      setNotes([]);
      return;
    }

    const loadNotes = async () => {
      setNotesLoading(true);
      const { data, error } = await supabase
        .from('dashboard_notes')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load dashboard notes', error);
        setNotes([]);
      } else {
        setNotes((data ?? []) as DashboardNote[]);
      }
      setNotesLoading(false);
      setNotesPage(1);
    };

    loadNotes();
  }, [schoolId]);

  // keep notesPage within range
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(notes.length / NOTES_PER_PAGE));
    if (notesPage > totalPages) {
      setNotesPage(totalPages);
    }
  }, [notes.length, notesPage]);

  // urgent first, then newest first
  const sortedNotes = useMemo(() => {
    const clone = [...notes];
    clone.sort((a, b) => {
      if (a.is_urgent !== b.is_urgent) {
        return a.is_urgent ? -1 : 1; // urgent first
      }
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da; // newest first
    });
    return clone;
  }, [notes]);

  const totalNotesPages = Math.max(
    1,
    Math.ceil(sortedNotes.length / NOTES_PER_PAGE),
  );

  const pageNotes = useMemo(() => {
    const start = (notesPage - 1) * NOTES_PER_PAGE;
    return sortedNotes.slice(start, start + NOTES_PER_PAGE);
  }, [sortedNotes, notesPage]);

  const handleAddNote = async () => {
    if (!schoolId) return;
    const trimmed = noteText.trim();
    if (!trimmed) return;

    setNotesSaving(true);
    const { data, error } = await supabase
      .from('dashboard_notes')
      .insert({
        school_id: schoolId,
        content: trimmed,
        color: noteColor,
        is_urgent: noteUrgent,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert dashboard note', error);
    } else if (data) {
      setNotes((prev) => [data as DashboardNote, ...prev]);
      setNoteText('');
      setNoteUrgent(false);
      setNotesPage(1);
    }
    setNotesSaving(false);
  };

  const handleDeleteNote = async (id: string) => {
    const prev = notes;
    setNotes((n) => n.filter((note) => note.id !== id));

    const { error } = await supabase
      .from('dashboard_notes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete dashboard note', error);
      setNotes(prev);
    }
  };

  const handleChangeNoteColor = async (id: string, color: string) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, color } : note)),
    );

    const { error } = await supabase
      .from('dashboard_notes')
      .update({ color })
      .eq('id', id);

    if (error) {
      console.error('Failed to update note color', error);
    }
  };

  const handleToggleUrgent = async (id: string, current: boolean) => {
    const prev = notes;
    setNotes((list) =>
      list.map((note) =>
        note.id === id ? { ...note, is_urgent: !current } : note,
      ),
    );

    const { error } = await supabase
      .from('dashboard_notes')
      .update({ is_urgent: !current })
      .eq('id', id);

    if (error) {
      console.error('Failed to update note urgency', error);
      setNotes(prev);
    }
  };

  // ---- Calendar events: from program_items + overrides ----
  const events = useMemo(() => {
    if (!viewRange) return [];

    const { start: viewStart, end: viewEnd } = viewRange;
    const out: any[] = [];

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

    // 1) Pattern-based events (weekly), modified by overrides on same day
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
        const key = `${item.id}-${dateStr}`;
        const override = overrideMap.get(key);

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

          out.push({
            id: `${item.id}-${dateStr}`,
            title: cls.title,
            start,
            end,
            extendedProps: {
              programItemId: item.id,
              classId: cls.id,
              subject: cls.subject,
              tutorName,
              overrideDate: override ? dateStr : null,
              overrideId: overrideId ?? null,
            },
          });
        }

        const next = new Date(currentDate);
        next.setDate(next.getDate() + 7);
        currentDate = next;
      }
    });

    // 2) Overrides that create a one-off event on a different weekday
    overrides.forEach((ov) => {
      if (!ov.override_date) return;
      if (ov.is_deleted) return;
      if (usedOverrideIds.has(ov.id)) return; // already used above

      const item = programItemMap.get(ov.program_item_id);
      if (!item) return;

      const cls = classMap.get(item.class_id);
      if (!cls) return;

      const overrideDateObj = new Date(ov.override_date + 'T00:00:00');
      if (overrideDateObj < viewStart || overrideDateObj > viewEnd) return;

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

      const dateStr = ov.override_date;

      out.push({
        id: `${item.id}-${dateStr}-override`,
        title: cls.title,
        start,
        end,
        extendedProps: {
          programItemId: item.id,
          classId: cls.id,
          subject: cls.subject,
          tutorName,
          overrideDate: dateStr,
          overrideId: ov.id,
        },
      });
    });

    return out;
  }, [viewRange, programItems, classes, tutors, overrides]);

  // ✅ Drag & drop single occurrence, no duplicates
  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, oldEvent, revert } = arg;

    const programItemId = event.extendedProps['programItemId'] as
      | string
      | undefined;

    if (
      !programItemId ||
      !event.start ||
      !event.end ||
      !oldEvent ||
      !oldEvent.start
    ) {
      revert();
      return;
    }

    const oldDateStr = formatLocalYMD(oldEvent.start);
    const newDateStr = formatLocalYMD(event.start);

    const newStartTimeDb = `${pad2(event.start.getHours())}:${pad2(
      event.start.getMinutes(),
    )}:00`;
    const newEndTimeDb = `${pad2(event.end.getHours())}:${pad2(
      event.end.getMinutes(),
    )}:00`;

    try {
      if (oldDateStr === newDateStr) {
        // same day → only time changed
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
        // different day → delete old occurrence, create/update new one

        // 1) Mark old date as deleted (so pattern won't draw it)
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

        // 2) Create/update override for new date with new time
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

  const renderEventContent = (arg: EventContentArg) => {
    const { event, timeText } = arg;
    const subject = event.extendedProps['subject'] as string | null;
    const tutorName = event.extendedProps['tutorName'] as string | null;

    return (
      <div className="flex flex-col text-[10px] leading-tight">
        <div className="font-semibold">{timeText}</div>
        <div className="mt-0.5 font-semibold">{event.title}</div>

        {subject && <div className="mt-0.5">{subject}</div>}

        {tutorName && (
          <div className="mt-0.5 opacity-90">
            <span>{tutorName}</span>
          </div>
        )}
      </div>
    );
  };

  // click on event → open modal
  const handleEventClick = (arg: EventClickArg) => {
    const { event } = arg;
    const programItemId = event.extendedProps['programItemId'] as
      | string
      | undefined;

    if (!programItemId || !event.start || !event.end) return;

    const dateStr = formatLocalYMD(event.start);
    const overrideId = event.extendedProps['overrideId'] as
      | string
      | null;

    const startTime = `${pad2(event.start.getHours())}:${pad2(
      event.start.getMinutes(),
    )}`;
    const endTime = `${pad2(event.end.getHours())}:${pad2(
      event.end.getMinutes(),
    )}`;

    setEventModal({
      programItemId,
      dateStr,
      startTime,
      endTime,
      overrideId: overrideId ?? undefined,
    });
  };

  const handleEventModalSave = async () => {
    if (!eventModal) return;
    const { programItemId, dateStr, startTime, endTime, overrideId } =
      eventModal;

    const startTimeDb = `${startTime}:00`;
    const endTimeDb = `${endTime}:00`;

    try {
      if (overrideId) {
        const { data, error } = await supabase
          .from('program_item_overrides')
          .update({
            start_time: startTimeDb,
            end_time: endTimeDb,
            is_deleted: false,
          })
          .eq('id', overrideId)
          .select()
          .single();

        if (error || !data) throw error ?? new Error('No data');

        setOverrides((prev) =>
          prev.map((o) =>
            o.id === overrideId ? (data as ProgramItemOverrideRow) : o,
          ),
        );
      } else {
        const existing = overrides.find(
          (o) =>
            o.program_item_id === programItemId &&
            o.override_date === dateStr,
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
              override_date: dateStr,
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
    } catch (err) {
      console.error('Failed to save event override via modal', err);
    }
  };

  const handleEventModalDeleteForDay = async () => {
    if (!eventModal) return;
    const { programItemId, dateStr } = eventModal;

    try {
      const existing = overrides.find(
        (o) =>
          o.program_item_id === programItemId &&
          o.override_date === dateStr,
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
            override_date: dateStr,
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
    } catch (err) {
      console.error('Failed to delete event occurrence via modal', err);
    }
  };

  // ---- calendar callbacks: view change ----
  const handleDatesSet = (arg: DatesSetArg) => {
    setCalendarView(arg.view.type);
    setViewRange({ start: arg.start, end: arg.end });
  };

  return (
    <div className="space-y-6">
      {/* Top widgets */}
      <section className="grid gap-3 md:grid-cols-3">
        <StatWidget
          title="Σύνολο μαθητών"
          value={stats.studentsCount}
          subtitle="Θα συνδεθεί με το σύστημα μαθητών."
          variant="primary"
        />

        <StatWidget
          title="Μηνιαίο εισόδημα"
          value={`€ ${stats.monthlyIncome.toFixed(2)}`}
          subtitle="Θα υπολογίζεται από τις πληρωμές."
          variant="success"
        />

        <StatWidget
          title="Ετήσιο εισόδημα"
          value={`€ ${stats.yearlyIncome.toFixed(2)}`}
          subtitle="Θα ενημερώνεται αυτόματα μελλοντικά."
          variant="success"
        />
      </section>

      {/* Notes section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-50">Σημειώσεις</h2>

        <div className="border border-slate-700 rounded-md bg-[color:var(--color-sidebar)] p-3 space-y-3">
          {/* add note form */}
          <div className="flex flex-col gap-2 md:flex-row md:items-start">
            <textarea
              className="flex-1 rounded-md border border-slate-600 bg-[color:var(--color-input-bg)] px-3 py-2 text-xs text-white outline-none"
              rows={2}
              placeholder="Γράψε μια σημείωση για σήμερα…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className="flex flex-row md:flex-col gap-2 md:w-56">
              {/* colors + urgent */}
              <div className="flex items-center gap-2 justify-center md:justify-start">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNoteColor(c.value)}
                    className={`h-5 w-5 rounded-full border border-slate-800 transition-transform ${
                      noteColor === c.value
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                        : ''
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    aria-label={c.label}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setNoteUrgent((v) => !v)}
                  className={`px-2 py-[2px] rounded-full text-[10px] border transition ${
                    noteUrgent
                      ? 'border-red-500 bg-red-500/15 text-red-300'
                      : 'border-slate-600 text-slate-300'
                  }`}
                >
                  {noteUrgent ? 'Επείγον ✔' : 'Επείγον'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddNote}
                disabled={notesSaving || !noteText.trim()}
                className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed text-[11px] py-1"
              >
                {notesSaving ? 'Αποθήκευση…' : 'Προσθήκη σημείωσης'}
              </button>
            </div>
          </div>

          {/* notes list */}
          <div className="border-t border-slate-700 pt-2">
            {notesLoading ? (
              <p className="text-[11px] text-slate-300">
                Φόρτωση σημειώσεων…
              </p>
            ) : sortedNotes.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                Δεν υπάρχουν ακόμη σημειώσεις για το σχολείο σας.
              </p>
            ) : (
              <>
                <ol
                  className="space-y-2 text-[11px] list-decimal list-inside"
                  start={(notesPage - 1) * NOTES_PER_PAGE + 1}
                >
                  {pageNotes.map((note, idx) => {
                    const globalIndex =
                      (notesPage - 1) * NOTES_PER_PAGE + idx + 1;

                    return (
                      <li
                        key={note.id}
                        className="flex items-start gap-2 rounded-md px-2 py-1 border border-transparent"
                        style={{
                          background: `linear-gradient(to right, ${note.color}40, transparent)`,
                          borderColor: note.is_urgent
                            ? 'rgba(248, 113, 113, 0.8)'
                            : 'transparent',
                        }}
                      >
                        <div
                          className="mt-[3px] h-3 w-3 rounded-full flex-shrink-0 border border-slate-800"
                          style={{ backgroundColor: note.color }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="whitespace-pre-wrap text-slate-100">
                              {note.content}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-[10px] text-slate-300 hover:text-red-400"
                            >
                              Διαγραφή
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-slate-200">
                              Σημείωση #{globalIndex}
                            </span>

                            {note.is_urgent && (
                              <span className="text-[10px] px-2 py-[1px] rounded-full bg-red-500/20 text-red-300 border border-red-500/60">
                                Επείγον
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleUrgent(note.id, note.is_urgent)
                              }
                              className="text-[10px] px-2 py-[1px] rounded-full border border-slate-600 text-slate-200 hover:border-red-400 hover:text-red-300"
                            >
                              {note.is_urgent
                                ? 'Αφαίρεση επείγοντος'
                                : 'Σήμανση επείγον'}
                            </button>

                            {/* per-note color picker – dots */}
                            <div className="flex items-center gap-1">
                              {NOTE_COLORS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() =>
                                    handleChangeNoteColor(note.id, c.value)
                                  }
                                  className={`h-4 w-4 rounded-full border border-slate-800 transition-transform ${
                                    note.color === c.value
                                      ? 'ring-2 ring-white ring-offset-[1px]'
                                      : ''
                                  }`}
                                  style={{ backgroundColor: c.value }}
                                  title={c.label}
                                  aria-label={c.label}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {/* pagination */}
                {totalNotesPages > 1 && (
                  <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-slate-300">
                    <button
                      type="button"
                      onClick={() =>
                        setNotesPage((p) => Math.max(1, p - 1))
                      }
                      disabled={notesPage === 1}
                      className="px-2 py-[2px] rounded border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Προηγούμενη
                    </button>
                    <span>
                      Σελίδα {notesPage} από {totalNotesPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNotesPage((p) =>
                          Math.min(totalNotesPages, p + 1),
                        )
                      }
                      disabled={notesPage === totalNotesPages}
                      className="px-2 py-[2px] rounded border border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Επόμενη
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Calendar */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-50">
          Πρόγραμμα Τμημάτων
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
      </section>

      {/* Modal for editing a single occurrence */}
      {eventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-md bg-slate-900 border border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-50 mb-1">
              Επεξεργασία μαθήματος
            </h3>
            <p className="text-[11px] text-slate-300">
              Ημερομηνία: {eventModal.dateStr}
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-200">
                  Ώρα έναρξης
                </label>
                <input
                  type="time"
                  value={eventModal.startTime}
                  onChange={(e) =>
                    setEventModal((prev) =>
                      prev
                        ? { ...prev, startTime: e.target.value }
                        : prev,
                    )
                  }
                  className="rounded border border-slate-600 bg-[color:var(--color-input-bg)] px-2 py-1 text-xs text-white outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-200">
                  Ώρα λήξης
                </label>
                <input
                  type="time"
                  value={eventModal.endTime}
                  onChange={(e) =>
                    setEventModal((prev) =>
                      prev
                        ? { ...prev, endTime: e.target.value }
                        : prev,
                    )
                  }
                  className="rounded border border-slate-600 bg-[color:var(--color-input-bg)] px-2 py-1 text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="pt-3 mt-2 flex justify-between items-center border-t border-slate-700">
              <button
                type="button"
                onClick={handleEventModalDeleteForDay}
                className="text-[11px] px-2 py-1 rounded border border-red-500 text-red-300 hover:bg-red-500/10"
              >
                Διαγραφή μόνο για αυτή την ημέρα
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEventModal(null)}
                  className="text-[11px] px-3 py-1 rounded border border-slate-600 text-slate-200 hover:bg-slate-700/60"
                >
                  Άκυρο
                </button>
                <button
                  type="button"
                  onClick={handleEventModalSave}
                  className="text-[11px] px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Αποθήκευση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
