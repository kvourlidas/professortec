import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { ClipboardCheck, History } from 'lucide-react';
import AttendanceLessonCard from '../components/attendance/AttendanceLessonCard';
import AttendanceHistoryPanel from '../components/attendance/AttendanceHistoryPanel';
import FolderTabs from '../components/ui/FolderTabs';
import { DAY_LABEL_BY_VALUE } from '../components/program/constants';
import { formatDateDisplayLong, formatTimeDisplay, todayISO, weekdayOf } from '../components/attendance/utils';
import type {
  AttendanceRow, AttendanceStatus, ClassRow, HolidayRow, LessonSession,
  ProgramItemOverrideRow, ProgramItemRow, StudentRow, SubjectRow, TestRow, TutorRow,
} from '../components/attendance/types';

type Tab = 'today' | 'history';

export default function AttendancePage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [tab, setTab] = useState<Tab>('today');
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classStudents, setClassStudents] = useState<{ class_id: string; student_id: string }[]>([]);
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);
  const [overrides, setOverrides] = useState<ProgramItemOverrideRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [testsForDate, setTestsForDate] = useState<TestRow[]>([]);
  const [attendanceForDate, setAttendanceForDate] = useState<AttendanceRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load reference data (classes, subjects, tutors, students, roster, schedule) ──
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const { data: programRows, error: programErr } = await supabase.from('programs').select('id').eq('school_id', schoolId).order('created_at', { ascending: true });
        if (programErr) throw programErr;
        const programIds = (programRows ?? []).map((p) => p.id as string);

        const [
          { data: classData, error: classErr },
          { data: subjData, error: subjErr },
          { data: tutorData, error: tutorErr },
          { data: studentData, error: studentErr },
          { data: csData, error: csErr },
          { data: itemData, error: itemErr },
          { data: holidayData, error: holidayErr },
        ] = await Promise.all([
          supabase.from('classes').select('id, school_id, title, subject, subject_id, tutor_id').eq('school_id', schoolId).order('title', { ascending: true }),
          supabase.from('subjects').select('id, name').eq('school_id', schoolId),
          supabase.from('tutors').select('id, full_name').eq('school_id', schoolId).is('deleted_at', null),
          supabase.from('students').select('id, full_name').eq('school_id', schoolId).is('deleted_at', null),
          supabase.from('class_students').select('class_id, student_id').eq('school_id', schoolId).eq('status', 'active'),
          programIds.length > 0
            ? supabase.from('program_items').select('id, class_id, day_of_week, start_time, end_time, start_date, end_date, subject_id, tutor_id, room').in('program_id', programIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('school_holidays').select('date').eq('school_id', schoolId),
        ]);

        if (classErr) throw classErr; if (subjErr) throw subjErr; if (tutorErr) throw tutorErr;
        if (studentErr) throw studentErr; if (csErr) throw csErr; if (itemErr) throw itemErr;
        if (holidayErr) throw holidayErr;

        const items = (itemData ?? []) as ProgramItemRow[];
        const itemIds = items.map((i) => i.id);
        const { data: overrideData, error: overrideErr } = itemIds.length > 0
          ? await supabase.from('program_item_overrides').select('id, program_item_id, override_date, start_time, end_time, is_deleted, is_inactive, holiday_active_override').in('program_item_id', itemIds)
          : { data: [], error: null };
        if (overrideErr) throw overrideErr;

        setClasses((classData ?? []) as ClassRow[]);
        setSubjects((subjData ?? []) as SubjectRow[]);
        setTutors((tutorData ?? []) as TutorRow[]);
        setStudents((studentData ?? []) as StudentRow[]);
        setClassStudents((csData ?? []) as { class_id: string; student_id: string }[]);
        setProgramItems(items);
        setOverrides((overrideData ?? []) as ProgramItemOverrideRow[]);
        setHolidays((holidayData ?? []) as HolidayRow[]);
      } catch (err) {
        console.error('AttendancePage reference load error', err);
        setError('Αποτυχία φόρτωσης δεδομένων.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  // ── Load attendance rows for the selected date ──
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error: attErr } = await supabase.from('class_attendance').select('*').eq('school_id', schoolId).eq('session_date', selectedDate);
      if (cancelled) return;
      if (attErr) { console.error('Error loading attendance', attErr); return; }
      setAttendanceForDate((data ?? []) as AttendanceRow[]);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, selectedDate]);

  // ── Load class-based tests scheduled for the selected date ──
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error: testErr } = await supabase.from('tests')
        .select('id, class_id, subject_id, test_date, title, start_time, end_time, active_during_holiday')
        .eq('school_id', schoolId).eq('test_date', selectedDate).not('class_id', 'is', null);
      if (cancelled) return;
      if (testErr) { console.error('Error loading tests', testErr); return; }
      setTestsForDate((data ?? []) as TestRow[]);
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, selectedDate]);

  // ── Maps ──
  const subjectNameById = useMemo(() => { const m = new Map<string, string>(); subjects.forEach((s) => m.set(s.id, s.name)); return m; }, [subjects]);
  const tutorNameById = useMemo(() => { const m = new Map<string, string>(); tutors.forEach((t) => m.set(t.id, t.full_name)); return m; }, [tutors]);
  const studentById = useMemo(() => { const m = new Map<string, StudentRow>(); students.forEach((s) => m.set(s.id, s)); return m; }, [students]);
  const studentNameById = useMemo(() => { const m = new Map<string, string>(); students.forEach((s) => m.set(s.id, s.full_name ?? 'Χωρίς όνομα')); return m; }, [students]);
  const classById = useMemo(() => { const m = new Map<string, ClassRow>(); classes.forEach((c) => m.set(c.id, c)); return m; }, [classes]);
  const rosterByClass = useMemo(() => {
    const m = new Map<string, StudentRow[]>();
    classStudents.forEach(({ class_id, student_id }) => {
      const student = studentById.get(student_id);
      if (!student) return;
      const list = m.get(class_id) ?? [];
      list.push(student);
      m.set(class_id, list);
    });
    return m;
  }, [classStudents, studentById]);

  const holidayDateSet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);

  const overrideByItemAndDate = useMemo(() => {
    const m = new Map<string, ProgramItemOverrideRow>();
    overrides.forEach((ov) => { if (ov.override_date) m.set(`${ov.program_item_id}-${ov.override_date}`, ov); });
    return m;
  }, [overrides]);

  const testByClassId = useMemo(() => {
    const m = new Map<string, TestRow>();
    testsForDate.forEach((t) => { if (t.class_id && !m.has(t.class_id)) m.set(t.class_id, t); });
    return m;
  }, [testsForDate]);

  // ── Lessons (and tests) scheduled for the selected date, with a non-empty roster ──
  // Accounts for one-off overrides made from the Calendar page: a session
  // cancelled/moved away that day is excluded, and a session moved onto
  // that day is included even though it isn't the class's regular weekday.
  // A test on the same class + date is folded into that lesson's card
  // instead of creating a second, duplicate one; a test with no class
  // session that day gets its own standalone card.
  const lessonSessions = useMemo<LessonSession[]>(() => {
    const weekday = weekdayOf(selectedDate);
    const isHoliday = holidayDateSet.has(selectedDate);
    const coveredClassIds = new Set<string>();

    const buildSession = (item: ProgramItemRow, override: ProgramItemOverrideRow | undefined): LessonSession | null => {
      const manualInactive = !!override?.is_inactive;
      const holidayActiveOverride = !!override?.holiday_active_override;
      const isInactive = manualInactive || (isHoliday && !holidayActiveOverride);
      if (isInactive) return null;

      const cls = classById.get(item.class_id);
      if (!cls) return null;
      const roster = rosterByClass.get(item.class_id) ?? [];
      if (roster.length === 0) return null;

      coveredClassIds.add(item.class_id);
      const test = testByClassId.get(item.class_id) ?? null;
      const startTime = override?.start_time ?? item.start_time;
      const endTime = override?.end_time ?? item.end_time;
      const subjectName = (item.subject_id ? subjectNameById.get(item.subject_id) : null) ?? (cls.subject_id ? subjectNameById.get(cls.subject_id) : null) ?? cls.subject ?? '';
      const tutorName = (item.tutor_id ? tutorNameById.get(item.tutor_id) : null) ?? (cls.tutor_id ? tutorNameById.get(cls.tutor_id) : null) ?? '';
      const timeRange = startTime && endTime ? `${formatTimeDisplay(startTime)} – ${formatTimeDisplay(endTime)}` : '';

      return {
        key: `${item.id}-${selectedDate}`,
        classId: item.class_id,
        programItemId: item.id,
        testId: test?.id ?? null,
        classTitle: cls.title,
        subjectName,
        tutorName,
        timeRange,
        room: item.room,
        date: selectedDate,
        isTest: !!test,
        testTitle: test?.title ?? null,
        roster: [...roster].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el')),
      };
    };

    const sessions: LessonSession[] = [];
    programItems.forEach((item) => {
      const naturalMatch = item.day_of_week === weekday && (!item.start_date || item.start_date <= selectedDate) && (!item.end_date || item.end_date >= selectedDate);
      const override = overrideByItemAndDate.get(`${item.id}-${selectedDate}`);
      if (naturalMatch) {
        if (override?.is_deleted) return; // moved away or cancelled that day
        const session = buildSession(item, override);
        if (session) sessions.push(session);
      } else if (override && !override.is_deleted) {
        const session = buildSession(item, override); // moved onto that day
        if (session) sessions.push(session);
      }
    });

    testsForDate.forEach((t) => {
      if (!t.class_id || coveredClassIds.has(t.class_id)) return; // already folded into a lesson card above
      const isInactive = isHoliday && !t.active_during_holiday;
      if (isInactive) return;
      const cls = classById.get(t.class_id);
      if (!cls) return;
      const roster = rosterByClass.get(t.class_id) ?? [];
      if (roster.length === 0) return;

      const subjectName = (t.subject_id ? subjectNameById.get(t.subject_id) : null) ?? (cls.subject_id ? subjectNameById.get(cls.subject_id) : null) ?? cls.subject ?? '';
      const tutorName = cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
      const timeRange = t.start_time && t.end_time ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(t.end_time)}` : '';

      sessions.push({
        key: `test-${t.id}-${selectedDate}`,
        classId: t.class_id,
        programItemId: null,
        testId: t.id,
        classTitle: cls.title,
        subjectName,
        tutorName,
        timeRange,
        room: null,
        date: selectedDate,
        isTest: true,
        testTitle: t.title,
        roster: [...roster].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el')),
      });
    });

    return sessions.sort((a, b) => a.classTitle.localeCompare(b.classTitle, 'el'));
  }, [programItems, overrideByItemAndDate, testsForDate, testByClassId, holidayDateSet, selectedDate, classById, rosterByClass, subjectNameById, tutorNameById]);

  const attendanceByClass = useMemo(() => {
    const m = new Map<string, Map<string, AttendanceRow>>();
    attendanceForDate.forEach((row) => {
      const inner = m.get(row.class_id) ?? new Map<string, AttendanceRow>();
      inner.set(row.student_id, row);
      m.set(row.class_id, inner);
    });
    return m;
  }, [attendanceForDate]);

  const isSessionComplete = (session: LessonSession) => {
    const answered = attendanceByClass.get(session.classId);
    return session.roster.every((student) => answered?.has(student.id));
  };

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

  const pendingSessions = lessonSessions.filter((s) => {
    if (!isSessionComplete(s)) return true;
    return recentlyCompletedKeys.has(s.key) && !dismissedKeys.has(s.key);
  });

  // ── Mark / clear / reason handlers ──
  const handleMark = async (session: LessonSession, studentId: string, status: AttendanceStatus) => {
    if (!schoolId) return;
    try {
      const { data, error: upErr } = await supabase.from('class_attendance')
        .upsert({
          school_id: schoolId,
          class_id: session.classId,
          program_item_id: session.programItemId,
          student_id: studentId,
          session_date: session.date,
          status,
          marked_by: profile?.id ?? null,
        }, { onConflict: 'class_id,student_id,session_date' })
        .select('*').single();
      if (upErr) throw upErr;
      const row = data as AttendanceRow;
      setAttendanceForDate((prev) => [...prev.filter((r) => !(r.class_id === session.classId && r.student_id === studentId)), row]);

      const answered = attendanceByClass.get(session.classId);
      const remainingAfter = session.roster.filter((s) => s.id !== studentId && !answered?.has(s.id)).length;
      if (remainingAfter === 0) {
        setRecentlyCompletedKeys((prev) => new Set(prev).add(session.key));
      }
    } catch (err) {
      console.error('Error marking attendance', err);
      showToast('Σφάλμα καταχώρησης παρουσίας', 'error');
    }
  };

  const handleClear = async (session: LessonSession, studentId: string) => {
    if (!schoolId) return;
    try {
      const { error: delErr } = await supabase.from('class_attendance').delete()
        .eq('school_id', schoolId).eq('class_id', session.classId).eq('student_id', studentId).eq('session_date', session.date);
      if (delErr) throw delErr;
      setAttendanceForDate((prev) => prev.filter((r) => !(r.class_id === session.classId && r.student_id === studentId)));
    } catch (err) {
      console.error('Error clearing attendance', err);
      showToast('Σφάλμα κατά την ακύρωση', 'error');
    }
  };

  const handleSaveReason = async (session: LessonSession, studentId: string, reason: string) => {
    if (!schoolId) return;
    try {
      const { data, error: updErr } = await supabase.from('class_attendance')
        .update({ reason: reason.trim() || null })
        .eq('school_id', schoolId).eq('class_id', session.classId).eq('student_id', studentId).eq('session_date', session.date)
        .select('*').single();
      if (updErr) throw updErr;
      const row = data as AttendanceRow;
      setAttendanceForDate((prev) => [...prev.filter((r) => !(r.class_id === session.classId && r.student_id === studentId)), row]);
    } catch (err) {
      console.error('Error saving reason', err);
      showToast('Σφάλμα αποθήκευσης λόγου', 'error');
    }
  };

  const dateInputCls = isDark
    ? 'h-9 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

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
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={dateInputCls} />
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
            <ClipboardCheck className="h-20 w-20" style={{ color: 'color-mix(in srgb, var(--color-accent) 55%, transparent)' }} />
            <div>
              <p className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                {lessonSessions.length === 0 ? 'Δεν υπάρχουν προγραμματισμένα μαθήματα' : 'Όλες οι παρουσίες καταχωρήθηκαν'}
              </p>
              <p className={`mt-1.5 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {DAY_LABEL_BY_VALUE[weekdayOf(selectedDate)]} · {formatDateDisplayLong(selectedDate)}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {pendingSessions.map((session) => (
              <AttendanceLessonCard
                key={session.key}
                session={session}
                attendanceByStudent={attendanceByClass.get(session.classId) ?? new Map()}
                isComplete={isSessionComplete(session)}
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
        <AttendanceHistoryPanel schoolId={schoolId} classes={classes} studentNameById={studentNameById} isDark={isDark} />
      )}
    </div>
  );
}
