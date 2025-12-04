// src/components/dashboard/DashboardCalendarSection.tsx
import { useEffect, useMemo, useState } from 'react';
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

/* holidays */
type HolidayRow = {
  id: string;
  school_id: string;
  date: string; // "YYYY-MM-DD"
  name: string | null;
};

/* school events from EventsPage */
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

type CalendarEventModal = {
  programItemId: string;
  dateStr: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  overrideId?: string;
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

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

  // calendar view range
  const [calendarView, setCalendarView] = useState<string>('timeGridWeek');
  const [viewRange, setViewRange] = useState<{ start: Date; end: Date } | null>(
    null,
  );

  // holidays
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);

  // school events (from EventsPage)
  const [schoolEvents, setSchoolEvents] = useState<SchoolEventRow[]>([]);

  // modal for editing / deleting specific occurrence (PROGRAM items)
  const [eventModal, setEventModal] = useState<CalendarEventModal | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Load school events (for all dates; filtering is done in events useMemo by viewRange)
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

  // Events for FullCalendar (program + overrides + school events)
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

    // 1) Pattern-based PROGRAM events
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

        // Skip holidays
        if (holidaySet.has(dateStr)) {
          currentDate = next;
          continue;
        }

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
              kind: 'program',
              programItemId: item.id,
              classId: cls.id,
              subject: cls.subject,
              tutorName,
              overrideDate: override ? dateStr : null,
              overrideId: overrideId ?? null,
            },
          });
        }

        currentDate = next;
      }
    });

    // 2) PROGRAM overrides that create one-off events on different weekday
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

      out.push({
        id: `${item.id}-${dateStr}-override`,
        title: cls.title,
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
        },
      });
    });

    // 3) SCHOOL EVENTS (from EventsPage)
    schoolEvents.forEach((ev) => {
      // Build start/end Date objects
      const start = new Date(ev.date + 'T' + ev.start_time);
      const end = new Date(ev.date + 'T' + ev.end_time);

      if (start < viewStart || start > viewEnd) return;

      // skip if holiday, if you want (optional)
      if (holidaySet.has(ev.date)) return;

      out.push({
        id: `event-${ev.id}`,
        title: ev.name,
        start,
        end,
        // ⬇️ removed flat blue so they use the same gradient styling
        extendedProps: {
          kind: 'schoolEvent',
          eventId: ev.id,
          description: ev.description,
        },
      });
    });

    return out;
  }, [viewRange, programItems, classes, tutors, overrides, holidays, schoolEvents]);

  // drag & drop handling (PROGRAM + SCHOOL EVENTS)
  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, oldEvent, revert } = arg;

    const kind = event.extendedProps['kind'] as
      | 'program'
      | 'schoolEvent'
      | undefined;

    // common date/times
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

    // 1) SCHOOL EVENTS: simple update to school_events table
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

    // 2) PROGRAM EVENTS: existing logic with overrides
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

        // 1) mark old date as deleted
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

        // 2) override for new date
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
    const { event } = arg;
    const kind = event.extendedProps['kind'] as string | undefined;

    // PROGRAM events extra info
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

    return (
      <div className="flex flex-col text-[12px] leading-tight">
        {timeRange && (
          <div className="font-semibold text-[13px] text-[#ffc947]">
            {timeRange}
          </div>
        )}

        <div className="mt-0.5 font-semibold">{event.title}</div>

        {/* Only program events have subject / tutor */}
        {kind === 'program' && subject && (
          <div className="mt-0.5">{subject}</div>
        )}

        {kind === 'program' && tutorName && (
          <div className="mt-0.5 opacity-90">
            <span>{tutorName}</span>
          </div>
        )}
      </div>
    );
  };

  const handleEventClick = (arg: EventClickArg) => {
    const { event } = arg;
    const kind = event.extendedProps['kind'] as
      | 'program'
      | 'schoolEvent'
      | undefined;

    if (!event.start || !event.end) return;

    // PROGRAM items → open override modal (existing behavior)
    if (kind === 'program') {
      const programItemId = event.extendedProps['programItemId'] as
        | string
        | undefined;

      if (!programItemId) return;

      const dateStr = formatLocalYMD(event.start);
      const overrideId = event.extendedProps['overrideId'] as string | null;

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
      setShowDeleteConfirm(false);
      return;
    }

    // SCHOOL EVENTS: for now → no modal, just ignore click or later we can add view-only modal
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
      setShowDeleteConfirm(false);
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
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete event occurrence via modal', err);
    }
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setCalendarView(arg.view.type);
    setViewRange({ start: arg.start, end: arg.end });
  };

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

      {/* Modal for PROGRAM override */}
      {eventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-sm rounded-md bg-slate-900 border border-slate-700 p-4 space-y-3">
            {/* X close button */}
            <button
              type="button"
              onClick={() => {
                setEventModal(null);
                setShowDeleteConfirm(false);
              }}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 text-sm"
              aria-label="Κλείσιμο"
            >
              ×
            </button>

            {showDeleteConfirm ? (
              <>
                <h3 className="text-sm font-semibold text-slate-50 mb-1">
                  Διαγραφή μαθήματος
                </h3>
                <p className="text-[11px] text-slate-300">
                  Είσαι σίγουρος ότι θέλεις να διαγράψεις το μάθημα για την
                  ημερομηνία {eventModal.dateStr};
                </p>

                <div className="pt-3 mt-2 flex justify-between items-center border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-[11px] px-3 py-1 rounded border border-slate-600 text-slate-200 hover:bg-slate-700/60"
                  >
                    Άκυρο
                  </button>
                  <button
                    type="button"
                    onClick={handleEventModalDeleteForDay}
                    className="text-[11px] px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-medium"
                  >
                    Ναι, διαγραφή
                  </button>
                </div>
              </>
            ) : (
              <>
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
                          prev ? { ...prev, startTime: e.target.value } : prev,
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
                          prev ? { ...prev, endTime: e.target.value } : prev,
                        )
                      }
                      className="rounded border border-slate-600 bg-[color:var(--color-input-bg)] px-2 py-1 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="pt-3 mt-2 flex justify-between items-center border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-[11px] px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-medium"
                  >
                    Διαγραφή μόνο για αυτή την ημέρα
                  </button>

                  <button
                    type="button"
                    onClick={handleEventModalSave}
                    className="text-[11px] px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
                  >
                    Αποθήκευση
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
