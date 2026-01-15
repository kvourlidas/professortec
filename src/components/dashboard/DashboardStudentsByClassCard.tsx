// src/components/dashboard/DashboardStudentsByClassCard.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

type ClassRow = { id: string; title: string };
type ClassStudentRow = { class_id: string; student_id: string };

type BarRow = {
  name: string;
  value: number;
};

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload as BarRow | undefined;
  if (!p) return null;

  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-950/90 px-3 py-2 shadow-xl backdrop-blur-md">
      <div className="text-[11px] text-slate-300">Τμήμα</div>
      <div className="text-xs font-semibold text-slate-50">{p.name}</div>
      <div className="mt-1 text-[11px] text-slate-300">
        Μαθητές: <span className="font-semibold text-slate-50">{p.value}</span>
      </div>
    </div>
  );
}

function truncateLabel(value: any, max = 14) {
  const s = String(value ?? '');
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export default function DashboardStudentsByClassCard({
  schoolId,
}: {
  schoolId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudentRow[]>([]);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // total students
        const { count: studentsCount, error: stErr } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId);

        if (stErr) throw stErr;

        // classes
        const { data: classData, error: cErr } = await supabase
          .from('classes')
          .select('id, title')
          .eq('school_id', schoolId)
          .order('title', { ascending: true });

        if (cErr) throw cErr;

        // class_students
        const { data: csData, error: csErr } = await supabase
          .from('class_students')
          .select('class_id, student_id')
          .eq('school_id', schoolId);

        if (csErr) throw csErr;

        setTotalStudents(studentsCount ?? 0);
        setClasses((classData ?? []) as ClassRow[]);
        setClassStudents((csData ?? []) as ClassStudentRow[]);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? 'Κάτι πήγε στραβά.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [schoolId]);

  const totalClasses = classes.length;

  const rows: BarRow[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of classStudents) {
      counts.set(r.class_id, (counts.get(r.class_id) ?? 0) + 1);
    }

    const all: BarRow[] = classes.map((c) => ({
      name: c.title || '—',
      value: counts.get(c.id) ?? 0,
    }));

    // sort by size desc, then name
    all.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.name.localeCompare(b.name, 'el');
    });

    // dashboard-friendly: Top 8 + "Λοιπά"
    const TOP = 8;
    const top = all.slice(0, TOP);
    const rest = all.slice(TOP);
    const restSum = rest.reduce((sum, r) => sum + r.value, 0);

    return restSum > 0 ? [...top, { name: 'Λοιπά', value: restSum }] : top;
  }, [classes, classStudents]);

  // “glassy / premium” colors per bar
  const COLORS = [
    '#F6C453',
    '#84B7FF',
    '#49D6B1',
    '#FF7C92',
    '#B69CFF',
    '#59D7FF',
    '#FFB86B',
    '#B0BBCB',
    '#9FE3C4',
  ];

  return (
    <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg ring-1 ring-inset ring-slate-300/15">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">Μαθητές ανά Τμήμα</h2>
            <p className="mt-1 text-[11px] text-slate-300">
              Κάνε hover στις μπάρες για λεπτομέρειες.
            </p>
          </div>

          {/* totals inline */}
          <div className="flex items-center gap-4 text-[11px] text-slate-300">
            <span>
              Μαθητές:{' '}
              <span className="font-semibold text-slate-50">{totalStudents}</span>
            </span>
            <span className="h-4 w-px bg-slate-600/60" />
            <span>
              Τμήματα:{' '}
              <span className="font-semibold text-slate-50">{totalClasses}</span>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {/* Chart */}
      <div className="px-4 pb-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Φόρτωση...
          </div>
        ) : totalClasses === 0 ? (
          <div className="py-12 text-center text-xs text-slate-300">Δεν υπάρχουν τμήματα.</div>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 8, left: 10 }}
                barCategoryGap={10}
              >
                <Tooltip content={<BarTooltip />} />

                {/* X axis: counts */}
                <XAxis
                  type="number"
                  tick={{ fill: 'rgba(226,232,240,0.75)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />

                {/* Y axis: class names */}
                <YAxis
                  type="category"
                  dataKey="name"
                  width={86}
                  tickFormatter={(v) => truncateLabel(v, 12)}
                  tick={{ fill: 'rgba(226,232,240,0.9)', fontSize: 11, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />

                <Bar
                  dataKey="value"
                  radius={[999, 999, 999, 999]}
                  // subtle “glassy” stroke
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth={1}
                >
                  {rows.map((_, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={COLORS[idx % COLORS.length]}
                      fillOpacity={0.9}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!loading && totalClasses > 0 && (
          <div className="mt-2 text-[10px] text-slate-400">
            Εμφανίζονται τα μεγαλύτερα τμήματα (Top 8) + «Λοιπά».
          </div>
        )}
      </div>
    </div>
  );
}
