import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type {
  EventDropArg,
  EventContentArg,
  EventClickArg,
  DatesSetArg,
} from '@fullcalendar/core';
import StatWidget from '../components/StatWidget';
import elLocale from '@fullcalendar/core/locales/el';

type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject: string | null;
  level: string | null;
  tutor_id: string | null;
  day_of_week: string | null;
  time_window: string | null; // "HH:MM–HH:MM" (24h)
  repeat_weeks: number | null;
  start_date: string | null; // "YYYY-MM-DD"
};

type TutorRow = {
  id: string;
  full_name: string | null;
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

type EventEditForm = {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // 12h "HH:MM"
  startPeriod: 'AM' | 'PM';
  endTime: string; // 12h "HH:MM"
  endPeriod: 'AM' | 'PM';
  repeatWeeks: string;
};

const NOTE_COLORS = [
  { value: '#f97316', label: 'Πορτοκαλί' },
  { value: '#3b82f6', label: 'Μπλε' },
  { value: '#22c55e', label: 'Πράσινο' },
  { value: '#eab308', label: 'Κίτρινο' },
  { value: '#f97373', label: 'Κόκκινο' },
];

const NOTES_PER_PAGE = 5;

const emptyEventForm: EventEditForm = {
  title: '',
  date: '',
  startTime: '',
  startPeriod: 'AM',
  endTime: '',
  endPeriod: 'PM',
  repeatWeeks: '',
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** 24h "HH:MM" -> { time12, period } */
function convert24To12(
  time: string,
): { time12: string; period: 'AM' | 'PM' } {
  if (!time) return { time12: '', period: 'AM' };
  const [hStr, mStr = '00'] = time.split(':');
  let h = Number(hStr);
  let m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return { time12: time, period: 'AM' };

  const isPM = h >= 12;
  h = h % 12;
  if (h === 0) h = 12;

  return {
    time12: `${pad2(h)}:${pad2(m)}`,
    period: isPM ? 'PM' : 'AM',
  };
}

/** 12h "HH:MM" + AM/PM -> 24h "HH:MM" */
function convert12To24(time: string, period: string): string | null {
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
    // 12:xx AM -> 00:xx
    h = 0;
  }

  return `${pad2(h)}:${pad2(m)}`;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    studentsCount: 0,
    monthlyIncome: 0,
    yearlyIncome: 0,
  });

  // --- calendar view state (for month/week handling) ---
  const [calendarView, setCalendarView] = useState<string>('timeGridWeek');

  // NOTES
  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<string>(NOTE_COLORS[0].value);
  const [noteUrgent, setNoteUrgent] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesPage, setNotesPage] = useState(1);

  // EVENT EDIT MODAL
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalClass, setEventModalClass] = useState<ClassRow | null>(
    null,
  );
  const [eventForm, setEventForm] = useState<EventEditForm>(emptyEventForm);
  const [eventSaving, setEventSaving] = useState(false);

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

  // Load classes
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

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

  // ---- Calendar events (with month view "no duplicates") ----
  const events = useMemo(() => {
    const out: any[] = [];

    const tutorMap: Record<string, string> = {};
    tutors.forEach((t) => {
      if (t.id && t.full_name) {
        tutorMap[t.id] = t.full_name;
      }
    });

    classes.forEach((c) => {
      if (!c.start_date || !c.time_window) return;

      const [startStr, endStr] = c.time_window.split('–').map((s) => s.trim());
      if (!startStr || !endStr) return;

      const [sH, sM] = startStr.split(':').map(Number);
      const [eH, eM] = endStr.split(':').map(Number);

      // 👉 στο month view δείχνουμε μόνο την πρώτη εβδομάδα
      const repeatCount =
        calendarView === 'dayGridMonth'
          ? 1
          : c.repeat_weeks && c.repeat_weeks > 0
          ? c.repeat_weeks
          : 1;

      const baseDate = new Date(c.start_date + 'T00:00:00');

      const tutorName =
        c.tutor_id && tutorMap[c.tutor_id] ? tutorMap[c.tutor_id] : null;

      for (let i = 0; i < repeatCount; i++) {
        const start = new Date(baseDate);
        start.setDate(start.getDate() + i * 7);
        start.setHours(sH, sM, 0, 0);

        const end = new Date(baseDate);
        end.setDate(end.getDate() + i * 7);
        end.setHours(eH, eM, 0, 0);

        out.push({
          id: `${c.id}-${i}`,
          title: c.title,
          start,
          end,
          extendedProps: {
            classId: c.id,
            subject: c.subject,
            level: c.level,
            tutorName,
          },
        });
      }
    });

    return out;
  }, [classes, tutors, calendarView]);

  const handleEventDrop = async (arg: EventDropArg) => {
    const { event, revert } = arg;
    const classId = event.extendedProps['classId'] as string | undefined;

    if (!classId || !event.start || !event.end) {
      revert();
      return;
    }

    const start = event.start;
    const end = event.end;

    const newDayOfWeek = weekdayFromDate(start);
    const newStartDate = `${start.getFullYear()}-${pad2(
      start.getMonth() + 1,
    )}-${pad2(start.getDate())}`;

    const startTime = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
    const endTime = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
    const newTimeWindow = `${startTime}–${endTime}`;

    const { error, data } = await supabase
      .from('classes')
      .update({
        day_of_week: newDayOfWeek,
        start_date: newStartDate,
        time_window: newTimeWindow,
      })
      .eq('id', classId)
      .select('*')
      .maybeSingle();

    if (error || !data) {
      console.error('Failed to update class on eventDrop', error);
      revert();
      return;
    }

    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? (data as ClassRow) : c)),
    );
  };

  const renderEventContent = (arg: EventContentArg) => {
    const { event, timeText } = arg;
    const subject = event.extendedProps['subject'] as string | null;
    const level = event.extendedProps['level'] as string | null;
    const tutorName = event.extendedProps['tutorName'] as string | null;

    return (
      <div className="flex flex-col text-[10px] leading-tight">
        <div className="font-semibold">{timeText}</div>
        <div className="mt-0.5 font-semibold">{event.title}</div>

        {subject && <div className="mt-0.5">{subject}</div>}

        {(level || tutorName) && (
          <div className="mt-0.5 opacity-90">
            {level && <span>{level}</span>}
            {level && tutorName && <span> · </span>}
            {tutorName && <span>{tutorName}</span>}
          </div>
        )}
      </div>
    );
  };

  // ---- calendar callbacks: view change & click ----
  const handleDatesSet = (arg: DatesSetArg) => {
    setCalendarView(arg.view.type);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const classId = arg.event.extendedProps['classId'] as string | undefined;
    if (!classId) return;

    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;

    const [startStr = '', endStr = ''] = (cls.time_window ?? '')
      .split('–')
      .map((s) => s.trim());

    const { time12: start12, period: startPeriod } = convert24To12(startStr);
    const { time12: end12, period: endPeriod } = convert24To12(endStr);

    setEventModalClass(cls);
    setEventForm({
      title: cls.title ?? '',
      date: cls.start_date ? cls.start_date.slice(0, 10) : '',
      startTime: start12,
      startPeriod,
      endTime: end12,
      endPeriod,
      repeatWeeks:
        cls.repeat_weeks != null ? String(cls.repeat_weeks) : '',
    });
    setEventModalOpen(true);
  };

  const handleEventFormChange =
    (field: keyof EventEditForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setEventForm((prev) => ({ ...prev, [field]: value as any }));
    };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setEventModalClass(null);
    setEventForm(emptyEventForm);
    setEventSaving(false);
  };

  const handleEventSave = async () => {
    if (!eventModalClass) return;

    const start24 = convert12To24(
      eventForm.startTime,
      eventForm.startPeriod || 'AM',
    );
    const end24 = convert12To24(
      eventForm.endTime,
      eventForm.endPeriod || 'PM',
    );
    const timeWindow =
      start24 && end24 ? `${start24}–${end24}` : eventModalClass.time_window;

    const weeksNum = eventForm.repeatWeeks.trim()
      ? Number(eventForm.repeatWeeks)
      : null;

    const newStartDate = eventForm.date || eventModalClass.start_date || null;
    let newDayOfWeek = eventModalClass.day_of_week;
    if (newStartDate) {
      const d = new Date(newStartDate + 'T00:00:00');
      newDayOfWeek = weekdayFromDate(d);
    }

    setEventSaving(true);

    const { data, error } = await supabase
      .from('classes')
      .update({
        title: eventForm.title.trim() || eventModalClass.title,
        start_date: newStartDate,
        day_of_week: newDayOfWeek,
        time_window: timeWindow,
        repeat_weeks: Number.isNaN(weeksNum) ? null : weeksNum,
      })
      .eq('id', eventModalClass.id)
      .select('*')
      .maybeSingle();

    setEventSaving(false);

    if (error || !data) {
      console.error('Failed to update class from calendar modal', error);
      return;
    }

    setClasses((prev) =>
      prev.map((c) => (c.id === eventModalClass.id ? (data as ClassRow) : c)),
    );
    closeEventModal();
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
            eventDrop={handleEventDrop}
            droppable={false}
            eventContent={renderEventContent}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
          />
        )}
      </section>

      {/* Event edit modal */}
      {eventModalOpen && eventModalClass && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                Επεξεργασία μαθήματος
              </h2>
              <button
                type="button"
                onClick={closeEventModal}
                className="text-xs text-slate-200 hover:text-white"
              >
                Κλείσιμο
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="form-label text-slate-100">
                  Τίτλος τμήματος
                </label>
                <input
                  value={eventForm.title}
                  onChange={handleEventFormChange('title')}
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>

              <div>
                <label className="form-label text-slate-100">
                  Ημερομηνία έναρξης
                </label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={handleEventFormChange('date')}
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">
                    Ώρα έναρξης
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={eventForm.startTime}
                      onChange={handleEventFormChange('startTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                      placeholder="π.χ. 06:15"
                    />
                    <select
                      value={eventForm.startPeriod}
                      onChange={handleEventFormChange('startPeriod')}
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
                      value={eventForm.endTime}
                      onChange={handleEventFormChange('endTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                      placeholder="π.χ. 07:15"
                    />
                    <select
                      value={eventForm.endPeriod}
                      onChange={handleEventFormChange('endPeriod')}
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

              <div>
                <label className="form-label text-slate-100">
                  Για πόσες εβδομάδες
                </label>
                <input
                  type="number"
                  min={1}
                  value={eventForm.repeatWeeks}
                  onChange={handleEventFormChange('repeatWeeks')}
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. 8"
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEventModal}
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
                  onClick={handleEventSave}
                  disabled={eventSaving}
                  className="btn-primary"
                >
                  {eventSaving ? 'Αποθήκευση...' : 'Αποθήκευση αλλαγών'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
