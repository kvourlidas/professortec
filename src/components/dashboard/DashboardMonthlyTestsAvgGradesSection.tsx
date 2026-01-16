// src/components/dashboard/DashboardMonthlyTestsAvgGradesSection.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ChevronDown } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type Props = {
  schoolId: string | null;
};

type StudentTestGradeRow = {
  test_id: string;
  test_name: string | null;
  test_date: string | null; // date
  grade: number | null;
  // ✅ we assume this exists to filter by subject
  subject_id?: string | null;
};

type SubjectRow = {
  id: string;
  title: string | null;
};

type ChartRow = {
  testId: string;
  name: string;
  avg: number;
  count: number;
};

const MONTHS = [
  { idx: 1, label: 'Ιανουάριος' },
  { idx: 2, label: 'Φεβρουάριος' },
  { idx: 3, label: 'Μάρτιος' },
  { idx: 4, label: 'Απρίλιος' },
  { idx: 5, label: 'Μάιος' },
  { idx: 6, label: 'Ιούνιος' },
  { idx: 7, label: 'Ιούλιος' },
  { idx: 8, label: 'Αύγουστος' },
  { idx: 9, label: 'Σεπτέμβριος' },
  { idx: 10, label: 'Οκτώβριος' },
  { idx: 11, label: 'Νοέμβριος' },
  { idx: 12, label: 'Δεκέμβριος' },
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function monthRangeYYYYMMDD(year: number, month1to12: number) {
  const start = new Date(year, month1to12 - 1, 1);
  const end = new Date(year, month1to12, 0); // last day of month

  const from = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(
    start.getDate(),
  )}`;
  const to = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(
    end.getDate(),
  )}`;

  return { from, to };
}

function useOutsideClose(
  refs: Array<React.RefObject<HTMLElement | null>>,
  onClose: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;

      const inside = refs.some((r) => {
        const el = r.current;
        return !!el && el.contains(target);
      });

      if (!inside) onClose();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled, onClose, refs]);
}

function DropdownShell({
  label,
  open,
  onToggle,
  children,
  widthClass,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`
          inline-flex items-center justify-between gap-2
          rounded-lg border border-white/10 bg-white/[0.04]
          px-3 py-2 text-[11px] text-white/80
          hover:bg-white/[0.06] transition
          ${widthClass ?? 'w-[150px]'}
        `}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="text-white/60" />
      </button>

      {open && (
        <div
          className="
            absolute left-0 z-50 mt-2
            w-full
            rounded-xl border border-white/10
            bg-[#0b1220]/95 backdrop-blur-xl
            shadow-xl overflow-hidden
          "
          role="dialog"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  return (
    <div
      className="
        rounded-xl border border-white/10
        bg-[#0b1220]/95 backdrop-blur-xl
        px-3 py-2 text-[11px] text-white/90 shadow-xl
      "
    >
      <div className="font-semibold text-white/90">{label}</div>
      <div className="mt-1 text-white/70">
        Μ.Ο.: <span className="text-white/90">{row.avg}</span>{' '}
        <span className="text-white/45">(σε {row.count})</span>
      </div>
    </div>
  );
}

export default function DashboardMonthlyTestsAvgGradesSection({ schoolId }: Props) {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);

  const [openMonth, setOpenMonth] = useState(false);
  const [openYear, setOpenYear] = useState(false);

  // ✅ Subjects multi-select
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [openSubjects, setOpenSubjects] = useState(false);

  const monthWrapRef = useRef<HTMLDivElement | null>(null);
  const yearWrapRef = useRef<HTMLDivElement | null>(null);
  const subjectsWrapRef = useRef<HTMLDivElement | null>(null);

  useOutsideClose(
    [monthWrapRef, yearWrapRef, subjectsWrapRef],
    () => {
      setOpenMonth(false);
      setOpenYear(false);
      setOpenSubjects(false);
    },
    openMonth || openYear || openSubjects,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChartRow[]>([]);

  const range = useMemo(() => monthRangeYYYYMMDD(year, month), [year, month]);

  // rolling +-10 years around CURRENT year
  const yearOptions = useMemo(() => {
    const base = new Date().getFullYear();
    const start = base - 10;
    const end = base + 10;
    const arr: number[] = [];
    for (let y = start; y <= end; y++) arr.push(y);
    return arr;
  }, []);

  const monthLabel = useMemo(() => {
    return MONTHS.find((m) => m.idx === month)?.label ?? 'Μήνας';
  }, [month]);

  const subjectsLabel = useMemo(() => {
    if (selectedSubjectIds.length === 0) return 'Όλα τα μαθήματα';
    const selected = subjects
      .filter((s) => selectedSubjectIds.includes(s.id))
      .map((s) => (s.title ?? '').trim())
      .filter(Boolean);

    if (selected.length === 0) return 'Επιλεγμένα μαθήματα';
    if (selected.length <= 2) return selected.join(', ');
    return `${selected[0]}, ${selected[1]} +${selected.length - 2}`;
  }, [selectedSubjectIds, subjects]);

  const headerSubtitle = useMemo(() => {
    const subjPart =
      selectedSubjectIds.length === 0 ? 'Όλα τα μαθήματα' : 'Φιλτραρισμένα μαθήματα';
    return `${monthLabel} ${year} • ${rows.length} τεστ • ${subjPart}`;
  }, [monthLabel, year, rows.length, selectedSubjectIds.length]);

  // ✅ Load subjects (from Subjects page table)
  useEffect(() => {
    if (!schoolId) {
      setSubjects([]);
      setSelectedSubjectIds([]);
      return;
    }

    let cancelled = false;

    const loadSubjects = async () => {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('id,title')
          .eq('school_id', schoolId)
          .order('title', { ascending: true });

        if (error) throw error;
        if (cancelled) return;
        setSubjects((data ?? []) as SubjectRow[]);
      } catch (e: any) {
        // don't hard-fail chart if subjects can't load
        console.error(e);
        if (!cancelled) setSubjects([]);
      }
    };

    loadSubjects();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  // ✅ Load grades with subject filter
  useEffect(() => {
    if (!schoolId) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        let q = supabase
          .from('student_test_grades')
          .select('test_id,test_name,test_date,grade,subject_id')
          .eq('school_id', schoolId)
          .gte('test_date', range.from)
          .lte('test_date', range.to);

        if (selectedSubjectIds.length > 0) {
          q = q.in('subject_id', selectedSubjectIds);
        }

        const { data, error } = await q;
        if (error) throw error;

        const list = (data ?? []) as StudentTestGradeRow[];

        const map = new Map<
          string,
          { name: string; sum: number; count: number; date: string }
        >();

        for (const r of list) {
          if (!r.test_id) continue;
          if (r.grade == null) continue;

          const key = r.test_id;
          const name = (r.test_name ?? 'Τεστ').trim() || 'Τεστ';
          const date = r.test_date ?? '9999-12-31';

          const curr = map.get(key);
          if (!curr) {
            map.set(key, { name, sum: Number(r.grade), count: 1, date });
          } else {
            curr.sum += Number(r.grade);
            curr.count += 1;
            if (date < curr.date) curr.date = date;
          }
        }

        const aggregated: ChartRow[] = Array.from(map.entries()).map(
          ([testId, v]) => ({
            testId,
            name: v.name,
            avg: v.count === 0 ? 0 : Math.round((v.sum / v.count) * 10) / 10,
            count: v.count,
          }),
        );

        const dateById = new Map<string, string>();
        for (const r of list) {
          if (!r.test_id) continue;
          if (!dateById.has(r.test_id) && r.test_date) {
            dateById.set(r.test_id, r.test_date);
          }
        }

        aggregated.sort((a, b) => {
          const da = dateById.get(a.testId) ?? '9999-12-31';
          const db = dateById.get(b.testId) ?? '9999-12-31';
          if (da !== db) return da.localeCompare(db);
          return a.name.localeCompare(b.name);
        });

        if (cancelled) return;
        setRows(aggregated);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Αποτυχία φόρτωσης.');
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [schoolId, range.from, range.to, selectedSubjectIds]);

  // if grades are typically 0-20, keep it nice
  const yDomain = useMemo(() => {
    const maxVal = Math.max(0, ...rows.map((r) => r.avg));
    if (maxVal <= 20) return [0, 20] as [number, number];
    return [0, Math.ceil(maxVal / 10) * 10] as [number, number];
  }, [rows]);

  const BAR_FILL = 'var(--color-accent)';

  return (
    <section className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg ring-1 ring-inset ring-slate-300/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-50">Τεστ & Μέσος Όρος</div>
          <div className="mt-0.5 text-xs text-slate-400">{headerSubtitle}</div>
        </div>

        {/* Month + Year + Subjects controls */}
        <div className="flex items-center gap-2">
          {/* Subjects */}
          <div ref={subjectsWrapRef}>
            <DropdownShell
              label={subjectsLabel}
              open={openSubjects}
              onToggle={() => {
                setOpenMonth(false);
                setOpenYear(false);
                setOpenSubjects((v) => !v);
              }}
              widthClass="w-[200px]"
            >
              <div className="max-h-72 overflow-auto p-2">
                {/* All / Clear */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectIds([]);
                    setOpenSubjects(false);
                  }}
                  className="
                    w-full text-left px-3 py-2 text-[11px]
                    rounded-lg transition
                    text-white/85 hover:bg-white/8
                  "
                >
                  Όλα τα μαθήματα
                </button>

                <div className="my-2 h-px bg-white/10" />

                {subjects.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-white/60">
                    Δεν υπάρχουν μαθήματα.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {subjects.map((s) => {
                      const active = selectedSubjectIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubjectIds((prev) => {
                              if (prev.includes(s.id)) return prev.filter((x) => x !== s.id);
                              return [...prev, s.id];
                            });
                          }}
                          className={`
                            w-full text-left px-3 py-2 text-[11px]
                            rounded-lg transition flex items-center justify-between gap-3
                            ${active ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/8'}
                          `}
                        >
                          <span className="truncate">{(s.title ?? 'Μάθημα').trim() || 'Μάθημα'}</span>
                          <span
                            className={`
                              h-4 w-4 rounded border
                              ${active ? 'bg-white/80 border-white/30' : 'bg-transparent border-white/20'}
                            `}
                            aria-hidden="true"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </DropdownShell>
          </div>

          {/* Month */}
          <div ref={monthWrapRef}>
            <DropdownShell
              label={monthLabel}
              open={openMonth}
              onToggle={() => {
                setOpenSubjects(false);
                setOpenYear(false);
                setOpenMonth((v) => !v);
              }}
              widthClass="w-[150px]"
            >
              <div className="max-h-72 overflow-auto p-1">
                {MONTHS.map((m) => {
                  const active = m.idx === month;
                  return (
                    <button
                      key={m.idx}
                      type="button"
                      onClick={() => {
                        setMonth(m.idx);
                        setOpenMonth(false);
                      }}
                      className={`
                        w-full text-left px-3 py-2 text-[11px]
                        rounded-lg transition
                        ${active ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/8'}
                      `}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </DropdownShell>
          </div>

          {/* Year */}
          <div ref={yearWrapRef}>
            <DropdownShell
              label={String(year)}
              open={openYear}
              onToggle={() => {
                setOpenSubjects(false);
                setOpenMonth(false);
                setOpenYear((v) => !v);
              }}
              widthClass="w-[86px]"
            >
              <div className="max-h-72 overflow-auto p-1">
                {yearOptions.map((y) => {
                  const active = y === year;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => {
                        setYear(y);
                        setOpenYear(false);
                      }}
                      className={`
                        w-full text-left px-3 py-2 text-[11px]
                        rounded-lg transition
                        ${active ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/8'}
                      `}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </DropdownShell>
          </div>
        </div>
      </div>

      <div className="mt-3 h-44">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-200">Φόρτωση…</div>
        ) : error ? (
          <div className="rounded border border-red-500 bg-red-900/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Δεν υπάρχουν βαθμολογίες για τεστ αυτόν τον μήνα.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />

              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'rgba(226,232,240,0.60)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                height={28}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgba(226,232,240,0.45)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                width={28}
                domain={yDomain}
              />

              {/* remove the white hover highlight */}
              <Tooltip cursor={false} content={<BarTooltip />} />

              <Bar
                dataKey="avg"
                fill={BAR_FILL}
                radius={[10, 10, 6, 6]}
                barSize={40}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 text-[10px] text-slate-500">
        * Υπολογισμός: μέσος όρος από όλες τις καταχωρημένες βαθμολογίες ανά τεστ.
      </div>
    </section>
  );
}
