import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import {
  Loader2, Save, HandCoins, History, X, Briefcase,
  Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import YearlySubscriptionModal from '../../components/economics/YearlySubscriptionModal';
import MonthlySubscriptionModal, {
  type PeriodMode as MonthlyPeriodMode,
} from '../../components/economics/MonthlySubscriptionModal';

type StudentRow = { id: string; school_id: string; full_name: string | null };
type PackageType = 'hourly' | 'monthly' | 'yearly';
type PackageRow = { id: string; school_id: string; name: string; price: number; currency: string; is_active: boolean; sort_order: number; package_type?: PackageType | null; hours?: number | null; created_at?: string | null };
type SubscriptionRow = { id: string; school_id: string; student_id: string; package_id: string | null; package_name: string; price: number; currency: string; status: 'active' | 'completed' | 'canceled'; starts_on: string | null; ends_on: string | null; created_at: string | null; used_hours?: number | null; charge_amount?: number | null; paid_amount?: number | null; balance?: number | null };
type PaymentRow = { subscription_id: string; amount: number; created_at: string | null };
type StudentViewRow = { student_id: string; student_name: string; sub: SubscriptionRow | null; paid: number; balance: number; payments: PaymentRow[] };

const CURRENCY_SYMBOL = '€';

function money(n: number | null | undefined) { const v = Number(n ?? 0); return Number.isFinite(v) ? v.toFixed(2) : '0.00'; }
function parseMoney(input: string) { const n = Number((input ?? '').trim().replace(',', '.').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? Math.max(0, n) : 0; }
function parsePct(input: string) { const n = Number((input ?? '').trim().replace(',', '.').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; }
function round2(n: number) { return Number(Number(n ?? 0).toFixed(2)); }
const pad2 = (n: number) => String(n).padStart(2, '0');
function todayLocalISODate() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function displayToISODate(display: string): string | null { const v = (display ?? '').trim(); if (!v) return null; const parts = v.split(/[\/\-\.]/); if (parts.length !== 3) return null; const [dStr,mStr,yStr] = parts; const d=Number(dStr),m=Number(mStr),y=Number(yStr); if (!d||!m||!y) return null; const dt=new Date(y,m-1,d); if (Number.isNaN(dt.getTime())||dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d) return null; return `${y}-${pad2(m)}-${pad2(d)}`; }
function isoToDisplayDate(iso: string | null | undefined): string { const v=(iso??'').trim(); if (!v) return ''; if (v.includes('T')) { const d=new Date(v); if (!Number.isNaN(d.getTime())) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; } const parts=v.split('-'); if (parts.length===3) { const [y,m,d]=parts; if (y&&m&&d) return `${pad2(Number(d))}/${pad2(Number(m))}/${y}`; } return v; }
function monthKeyToRange(monthKey: string): { startISO: string; endISO: string } | null { const mk=(monthKey??'').trim(); if (!mk) return null; const [yStr,mStr]=mk.split('-'); const y=Number(yStr),m=Number(mStr); if (!y||!m||m<1||m>12) return null; const end=new Date(y,m,0); return { startISO:`${y}-${pad2(m)}-01`, endISO:`${y}-${pad2(m)}-${pad2(end.getDate())}` }; }
function monthKeyFromISO(iso: string | null | undefined): string { const v=(iso??'').trim(); if (!v) return ''; const base=v.includes('T')?v.split('T')[0]:v; const parts=base.split('-'); if (parts.length<2) return ''; const [y,m]=parts; return (y&&m)?`${y}-${m}`:''; }
function normalizeText(value: string | null | undefined): string { if (!value) return ''; return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function isYearlyPackageName(name: string | null | undefined) { const n=normalizeText(name); return n.includes('ετησι')||n.includes('annual')||n.includes('year'); }
function isMonthlyPackageName(name: string | null | undefined) { const n=normalizeText(name); return n.includes('μην')||n.includes('monthly')||n.includes('month'); }
function isHourlyPackageName(name: string | null | undefined) { const n=normalizeText(name); return n.includes('ωρια')||n.includes('hour')||n.includes('hourly'); }
function formatDateTime(iso: string | null) { if (!iso) return '—'; const d=new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

export default function StudentsSubscriptionsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;
  const pageSize = 15;

  const inputCls = isDark
    ? 'h-8 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2.5 text-[11px] text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const theadCls = isDark
    ? 'border-b border-slate-800/60 bg-slate-900/40 text-[10px] font-semibold uppercase tracking-widest'
    : 'border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-widest';

  const pkgSelectCls = isDark
    ? 'w-full max-w-[280px] rounded-lg border border-slate-700/70 bg-slate-900/60 px-2 py-1.5 text-[11px] text-slate-100 outline-none transition focus:border-[color:var(--color-accent)]'
    : 'w-full max-w-[280px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none transition focus:border-[color:var(--color-accent)]';

  const periodBadgeCls = isDark
    ? 'inline-flex rounded-full border border-slate-700/60 bg-slate-900/30 px-2.5 py-1 text-[11px] text-slate-300'
    : 'inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600';

  const paginationBarCls = isDark
    ? 'flex items-center justify-between gap-3 border-t border-slate-800/60 bg-slate-900/20 px-4 py-3'
    : 'flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3';

  const paginationBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/40 text-slate-400 transition hover:bg-slate-800/50 hover:text-slate-200 disabled:opacity-30'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30';

  const searchInputCls = isDark
    ? 'h-9 w-full rounded-xl border border-slate-700/60 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 backdrop-blur'
    : 'h-9 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const modalCardCls = isDark
    ? 'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl';

  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';

  const cancelBtnCls = isDark
    ? 'rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60'
    : 'rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [rows, setRows] = useState<StudentViewRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Record<string, string>>({});
  const [paymentInput, setPaymentInput] = useState<Record<string, string>>({});
  const [customPriceInput, setCustomPriceInput] = useState<Record<string, string>>({});
  const [discountPctInput, setDiscountPctInput] = useState<Record<string, string>>({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [payingStudentId, setPayingStudentId] = useState<string | null>(null);
  const [startsOn, setStartsOn] = useState<Record<string, string>>({});
  const [endsOn, setEndsOn] = useState<Record<string, string>>({});
  const [periodMode, setPeriodMode] = useState<Record<string, MonthlyPeriodMode>>({});
  const [selectedMonthNum, setSelectedMonthNum] = useState<Record<string, string>>({});
  const [selectedYear, setSelectedYear] = useState<Record<string, string>>({});
  const [yearlyModal, setYearlyModal] = useState<{ studentId: string; studentName: string; pkgId: string; pkgName: string; prevPkgId: string } | null>(null);
  const [monthlyModal, setMonthlyModal] = useState<{ studentId: string; studentName: string; pkgId: string; pkgName: string; prevPkgId: string } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ studentName: string; payments: PaymentRow[] } | null>(null);

  const historyTotalPaid = useMemo(() => historyTarget?.payments.reduce((sum,p)=>sum+Number(p.amount??0),0)??0, [historyTarget]);
  useEffect(() => setPage(1), [search]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalStudents/pageSize)), [totalStudents]);
  useEffect(() => setPage(p => Math.min(Math.max(1,p), pageCount)), [pageCount]);
  const packageById = useMemo(() => { const map=new Map<string,PackageRow>(); for (const p of packages) map.set(p.id,p); return map; }, [packages]);

  const monthOptions = useMemo(() => [
    {value:'01',label:'Ιανουάριος'},{value:'02',label:'Φεβρουάριος'},{value:'03',label:'Μάρτιος'},
    {value:'04',label:'Απρίλιος'},{value:'05',label:'Μάιος'},{value:'06',label:'Ιούνιος'},
    {value:'07',label:'Ιούλιος'},{value:'08',label:'Αύγουστος'},{value:'09',label:'Σεπτέμβριος'},
    {value:'10',label:'Οκτώβριος'},{value:'11',label:'Νοέμβριος'},{value:'12',label:'Δεκέμβριος'},
  ], []);

  const yearOptions = useMemo(() => { const y=new Date().getFullYear(); return Array.from({length:6},(_,i)=>String(y+i)); }, []);
  const monthLabel = (m: string) => monthOptions.find(x=>x.value===m)?.label ?? '';

  const getFinalPriceForStudent = (studentId: string) => {
    const pkgId = (selectedPackage[studentId]??'').trim();
    const pkg = pkgId ? packageById.get(pkgId)??null : null;
    const custom = (customPriceInput[studentId]??'').trim();
    const base = custom ? parseMoney(custom) : Number(pkg?.price??0);
    const pct = parsePct(discountPctInput[studentId]??'');
    return round2(Math.max(0, base*(1-pct/100)));
  };

  const loadPackages = async () => {
    if (!schoolId) return;
    const { data, error } = await supabase.from('packages').select('id,school_id,name,price,currency,is_active,sort_order,created_at').eq('school_id',schoolId).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
    if (error) { setError(error.message); setPackages([]); return; }
    setPackages((data??[]) as PackageRow[]);
  };

  const load = async () => {
    if (!schoolId) { setLoading(false); setError('Δεν βρέθηκε school_id στο προφίλ.'); return; }
    setLoading(true); setError(null); setInfo(null);
    const from=(page-1)*pageSize, to=from+pageSize-1;
    let stQ = supabase.from('students').select('id,school_id,full_name',{count:'exact'}).eq('school_id',schoolId).order('full_name',{ascending:true}).range(from,to);
    const q=search.trim(); if (q) stQ=stQ.ilike('full_name',`%${q}%`);
    const stRes = await stQ;
    if (stRes.error) { setError(stRes.error.message); setRows([]); setTotalStudents(0); setLoading(false); return; }
    const students=(stRes.data??[]) as StudentRow[]; setTotalStudents(stRes.count??0);
    if (students.length===0) { setRows([]); setLoading(false); return; }
    const studentIds=students.map(s=>s.id);
    const subRes = await supabase.from('student_subscriptions_with_totals').select('id,school_id,student_id,package_id,package_name,price,currency,status,starts_on,ends_on,created_at,used_hours,charge_amount,paid_amount,balance').eq('school_id',schoolId).in('student_id',studentIds).order('created_at',{ascending:false});
    if (subRes.error) { setError(subRes.error.message); setRows([]); setLoading(false); return; }
    const subs=(subRes.data??[]) as SubscriptionRow[];
    const latestSubByStudent=new Map<string,SubscriptionRow>();
    for (const s of subs) if (!latestSubByStudent.has(s.student_id)) latestSubByStudent.set(s.student_id,s);
    const subIds=Array.from(latestSubByStudent.values()).map(s=>s.id);
    const paymentsBySubId=new Map<string,PaymentRow[]>();
    if (subIds.length>0) {
      const payRes=await supabase.from('student_subscription_payments').select('subscription_id,amount,created_at').eq('school_id',schoolId).in('subscription_id',subIds);
      if (payRes.error) { setError(payRes.error.message); setRows([]); setLoading(false); return; }
      for (const p of (payRes.data??[]) as PaymentRow[]) { const list=paymentsBySubId.get(p.subscription_id)??[]; list.push(p); paymentsBySubId.set(p.subscription_id,list); }
      for (const [sid,list] of paymentsBySubId.entries()) { list.sort((a,b)=>(b.created_at??'').localeCompare(a.created_at??'')); paymentsBySubId.set(sid,list); }
    }
    const view: StudentViewRow[] = students.map(st => { const sub=latestSubByStudent.get(st.id)??null; return { student_id:st.id, student_name:st.full_name??'—', sub, paid:sub?Number((sub as any).paid_amount??0):0, balance:sub?Number((sub as any).balance??0):0, payments:sub?paymentsBySubId.get(sub.id)??[]:[] }; });
    setRows(view);
    const now=new Date(), defY=String(now.getFullYear()), defM=pad2(now.getMonth()+1);
    setSelectedPackage(prev => { const next={...prev}; for (const r of view) { if (!(r.student_id in next)||!prev[r.student_id]) next[r.student_id]=r.sub?.package_id??''; } return next; });
    setPaymentInput(prev => { const next={...prev}; for (const r of view) if (!(r.student_id in next)) next[r.student_id]=''; return next; });
    setCustomPriceInput(prev => { const next={...prev}; for (const r of view) if (!(r.student_id in next)) next[r.student_id]=''; return next; });
    setDiscountPctInput(prev => { const next={...prev}; for (const r of view) if (!(r.student_id in next)) next[r.student_id]=''; return next; });
    setStartsOn(prev => { const next={...prev}; for (const r of view) if (!(r.student_id in next)) next[r.student_id]=isoToDisplayDate(r.sub?.starts_on); return next; });
    setEndsOn(prev => { const next={...prev}; for (const r of view) if (!(r.student_id in next)) next[r.student_id]=isoToDisplayDate(r.sub?.ends_on); return next; });
    setPeriodMode(prev => { const next={...prev}; for (const r of view) if (!(r.student_id in next)) next[r.student_id]=isMonthlyPackageName(r.sub?.package_name??'')?'month':'range'; return next; });
    setSelectedYear(prev => { const next={...prev}; for (const r of view) { if (r.student_id in next) continue; const mk=monthKeyFromISO(r.sub?.starts_on); const y=mk?mk.split('-')[0]:defY; next[r.student_id]=yearOptions.includes(y)?y:defY; } return next; });
    setSelectedMonthNum(prev => { const next={...prev}; for (const r of view) { if (r.student_id in next) continue; const mk=monthKeyFromISO(r.sub?.starts_on); next[r.student_id]=mk?mk.split('-')[1]??defM:defM; } return next; });
    setLoading(false);
  };

  useEffect(() => { loadPackages(); }, [schoolId]);
  useEffect(() => { load(); }, [schoolId, page, search]);

  const openPackageModalIfNeeded = (studentId: string, studentName: string, nextPkgId: string, prevPkgId: string) => {
    const pkg=nextPkgId?packageById.get(nextPkgId):null; if (!pkg) return;
    if (isYearlyPackageName(pkg.name)) { setYearlyModal({studentId,studentName,pkgId:nextPkgId,pkgName:pkg.name,prevPkgId}); return; }
    if (isMonthlyPackageName(pkg.name)) { setMonthlyModal({studentId,studentName,pkgId:nextPkgId,pkgName:pkg.name,prevPkgId}); return; }
    if (isHourlyPackageName(pkg.name)) { setStartsOn(p=>({...p,[studentId]:(p[studentId]??'').trim()||isoToDisplayDate(todayLocalISODate())})); setEndsOn(p=>({...p,[studentId]:''})); setPeriodMode(p=>({...p,[studentId]:'range'})); return; }
    setStartsOn(p=>({...p,[studentId]:''})); setEndsOn(p=>({...p,[studentId]:''})); setPeriodMode(p=>({...p,[studentId]:'range'}));
  };

  const saveStudentPackage = async (studentId: string) => {
    if (!schoolId) return;
    const pkgId=(selectedPackage[studentId]??'').trim(); if (!pkgId) { setError('Επέλεξε πακέτο πρώτα.'); return; }
    const pkg=packageById.get(pkgId); if (!pkg) { setError('Το επιλεγμένο πακέτο δεν βρέθηκε.'); return; }
    const yearly=isYearlyPackageName(pkg.name), monthly=isMonthlyPackageName(pkg.name), hourly=isHourlyPackageName(pkg.name);
    const sOnDisplay=(startsOn[studentId]??'').trim(), eOnDisplay=(endsOn[studentId]??'').trim();
    let startsISO: string|null=null, endsISO: string|null=null;
    if (yearly) {
      const s=displayToISODate(sOnDisplay), e=displayToISODate(eOnDisplay);
      if (!s||!e) { setError('Για το ετήσιο πακέτο βάλε έγκυρη ημερομηνία έναρξης και λήξης.'); return; }
      if (new Date(s).getTime()>new Date(e).getTime()) { setError('Η ημερομηνία έναρξης δεν μπορεί να είναι μετά τη λήξη.'); return; }
      startsISO=s; endsISO=e;
    } else if (monthly) {
      const mode: MonthlyPeriodMode=periodMode[studentId]??'month';
      if (mode==='range') {
        const s=displayToISODate(sOnDisplay), e=displayToISODate(eOnDisplay);
        if (!s||!e) { setError('Βάλε έγκυρη ημερομηνία έναρξης και λήξης.'); return; }
        if (new Date(s).getTime()>new Date(e).getTime()) { setError('Η ημερομηνία έναρξης δεν μπορεί να είναι μετά τη λήξη.'); return; }
        startsISO=s; endsISO=e;
      } else {
        const y=(selectedYear[studentId]??'').trim(), m=(selectedMonthNum[studentId]??'').trim();
        const range=monthKeyToRange(`${y}-${m}`); if (!range) { setError('Επέλεξε μήνα και έτος για τη συνδρομή.'); return; }
        startsISO=range.startISO; endsISO=range.endISO;
      }
    } else if (hourly) {
      startsISO=displayToISODate(sOnDisplay)??todayLocalISODate(); endsISO=null;
      setStartsOn(p=>({...p,[studentId]:isoToDisplayDate(startsISO)})); setEndsOn(p=>({...p,[studentId]:''}));
    }
    const row=rows.find(r=>r.student_id===studentId)??null;
    setSavingStudentId(studentId); setError(null); setInfo(null);
    const payload={school_id:schoolId,student_id:studentId,package_id:pkg.id,package_name:pkg.name,price:getFinalPriceForStudent(studentId),currency:pkg.currency??'EUR',status:'active' as const,starts_on:startsISO,ends_on:endsISO};
    if (!row?.sub) {
      const {error}=await supabase.from('student_subscriptions').insert(payload);
      if (error) { setError(error.message); setSavingStudentId(null); return; }
      setInfo('Ανατέθηκε πακέτο.'); await load(); setSavingStudentId(null); return;
    }
    const {error}=await supabase.from('student_subscriptions').update(payload).eq('id',row.sub.id).eq('school_id',schoolId);
    if (error) { setError(error.message); setSavingStudentId(null); return; }
    setInfo('Ενημερώθηκε το πακέτο.'); await load(); setSavingStudentId(null);
  };

  const addPayment = async (studentId: string) => {
    if (!schoolId) return;
    const row=rows.find(r=>r.student_id===studentId)??null;
    if (!row?.sub) { setError('Ο μαθητής δεν έχει πακέτο. Ανάθεσε πακέτο πρώτα.'); return; }
    const amount=parseMoney(paymentInput[studentId]??''); if (amount<=0) { setError('Δώσε ποσό μεγαλύτερο από 0.'); return; }
    setPayingStudentId(studentId); setError(null); setInfo(null);
    const {error}=await supabase.from('student_subscription_payments').insert({school_id:schoolId,subscription_id:row.sub.id,amount:Number(amount.toFixed(2))});
    if (error) { setError(error.message); setPayingStudentId(null); return; }
    setPaymentInput(prev=>({...prev,[studentId]:''})); setInfo('Καταχωρήθηκε πληρωμή.'); await load(); setPayingStudentId(null);
  };

  const showingFrom=totalStudents===0?0:(page-1)*pageSize+1;
  const showingTo=Math.min(page*pageSize,totalStudents);

  const periodSummary = (studentId: string, pkgName: string|null|undefined, sub: SubscriptionRow|null) => {
    if (!pkgName) return '—';
    if (isYearlyPackageName(pkgName)) { const a=(startsOn[studentId]??'').trim(), b=(endsOn[studentId]??'').trim(); return a&&b?`${a} – ${b}`:'—'; }
    if (isMonthlyPackageName(pkgName)) { const mode=periodMode[studentId]??'month'; if (mode==='range') { const a=(startsOn[studentId]??'').trim(), b=(endsOn[studentId]??'').trim(); return a&&b?`${a} – ${b}`:'—'; } const y=(selectedYear[studentId]??'').trim(), m=(selectedMonthNum[studentId]??'').trim(); if (!y||!m) return '—'; const label=monthLabel(m); return label?`${label} ${y}`:`${m}/${y}`; }
    if (isHourlyPackageName(pkgName)) { const s=(startsOn[studentId]??'').trim()||isoToDisplayDate(sub?.starts_on); const hrs=sub?Number((sub as any).used_hours??0):0; return s?`Από ${s} · ${money(Math.abs(hrs))} ώρες`:'—'; }
    return '—';
  };

  return (
    <div className="space-y-6 px-1">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <Briefcase className="h-4 w-4 text-black"/>
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark?'text-slate-50':'text-slate-800'}`}>Συνδρομές Μαθητών</h1>
            <p className={`mt-0.5 text-xs ${isDark?'text-slate-400':'text-slate-500'}`}>Ανάθεση πακέτου &amp; πληρωμές (υπολογίζει αυτόματα υπόλοιπο).</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark?'text-slate-500':'text-slate-400'}`}/>
          <input className={searchInputCls} placeholder="Αναζήτηση μαθητή..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      </div>

      {(error || info) && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${error?(isDark?'border-red-500/40 bg-red-950/40 text-red-200':'border-red-300 bg-red-50 text-red-700'):(isDark?'border-emerald-500/30 bg-emerald-950/30 text-emerald-200':'border-emerald-300 bg-emerald-50 text-emerald-700')}`}>
          <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${error?'bg-red-400':'bg-emerald-400'}`}/>
          {error ?? info}
        </div>
      )}

      <div className={cardCls}>
        <div className="overflow-x-auto overflow-y-visible">
          {loading ? (
            <div className={`flex items-center gap-2.5 px-6 py-10 text-sm ${isDark?'text-slate-400':'text-slate-500'}`}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color:'var(--color-accent)' }}/>Φόρτωση…
            </div>
          ) : rows.length === 0 ? (
            <div className={`flex items-center justify-center px-6 py-12 text-xs ${isDark?'text-slate-500':'text-slate-400'}`}>Δεν βρέθηκαν μαθητές.</div>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadCls} style={{ color:'color-mix(in srgb, var(--color-accent) 70%, white)' }}>
                  <th className="px-4 py-3 text-left">Μαθητής</th>
                  <th className="px-4 py-3 text-left">Πακέτο</th>
                  <th className="px-4 py-3 text-left">Διάστημα</th>
                  <th className="px-4 py-3 text-right">Τιμή</th>
                  <th className="px-4 py-3 text-right">Πληρώθηκε</th>
                  <th className="px-4 py-3 text-right">Υπόλοιπο</th>
                  <th className="px-4 py-3 text-left">Κατάσταση</th>
                  <th className="px-4 py-3 text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody className={isDark?'divide-y divide-slate-800/40':'divide-y divide-slate-100'}>
                {rows.map((r) => {
                  const hasSub=!!r.sub, paid=r.paid;
                  const pkgNameForLogic=r.sub?.package_name??'', isHourly=isHourlyPackageName(pkgNameForLogic);
                  const billedRaw=r.sub?Number((r.sub as any).charge_amount??r.sub.price??0):0;
                  const billed=!hasSub?0:isHourly?Math.abs(billedRaw):billedRaw;
                  const computedBalance=!hasSub?0:isHourly?Math.max(0,billed-paid):Number(r.balance??0);
                  const displayPrice=!hasSub?0:isHourly?Number(r.sub?.price??0):Number(r.sub?.price??billed);
                  const paidCls=!hasSub?(isDark?'text-slate-500':'text-slate-300'):paid>0?(isDark?'text-emerald-400':'text-emerald-600'):(isDark?'text-slate-400':'text-slate-400');
                  const balanceCls=!hasSub?(isDark?'text-slate-500':'text-slate-300'):computedBalance>0?(isDark?'text-amber-400':'text-amber-600'):(isDark?'text-emerald-400':'text-emerald-600');
                  const badge=!hasSub
                    ?{text:'Χωρίς πακέτο',cls:isDark?'border-slate-700/60 bg-slate-900/30 text-slate-400':'border-slate-200 bg-slate-100 text-slate-500'}
                    :paid<=0&&billed>0?{text:'Ανεξόφλητο',cls:isDark?'border-red-500/40 bg-red-950/30 text-red-300':'border-red-300 bg-red-50 text-red-600'}
                    :computedBalance>0?{text:'Υπόλοιπο',cls:isDark?'border-amber-500/40 bg-amber-950/30 text-amber-300':'border-amber-300 bg-amber-50 text-amber-600'}
                    :{text:'Εξοφλημένο',cls:isDark?'border-emerald-500/40 bg-emerald-950/30 text-emerald-300':'border-emerald-300 bg-emerald-50 text-emerald-700'};
                  const selectedPkgId=selectedPackage[r.student_id]??'';
                  const selectedPkg=selectedPkgId?packageById.get(selectedPkgId)??null:null;
                  const summary=periodSummary(r.student_id,selectedPkg?.name??r.sub?.package_name,r.sub);
                  return (
                    <tr key={r.student_id} className={isDark?'transition-colors hover:bg-white/[0.025]':'transition-colors hover:bg-slate-50/80'}>
                      <td className="px-4 py-3 align-top">
                        <span className={`font-medium ${isDark?'text-slate-100':'text-slate-700'}`}>{r.student_name}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select value={selectedPkgId} onChange={e => {
                          const nextId=e.target.value,prevId=selectedPackage[r.student_id]??'';
                          setSelectedPackage(prev=>({...prev,[r.student_id]:nextId}));
                          setCustomPriceInput(p=>({...p,[r.student_id]:''}));
                          setDiscountPctInput(p=>({...p,[r.student_id]:''}));
                          if (!nextId){setStartsOn(p=>({...p,[r.student_id]:''}));setEndsOn(p=>({...p,[r.student_id]:''}));setPeriodMode(p=>({...p,[r.student_id]:'month'}));const now=new Date();setSelectedYear(p=>({...p,[r.student_id]:String(now.getFullYear())}));setSelectedMonthNum(p=>({...p,[r.student_id]:pad2(now.getMonth()+1)}));return;}
                          openPackageModalIfNeeded(r.student_id,r.student_name,nextId,prevId);
                        }} className={pkgSelectCls}>
                          <option value="">— Επιλογή πακέτου —</option>
                          {packages.map(p=><option key={p.id} value={p.id}>{p.name} · {money(p.price)} {CURRENCY_SYMBOL}{p.is_active?'':' (ανενεργό)'}</option>)}
                        </select>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <input value={customPriceInput[r.student_id]??''} onChange={e=>setCustomPriceInput(p=>({...p,[r.student_id]:e.target.value.replace(',','.').replace(/[^0-9.]/g,'')}))} disabled={!selectedPkgId} inputMode="decimal" placeholder={selectedPkg?`Τιμή (${money(selectedPkg.price)} ${CURRENCY_SYMBOL})`:'Τιμή'} className={`w-28 ${inputCls} ${!selectedPkgId?'cursor-not-allowed opacity-50':''}`}/>
                          <input value={discountPctInput[r.student_id]??''} onChange={e=>setDiscountPctInput(p=>({...p,[r.student_id]:e.target.value.replace(',','.').replace(/[^0-9.]/g,'')}))} disabled={!selectedPkgId} inputMode="decimal" placeholder="Έκπτωση %" className={`w-20 ${inputCls} ${!selectedPkgId?'cursor-not-allowed opacity-50':''}`}/>
                          <span className={`text-[11px] ${isDark?'text-slate-500':'text-slate-400'}`}>Τελική: <span className={`font-semibold ${isDark?'text-slate-200':'text-slate-700'}`}>{selectedPkgId?`${money(getFinalPriceForStudent(r.student_id))} ${CURRENCY_SYMBOL}`:'—'}</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top"><span className={periodBadgeCls}>{summary}</span></td>
                      <td className={`px-4 py-3 align-top text-right text-[12px] tabular-nums ${isDark?'text-slate-200':'text-slate-700'}`}>{r.sub?`${money(displayPrice)} ${CURRENCY_SYMBOL}${isHourly?' / ώρα':''}`:'—'}</td>
                      <td className={`px-4 py-3 align-top text-right text-[12px] tabular-nums font-medium ${paidCls}`}>{r.sub?`${money(paid)} ${CURRENCY_SYMBOL}`:'—'}</td>
                      <td className={`px-4 py-3 align-top text-right text-[12px] tabular-nums font-medium ${balanceCls}`}>{r.sub?`${money(computedBalance)} ${CURRENCY_SYMBOL}`:'—'}</td>
                      <td className="px-4 py-3 align-top"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.cls}`}>{badge.text}</span></td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <input value={paymentInput[r.student_id]??''} onChange={e=>setPaymentInput(prev=>({...prev,[r.student_id]:e.target.value.replace(',','.').replace(/[^0-9.]/g,'')}))} disabled={!hasSub||payingStudentId===r.student_id} inputMode="decimal" placeholder="Πληρωμή" className={`w-24 ${inputCls} ${(!hasSub||payingStudentId===r.student_id)?'cursor-not-allowed opacity-50':''}`}/>
                          <button type="button" onClick={()=>addPayment(r.student_id)} disabled={!hasSub||payingStudentId===r.student_id}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${hasSub?'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20':`cursor-not-allowed ${isDark?'border-slate-800/60 bg-slate-900/20 text-slate-600':'border-slate-200 bg-slate-50 text-slate-300'}`}`}>
                            {payingStudentId===r.student_id?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<HandCoins className="h-3.5 w-3.5"/>}
                          </button>
                          <button type="button" onClick={()=>saveStudentPackage(r.student_id)} disabled={savingStudentId===r.student_id}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${savingStudentId===r.student_id?'cursor-not-allowed opacity-50':''}`}
                            style={{borderColor:'color-mix(in srgb, var(--color-accent) 40%, transparent)',background:'color-mix(in srgb, var(--color-accent) 12%, transparent)',color:'var(--color-accent)'}}>
                            {savingStudentId===r.student_id?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Save className="h-3.5 w-3.5"/>}
                          </button>
                          <button type="button" onClick={()=>{if(hasSub)setHistoryTarget({studentName:r.student_name,payments:r.payments});}} disabled={!hasSub}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${hasSub?(isDark?'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200':'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700'):`cursor-not-allowed ${isDark?'border-slate-800/60 bg-slate-900/20 text-slate-600':'border-slate-200 bg-slate-50 text-slate-300'}`}`}>
                            <History className="h-3.5 w-3.5"/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && totalStudents > 0 && (
          <div className={paginationBarCls}>
            <span className={`text-[11px] ${isDark?'text-slate-500':'text-slate-400'}`}>
              Εμφάνιση <span className={isDark?'text-slate-300':'text-slate-700'}>{showingFrom}–{showingTo}</span> από <span className={isDark?'text-slate-300':'text-slate-700'}>{totalStudents}</span>
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className={paginationBtnCls}><ChevronLeft className="h-3.5 w-3.5"/></button>
              <span className={`min-w-[56px] text-center text-[11px] ${isDark?'text-slate-400':'text-slate-500'}`}><span className={`font-semibold ${isDark?'text-slate-200':'text-slate-800'}`}>{page}</span> / {pageCount}</span>
              <button type="button" onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={page>=pageCount} className={paginationBtnCls}><ChevronRight className="h-3.5 w-3.5"/></button>
            </div>
          </div>
        )}
      </div>

      <YearlySubscriptionModal open={!!yearlyModal} studentName={yearlyModal?.studentName??''} packageName={yearlyModal?.pkgName??''} initialStart={startsOn[yearlyModal?.studentId??'']??''} initialEnd={endsOn[yearlyModal?.studentId??'']??''} onCancel={()=>{if(yearlyModal)setSelectedPackage(p=>({...p,[yearlyModal.studentId]:yearlyModal.prevPkgId}));setYearlyModal(null);}} onSave={(startDisplay,endDisplay)=>{if(!yearlyModal)return;const sid=yearlyModal.studentId;setStartsOn(p=>({...p,[sid]:startDisplay}));setEndsOn(p=>({...p,[sid]:endDisplay}));setPeriodMode(p=>({...p,[sid]:'range'}));setYearlyModal(null);}}/>
      <MonthlySubscriptionModal open={!!monthlyModal} studentName={monthlyModal?.studentName??''} packageName={monthlyModal?.pkgName??''} yearOptions={yearOptions} monthOptions={monthOptions} initialMode={periodMode[monthlyModal?.studentId??'']??'month'} initialMonth={selectedMonthNum[monthlyModal?.studentId??'']??pad2(new Date().getMonth()+1)} initialYear={selectedYear[monthlyModal?.studentId??'']??String(new Date().getFullYear())} initialStart={startsOn[monthlyModal?.studentId??'']??''} initialEnd={endsOn[monthlyModal?.studentId??'']??''} onCancel={()=>{if(monthlyModal)setSelectedPackage(p=>({...p,[monthlyModal.studentId]:monthlyModal.prevPkgId}));setMonthlyModal(null);}} onSave={({mode,month,year,startDisplay,endDisplay})=>{if(!monthlyModal)return;const sid=monthlyModal.studentId;setPeriodMode(p=>({...p,[sid]:mode}));if(mode==='month'){setSelectedMonthNum(p=>({...p,[sid]:month}));setSelectedYear(p=>({...p,[sid]:year}));const range=monthKeyToRange(`${year}-${month}`);if(range){setStartsOn(p=>({...p,[sid]:isoToDisplayDate(range.startISO)}));setEndsOn(p=>({...p,[sid]:isoToDisplayDate(range.endISO)}));}}else{setStartsOn(p=>({...p,[sid]:startDisplay}));setEndsOn(p=>({...p,[sid]:endDisplay}));}setMonthlyModal(null);}}/>

      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={modalCardCls} style={isDark?{background:'var(--color-sidebar)'}:{}}>
            <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))'}}/>
            <div className={`flex items-center justify-between px-6 pt-5 pb-4 ${!isDark?'border-b border-slate-100':''}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{background:'color-mix(in srgb, var(--color-accent) 15%, transparent)',border:'1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)'}}>
                  <History className="h-4 w-4" style={{color:'var(--color-accent)'}}/>
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isDark?'text-slate-50':'text-slate-800'}`}>Ιστορικό πληρωμών</div>
                  <div className={`mt-0.5 text-[11px] ${isDark?'text-slate-400':'text-slate-500'}`}>Μαθητής: <span className="font-semibold" style={{color:'var(--color-accent)'}}>{historyTarget.studentName}</span></div>
                </div>
              </div>
              <button type="button" onClick={()=>setHistoryTarget(null)} className={modalCloseBtnCls}><X className="h-3.5 w-3.5"/></button>
            </div>
            <div className="px-6 pb-2">
              {historyTarget.payments.length===0?(
                <div className={`rounded-xl border px-4 py-4 text-center text-xs ${isDark?'border-slate-700/50 bg-slate-900/30 text-slate-500':'border-slate-200 bg-slate-50 text-slate-400'}`}>Δεν υπάρχουν πληρωμές ακόμα.</div>
              ):(
                <div className={`overflow-hidden rounded-xl border ${isDark?'border-slate-700/50':'border-slate-200'}`}>
                  <table className="min-w-full border-collapse text-xs">
                    <thead>
                      <tr className={`${isDark?'border-b border-slate-700/60 bg-slate-900/40':'border-b border-slate-200 bg-slate-50'} text-[10px] font-semibold uppercase tracking-widest`} style={{color:'color-mix(in srgb, var(--color-accent) 70%, white)'}}>
                        <th className="px-4 py-2.5 text-left">Ημερομηνία</th>
                        <th className="px-4 py-2.5 text-right">Ποσό</th>
                      </tr>
                    </thead>
                    <tbody className={isDark?'divide-y divide-slate-800/40':'divide-y divide-slate-100'}>
                      {historyTarget.payments.map((p,i)=>(
                        <tr key={`${p.created_at??'na'}-${i}`} className={isDark?'transition-colors hover:bg-white/[0.02]':'transition-colors hover:bg-slate-50'}>
                          <td className={`px-4 py-2.5 ${isDark?'text-slate-300':'text-slate-600'}`}>{formatDateTime(p.created_at)}</td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums text-emerald-400">{money(p.amount)} {CURRENCY_SYMBOL}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark?'mt-4 border-t border-slate-800/70 bg-slate-900/20':'border-t border-slate-100 bg-slate-50'}`}>
              <span className={`text-xs ${isDark?'text-slate-400':'text-slate-500'}`}>Σύνολο: <span className="font-semibold text-emerald-400">{money(historyTotalPaid)} {CURRENCY_SYMBOL}</span></span>
              <button type="button" onClick={()=>setHistoryTarget(null)} className={cancelBtnCls}>Κλείσιμο</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}