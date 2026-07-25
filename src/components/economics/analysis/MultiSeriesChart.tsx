import { money } from '../utils';
import type { Point } from '../types';

export type SeriesId = 'income' | 'expense' | 'owed';

interface Props {
  incomeSeries: Point[];
  expenseSeries: Point[];
  owedValue: number;
  isDark: boolean;
  active: Set<SeriesId>;
}

const CFG: Record<SeriesId, { stroke: string; fillTop: string; fillBot: string }> = {
  income:  { stroke: '#10b981', fillTop: 'rgba(16,185,129,0.55)', fillBot: 'rgba(16,185,129,0.08)' },
  expense: { stroke: '#f43f5e', fillTop: 'rgba(244,63,94,0.50)',  fillBot: 'rgba(244,63,94,0.06)'  },
  owed:    { stroke: '#f59e0b', fillTop: 'rgba(245,158,11,0.45)', fillBot: 'rgba(245,158,11,0.06)' },
};

export function MultiSeriesChart({ incomeSeries, expenseSeries, owedValue, isDark, active }: Props) {
  const W = 520; const H = 220; const padX = 12; const padY = 14;
  const bottom = H - padY;

  const xSeries = incomeSeries.length > 0 ? incomeSeries : expenseSeries;
  const n = Math.max(1, xSeries.length);
  const xAt = (i: number) => n === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1);

  const incVals = incomeSeries.map(p => Math.max(0, Number(p.value) || 0));
  const expVals = expenseSeries.map(p => Math.max(0, Number(p.value) || 0));
  const candidates = [
    ...(active.has('income') ? incVals : []),
    ...(active.has('expense') ? expVals : []),
    ...(active.has('owed') ? [owedValue] : []),
  ];
  const max = Math.max(1, ...candidates);
  const yAt = (v: number) => Math.max(padY, Math.min(bottom, H - padY - (Math.max(0, v) / max) * (H - padY * 2)));

  const buildPaths = (series: Point[]) => {
    const pts = series.map((p, i) => ({ x: xAt(i), y: yAt(Number(p.value) || 0), p }));
    if (pts.length === 0) return { lineD: '', areaD: '', pts };
    const lineD = `M ${pts[0]!.x} ${pts[0]!.y}` + pts.slice(1).map(t => ` L ${t.x} ${t.y}`).join('');
    const areaD = `M ${pts[0]!.x} ${bottom} L ${pts[0]!.x} ${pts[0]!.y}` + pts.slice(1).map(t => ` L ${t.x} ${t.y}`).join('') + ` L ${pts[pts.length - 1]!.x} ${bottom} Z`;
    return { lineD, areaD, pts };
  };

  const incP = buildPaths(incomeSeries);
  const expP = buildPaths(expenseSeries);
  const owedY = yAt(owedValue);

  const gridColor = isDark ? 'rgba(148,163,184,0.10)' : 'rgba(100,116,139,0.09)';
  const labelColor = isDark ? '#64748b' : '#94a3b8';
  const labelIdx = xSeries.length <= 1 ? [0] : [0, Math.floor((xSeries.length - 1) / 2), xSeries.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full">
        <defs>
          {(['income', 'expense', 'owed'] as SeriesId[]).map(id => (
            <linearGradient key={id} id={`msc-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CFG[id].fillTop} />
              <stop offset="100%" stopColor={CFG[id].fillBot} />
            </linearGradient>
          ))}
        </defs>

        {[0.25, 0.5, 0.75].map(t => {
          const y = padY + (H - padY * 2) * t;
          return <line key={t} x1={padX} x2={W - padX} y1={y} y2={y} stroke={gridColor} strokeDasharray="4 5" />;
        })}

        {active.has('income') && incP.areaD && (
          <>
            <path d={incP.areaD} fill="url(#msc-income)" />
            <path d={incP.lineD} fill="none" stroke={CFG.income.stroke} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
            {incP.pts.map((t, i) => (
              <circle key={i} cx={t.x} cy={t.y} r="3.5" fill={CFG.income.stroke}>
                <title>{t.p.title ?? `Έσοδα ${t.p.label}: ${money(t.p.value)}`}</title>
              </circle>
            ))}
          </>
        )}

        {active.has('expense') && expP.areaD && (
          <>
            <path d={expP.areaD} fill="url(#msc-expense)" />
            <path d={expP.lineD} fill="none" stroke={CFG.expense.stroke} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />
            {expP.pts.map((t, i) => (
              <circle key={i} cx={t.x} cy={t.y} r="3.5" fill={CFG.expense.stroke}>
                <title>{t.p.title ?? `Έξοδα ${t.p.label}: ${money(t.p.value)}`}</title>
              </circle>
            ))}
          </>
        )}

        {active.has('owed') && owedValue > 0 && (
          <path d={`M ${padX} ${owedY} L ${W - padX} ${owedY}`}
            fill="none" stroke={CFG.owed.stroke} strokeWidth="2.5" strokeDasharray="8 4" />
        )}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[10px] font-medium" style={{ color: labelColor }}>
        {labelIdx.map(i => <span key={i}>{xSeries[i]?.label ?? ''}</span>)}
      </div>
    </div>
  );
}
