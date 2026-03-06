import type { Mode, TxKind, TxRow, Point } from './types';

export function money(n: number): string { return `${(Number(n) || 0).toFixed(2)} €`; }
export function isoToday(): string { return new Date().toISOString().slice(0, 10); }
export function clampNumber(v: string): number { const n = Number(v); return (Number.isNaN(n) || !Number.isFinite(n)) ? 0 : Math.max(0, n); }
export function monthLabelEl(m: number): string { return ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'][m-1] ?? `Μήνας ${m}`; }
export function monthShortEl(m: number): string { return monthLabelEl(m).slice(0, 3); }
export function startOfMonthISO(y: number, m: number): string { return new Date(y, m-1, 1).toISOString().slice(0,10); }
export function endOfMonthISO(y: number, m: number): string { return new Date(y, m, 0).toISOString().slice(0,10); }
export function startOfYearISO(y: number): string { return new Date(y, 0, 1).toISOString().slice(0,10); }
export function endOfYearISO(y: number): string { return new Date(y, 11, 31).toISOString().slice(0,10); }
export function startOfDayTs(d: string): string { return `${d}T00:00:00.000Z`; }
export function endOfDayTs(d: string): string { return `${d}T23:59:59.999Z`; }
export function fmtDDMM(d: string): string { const [,m,day] = d.split('-'); return `${day}/${m}`; }
export function toUTCDate(d: string): Date { return new Date(`${d}T00:00:00.000Z`); }
export function diffDaysInclusive(s: string, e: string): number { return Math.floor(Math.max(0, toUTCDate(e).getTime()-toUTCDate(s).getTime())/86400000)+1; }
export function addDaysISO(s: string, n: number): string { const d = toUTCDate(s); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function errMsg(e: unknown): string { return String((e as any)?.message ?? e ?? '').toLowerCase(); }
export function hasAll(e: unknown, ...p: string[]): boolean { const m=errMsg(e); return p.every(x=>m.includes(x.toLowerCase())); }
export function hasAny(e: unknown, ...p: string[]): boolean { const m=errMsg(e); return p.some(x=>m.includes(x.toLowerCase())); }
export function getCurrentPeriod(): { year: number; month: number } { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth()+1 }; }

export function buildSeriesForPeriod(args: { kind: TxKind; rows: TxRow[]; mode: Mode; year: number; month: number; start: string; end: string }): Point[] {
  const { kind, rows, mode, year, month, start, end } = args;
  const only = rows.filter(r => r.kind === kind);
  const byDay = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const r of only) {
    const d = r.date.slice(0,10); byDay.set(d, (byDay.get(d)??0)+(Number(r.amount)||0));
    const ym = d.slice(0,7); byMonth.set(ym, (byMonth.get(ym)??0)+(Number(r.amount)||0));
  }
  if (mode === 'year') { const pts: Point[] = []; for (let m=1;m<=12;m++) { const key=`${year}-${String(m).padStart(2,'0')}`; const v=byMonth.get(key)??0; pts.push({label:monthShortEl(m),value:v,title:`${monthLabelEl(m)} ${year}: ${money(v)}`}); } return pts; }
  if (mode === 'month') { const s=startOfMonthISO(year,month); const days=diffDaysInclusive(s,endOfMonthISO(year,month)); const pts: Point[] = []; for (let i=0;i<days;i++) { const d=addDaysISO(s,i); const v=byDay.get(d)??0; pts.push({label:fmtDDMM(d),value:v,title:`${d}: ${money(v)}`}); } return pts; }
  const days = diffDaysInclusive(start, end);
  if (days <= 31) { const pts: Point[] = []; for (let i=0;i<days;i++) { const d=addDaysISO(start,i); const v=byDay.get(d)??0; pts.push({label:fmtDDMM(d),value:v,title:`${d}: ${money(v)}`}); } return pts; }
  if (days <= 120) { const weeks=Math.ceil(days/7); const pts: Point[] = []; for (let w=0;w<weeks;w++) { const ws=addDaysISO(start,w*7); const we=addDaysISO(start,Math.min(days-1,w*7+6)); let sum=0; for (let i=0;i<diffDaysInclusive(ws,we);i++) sum+=byDay.get(addDaysISO(ws,i))??0; pts.push({label:fmtDDMM(ws),value:sum,title:`${ws} → ${we}: ${money(sum)}`}); } return pts; }
  const pts: Point[] = []; let curY=Number(start.slice(0,4)); let curM=Number(start.slice(5,7));
  while (true) { const key=`${curY}-${String(curM).padStart(2,'0')}`; const v=byMonth.get(key)??0; pts.push({label:monthShortEl(curM),value:v,title:`${key}: ${money(v)}`}); if (key===end.slice(0,7)) break; if (++curM===13){curM=1;curY++;} }
  return pts;
}
