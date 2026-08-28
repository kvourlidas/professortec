import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { ClipboardCheck, CalendarOff, History } from 'lucide-react';
import PrivateAttendanceLessonCard from '../components/attendance/PrivateAttendanceLessonCard';
import PrivateAttendanceHistoryPanel from '../components/attendance/PrivateAttendanceHistoryPanel';
import AppDatePicker from '../components/ui/AppDatePicker';
import FolderTabs from '../components/ui/FolderTabs';
import { DAY_LABEL_BY_VALUE } from '../components/program/constants';
import { addDaysISO, displayToISO, formatDateDisplay, formatDateDisplayLong, formatTimeDisplay, todayISO, weekdayOf } from '../components/attendance/utils';
import { isSchoolYearCurrent } from '../components/school-info/types';
import type {
  AttendanceStatus, HolidayRow, PrivateAttendanceRow,
  PrivateLessonSession, PrivateProgramItemRow, ProgramItemOverrideRow, StudentRow, SubjectRow,
} from '../components/attendance/types';

type Tab = 'today' | 'history';

// How far back to keep surfacing lessons whose attendance the tutor never
// answered — an unmarked session stays visible on the "today" tab (it never
// silently drops out) until it's marked, no matter how many days ago it happened.
const PENDING_LOOKBACK_DAYS = 60;

export default function PrivateAttendancePage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [tab, setTab] = useState<Tab>('today');
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [programItems, setProgramItems] = useState<PrivateProgramItemRow[]>([]);
  const [overrides, setOverrides] = useState<ProgramItemOverrideRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<PrivateAttendanceRow[]>([]);
  const [schoolYears, setSchoolYears] = useState<{ id: string; start_date: string; end_date: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load reference data (subjects, students, private-lesson slots) ──
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const { data: programRows, error: programErr } = await supabase.from('programs').select('id').eq('school_id', schoolId).order('created_at', { ascending: true });
        if (programErr) throw programErr;
        const programIds = (programRows ?? []).map((p) => p.id as string);

        const [
          { data: subjData, error: subjErr },
          { data: studentData, error: studentErr },
          { data: itemData, error: itemErr },
          { data: holidayData, error: holidayErr },
        ] = await Promise.all([
          supabase.from('subjects').select('id, name').eq('school_id', schoolId),
          supabase.from('students').select('id, full_name').eq('school_id', schoolId).is('deleted_at', null),
          programIds.length > 0
            ? supabase.from('program_items').select('id, student_id, subject_id, day_of_week, start_time, end_time, start_date, end_date, room').in('program_id', programIds).not('student_id', 'is', null)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('school_holidays').select('date').eq('school_id', schoolId),
        ]);

        if (subjErr) throw subjErr; if (studentErr) throw studentErr;
        if (itemErr) throw itemErr; if (holidayErr) throw holidayErr;

        const items = (itemData ?? []) as PrivateProgramItemRow[];
        const itemIds = items.map((i) => i.id);
        const { data: overrideData, error: overrideErr } = itemIds.length > 0
          ? await supabase.from('program_item_overrides').select('id, program_item_id, override_date, start_time, end_time, is_deleted, is_inactive, holiday_active_override').in('program_item_id', itemIds)
          : { data: [], error: null };
        if (overrideErr) throw overrideErr;

        setSubjects((subjData ?? []) as SubjectRow[]);
        setStudents((studentData ?? []) as StudentRow[]);
        setProgramItems(items);
        setOverrides((overrideData ?? []) as ProgramItemOverrideRow[]);
        setHolidays((holidayData ?? []) as HolidayRow[]);
      } catch (err) {
        console.error('PrivateAttendancePage reference load error', err);
        setError('Αποτυχία φόρτωσης δεδομένων.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  // ── Load school years (used to tell a genuine day off from a day the school just isn't running at all) ──
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from('school_years').select('id, start_date, end_date').eq('school_id', schoolId);
      if (cancelled) return;
      setSchoolYears((data ?? []) as { id: string; start_date: string; end_date: string }[]);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId]);

  // The lookback window: any lesson between here and selectedDate whose
  // attendance is incomplete stays on the "today" list, not just selectedDate.
  const windowStart = useMemo(() => addDaysISO(selectedDate, -PENDING_LOOKBACK_DAYS), [selectedDate]);

  // ── Load attendance rows for the lookback window ──
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error: attErr } = await supabase.from('private_lesson_attendance').select('*')
        .eq('school_id', schoolId).gte('session_date', windowStart).lte('session_date', selectedDate);
      if (cancelled) return;
      if (attErr) { console.error('Error loading attendance', attErr); return; }
      setAttendanceRows((data ?? []) as PrivateAttendanceRow[]);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, windowStart, selectedDate]);

  // ── Maps ──
  const subjectNameById = useMemo(() => { const m = new Map<string, string>(); subjects.forEach((s) => m.set(s.id, s.name)); return m; }, [subjects]);
  const studentNameById = useMemo(() => { const m = new Map<string, string>(); students.forEach((s) => m.set(s.id, s.full_name ?? 'Χωρίς όνομα')); return m; }, [students]);

  const holidayDateSet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);

  const overrideByItemAndDate = useMemo(() => {
    const m = new Map<string, ProgramItemOverrideRow>();
    overrides.forEach((ov) => { if (ov.override_date) m.set(`${ov.program_item_id}-${ov.override_date}`, ov); });
    return m;
  }, [overrides]);

  // Every date in the lookback window, oldest first.
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    let cursor = windowStart;
    let guard = 0;
    while (cursor <= selectedDate && guard < PENDING_LOOKBACK_DAYS + 5) {
      dates.push(cursor);
      cursor = addDaysISO(cursor, 1);
      guard += 1;
    }
    return dates;
  }, [windowStart, selectedDate]);

  // ── Private lessons scheduled anywhere in the lookback window ──
  // Accounts for one-off overrides made from the Calendar page: a session
  // cancelled/moved away that day is excluded, and a session moved onto
  // that day is included even though it isn't the slot's regular weekday.
  const lessonSessions = useMemo<PrivateLessonSession[]>(() => {
    const sessions: PrivateLessonSession[] = [];

    dateRange.forEach((date) => {
      const weekday = weekdayOf(date);
      const isHoliday = holidayDateSet.has(date);

      const buildSession = (item: PrivateProgramItemRow, override: ProgramItemOverrideRow | undefined): PrivateLessonSession | null => {
        const manualInactive = !!override?.is_inactive;
        const holidayActiveOverride = !!override?.holiday_active_override;
        const isInactive = manualInactive || (isHoliday && !holidayActiveOverride);
        if (isInactive) return null;

        const studentName = studentNameById.get(item.student_id);
        if (!studentName) return null;

        const startTime = override?.start_time ?? item.start_time;
        const endTime = override?.end_time ?? item.end_time;
        const subjectName = item.subject_id ? (subjectNameById.get(item.subject_id) ?? '') : '';
        const timeRange = startTime && endTime ? `${formatTimeDisplay(startTime)} – ${formatTimeDisplay(endTime)}` : '';

        return {
          key: `${item.id}-${date}`,
          programItemId: item.id,
          studentId: item.student_id,
          studentName,
          subjectName,
          timeRange,
          room: item.room,
          date,
        };
      };

      programItems.forEach((item) => {
        const naturalMatch = item.day_of_week === weekday && (!item.start_date || item.start_date <= date) && (!item.end_date || item.end_date >= date);
        const override = overrideByItemAndDate.get(`${item.id}-${date}`);
        if (naturalMatch) {
          if (override?.is_deleted) return; // moved away or cancelled that day
          const session = buildSession(item, override);
          if (session) sessions.push(session);
        } else if (override && !override.is_deleted) {
          const session = buildSession(item, override); // moved onto that day
          if (session) sessions.push(session);
        }
      });
    });

    return sessions;
  }, [dateRange, programItems, overrideByItemAndDate, holidayDateSet, studentNameById, subjectNameById]);

  // Keyed by program item + session date (not just program item) — the
  // window can hold several past occurrences of the same slot.
  const attendanceByKey = useMemo(() => {
    const m = new Map<string, PrivateAttendanceRow>();
    attendanceRows.forEach((row) => { m.set(`${row.program_item_id}|${row.session_date}`, row); });
    return m;
  }, [attendanceRows]);

  const isSessionComplete = (session: PrivateLessonSession) => attendanceByKey.has(`${session.programItemId}|${session.date}`);

  // A session that was already fully marked before this page load never
  // shows up as pending — it belongs in history and stays there. A session
  // completed live, during this visit, stays visible with a "Μετάβαση στο
  // ιστορικό" button (tracked in recentlyCompletedKeys) so there's as much
  // time as needed to add a reason — it only moves to history once the
  // tutor explicitly confirms (dismissedKeys), never on its own.
  const [recentlyCompletedKeys, setRecentlyCompletedKeys] = useState<Set<string>>(new Set());
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const handleConfirmDone = (key: string) => {
    setDismissedKeys((prev) => new Set(prev).add(key));
  };

  const pendingSessions = lessonSessions
    .filter((s) => {
      if (!isSessionComplete(s)) return true;
      return recentlyCompletedKeys.has(s.key) && !dismissedKeys.has(s.key);
    })
    .sort((a, b) => (a.date === b.date ? a.studentName.localeCompare(b.studentName, 'el') : a.date.localeCompare(b.date)));

  // If the school has defined school years at all, a date outside every one of
  // them means the school simply isn't running that day — a different message
  // than "no lessons happened to be scheduled" for a day inside an active year.
  const isSchoolOpenOnSelectedDate = schoolYears.length === 0 || schoolYears.some((y) => isSchoolYearCurrent(y, selectedDate));

  // ── Mark / clear / reason handlers ──
  const handleMark = async (session: PrivateLessonSession, status: AttendanceStatus) => {
    if (!schoolId) return;
    try {
      const { data, error: upErr } = await supabase.from('private_lesson_attendance')
        .upsert({
          school_id: schoolId,
          program_item_id: session.programItemId,
          student_id: session.studentId,
          session_date: session.date,
          status,
          marked_by: profile?.id ?? null,
        }, { onConflict: 'program_item_id,session_date' })
        .select('*').single();
      if (upErr) throw upErr;
      const row = data as PrivateAttendanceRow;
      setAttendanceRows((prev) => [...prev.filter((r) => !(r.program_item_id === session.programItemId && r.session_date === session.date)), row]);
      setRecentlyCompletedKeys((prev) => new Set(prev).add(session.key));
    } catch (err) {
      console.error('Error marking attendance', err);
      showToast('Σφάλμα καταχώρησης παρουσίας', 'error');
    }
  };

  const handleClear = async (session: PrivateLessonSession) => {
    if (!schoolId) return;
    try {
      const { error: delErr } = await supabase.from('private_lesson_attendance').delete()
        .eq('school_id', schoolId).eq('program_item_id', session.programItemId).eq('session_date', session.date);
      if (delErr) throw delErr;
      setAttendanceRows((prev) => prev.filter((r) => !(r.program_item_id === session.programItemId && r.session_date === session.date)));
    } catch (err) {
      console.error('Error clearing attendance', err);
      showToast('Σφάλμα κατά την ακύρωση', 'error');
    }
  };

  const handleSaveReason = async (session: PrivateLessonSession, reason: string) => {
    if (!schoolId) return;
    try {
      const { data, error: updErr } = await supabase.from('private_lesson_attendance')
        .update({ reason: reason.trim() || null })
        .eq('school_id', schoolId).eq('program_item_id', session.programItemId).eq('session_date', session.date)
        .select('*').single();
      if (updErr) throw updErr;
      const row = data as PrivateAttendanceRow;
      setAttendanceRows((prev) => [...prev.filter((r) => !(r.program_item_id === session.programItemId && r.session_date === session.date)), row]);
    } catch (err) {
      console.error('Error saving reason', err);
      showToast('Σφάλμα αποθήκευσης λόγου', 'error');
    }
  };

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FolderTabs
          isDark={isDark}
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'today', label: 'Σημερινά μαθήματα', icon: ClipboardCheck },
            { key: 'history', label: 'Ιστορικό', icon: History },
          ]}
        />

        {tab === 'today' && (
          <div className="w-40">
            <AppDatePicker value={formatDateDisplay(selectedDate)} onChange={(v) => setSelectedDate(displayToISO(v))} />
          </div>
        )}
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.
        </div>
      )}

      {tab === 'today' ? (
        loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className={`h-7 w-7 animate-spin rounded-full border-2 border-t-transparent ${isDark ? 'border-slate-600' : 'border-slate-300'}`} />
          </div>
        ) : pendingSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
            {!isSchoolOpenOnSelectedDate ? (
              <>
                <CalendarOff className="h-20 w-20" style={{ color: 'color-mix(in srgb, var(--color-accent) 55%, transparent)' }} />
                <div>
                  <p className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Το σχολείο είναι κλειστό</p>
                  <p className={`mt-1.5 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Δεν υπάρχει ενεργό σχολικό έτος για {DAY_LABEL_BY_VALUE[weekdayOf(selectedDate)]} · {formatDateDisplayLong(selectedDate)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <ClipboardCheck className="h-20 w-20" style={{ color: 'color-mix(in srgb, var(--color-accent) 55%, transparent)' }} />
                <div>
                  <p className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                    {lessonSessions.length === 0 ? 'Δεν υπάρχουν προγραμματισμένα μαθήματα' : 'Όλες οι παρουσίες καταχωρήθηκαν'}
                  </p>
                  <p className={`mt-1.5 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {DAY_LABEL_BY_VALUE[weekdayOf(selectedDate)]} · {formatDateDisplayLong(selectedDate)}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {pendingSessions.map((session) => (
              <PrivateAttendanceLessonCard
                key={session.key}
                session={session}
                record={attendanceByKey.get(`${session.programItemId}|${session.date}`)}
                isDark={isDark}
                onMark={handleMark}
                onClear={handleClear}
                onSaveReason={handleSaveReason}
                onConfirmDone={() => handleConfirmDone(session.key)}
              />
            ))}
          </div>
        )
      ) : (
        <PrivateAttendanceHistoryPanel schoolId={schoolId} studentNameById={studentNameById} isDark={isDark} />
      )}
    </div>
  );
}
