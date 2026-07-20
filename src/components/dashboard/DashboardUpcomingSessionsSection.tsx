// src/components/dashboard/DashboardUpcomingSessionsSection.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';
import { CalendarClock, Loader2, Clock } from 'lucide-react';

/* ------------ Types ------------ */
type ClassRow = { id: string; title: string; subject: string | null; subject_id: string | null; tutor_id: string | null };
type TutorRow = { id: string; full_name: string | null };
type ProgramRow = { id: string };
type ProgramItemRow = {
  id: string; program_id: string; class_id: string; day_of_week: string;
  start_time: string | null; end_time: string | null;
  start_date: string | null; end_date: string | null; subject_id: string | null; tutor_id: string | null;
};
type ProgramItemOverrideRow = {
  id: string; program_item_id: string; override_date: string | null;
  start_time: string | null; end_time: string | null;
  is_deleted: boolean | null; is_inactive: boolean | null; holiday_active_override: boolean | null;
};
type HolidayRow = { date: string };
type SubjectRow = { id: string; name: string };
type SubjectTutorLinkRow = { subject_id: string; tutor_id: string };
type TestRow = {
  id: string; class_id: string; subject_id: string | null;
  test_date: string; start_time: string | null; end_time: string | null;
  title: string | null; active_during_holiday: boolean | null;
};
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
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);
  const [overrides, setOverrides] = useState<ProgramItemOverrideRow[]>([]);
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectTutorLinks, setSubjectTutorLinks] = useState<SubjectTutorLinkRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
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
        const [{ data: cd }, { data: td }, { data: sd }, { data: std }, { data: hd }] = await Promise.all([
          supabase.from('classes').select('id, title, subject, subject_id, tutor_id').eq('school_id', schoolId),
          supabase.from('tutors').select('id, full_name').eq('school_id', schoolId),
          supabase.from('subjects').select('id, name').eq('school_id', schoolId),
          supabase.from('subject_tutors').select('subject_id, tutor_id').eq('school_id', schoolId),
          supabase.from('school_holidays').select('date').eq('school_id', schoolId),
        ]);
        setClasses((cd ?? []) as ClassRow[]);
        setTutors((td ?? []) as TutorRow[]);
        setSubjects((sd ?? []) as SubjectRow[]);
        setSubjectTutorLinks((std ?? []) as SubjectTutorLinkRow[]);
        setHolidays((hd ?? []) as HolidayRow[]);
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
        const { data: testData } = await supabase.from('tests').select('id, class_id, subject_id, test_date, start_time, end_time, title, active_during_holiday').eq('school_id', schoolId);
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
    const tBySubj = new Map<string, string>();
    subjectTutorLinks.forEach((l) => { if (!tBySubj.has(l.subject_id)) { const n = tMap.get(l.tutor_id); if (n) tBySubj.set(l.subject_id, n); } });
    const ovMap = new Map<string, ProgramItemOverrideRow>();
    overrides.forEach((ov) => { if (ov.override_date) ovMap.set(`${ov.program_item_id}-${ov.override_date}`, ov); });
    const piMap = new Map(programItems.map((pi) => [pi.id, pi]));
    const usedOverrideIds = new Set<string>();
    const out: UpcomingSession[] = [];

    const pushClassSession = (id: string, cls: ClassRow, item: ProgramItemRow, dateObj: Date, ds: string, st: string, et: string) => {
      const [sH, sM] = st.split(':').map(Number);
      const [eH, eM] = et.split(':').map(Number);
      const startTime = new Date(dateObj); startTime.setHours(sH, sM, 0, 0);
      const endTime = new Date(dateObj); endTime.setHours(eH, eM, 0, 0);
      if (endTime <= now) return;
      const sid = item.subject_id ?? cls.subject_id ?? null;
      out.push({
        id, classTitle: cls.title,
        subjectName: sid ? (sMap.get(sid) ?? cls.subject) : cls.subject ?? null,
        tutorName: (item.tutor_id ? tMap.get(item.tutor_id) : null) ?? (sid ? tBySubj.get(sid) : null) ?? (cls.tutor_id ? tMap.get(cls.tutor_id) : null) ?? null,
        date: new Date(dateObj), startTime, endTime, dateStr: ds,
        isCurrent: now >= startTime && now < endTime,
        sessionType: 'class', testTitle: null,
      });
    };

    programItems.forEach((item) => {
      const cls = cMap.get(item.class_id);
      if (!cls || !item.day_of_week || !item.start_time || !item.end_time) return;
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
          pushClassSession(`${item.id}-${ds}`, cls, item, cur, ds, ov?.start_time ?? item.start_time!, ov?.end_time ?? item.end_time!);
        }
        const next = new Date(cur); next.setDate(next.getDate() + 7); cur = next;
      }
    });

    // Rescheduled sessions: overrides that move a class to a date outside its normal pattern
    overrides.forEach((ov) => {
      if (!ov.override_date || ov.is_deleted || usedOverrideIds.has(ov.id)) return;
      const item = piMap.get(ov.program_item_id);
      if (!item) return;
      const cls = cMap.get(item.class_id);
      if (!cls) return;
      const ds = ov.override_date;
      const dateObj = new Date(ds + 'T00:00:00');
      if (dateObj < wStart || dateObj > wEnd) return;
      const isHol = hSet.has(ds);
      if (ov.is_inactive || (isHol && !ov.holiday_active_override)) return;
      const st = ov.start_time ?? item.start_time;
      const et = ov.end_time ?? item.end_time;
      if (!st || !et) return;
      pushClassSession(`override-${ov.id}`, cls, item, dateObj, ds, st, et);
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
      const cls = cMap.get(test.class_id);
      const sid = test.subject_id ?? null;
      out.push({
        id: `test-${test.id}`, classTitle: cls?.title ?? '',
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
  }, [programItems, overrides, holidays, classes, tutors, subjects, subjectTutorLinks, tests, now]);

  /* ── theme tokens ── */
  const muted = isDark ? 'text-slate-500' : 'text-slate-400';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const primary = isDark ? 'text-slate-50' : 'text-slate-800';

  /* ── sub-components ── */
  const PanelLabel = ({ children }: { children: React.ReactNode }) => (
    <p className={`mb-3 shrink-0 text-sm font-semibold ${primary}`}>{children}</p>
  );

  const TestBadge = () => (
    <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-purple-400">
      Διαγώνισμα
    </span>
  );

  const NowBadge = () => (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-emerald-400">
      <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
      Τώρα
    </span>
  );

  const SessionCard = ({ s, variant, compact }: { s: UpcomingSession; variant: 'current' | 'upcoming'; compact: boolean }) => {
    const elapsed = now.getTime() - s.startTime.getTime();
    const total = s.endTime.getTime() - s.startTime.getTime();
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const details = [s.subjectName, s.tutorName].filter(Boolean).join(' · ');
    const isGreen = variant === 'current';
    const borderCls = isGreen
      ? isDark ? 'border-emerald-500/20 bg-emerald-500/[0.07]' : 'border-emerald-200 bg-emerald-50/60'
      : isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-200 bg-slate-50/60';

    if (compact) {
      return (
        <div className={`rounded-lg border px-3 py-2 ${borderCls}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className={`text-xs font-bold leading-snug ${primary}`}>{s.classTitle}</p>
                {s.sessionType === 'test' && <TestBadge />}
              </div>
              {details && <p className={`text-[10px] leading-snug mt-0.5 truncate ${sub}`}>{details}</p>}
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className={`text-[11px] font-semibold font-sans tabular-nums tracking-tight ${isGreen ? 'text-emerald-400' : ''}`}
                style={isGreen ? {} : { color: 'var(--color-accent)' }}>
                {formatTime(s.startTime)}–{formatTime(s.endTime)}
              </span>
              {isGreen ? <NowBadge /> : <span className={`text-[9px] ${muted}`}>{dayLabel(s.date)}</span>}
            </div>
          </div>
          {isGreen && (
            <div className={`mt-1.5 h-0.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-emerald-100'}`}>
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`rounded-xl border p-4 ${borderCls}`}>
        <div className="flex items-start justify-between mb-2 gap-2">
          <span className={`text-sm font-semibold font-sans tabular-nums tracking-tight ${isGreen ? 'text-emerald-400' : ''}`}
            style={isGreen ? {} : { color: 'var(--color-accent)' }}>
            {formatTime(s.startTime)} – {formatTime(s.endTime)}
          </span>
          {isGreen ? (
            <div className="flex flex-col items-end gap-0.5">
              <NowBadge />
              <span className={`text-[10px] tabular-nums ${muted}`}>{formatDMY(s.date)}</span>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-0.5">
              <span className={`text-[10px] font-medium ${muted}`}>{dayLabel(s.date)}</span>
              <span className={`text-[10px] tabular-nums ${muted}`}>{formatDMY(s.date)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <p className={`text-sm font-bold leading-snug ${primary}`}>{s.classTitle}</p>
          {s.sessionType === 'test' && <TestBadge />}
        </div>
        {details && <p className={`text-[11px] leading-snug ${sub}`}>{details}</p>}
        {isGreen && (
          <div className={`mt-3 h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-emerald-100'}`}>
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
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

  const currentLabel = currentSessions.length > 1 ? `Τρέχουσες (${currentSessions.length})` : 'Τρέχουσα';
  const upcomingLabel = upcomingSessions.length > 1 ? `Επόμενες (${upcomingSessions.length})` : 'Επόμενη';
  const currentCompact = currentSessions.length > 1;
  const upcomingCompact = upcomingSessions.length > 1;

  return (
    <section className="flex flex-col flex-1">
      {/* Card */}
      <div className={`flex flex-col flex-1 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
        isDark ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]' : 'border-slate-200 bg-white/80 ring-black/[0.02]'
      }`}>
        {/* Header — inside card */}
        <div className="flex shrink-0 items-center justify-between px-5 py-3" style={{ background: 'var(--ch-bg)', borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <CalendarClock className="h-3.5 w-3.5" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ch-text)' }}>Επόμενες Συνεδρίες</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            <span className={`text-xs ${muted}`}>Φόρτωση…</span>
          </div>
        ) : (
          /* Two-panel split */
          <div className="flex flex-1 min-h-0">

            {/* LEFT — Current */}
            <div className="flex flex-col flex-1 min-h-0 p-5">
              <PanelLabel>{currentLabel}</PanelLabel>
              {currentSessions.length > 0 ? (
                <div className={`flex flex-col flex-1 min-h-0 overflow-y-auto ${currentCompact ? 'gap-1.5' : 'gap-2'}`}>
                  {currentSessions.map((s) => <SessionCard key={s.id} s={s} variant="current" compact={currentCompact} />)}
                </div>
              ) : (
                <NoSession label="Δεν υπάρχει τρέχουσα συνεδρία" />
              )}
            </div>

            {/* RIGHT — Upcoming */}
            <div className="flex flex-col flex-1 min-h-0 p-5">
              <PanelLabel>{upcomingLabel}</PanelLabel>
              {upcomingSessions.length > 0 ? (
                <div className={`flex flex-col flex-1 min-h-0 overflow-y-auto ${upcomingCompact ? 'gap-1.5' : 'gap-2'}`}>
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
