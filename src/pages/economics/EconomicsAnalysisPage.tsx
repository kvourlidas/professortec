// src/pages/economics/EconomicsAnalysisPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import {
  TrendingUp, CalendarDays, Plus, Loader2, X,
  ChevronDown, ChevronLeft, ChevronRight,
  TrendingDown, Wallet, Receipt, Tag,
} from 'lucide-react';
import AppDatePicker from '../../components/ui/AppDatePicker';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';

// ── Types ──────────────────────────────────────────────────────────────────
type Mode = 'month' | 'year' | 'range';
type TxKind = 'income' | 'expense';
type TxSource = 'student_subscription' | 'tutor_payment' | 'extra_expense';
type TxRow = { id: string; kind: TxKind; source: TxSource; date: string; amount: number; label: string; notes?: string | null; category?: string | null };
type ExtraExpenseRow = { id: string; school_id: string; occurred_on?: string | null; name: string; amount: number; notes?: string | null; created_at?: string; created_by?: string | null };
type Point = { label: string; value: number; title?: string };

const PAGE_SIZE = 10;

// ── Helpers ────────────────────────────────────────────────────────────────
function money(n: number) { return `${(Number(n) || 0).toFixed(2)} €`; }
function isoToday() { return new Date().toISOString().slice(0, 10); }
function clampNumber(v: string) { const n = Number(v); return (Number.isNaN(n) || !Number.isFinite(n)) ? 0 : Math.max(0, n); }
function monthLabelEl(m: number) { return ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'][m-1] ?? `Μήνας ${m}`; }
function monthShortEl(m: number) { return monthLabelEl(m).slice(0, 3); }
function startOfMonthISO(y: number, m: number) { return new Date(y, m-1, 1).toISOString().slice(0,10); }
function endOfMonthISO(y: number, m: number) { return new Date(y, m, 0).toISOString().slice(0,10); }
function startOfYearISO(y: number) { return new Date(y, 0, 1).toISOString().slice(0,10); }
function endOfYearISO(y: number) { return new Date(y, 11, 31).toISOString().slice(0,10); }
function startOfDayTs(d: string) { return `${d}T00:00:00.000Z`; }
function endOfDayTs(d: string) { return `${d}T23:59:59.999Z`; }
function fmtDDMM(d: string) { const [,m,day] = d.split('-'); return `${day}/${m}`; }
function toUTCDate(d: string) { return new Date(`${d}T00:00:00.000Z`); }
function diffDaysInclusive(s: string, e: string) { return Math.floor(Math.max(0, toUTCDate(e).getTime()-toUTCDate(s).getTime())/86400000)+1; }
function addDaysISO(s: string, n: number) { const d = toUTCDate(s); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function errMsg(e: any) { return String(e?.message ?? e ?? '').toLowerCase(); }
function hasAll(e: any, ...p: string[]) { const m=errMsg(e); return p.every(x=>m.includes(x.toLowerCase())); }
function hasAny(e: any, ...p: string[]) { const m=errMsg(e); return p.some(x=>m.includes(x.toLowerCase())); }

// ── Shared input style ──────────────────────────────────────────────────────
const inputCls = 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{children}</div>;
}

// ── Outside-close hook ─────────────────────────────────────────────────────
function useOutsideClose(refs: Array<React.RefObject<HTMLElement|null>>, onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onDown = (e: MouseEvent) => { if (!refs.some(r => r.current?.contains(e.target as Node))) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [enabled, onClose, refs]);
}

// ── Dropdown ───────────────────────────────────────────────────────────────
function DropdownShell({ label, open, onToggle, children, widthClass }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode; widthClass?: string }) {
  return (
    <div className="relative">
      <button type="button" onClick={onToggle}
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-200 transition hover:border-slate-600 hover:bg-slate-800/60 ${widthClass ?? 'w-[150px]'}`}
        aria-haspopup="dialog" aria-expanded={open}>
        <span className="truncate">{label}</span>
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/95 shadow-2xl backdrop-blur-xl" role="dialog">
          {children}
        </div>
      )}
    </div>
  );
}

// ── SparkArea chart ────────────────────────────────────────────────────────
function SparkArea({ points, stroke, fillTop, fillBottom, height = 112, id }: { points: Point[]; stroke: string; fillTop: string; fillBottom: string; height?: number; id: string }) {
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
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full">
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={fillTop}/><stop offset="100%" stopColor={fillBottom}/></linearGradient></defs>
        {[0.25,0.5,0.75].map(t => { const y = padY+(h-padY*2)*t; return <line key={t} x1={padX} x2={w-padX} y1={y} y2={y} stroke="rgba(148,163,184,0.12)" strokeDasharray="4 5"/>; })}
        {areaD ? <path d={areaD} fill={`url(#${id})`}/> : null}
        {lineD ? <path d={lineD} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"/> : null}
        {pts.map((t,i) => <circle key={i} cx={t.x} cy={t.y} r="3.6" fill={stroke} opacity="0.9"><title>{t.p.title ?? `${t.p.label}: ${money(t.p.value)}`}</title></circle>)}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
        {labelIdx.map(i => <span key={i}>{points[i]?.label ?? ''}</span>)}
      </div>
    </div>
  );
}

// ── Donut ──────────────────────────────────────────────────────────────────
function IncomeExpenseDonut({ income, expense }: { income: number; expense: number }) {
  const inc = Math.max(0, Number(income)||0);
  const exp = Math.max(0, Number(expense)||0);
  const total = inc + exp;
  const incPct = total > 0 ? (inc/total)*100 : 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-16 w-16 shrink-0 rounded-full" style={{ background: total > 0 ? `conic-gradient(rgba(52,211,153,0.85) 0 ${incPct}%, rgba(251,113,133,0.80) ${incPct}% 100%)` : 'conic-gradient(rgba(100,116,139,0.25) 0 100%)' }} title="Έσοδα vs Έξοδα">
        <div className="absolute inset-2.5 rounded-full bg-slate-950/80 ring-1 ring-inset ring-white/[0.04]"/>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400/80"/><span className="text-slate-400">Έσοδα</span><span className="font-semibold text-emerald-300">{money(inc)}</span></div>
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400/80"/><span className="text-slate-400">Έξοδα</span><span className="font-semibold text-rose-300">{money(exp)}</span></div>
      </div>
    </div>
  );
}

function getCurrentPeriod() { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth()+1 }; }

const STUDENT_INCOME_TABLE = 'student_subscription_payments';
const EXTRA_EXPENSES_TABLE = 'school_extra_expenses';

function buildSeriesForPeriod(args: { kind: TxKind; rows: TxRow[]; mode: Mode; year: number; month: number; start: string; end: string }): Point[] {
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

// ── Page ───────────────────────────────────────────────────────────────────
export default function EconomicsAnalysisPage() {
  const { user, profile } = useAuth();
  const schoolId = profile?.school_id ?? null;
  const { year: currentYear, month: currentMonth } = getCurrentPeriod();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [openMonth, setOpenMonth] = useState(false);
  const [openYear, setOpenYear] = useState(false);
  const monthWrapRef = useRef<HTMLDivElement|null>(null);
  const yearWrapRef = useRef<HTMLDivElement|null>(null);
  useOutsideClose([monthWrapRef, yearWrapRef], () => { setOpenMonth(false); setOpenYear(false); }, openMonth || openYear);

  const [rangeStart, setRangeStart] = useState(startOfMonthISO(currentYear, currentMonth));
  const [rangeEnd, setRangeEnd] = useState(isoToday());
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState(isoToday());
  const [expNotes, setExpNotes] = useState('');
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [extraExpenses, setExtraExpenses] = useState<ExtraExpenseRow[]>([]);
  const [catPage, setCatPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ExtraExpenseRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState(isoToday());
  const [editNotes, setEditNotes] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<ExtraExpenseRow | null>(null);

  const monthsOptions = useMemo(() => Array.from({length:12},(_,i)=>({value:i+1,label:monthLabelEl(i+1)})), []);
  const yearsOptions = useMemo(() => { const base=new Date().getFullYear(); return Array.from({length:21},(_,i)=>({value:base-10+i,label:String(base-10+i)})); }, []);

  function getBounds() {
    if (mode === 'month') return { start: startOfMonthISO(year,month), end: endOfMonthISO(year,month) };
    if (mode === 'year') return { start: startOfYearISO(year), end: endOfYearISO(year) };
    return { start: rangeStart||isoToday(), end: rangeEnd||isoToday() };
  }
  const bounds = useMemo(() => getBounds(), [mode, month, year, rangeStart, rangeEnd]);

  useEffect(() => { setCatPage(1); setTxPage(1); }, [schoolId, mode, month, year, rangeStart, rangeEnd]);

  async function safeTutorPayments(start: string, end: string) {
    let res: any = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,paid_on,notes,created_at,status,tutors(full_name)').eq('school_id',schoolId!).eq('status','paid').gte('paid_on',start).lte('paid_on',end).order('paid_on',{ascending:false}).limit(500);
    if (res.error && (hasAny(res.error,'relationship')||hasAny(res.error,'foreign key'))) res = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,paid_on,notes,created_at,status').eq('school_id',schoolId!).eq('status','paid').gte('paid_on',start).lte('paid_on',end).order('paid_on',{ascending:false}).limit(500);
    if (res.error && hasAll(res.error,'paid_on','does not exist')) res = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,notes,created_at,status').eq('school_id',schoolId!).eq('status','paid').gte('created_at',startOfDayTs(start)).lte('created_at',endOfDayTs(end)).order('created_at',{ascending:false}).limit(500);
    return res;
  }
  async function safeStudentIncomes(start: string, end: string) {
    let res: any = await supabase.from(STUDENT_INCOME_TABLE).select('id,school_id,amount,paid_on,notes,created_at,student_id,students(full_name)').eq('school_id',schoolId!).gte('paid_on',start).lte('paid_on',end).order('paid_on',{ascending:false}).limit(800);
    if (res.error && hasAll(res.error,'student_id','does not exist')) res = await supabase.from(STUDENT_INCOME_TABLE).select('id,school_id,amount,paid_on,notes,created_at,students(full_name)').eq('school_id',schoolId!).gte('paid_on',start).lte('paid_on',end).order('paid_on',{ascending:false}).limit(800);
    if (res.error && hasAny(res.error,'relationship','foreign key','schema cache')) res = await supabase.from(STUDENT_INCOME_TABLE).select('id,school_id,amount,paid_on,notes,created_at').eq('school_id',schoolId!).gte('paid_on',start).lte('paid_on',end).order('paid_on',{ascending:false}).limit(800);
    if (res.error && hasAll(res.error,'paid_on','does not exist')) res = await supabase.from(STUDENT_INCOME_TABLE).select('id,school_id,amount,notes,created_at').eq('school_id',schoolId!).gte('created_at',startOfDayTs(start)).lte('created_at',endOfDayTs(end)).order('created_at',{ascending:false}).limit(800);
    return res;
  }
  async function safeExtraExpenses(start: string, end: string) {
    let res: any = await supabase.from(EXTRA_EXPENSES_TABLE).select('id,school_id,occurred_on,name,amount,notes,created_at,created_by').eq('school_id',schoolId!).gte('occurred_on',start).lte('occurred_on',end).order('occurred_on',{ascending:false}).order('created_at',{ascending:false}).limit(800);
    if (res.error && hasAll(res.error,'occurred_on','does not exist')) res = await supabase.from(EXTRA_EXPENSES_TABLE).select('id,school_id,name,amount,notes,created_at,created_by').eq('school_id',schoolId!).gte('created_at',startOfDayTs(start)).lte('created_at',endOfDayTs(end)).order('created_at',{ascending:false}).limit(800);
    return res as { data: ExtraExpenseRow[] | null; error: any };
  }

  async function loadForBounds(start: string, end: string) {
    if (!schoolId) return [];
    const [expRes, tutorRes, studentRes] = await Promise.all([safeExtraExpenses(start,end), safeTutorPayments(start,end), safeStudentIncomes(start,end)]);
    if (expRes.error) throw expRes.error; if (tutorRes.error) throw tutorRes.error; if (studentRes.error) throw studentRes.error;
    const expRows = (expRes.data??[]) as ExtraExpenseRow[];
    setExtraExpenses(expRows);
    const mappedExtra: TxRow[] = expRows.map(r => ({ id:r.id, kind:'expense', source:'extra_expense', date:(r.occurred_on??r.created_at?.slice(0,10)??isoToday()).slice(0,10), amount:Number(r.amount)||0, label:r.name, category:r.name, notes:r.notes??null }));
    const mappedTutor: TxRow[] = (tutorRes.data??[]).map((p:any) => ({ id:p.id, kind:'expense', source:'tutor_payment', date:(p.paid_on??p.created_at??isoToday()).slice(0,10), amount:Number(p.net_total)||0, label:`Πληρωμή Καθηγητή: ${p?.tutors?.full_name??'Καθηγητής'}`, category:'Καθηγητές', notes:p.notes??null }));
    const mappedStudent: TxRow[] = ((studentRes.data as any[]|null)??[]).map((p:any) => ({ id:p.id, kind:'income', source:'student_subscription', date:(p.paid_on??p.created_at??isoToday()).slice(0,10), amount:Number(p.amount)||0, label:`Συνδρομή: ${p?.students?.full_name??'Μαθητής'}`, notes:p.notes??null }));
    return [...mappedStudent, ...mappedTutor, ...mappedExtra].sort((a,b) => a.date < b.date ? 1 : -1);
  }

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true); setError(null);
    try { setTxRows(await loadForBounds(bounds.start, bounds.end)); }
    catch (e: any) { setError(e?.message ?? 'Κάτι πήγε στραβά.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, [schoolId, mode, month, year, rangeStart, rangeEnd]);

  const incomeTotal = useMemo(() => txRows.filter(r=>r.kind==='income').reduce((s,r)=>s+(Number(r.amount)||0),0), [txRows]);
  const expenseTotal = useMemo(() => txRows.filter(r=>r.kind==='expense').reduce((s,r)=>s+(Number(r.amount)||0),0), [txRows]);
  const netTotal = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal]);
  const incomeSeries = useMemo(() => buildSeriesForPeriod({kind:'income',rows:txRows,mode,year,month,start:bounds.start,end:bounds.end}), [txRows,mode,year,month,bounds.start,bounds.end]);
  const expenseSeries = useMemo(() => buildSeriesForPeriod({kind:'expense',rows:txRows,mode,year,month,start:bounds.start,end:bounds.end}), [txRows,mode,year,month,bounds.start,bounds.end]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string,number>();
    txRows.filter(r=>r.kind==='expense').forEach(r => { const k=r.category??(r.source==='extra_expense'?r.label?.trim()||'Άλλο':'Καθηγητές'); map.set(k,(map.get(k)??0)+(Number(r.amount)||0)); });
    return Array.from(map.entries()).map(([category,amount])=>({category,amount})).sort((a,b)=>b.amount-a.amount);
  }, [txRows]);

  const catTotalPages = useMemo(() => Math.max(1,Math.ceil(expenseByCategory.length/PAGE_SIZE)), [expenseByCategory.length]);
  const txTotalPages = useMemo(() => Math.max(1,Math.ceil(txRows.length/PAGE_SIZE)), [txRows.length]);
  useEffect(() => setCatPage(p=>Math.min(p,catTotalPages)), [catTotalPages]);
  useEffect(() => setTxPage(p=>Math.min(p,txTotalPages)), [txTotalPages]);
  const catPageRows = useMemo(() => { const s=(catPage-1)*PAGE_SIZE; return expenseByCategory.slice(s,s+PAGE_SIZE); }, [expenseByCategory,catPage]);
  const txPageRows = useMemo(() => { const s=(txPage-1)*PAGE_SIZE; return txRows.slice(s,s+PAGE_SIZE); }, [txRows,txPage]);

  async function addExtraExpense() {
    if (!schoolId||!user?.id) return;
    const name=expName.trim(); const amt=Number(expAmount)||0;
    if (!name||amt<=0) return;
    setBusy(true); setError(null);
    try {
      const payload: any = { school_id:schoolId, occurred_on:expDate||isoToday(), name, amount:amt, notes:expNotes.trim()||null, created_by:user.id };
      let ins: any = await supabase.from(EXTRA_EXPENSES_TABLE).insert(payload);
      if (ins.error && hasAll(ins.error,'occurred_on','does not exist')) ins = await supabase.from(EXTRA_EXPENSES_TABLE).insert({school_id:schoolId,name,amount:amt,notes:expNotes.trim()||null,created_by:user.id});
      if (ins.error) throw ins.error;
      setExpName(''); setExpAmount(0); setExpNotes(''); setExpDate(isoToday());
      await loadAll();
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία προσθήκης εξόδου.'); }
    finally { setBusy(false); }
  }

  function openEditExpense(r: ExtraExpenseRow) {
    setEditing(r); setEditName(r.name); setEditAmount(Number(r.amount)||0);
    setEditDate((r.occurred_on??r.created_at?.slice(0,10)??isoToday()).slice(0,10));
    setEditNotes(r.notes??''); setEditOpen(true);
  }
  function closeEditExpense() { if (busy) return; setEditOpen(false); setEditing(null); }

  async function saveEditExpense() {
    if (!schoolId||!user?.id||!editing) return;
    const name=editName.trim(); const amt=Number(editAmount)||0;
    if (!name||amt<=0) return;
    setBusy(true); setError(null);
    try {
      const patch: any = { name, amount:amt, notes:editNotes.trim()||null };
      if (editDate) patch.occurred_on = editDate;
      let upd: any = await supabase.from(EXTRA_EXPENSES_TABLE).update(patch).eq('id',editing.id);
      if (upd.error && hasAll(upd.error,'occurred_on','does not exist')) { const {occurred_on:_,...rest}=patch; upd = await supabase.from(EXTRA_EXPENSES_TABLE).update(rest).eq('id',editing.id); }
      if (upd.error) throw upd.error;
      closeEditExpense(); await loadAll();
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία αποθήκευσης.'); }
    finally { setBusy(false); }
  }

  function askDeleteExpense(r: ExtraExpenseRow) { setDeleting(r); setDeleteOpen(true); }
  function closeDeleteExpense() { if (busy) return; setDeleteOpen(false); setDeleting(null); }

  async function confirmDeleteExpense() {
    if (!deleting) return;
    setBusy(true); setError(null);
    try {
      const { error: delErr } = await supabase.from(EXTRA_EXPENSES_TABLE).delete().eq('id',deleting.id);
      if (delErr) throw delErr;
      closeDeleteExpense(); await loadAll();
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία διαγραφής.'); }
    finally { setBusy(false); }
  }

  // ── Pagination control ──────────────────────────────────────────────────
  const PaginationBar = ({ page, total, onPrev, onNext }: { page: number; total: number; onPrev: () => void; onNext: () => void }) => (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onPrev} disabled={page<=1} className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/40 text-slate-400 transition hover:bg-slate-800/50 hover:text-slate-200 disabled:opacity-30"><ChevronLeft className="h-3 w-3"/></button>
      <span className="min-w-[48px] text-center text-[11px] text-slate-400"><span className="font-semibold text-slate-200">{page}</span> / {total}</span>
      <button type="button" onClick={onNext} disabled={page>=total} className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/40 text-slate-400 transition hover:bg-slate-800/50 hover:text-slate-200 disabled:opacity-30"><ChevronRight className="h-3 w-3"/></button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-accent)' }} />
        <span className="text-sm">Φόρτωση...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <TrendingUp className="h-4 w-4 text-black"/>
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-50">Ανάλυση Οικονομικών</h1>
            <p className="mt-0.5 text-xs text-slate-400">Έσοδα, έξοδα και καθαρό αποτέλεσμα για την επιλεγμένη περίοδο.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode select */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 backdrop-blur">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0"/>
            <select value={mode} onChange={e=>setMode(e.target.value as Mode)}
              className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 outline-none focus:border-[color:var(--color-accent)]">
              <option value="month">Μηνιαία</option>
              <option value="year">Ετήσια</option>
              <option value="range">Εύρος ημερομηνιών</option>
            </select>
          </div>

          {/* Month + year pickers */}
          {mode === 'month' && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 backdrop-blur">
              <div ref={monthWrapRef}>
                <DropdownShell label={monthLabelEl(month)} open={openMonth} onToggle={() => { setOpenYear(false); setOpenMonth(v=>!v); }} widthClass="w-[148px]">
                  <div className="max-h-64 overflow-auto p-1">
                    {monthsOptions.map(m => (
                      <button key={m.value} type="button" onClick={() => { setMonth(m.value); setOpenMonth(false); }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-[11px] transition ${m.value===month ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.05]'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </DropdownShell>
              </div>
              <div ref={yearWrapRef}>
                <DropdownShell label={String(year)} open={openYear} onToggle={() => { setOpenMonth(false); setOpenYear(v=>!v); }} widthClass="w-[80px]">
                  <div className="max-h-64 overflow-auto p-1">
                    {yearsOptions.map(y => (
                      <button key={y.value} type="button" onClick={() => { setYear(y.value); setOpenYear(false); }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-[11px] transition ${y.value===year ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.05]'}`}>
                        {y.label}
                      </button>
                    ))}
                  </div>
                </DropdownShell>
              </div>
            </div>
          )}

          {mode === 'year' && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 backdrop-blur">
              <div ref={yearWrapRef}>
                <DropdownShell label={String(year)} open={openYear} onToggle={() => { setOpenMonth(false); setOpenYear(v=>!v); }} widthClass="w-[80px]">
                  <div className="max-h-64 overflow-auto p-1">
                    {yearsOptions.map(y => (
                      <button key={y.value} type="button" onClick={() => { setYear(y.value); setOpenYear(false); }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-[11px] transition ${y.value===year ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.05]'}`}>
                        {y.label}
                      </button>
                    ))}
                  </div>
                </DropdownShell>
              </div>
            </div>
          )}

          {mode === 'range' && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2 backdrop-blur">
              <span className="text-[11px] font-semibold text-slate-400">Από</span>
              <div className="min-w-[160px]"><AppDatePicker value={rangeStart as any} onChange={(v:any)=>setRangeStart(v)}/></div>
              <span className="text-[11px] font-semibold text-slate-400">Έως</span>
              <div className="min-w-[160px]"><AppDatePicker value={rangeEnd as any} onChange={(v:any)=>setRangeEnd(v)}/></div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400"/>{error}</div>}

      {/* ── Top grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Income + expense spark cards */}
        <div className="space-y-4 lg:col-span-8">
          {/* Income */}
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 p-5 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400"/>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Έσοδα</span>
            </div>
            <div className="text-3xl font-bold tracking-tight text-emerald-300">{money(incomeTotal)}</div>
            <div className="mt-4">
              <SparkArea id="spark-income" points={incomeSeries} stroke="rgba(52,211,153,0.95)" fillTop="rgba(52,211,153,0.18)" fillBottom="rgba(52,211,153,0.00)"/>
            </div>
          </div>

          {/* Expense */}
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 p-5 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-rose-400"/>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-500">Έξοδα</span>
            </div>
            <div className="text-3xl font-bold tracking-tight text-rose-300">{money(expenseTotal)}</div>
            <div className="mt-4">
              <SparkArea id="spark-expense" points={expenseSeries} stroke="rgba(251,113,133,0.95)" fillTop="rgba(251,113,133,0.18)" fillBottom="rgba(251,113,133,0.00)"/>
            </div>
          </div>
        </div>

        {/* Right: net + extra expenses form */}
        <div className="space-y-4 lg:col-span-4">
          {/* Net */}
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 p-5 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-3.5 w-3.5 text-slate-400"/>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Καθαρό</span>
            </div>
            <div className={`text-3xl font-bold tracking-tight ${netTotal >= 0 ? 'text-slate-100' : 'text-rose-300'}`}>{money(netTotal)}</div>
            <div className="mt-5 pt-4 border-t border-slate-800/60">
              <IncomeExpenseDonut income={incomeTotal} expense={expenseTotal}/>
            </div>
          </div>

          {/* Extra expenses form */}
          <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
            <div className="flex items-center gap-2.5 border-b border-slate-800/70 bg-slate-900/30 px-4 py-3">
              <Receipt className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }}/>
              <span className="text-xs font-semibold text-slate-200">Extra Έξοδα</span>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <FieldLabel>Όνομα εξόδου</FieldLabel>
                <input value={expName} onChange={e=>setExpName(e.target.value)} className={inputCls} placeholder="π.χ. Ενοίκιο / ΔΕΗ / Internet" disabled={busy}/>
              </div>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <FieldLabel>Ποσό</FieldLabel>
                  <input value={expAmount} onChange={e=>setExpAmount(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" disabled={busy}/>
                </div>
                <div className="col-span-7">
                  <FieldLabel>Ημερομηνία</FieldLabel>
                  <AppDatePicker value={expDate as any} onChange={(v:any)=>setExpDate(v)}/>
                </div>
              </div>
              <div>
                <FieldLabel>Σημειώσεις</FieldLabel>
                <input value={expNotes} onChange={e=>setExpNotes(e.target.value)} className={inputCls} placeholder="προαιρετικό" disabled={busy}/>
              </div>
              <button type="button" onClick={addExtraExpense} disabled={busy || !expName.trim() || (Number(expAmount)||0)<=0}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Plus className="h-3.5 w-3.5"/>}
                Προσθήκη
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: categories + transactions ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

        {/* Category breakdown */}
        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04] lg:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-800/70 bg-slate-900/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-slate-400"/>
              <span className="text-xs font-semibold text-slate-200">Έξοδα ανά κατηγορία</span>
            </div>
            {expenseByCategory.length > PAGE_SIZE && <PaginationBar page={catPage} total={catTotalPages} onPrev={()=>setCatPage(p=>Math.max(1,p-1))} onNext={()=>setCatPage(p=>Math.min(catTotalPages,p+1))}/>}
          </div>

          <div className="space-y-2 p-4">
            {expenseByCategory.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">Δεν υπάρχουν έξοδα στο φίλτρο.</p>
            ) : catPageRows.map(c => {
              const maxAmt = Math.max(1, ...expenseByCategory.map(x=>x.amount));
              const w = Math.round((c.amount/maxAmt)*100);
              return (
                <div key={c.category} className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-3 py-2.5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-slate-100 truncate">{c.category}</span>
                    <span className="shrink-0 pl-2 text-slate-300 tabular-nums">{money(c.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/60">
                    <div className="h-1.5 rounded-full bg-rose-400/60 transition-all" style={{ width: `${w}%` }}/>
                  </div>
                </div>
              );
            })}
            {expenseByCategory.length > PAGE_SIZE && (
              <p className="pt-1 text-[11px] text-slate-600">Εμφάνιση {Math.min(expenseByCategory.length,(catPage-1)*PAGE_SIZE+1)}–{Math.min(expenseByCategory.length,catPage*PAGE_SIZE)} από {expenseByCategory.length}</p>
            )}
          </div>
        </div>

        {/* Transactions */}
        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04] lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-800/70 bg-slate-900/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-slate-400"/>
              <span className="text-xs font-semibold text-slate-200">Κινήσεις (έσοδα / έξοδα)</span>
            </div>
            {txRows.length > PAGE_SIZE && <PaginationBar page={txPage} total={txTotalPages} onPrev={()=>setTxPage(p=>Math.max(1,p-1))} onNext={()=>setTxPage(p=>Math.min(txTotalPages,p+1))}/>}
          </div>

          {txRows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-xs text-slate-500">Δεν υπάρχουν κινήσεις στο φίλτρο.</div>
          ) : (
            <>
              <div className="grid grid-cols-12 border-b border-slate-800/60 bg-slate-900/20 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent) 70%, white)' }}>
                <div className="col-span-2">Ημερομηνία</div>
                <div className="col-span-2">Τύπος</div>
                <div className="col-span-6">Περιγραφή</div>
                <div className="col-span-2 text-right">Ποσό</div>
              </div>
              <div className="divide-y divide-slate-800/40">
                {txPageRows.map(r => (
                  <div key={`${r.source}-${r.id}`} className="grid grid-cols-12 items-center px-4 py-2.5 text-xs transition-colors hover:bg-white/[0.02]">
                    <div className="col-span-2 tabular-nums text-slate-500">{r.date}</div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.kind==='income' ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-300' : 'border-rose-800/50 bg-rose-950/40 text-rose-300'}`}>
                        {r.kind==='income' ? 'Έσοδο' : 'Έξοδο'}
                      </span>
                    </div>
                    <div className="col-span-6 truncate text-slate-300">
                      {r.label}{r.notes && <span className="text-slate-600"> — {r.notes}</span>}
                    </div>
                    <div className={`col-span-2 text-right font-semibold tabular-nums ${r.kind==='income' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {r.kind==='income' ? '+' : '−'} {money(r.amount)}
                    </div>
                  </div>
                ))}
              </div>
              {txRows.length > PAGE_SIZE && (
                <div className="border-t border-slate-800/60 px-4 py-2.5">
                  <p className="text-[11px] text-slate-600">Εμφάνιση {Math.min(txRows.length,(txPage-1)*PAGE_SIZE+1)}–{Math.min(txRows.length,txPage*PAGE_SIZE)} από {txRows.length}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Delete confirm ── */}
      <ConfirmActionModal
        open={deleteOpen}
        title="Διαγραφή εξόδου"
        message={<div className="text-slate-200">Σίγουρα θέλετε να διαγράψετε το έξοδο <span className="font-semibold text-slate-50">{deleting ? `${deleting.name} (${(deleting.occurred_on??deleting.created_at?.slice(0,10)??isoToday()).slice(0,10)})` : '—'}</span>; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.</div>}
        confirmLabel="Διαγραφή" cancelLabel="Ακύρωση" confirmColor="red" busy={busy}
        onClose={closeDeleteExpense} onConfirm={confirmDeleteExpense}
      />

      {/* ── Edit modal ── */}
      {editOpen && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }}/>
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <Receipt className="h-4 w-4" style={{ color: 'var(--color-accent)' }}/>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-50">Επεξεργασία Εξόδου</h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">Ενημέρωση ονόματος / ποσού / ημερομηνίας / σημειώσεων.</p>
                </div>
              </div>
              <button type="button" onClick={closeEditExpense} disabled={busy} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200 disabled:opacity-50">
                <X className="h-3.5 w-3.5"/>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-6 pb-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>Όνομα εξόδου</FieldLabel>
                <input value={editName} onChange={e=>setEditName(e.target.value)} className={inputCls} disabled={busy}/>
              </div>
              <div>
                <FieldLabel>Ποσό</FieldLabel>
                <input value={editAmount} onChange={e=>setEditAmount(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" disabled={busy}/>
              </div>
              <div>
                <FieldLabel>Ημερομηνία</FieldLabel>
                <AppDatePicker value={editDate as any} onChange={(v:any)=>setEditDate(v)}/>
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Σημειώσεις</FieldLabel>
                <input value={editNotes} onChange={e=>setEditNotes(e.target.value)} className={inputCls} disabled={busy}/>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4">
              <button type="button" onClick={closeEditExpense} disabled={busy} className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50">Ακύρωση</button>
              <button type="button" onClick={saveEditExpense} disabled={busy || !editName.trim() || (Number(editAmount)||0)<=0}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-black transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60" style={{ backgroundColor: 'var(--color-accent)' }}>
                {busy ? <><Loader2 className="h-3 w-3 animate-spin"/>Αποθήκευση…</> : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}