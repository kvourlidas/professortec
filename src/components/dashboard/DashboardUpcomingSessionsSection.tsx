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
type UpcomingSession = {
  id: string; classTitle: string; subjectName: string | null; tutorName: string | null;
  date: Date; startTime: Date; endTime: Date; dateStr: string; isCurrent: boolean;
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
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [schoolId]);

  const { currentSessions, upcomingSessions } = useMemo(() => {
    if (!programItems.length) return { currentSessions: [], upcomingSessions: [] };
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
    const out: UpcomingSession[] = [];
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
        const isHol = hSet.has(ds);
        if (!ov?.is_deleted && !(!!ov?.is_inactive || (isHol && !ov?.holiday_active_override))) {
          const st = ov?.start_time ?? item.start_time!;
          const et = ov?.end_time ?? item.end_time!;
          const [sH, sM] = st.split(':').map(Number);
          const [eH, eM] = et.split(':').map(Number);
          const startTime = new Date(cur); startTime.setHours(sH, sM, 0, 0);
          const endTime = new Date(cur); endTime.setHours(eH, eM, 0, 0);
          if (endTime > now) {
            const sid = item.subject_id ?? cls.subject_id ?? null;
            out.push({
              id: `${item.id}-${ds}`, classTitle: cls.title,
              subjectName: sid ? (sMap.get(sid) ?? cls.subject) : cls.subject ?? null,
              tutorName: (item.tutor_id ? tMap.get(item.tutor_id) : null) ?? (sid ? tBySubj.get(sid) : null) ?? (cls.tutor_id ? tMap.get(cls.tutor_id) : null) ?? null,
              date: new Date(cur), startTime, endTime, dateStr: ds, isCurrent: now >= startTime && now < endTime,
            });
          }
        }
        const next = new Date(cur); next.setDate(next.getDate() + 7); cur = next;
      }
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
  }, [programItems, overrides, holidays, classes, tutors, subjects, subjectTutorLinks, now]);

  /* ── theme tokens ── */
  const muted = isDark ? 'text-slate-500' : 'text-slate-400';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const primary = isDark ? 'text-slate-50' : 'text-slate-800';

  /* ── sub-components ── */
  const PanelLabel = ({ children }: { children: string }) => (
    <p className={`mb-4 text-sm font-semibold ${primary}`}>{children}</p>
  );

  const SessionCard = ({ s, variant }: { s: UpcomingSession; variant: 'current' | 'upcoming' }) => {
    const elapsed = now.getTime() - s.startTime.getTime();
    const total = s.endTime.getTime() - s.startTime.getTime();
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const details = [s.subjectName, s.tutorName].filter(Boolean).join(' · ');
    const isGreen = variant === 'current';

    return (
      <div className={`rounded-xl border p-4 ${
        isGreen
          ? isDark ? 'border-emerald-500/20 bg-emerald-500/[0.07]' : 'border-emerald-200 bg-emerald-50/60'
          : isDark ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-200 bg-slate-50/60'
      }`}>
        {/* Time row */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold font-mono tabular-nums ${isGreen ? 'text-emerald-400' : ''}`}
            style={isGreen ? {} : { color: 'var(--color-accent)' }}>
            {formatTime(s.startTime)} – {formatTime(s.endTime)}
          </span>
          {isGreen ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
              Τώρα
            </span>
          ) : (
            <span className={`text-[10px] font-medium ${muted}`}>{dayLabel(s.date)}</span>
          )}
        </div>

        {/* Class name */}
        <p className={`text-sm font-bold leading-snug mb-1 ${primary}`}>{s.classTitle}</p>

        {/* Details */}
        {details && <p className={`text-[11px] leading-snug ${sub}`}>{details}</p>}

        {/* Progress bar */}
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

  return (
    <section className="flex flex-col flex-1">
      {/* Card */}
      <div className={`flex flex-col flex-1 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
        isDark ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]' : 'border-slate-200 bg-white/80 ring-black/[0.02]'
      }`}>
        <div className="h-0.5 w-full shrink-0" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

        {/* Header — inside card */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <CalendarClock className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <p className={`text-sm font-semibold ${primary}`}>Επόμενες Συνεδρίες</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            <span className={`text-xs ${muted}`}>Φόρτωση…</span>
          </div>
        ) : (
          /* Two-panel split */
          <div className="flex flex-1">

            {/* LEFT — Current */}
            <div className="flex flex-col flex-1 p-5">
              <PanelLabel>Τρέχουσα</PanelLabel>
              {currentSessions.length > 0 ? (
                <div className="flex flex-col gap-2 flex-1">
                  {currentSessions.map((s) => <SessionCard key={s.id} s={s} variant="current" />)}
                </div>
              ) : (
                <NoSession label="Δεν υπάρχει τρέχουσα συνεδρία" />
              )}
            </div>

            {/* RIGHT — Upcoming */}
            <div className="flex flex-col flex-1 p-5">
              <PanelLabel>Επόμενη</PanelLabel>
              {upcomingSessions.length > 0 ? (
                <div className="flex flex-col gap-2 flex-1">
                  {upcomingSessions.map((s) => <SessionCard key={s.id} s={s} variant="upcoming" />)}
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
