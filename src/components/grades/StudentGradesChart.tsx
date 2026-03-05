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
import { useTheme } from '../../context/ThemeContext';

type Props = {
  grades: { test_date: string | null; grade: number | null; test_name: string | null }[];
  loading: boolean;
};
type ChartPoint = {
  date: string;
  dateLabel: string;
  grade: number;
  testName: string;
};

const StudentGradesChart = ({ grades, loading }: Props) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data: ChartPoint[] = useMemo(
    () =>
      grades
        .filter((g) => g.test_date && g.grade !== null)
        .map((g) => {
          const iso = g.test_date as string;
          const d = new Date(iso);
          const dateLabel = d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' });
          return { date: iso, dateLabel, grade: Number(g.grade), testName: g.test_name ?? '' };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [grades]
  );

  // ── Theme tokens ──
  const containerCls = isDark
    ? 'mb-4 rounded-lg border border-slate-600 bg-slate-800/70 p-3'
    : 'mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm';

  const placeholderCls = isDark
    ? 'mb-4 flex h-[220px] items-center justify-center rounded-lg border border-slate-600 bg-slate-800/60 text-xs text-slate-300'
    : 'mb-4 flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400';

  const titleCls = isDark ? 'text-[11px] font-medium text-slate-100' : 'text-[11px] font-medium text-slate-600';

  const gridColor = isDark ? '#4b5563' : '#e2e8f0';
  const axisTickColor = isDark ? '#e5e7eb' : '#64748b';
  const tooltipBg = isDark ? '#020617' : '#ffffff';
  const tooltipBorder = isDark ? '#4b5563' : '#e2e8f0';
  const tooltipLabelColor = isDark ? '#e5e7eb' : '#374151';
  const lineColor = isDark ? '#38bdf8' : '#0ea5e9';
  const dotStroke = isDark ? '#e0f2fe' : '#bae6fd';

  if (loading) {
    return <div className={placeholderCls}>Φόρτωση διαγράμματος...</div>;
  }

  if (!loading && data.length === 0) {
    return <div className={placeholderCls}>Δεν υπάρχουν αρκετά δεδομένα για γράφημα.</div>;
  }

  return (
    <div className={containerCls}>
      <div className="mb-2">
        <p className={titleCls}>Πρόοδος βαθμών</p>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: axisTickColor }}
              tickMargin={8}
            />
            <YAxis
              tick={{ fontSize: 10, fill: axisTickColor }}
              width={26}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: tooltipLabelColor }}
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
            <Line
              type="monotone"
              dataKey="grade"
              stroke={lineColor}
              strokeWidth={2.2}
              dot={{ r: 3.5, strokeWidth: 1, stroke: dotStroke, fill: lineColor }}
              activeDot={{ r: 4.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StudentGradesChart;