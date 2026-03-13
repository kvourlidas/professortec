import { useMemo } from 'react';
import { money } from '../utils';
import type { Point } from '../types';

interface SparkAreaProps {
  points: Point[];
  stroke: string;
  fillTop: string;
  fillBottom: string;
  height?: number;
  id: string;
  isDark: boolean;
}

export function SparkArea({ points, stroke, fillTop, fillBottom, height = 112, id, isDark }: SparkAreaProps) {
  const w = 520; const h = height; const padX = 12; const padY = 10;
  const vals = points.map(p => Math.max(0, Number(p.value)||0));
  const max = Math.max(1, ...vals);
  const n = Math.max(1, points.length);
  const xAt = (i: number) => n === 1 ? w/2 : padX + i*(w-padX*2)/(n-1);
  const yAt = (v: number) => Math.max(padY, Math.min(h-padY, h-padY-(Math.max(0,v)/max)*(h-padY*2)));
  const bottom = h - padY;
  const pts = points.map((p,i) => ({ x: xAt(i), y: yAt(Number(p.value)||0), p }));
  const lineD = pts.length === 0 ? '' : `M ${pts[0]!.x} ${pts[0]!.y} ` + pts.slice(1).map(t=>`L ${t.x} ${t.y}`).join(' ');
  const areaD = pts.length === 0 ? '' : `M ${pts[0]!.x} ${bottom} L ${pts[0]!.x} ${pts[0]!.y} ` + pts.slice(1).map(t=>`L ${t.x} ${t.y}`).join(' ') + ` L ${pts[pts.length-1]!.x} ${bottom} Z`;
  const labelIdx = useMemo(() => { if (points.length <= 1) return [0]; const mid = Math.floor((points.length-1)/2); return Array.from(new Set([0, mid, points.length-1])); }, [points.length]);
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.10)';
  const labelColor = isDark ? '#64748b' : '#94a3b8';
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full">
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fillTop}/><stop offset="100%" stopColor={fillBottom}/></linearGradient></defs>
        {[0.25,0.5,0.75].map(t => { const y = padY+(h-padY*2)*t; return <line key={t} x1={padX} x2={w-padX} y1={y} y2={y} stroke={gridColor} strokeDasharray="4 5"/>; })}
        {areaD ? <path d={areaD} fill={`url(#${id})`}/> : null}
        {lineD ? <path d={lineD} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"/> : null}
        {pts.map((t,i) => <circle key={i} cx={t.x} cy={t.y} r="3.6" fill={stroke} opacity="0.9"><title>{t.p.title ?? `${t.p.label}: ${money(t.p.value)}`}</title></circle>)}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] font-medium" style={{ color: labelColor }}>
        {labelIdx.map(i => <span key={i}>{points[i]?.label ?? ''}</span>)}
      </div>
    </div>
  );
}
