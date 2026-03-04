// src/components/dashboard/DashboardMonthlyTestsAvgGradesSection.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ChevronDown, BarChart2, Loader2, Check } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';

type Props = { schoolId: string | null };
type StudentTestGradeRow = { test_id: string; test_name: string | null; test_date: string | null; grade: number | null; subject_id?: string | null };
type SubjectRow = { id: string; title: string | null };
type ChartRow = { testId: string; name: string; avg: number; count: number };

const MONTHS = [
  { idx: 1, label: 'Ιανουάριος' }, { idx: 2, label: 'Φεβρουάριος' }, { idx: 3, label: 'Μάρτιος' },
  { idx: 4, label: 'Απρίλιος' }, { idx: 5, label: 'Μάιος' }, { idx: 6, label: 'Ιούνιος' },
  { idx: 7, label: 'Ιούλιος' }, { idx: 8, label: 'Αύγουστος' }, { idx: 9, label: 'Σεπτέμβριος' },
  { idx: 10, label: 'Οκτώβριος' }, { idx: 11, label: 'Νοέμβριος' }, { idx: 12, label: 'Δεκέμβριος' },
];

function pad2(n: number) { return String(n).padStart(2, '0'); }

function monthRangeYYYYMMDD(year: number, month1to12: number) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0);
  return {
    from: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    to: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}

function useOutsideClose(refs: Array<React.RefObject<HTMLElement | null>>, onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: MouseEvent) => { const target = e.target as Node; if (!refs.some((r) => r.current?.contains(target))) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [enabled, onClose, refs]);
}

function DropdownShell({ label, open, onToggle, children, widthClass, isDark }: {
  label: string; open: boolean; onToggle: () => void; children: React.ReactNode; widthClass?: string; isDark: boolean;
}) {
  return (
    <div className="relative">
      <button type="button" onClick={onToggle}
        className={`inline-flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${widthClass ?? 'w-[150px]'} ${
          isDark
            ? 'border-slate-700/60 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-700/60'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
        aria-haspopup="dialog" aria-expanded={open}>
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      </button>
      {open && (
        <div className={`absolute left-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border shadow-xl backdrop-blur-xl ${
          isDark ? 'border-slate-700/60 bg-slate-900/95' : 'border-slate-200 bg-white/95'
        }`} role="dialog">
          {children}
        </div>
      )}
    </div>
  );
}

export default function DashboardMonthlyTestsAvgGradesSection({ schoolId }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [openMonth, setOpenMonth] = useState(false);
  const [openYear, setOpenYear] = useState(false);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [openSubjects, setOpenSubjects] = useState(false);

  const monthWrapRef = useRef<HTMLDivElement | null>(null);
  const yearWrapRef = useRef<HTMLDivElement | null>(null);
  const subjectsWrapRef = useRef<HTMLDivElement | null>(null);

  useOutsideClose(
    [monthWrapRef, yearWrapRef, subjectsWrapRef],
    () => { setOpenMonth(false); setOpenYear(false); setOpenSubjects(false); },
    openMonth || openYear || openSubjects,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChartRow[]>([]);

  const range = useMemo(() => monthRangeYYYYMMDD(year, month), [year, month]);
  const yearOptions = useMemo(() => {
    const base = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = base - 10; y <= base + 10; y++) arr.push(y);
    return arr;
  }, []);
  const monthLabel = useMemo(() => MONTHS.find((m) => m.idx === month)?.label ?? 'Μήνας', [month]);

  const subjectsLabel = useMemo(() => {
    if (selectedSubjectIds.length === 0) return 'Όλα τα μαθήματα';
    const selected = subjects.filter((s) => selectedSubjectIds.includes(s.id)).map((s) => (s.title ?? '').trim()).filter(Boolean);
    if (selected.length === 0) return 'Επιλεγμένα';
    if (selected.length <= 2) return selected.join(', ');
    return `${selected[0]}, +${selected.length - 1}`;
  }, [selectedSubjectIds, subjects]);

  useEffect(() => {
    if (!schoolId) { setSubjects([]); setSelectedSubjectIds([]); return; }
    let cancelled = false;
    supabase.from('subjects').select('id,title').eq('school_id', schoolId).order('title', { ascending: true })
      .then(({ data, error }) => { if (cancelled) return; if (error) { console.error(error); setSubjects([]); } else { setSubjects((data ?? []) as SubjectRow[]); } });
    return () => { cancelled = true; };
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setRows([]); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        let q = supabase.from('student_test_grades').select('test_id,test_name,test_date,grade,subject_id').eq('school_id', schoolId).gte('test_date', range.from).lte('test_date', range.to);
        if (selectedSubjectIds.length > 0) q = q.in('subject_id', selectedSubjectIds);
        const { data, error } = await q;
        if (error) throw error;
        const list = (data ?? []) as StudentTestGradeRow[];
        const map = new Map<string, { name: string; sum: number; count: number; date: string }>();
        for (const r of list) {
          if (!r.test_id || r.grade == null) continue;
          const key = r.test_id; const name = (r.test_name ?? 'Τεστ').trim() || 'Τεστ'; const date = r.test_date ?? '9999-12-31';
          const curr = map.get(key);
          if (!curr) { map.set(key, { name, sum: Number(r.grade), count: 1, date }); } else { curr.sum += Number(r.grade); curr.count += 1; if (date < curr.date) curr.date = date; }
        }
        const aggregated: ChartRow[] = Array.from(map.entries()).map(([testId, v]) => ({ testId, name: v.name, avg: v.count === 0 ? 0 : Math.round((v.sum / v.count) * 10) / 10, count: v.count }));
        const dateById = new Map<string, string>();
        for (const r of list) { if (r.test_id && !dateById.has(r.test_id) && r.test_date) dateById.set(r.test_id, r.test_date); }
        aggregated.sort((a, b) => { const da = dateById.get(a.testId) ?? '9999-12-31'; const db = dateById.get(b.testId) ?? '9999-12-31'; if (da !== db) return da.localeCompare(db); return a.name.localeCompare(b.name); });
        if (cancelled) return;
        setRows(aggregated);
      } catch (e: any) { if (cancelled) return; setError(e?.message ?? 'Αποτυχία φόρτωσης.'); setRows([]); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [schoolId, range.from, range.to, selectedSubjectIds]);

  const yDomain = useMemo(() => {
    const maxVal = Math.max(0, ...rows.map((r) => r.avg));
    if (maxVal <= 20) return [0, 20] as [number, number];
    return [0, Math.ceil(maxVal / 10) * 10] as [number, number];
  }, [rows]);

  const listItemCls = (active: boolean) => `w-full flex items-center justify-between gap-2 px-3 py-2 text-[11px] rounded-lg transition cursor-pointer ${
    active
      ? isDark ? 'bg-white/10 text-slate-100' : 'bg-slate-100 text-slate-800'
      : isDark ? 'text-slate-300 hover:bg-white/[0.06] hover:text-slate-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
  }`;

  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const axisTickColor = isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)';
  const axisLineColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  // Plain function — avoids Recharts generic ContentType conflict entirely
  const renderTooltip = (props: any) => {
    const { active, payload, label } = props;
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as ChartRow | undefined;
    if (!row) return null;
    return (
      <div className={`rounded-xl border px-3 py-2 text-[11px] shadow-xl backdrop-blur-xl ${
        isDark
          ? 'border-slate-700/60 bg-slate-900/95 text-slate-100'
          : 'border-slate-200 bg-white text-slate-800'
      }`}>
        <p className="font-semibold">{label}</p>
        <p className={`mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
          Μ.Ο.:{' '}
          <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{row.avg}</span>{' '}
          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>({row.count} βαθμοί)</span>
        </p>
      </div>
    );
  };

  return (
    <section className={`overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${
      isDark
        ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]'
        : 'border-slate-200 bg-white/80 ring-black/[0.02]'
    }`}>
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
              <BarChart2 className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Τεστ & Μέσος Όρος</p>
              <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {monthLabel} {year} · {rows.length} τεστ · {selectedSubjectIds.length === 0 ? 'Όλα τα μαθήματα' : 'Φιλτραρισμένα'}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div ref={subjectsWrapRef}>
              <DropdownShell isDark={isDark} label={subjectsLabel} open={openSubjects} onToggle={() => { setOpenMonth(false); setOpenYear(false); setOpenSubjects((v) => !v); }} widthClass="w-[180px]">
                <div className="max-h-64 overflow-y-auto p-1.5">
                  <button type="button" onClick={() => { setSelectedSubjectIds([]); setOpenSubjects(false); }} className={listItemCls(selectedSubjectIds.length === 0)}>
                    <span>Όλα τα μαθήματα</span>
                    {selectedSubjectIds.length === 0 && <Check className="h-3 w-3" />}
                  </button>
                  <div className={`my-1 h-px ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`} />
                  {subjects.length === 0 ? (
                    <p className={`px-3 py-2 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν μαθήματα.</p>
                  ) : subjects.map((s) => {
                    const active = selectedSubjectIds.includes(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => setSelectedSubjectIds((prev) => active ? prev.filter((x) => x !== s.id) : [...prev, s.id])} className={listItemCls(active)}>
                        <span className="truncate">{(s.title ?? 'Μάθημα').trim() || 'Μάθημα'}</span>
                        {active && <Check className="h-3 w-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </DropdownShell>
            </div>

            <div ref={monthWrapRef}>
              <DropdownShell isDark={isDark} label={monthLabel} open={openMonth} onToggle={() => { setOpenSubjects(false); setOpenYear(false); setOpenMonth((v) => !v); }} widthClass="w-[140px]">
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {MONTHS.map((m) => (
                    <button key={m.idx} type="button" onClick={() => { setMonth(m.idx); setOpenMonth(false); }} className={listItemCls(m.idx === month)}>
                      <span>{m.label}</span>
                      {m.idx === month && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </DropdownShell>
            </div>

            <div ref={yearWrapRef}>
              <DropdownShell isDark={isDark} label={String(year)} open={openYear} onToggle={() => { setOpenSubjects(false); setOpenMonth(false); setOpenYear((v) => !v); }} widthClass="w-[80px]">
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {yearOptions.map((y) => (
                    <button key={y} type="button" onClick={() => { setYear(y); setOpenYear(false); }} className={listItemCls(y === year)}>
                      <span>{y}</span>
                      {y === year && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </DropdownShell>
            </div>
          </div>
        </div>

        {/* Chart area */}
        <div className="mt-4 h-48">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Φόρτωση…</span>
            </div>
          ) : error ? (
            <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${
              isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'
            }`}>
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
                <BarChart2 className={`h-5 w-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν βαθμολογίες για αυτόν τον μήνα.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisTickColor }} axisLine={{ stroke: axisLineColor }} tickLine={false} height={28} />
                <YAxis tick={{ fontSize: 10, fill: axisTickColor }} axisLine={{ stroke: axisLineColor }} tickLine={false} width={28} domain={yDomain} />
                <Tooltip cursor={false} content={renderTooltip as any} />
                <Bar dataKey="avg" fill="var(--color-accent)" radius={[8, 8, 4, 4]} barSize={36} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <p className={`mt-3 text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>* Μέσος όρος από όλες τις καταχωρημένες βαθμολογίες ανά τεστ.</p>
      </div>
    </section>
  );
}