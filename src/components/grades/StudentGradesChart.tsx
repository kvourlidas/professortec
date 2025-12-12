// src/components/grades/StudentGradesChart.tsx
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type Props = {
  grades: { test_date: string | null; grade: number | null; test_name: string | null }[];
  loading: boolean;
};

type ChartPoint = {
  date: string;      // ISO
  dateLabel: string; // formatted for axis
  grade: number;
  testName: string;
};

const StudentGradesChart = ({ grades, loading }: Props) => {
  const data: ChartPoint[] = useMemo(
    () =>
      grades
        .filter((g) => g.test_date && g.grade !== null)
        .map((g) => {
          const iso = g.test_date as string;
          const d = new Date(iso);
          const dateLabel = d.toLocaleDateString('el-GR', {
            day: '2-digit',
            month: '2-digit',
          });

          return {
            date: iso,
            dateLabel,
            grade: Number(g.grade),
            testName: g.test_name ?? '',
          };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [grades]
  );

  if (loading) {
    return (
      <div className="mb-4 flex h-[220px] items-center justify-center rounded-lg border border-slate-600 bg-slate-800/60 text-xs text-slate-200">
        Φόρτωση διαγράμματος...
      </div>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <div className="mb-4 flex h-[220px] items-center justify-center rounded-lg border border-slate-600 bg-slate-800/60 text-xs text-slate-300">
        Δεν υπάρχουν αρκετά δεδομένα για γράφημα.
      </div>
    );
  }

  return (
    // 🔹 Λίγο πιο ανοιχτό background + border
    <div className="mb-4 rounded-lg border border-slate-600 bg-slate-800/70 p-3">
      <div className="mb-2">
        <p className="text-[11px] font-medium text-slate-100">Πρόοδος βαθμών</p>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            {/* 🔹 Grid λίγο πιο φωτεινό αλλά όχι υπερβολικά */}
            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: '#e5e7eb' }} // λίγο πιο bright
              tickMargin={8}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#e5e7eb' }}
              width={26}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#020617',
                borderColor: '#4b5563',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: '#e5e7eb' }}
              formatter={(value) => {
                const v = value as number;
                return [`${v.toFixed(1)}`, 'Βαθμός'];
              }}
              labelFormatter={(_, payload) => {
                if (!payload || payload.length === 0) return '';
                const p = payload[0].payload as ChartPoint;
                return `${p.dateLabel} • ${p.testName}`;
              }}
            />
            {/* 🔹 Κρατάμε μπλε γραμμή, απλά λίγο πιο “electric” */}
            <Line
              type="monotone"
              dataKey="grade"
              stroke="#38bdf8"           // blue line
              strokeWidth={2.2}
              dot={{ r: 3.5, strokeWidth: 1, stroke: '#e0f2fe', fill: '#38bdf8' }}
              activeDot={{ r: 4.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StudentGradesChart;
