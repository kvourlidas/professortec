// src/components/dashboard/DashboardUpcomingSessionsSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { Loader2, Clock, CalendarClock } from 'lucide-react';

/* ------------ Types ------------ */
type ClassRow = { id: string; title: string; subject: string | null; subject_id: string | null; tutor_id: string | null };
type TutorRow = { id: string; full_name: string | null };
type ProgramRow = { id: string };
type ProgramItemRow = {
  id: string; program_id: string; class_id: string | null; student_id: string | null; day_of_week: string;
  start_time: string | null; end_time: string | null;
  start_date: string | null; end_date: string | null; subject_id: string | null; tutor_id: string | null;
};
type StudentRow = { id: string; full_name: string | null };
type ProgramItemOverrideRow = {
  id: string; program_item_id: string; override_date: string | null;
  start_time: string | null; end_time: string | null;
  is_deleted: boolean | null; is_inactive: boolean | null; holiday_active_override: boolean | null;
};
type HolidayRow = { date: string };
type SubjectRow = { id: string; name: string };
type SubjectTutorLinkRow = { subject_id: string; tutor_id: string };
type TestRow = {
  id: string; class_id: string | null; level_id: string | null; subject_id: string | null;
  test_date: string; start_time: string | null; end_time: string | null;
  title: string | null; active_during_holiday: boolean | null;
};
type LevelRow = { id: string; name: string };
type UpcomingSession = {
  id: string; classTitle: string; subjectName: string | null; tutorName: string | null;
  date: Date; startTime: Date; endTime: Date; dateStr: string; isCurrent: boolean;
  sessionType: 'class' | 'test'; testTitle: string | null;
};

/* ------------ Helpers ------------ */
const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatLocalYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
function getNextDateForDow(from: Date, dow: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return d;
}
const GREEK_MONTHS: string[] = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
const GREEK_DAYS_SHORT: Record<number, string> = { 0: 'Κυρ', 1: 'Δευ', 2: 'Τρι', 3: 'Τετ', 4: 'Πεμ', 5: 'Παρ', 6: 'Σαβ' };
function formatTime(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function formatDMY(d: Date) { return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`; }
function dayLabel(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const t = new Date(d); t.setHours(0, 0, 0, 0);
  if (t.getTime() === today.getTime()) return 'Σήμερα';
  if (t.getTime() === tomorrow.getTime()) return 'Αύριο';
  return `${GREEK_DAYS_SHORT[d.getDay()]} ${d.getDate()} ${GREEK_MONTHS[d.getMonth()]}`;
}

/* ------------ Component ------------ */
type Props = { schoolId: string | null };
const LOOKAHEAD_DAYS = 30;

export default function DashboardUpcomingSessionsSection({ schoolId }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);
  const [overrides, setOverrides] = useState<ProgramItemOverrideRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectTutorLinks, setSubjectTutorLinks] = useState<SubjectTutorLinkRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: cd }, { data: td }, { data: sd }, { data: std }, { data: hd }, { data: stud }, { data: lvd }] = await Promise.all([
          supabase.from('classes').select('id, title, subject, subject_id, tutor_id').eq('school_id', schoolId),
          supabase.from('tutors').select('id, full_name').eq('school_id', schoolId).is('deleted_at', null),
          supabase.from('subjects').select('id, name').eq('school_id', schoolId),
          supabase.from('subject_tutors').select('subject_id, tutor_id').eq('school_id', schoolId),
          supabase.from('school_holidays').select('date').eq('school_id', schoolId),
          supabase.from('students').select('id, full_name').eq('school_id', schoolId).is('deleted_at', null),
          supabase.from('levels').select('id, name').eq('school_id', schoolId),
        ]);
        setClasses((cd ?? []) as ClassRow[]);
        setTutors((td ?? []) as TutorRow[]);
        setSubjects((sd ?? []) as SubjectRow[]);
        setSubjectTutorLinks((std ?? []) as SubjectTutorLinkRow[]);
        setHolidays((hd ?? []) as HolidayRow[]);
        setStudents((stud ?? []) as StudentRow[]);
        setLevels((lvd ?? []) as LevelRow[]);
        const { data: pr } = await supabase.from('programs').select('id').eq('school_id', schoolId).order('created_at', { ascending: true }).limit(1);
        const program = (pr?.[0] as ProgramRow) ?? null;
        if (!program) { setLoading(false); return; }
        const { data: id_ } = await supabase.from('program_items').select('*').eq('program_id', program.id);
        const items = (id_ ?? []) as ProgramItemRow[];
        setProgramItems(items);
        if (items.length > 0) {
          const { data: ovd } = await supabase.from('program_item_overrides').select('*').in('program_item_id', items.map((r) => r.id));
          setOverrides((ovd ?? []) as ProgramItemOverrideRow[]);
        }
        const { data: testData } = await supabase.from('tests').select('id, class_id, level_id, subject_id, test_date, start_time, end_time, title, active_during_holiday').eq('school_id', schoolId);
        setTests((testData ?? []) as TestRow[]);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [schoolId]);

  const { currentSessions, upcomingSessions } = useMemo(() => {
    if (!programItems.length && !tests.length) return { currentSessions: [], upcomingSessions: [] };
    const wStart = new Date(now); wStart.setHours(0, 0, 0, 0);
    const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + LOOKAHEAD_DAYS);
    const hSet = new Set(holidays.map((h) => h.date));
    const tMap = new Map(tutors.map((t) => [t.id, t.full_name ?? '']));
    const sMap = new Map(subjects.map((s) => [s.id, s.name]));
    const cMap = new Map(classes.map((c) => [c.id, c]));
    const stuMap = new Map(students.map((s) => [s.id, s]));
    const lvlMap = new Map(levels.map((l) => [l.id, l]));
    const tBySubj = new Map<string, string>();
    subjectTutorLinks.forEach((l) => { if (!tBySubj.has(l.subject_id)) { const n = tMap.get(l.tutor_id); if (n) tBySubj.set(l.subject_id, n); } });
    const ovMap = new Map<string, ProgramItemOverrideRow>();
    overrides.forEach((ov) => { if (ov.override_date) ovMap.set(`${ov.program_item_id}-${ov.override_date}`, ov); });
    const piMap = new Map(programItems.map((pi) => [pi.id, pi]));
    const usedOverrideIds = new Set<string>();
    const out: UpcomingSession[] = [];

    const pushClassSession = (id: string, cls: ClassRow | null, item: ProgramItemRow, dateObj: Date, ds: string, st: string, et: string) => {
      const [sH, sM] = st.split(':').map(Number);
      const [eH, eM] = et.split(':').map(Number);
      const startTime = new Date(dateObj); startTime.setHours(sH, sM, 0, 0);
      const endTime = new Date(dateObj); endTime.setHours(eH, eM, 0, 0);
      if (endTime <= now) return;
      const sid = item.subject_id ?? cls?.subject_id ?? null;
      const title = cls ? cls.title : (item.student_id ? (stuMap.get(item.student_id)?.full_name ?? 'Μαθητής') : 'Μαθητής');
      out.push({
        id, classTitle: title,
        subjectName: sid ? (sMap.get(sid) ?? cls?.subject ?? null) : cls?.subject ?? null,
        tutorName: (item.tutor_id ? tMap.get(item.tutor_id) : null) ?? (sid ? tBySubj.get(sid) : null) ?? (cls?.tutor_id ? tMap.get(cls.tutor_id) : null) ?? null,
        date: new Date(dateObj), startTime, endTime, dateStr: ds,
        isCurrent: now >= startTime && now < endTime,
        sessionType: 'class', testTitle: null,
      });
    };

    programItems.forEach((item) => {
      const cls = item.class_id ? cMap.get(item.class_id) : undefined;
      const isStudentSlot = !cls && !!item.student_id;
      if ((!cls && !isStudentSlot) || !item.day_of_week || !item.start_time || !item.end_time) return;
      const dow = WEEKDAY_TO_INDEX[item.day_of_week];
      if (dow === undefined) return;
      const ps = item.start_date ? new Date(item.start_date + 'T00:00:00') : new Date('1970-01-01');
      const pe = item.end_date ? new Date(item.end_date + 'T23:59:59') : new Date('2999-12-31');
      const es = ps > wStart ? ps : wStart;
      const ee = pe < wEnd ? pe : wEnd;
      if (es > ee) return;
      let cur = getNextDateForDow(es, dow);
      while (cur <= ee) {
        const ds = formatLocalYMD(cur);
        const ov = ovMap.get(`${item.id}-${ds}`);
        if (ov?.id) usedOverrideIds.add(ov.id);
        const isHol = hSet.has(ds);
        if (!ov?.is_deleted && !(!!ov?.is_inactive || (isHol && !ov?.holiday_active_override))) {
          pushClassSession(`${item.id}-${ds}`, cls ?? null, item, cur, ds, ov?.start_time ?? item.start_time!, ov?.end_time ?? item.end_time!);
        }
        const next = new Date(cur); next.setDate(next.getDate() + 7); cur = next;
      }
    });

    // Rescheduled sessions: overrides that move a class to a date outside its normal pattern
    overrides.forEach((ov) => {
      if (!ov.override_date || ov.is_deleted || usedOverrideIds.has(ov.id)) return;
      const item = piMap.get(ov.program_item_id);
      if (!item) return;
      const cls = item.class_id ? cMap.get(item.class_id) : undefined;
      if (!cls && !item.student_id) return;
      const ds = ov.override_date;
      const dateObj = new Date(ds + 'T00:00:00');
      if (dateObj < wStart || dateObj > wEnd) return;
      const isHol = hSet.has(ds);
      if (ov.is_inactive || (isHol && !ov.holiday_active_override)) return;
      const st = ov.start_time ?? item.start_time;
      const et = ov.end_time ?? item.end_time;
      if (!st || !et) return;
      pushClassSession(`override-${ov.id}`, cls ?? null, item, dateObj, ds, st, et);
    });
    tests.forEach((test) => {
      if (!test.start_time || !test.end_time) return;
      const isHol = hSet.has(test.test_date);
      if (isHol && !test.active_during_holiday) return;
      const testDate = new Date(test.test_date + 'T00:00:00');
      if (testDate < wStart || testDate > wEnd) return;
      const [sH, sM] = test.start_time.split(':').map(Number);
      const [eH, eM] = test.end_time.split(':').map(Number);
      const startTime = new Date(testDate); startTime.setHours(sH, sM, 0, 0);
      const endTime = new Date(testDate); endTime.setHours(eH, eM, 0, 0);
      if (endTime <= now) return;
      const cls = test.class_id ? cMap.get(test.class_id) : undefined;
      const level = test.level_id ? lvlMap.get(test.level_id) : undefined;
      const sid = test.subject_id ?? null;
      out.push({
        id: `test-${test.id}`, classTitle: cls?.title ?? level?.name ?? '',
        subjectName: sid ? (sMap.get(sid) ?? null) : null,
        tutorName: (sid ? tBySubj.get(sid) : null) ?? null,
        date: testDate, startTime, endTime, dateStr: test.test_date,
        isCurrent: now >= startTime && now < endTime,
        sessionType: 'test', testTitle: test.title ?? null,
      });
    });
    out.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const current = out.filter((s) => s.isCurrent);
    const future = out.filter((s) => !s.isCurrent);
    const upcoming: UpcomingSession[] = [];
    if (future.length > 0) {
      const firstStart = future[0].startTime.getTime();
      upcoming.push(...future.filter((s) => s.startTime.getTime() === firstStart));
    }
    return { currentSessions: current, upcomingSessions: upcoming };
  }, [programItems, overrides, holidays, classes, students, levels, tutors, subjects, subjectTutorLinks, tests, now]);

  /* ── theme tokens ── */
  const muted = isDark ? 'text-slate-500' : 'text-slate-400';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const primary = isDark ? 'text-slate-50' : 'text-slate-900';
  const rule = isDark ? 'border-slate-800' : 'border-slate-100';

  /* ── sub-components ── */
  const PanelLabel = ({ children, count }: { children: React.ReactNode; count: number }) => (
    <div className="mb-3 flex shrink-0 items-center justify-between">
      <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${muted}`}>{children}</p>
      {count > 0 && (
        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
        }`}>{count}</span>
      )}
    </div>
  );

  const TestBadge = () => (
    <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
      Διαγώνισμα
    </span>
  );

  const SessionCard = ({ s, variant, compact }: { s: UpcomingSession; variant: 'current' | 'upcoming'; compact: boolean }) => {
    const elapsed = now.getTime() - s.startTime.getTime();
    const total = s.endTime.getTime() - s.startTime.getTime();
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const details = [s.subjectName, s.tutorName].filter(Boolean).join(' · ');
    const isGreen = variant === 'current';
    const barColor = isGreen ? (isDark ? '#34d399' : '#10b981') : 'var(--color-accent)';
    const tileCls = `rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50'}`;

    if (compact) {
      return (
        <div className={tileCls} style={{ borderLeftColor: barColor, borderLeftWidth: 3 }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-sm font-bold leading-snug tabular-nums ${isGreen ? (isDark ? 'text-emerald-300' : 'text-emerald-600') : primary}`}>
                {formatTime(s.startTime)}–{formatTime(s.endTime)}
              </p>
              <p className={`mt-0.5 truncate text-[13px] font-semibold ${primary}`}>{s.classTitle}</p>
              {details && <p className={`truncate text-[10px] ${sub}`}>{details}</p>}
            </div>
            <div className="shrink-0 text-right">
              {s.sessionType === 'test' && <TestBadge />}
              {!isGreen && <p className={`mt-0.5 text-[9px] font-semibold uppercase tracking-wide ${muted}`}>{dayLabel(s.date)}</p>}
            </div>
          </div>
          {isGreen && (
            <div className={`mt-2 h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-emerald-100'}`}>
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, background: barColor }} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={tileCls} style={{ borderLeftColor: barColor, borderLeftWidth: 3 }}>
        <div className="flex items-start justify-between gap-3">
          <p className={`text-2xl font-bold leading-none tabular-nums tracking-tight ${isGreen ? (isDark ? 'text-emerald-300' : 'text-emerald-600') : primary}`}>
            {formatTime(s.startTime)}<span className={`mx-1 text-base font-normal ${muted}`}>–</span>{formatTime(s.endTime)}
          </p>
          <div className="shrink-0 text-right">
            <p className={`text-[10px] font-bold uppercase tracking-wide ${isGreen ? (isDark ? 'text-emerald-300' : 'text-emerald-600') : muted}`}>{isGreen ? 'Τώρα' : dayLabel(s.date)}</p>
            <p className={`text-[10px] tabular-nums ${muted}`}>{formatDMY(s.date)}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <p className={`text-base font-bold leading-snug ${primary}`}>{s.classTitle}</p>
          {s.sessionType === 'test' && <TestBadge />}
        </div>
        {details && <p className={`mt-0.5 text-[12px] ${sub}`}>{details}</p>}
        {isGreen && (
          <div className={`mt-3 h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-emerald-100'}`}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, background: barColor }} />
          </div>
        )}
      </div>
    );
  };

  const NoSession = ({ label }: { label: string }) => (
    <div className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-center ${
      isDark ? 'border-slate-700/50' : 'border-slate-200'
    }`}>
      <Clock className={`h-5 w-5 ${muted}`} />
      <p className={`text-[11px] ${muted}`}>{label}</p>
    </div>
  );

  const currentLabel = currentSessions.length > 1 ? 'Τρέχουσες' : 'Τρέχουσα';
  const upcomingLabel = upcomingSessions.length > 1 ? 'Επόμενες' : 'Επόμενη';
  const currentCompact = currentSessions.length > 1;
  const upcomingCompact = upcomingSessions.length > 1;

  return (
    <section className="flex flex-col flex-1">
      {/* Elevated tile — real border + shadow lift, colored accent band up top, icon badge in header */}
      <div className={`relative flex flex-col flex-1 overflow-hidden rounded-2xl border shadow-lg ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="h-1 w-full shrink-0" style={{ background: 'var(--color-accent)' }} />

        {/* Header */}
        <div className={`flex shrink-0 items-center justify-between px-5 py-3.5 border-b ${rule}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <CalendarClock className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <p className={`text-sm font-bold ${primary}`}>Επόμενες Συνεδρίες</p>
          </div>
          <span className={`text-[10px] font-medium uppercase tracking-wide ${muted}`}>{LOOKAHEAD_DAYS} ημέρες</span>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-10">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            <span className={`text-xs ${muted}`}>Φόρτωση…</span>
          </div>
        ) : (
          /* Two-panel split, separated by a single hairline rule */
          <div className="flex flex-1 min-h-0">

            {/* LEFT — Current */}
            <div className="flex flex-col flex-1 min-h-0 px-5 py-4">
              <PanelLabel count={currentSessions.length}>{currentLabel}</PanelLabel>
              {currentSessions.length > 0 ? (
                <div className="flex flex-col flex-1 min-h-0 gap-2 overflow-y-auto">
                  {currentSessions.map((s) => <SessionCard key={s.id} s={s} variant="current" compact={currentCompact} />)}
                </div>
              ) : (
                <NoSession label="Δεν υπάρχει τρέχουσα συνεδρία" />
              )}
            </div>

            <div className={`w-px shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            {/* RIGHT — Upcoming */}
            <div className="flex flex-col flex-1 min-h-0 px-5 py-4">
              <PanelLabel count={upcomingSessions.length}>{upcomingLabel}</PanelLabel>
              {upcomingSessions.length > 0 ? (
                <div className="flex flex-col flex-1 min-h-0 gap-2 overflow-y-auto">
                  {upcomingSessions.map((s) => <SessionCard key={s.id} s={s} variant="upcoming" compact={upcomingCompact} />)}
                </div>
              ) : (
                <NoSession label="Δεν υπάρχουν επόμενα μαθήματα" />
              )}
            </div>

          </div>
        )}
      </div>
    </section>
  );
}
