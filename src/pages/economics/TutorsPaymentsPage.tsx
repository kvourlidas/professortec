// src/pages/economics/TutorsPaymentsPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import {
  Loader2, Save, HandCoins, Plus, Trash2, History,
  Pencil, ChevronRight, ChevronLeft, Search, X, Euro,
} from 'lucide-react';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';

type TutorRow = { id: string; school_id: string; full_name: string | null };
type TutorPaymentProfileRow = { id: string; school_id: string; tutor_id: string; base_gross: number; base_net: number; currency: string; updated_at: string; updated_by: string | null };
type TutorBonusRow = { id: string; school_id: string; tutor_id: string; period_year: number; period_month: number; kind: 'percent'|'amount'; value: number; description: string|null; is_active: boolean; created_at: string; created_by: string|null };
type TutorPaymentRow = { id: string; school_id: string; tutor_id: string; period_year: number; period_month: number; base_gross: number; base_net: number; bonus_total: number; gross_total: number; net_total: number; status: 'draft'|'paid'|'canceled'; paid_on: string|null; notes: string|null; created_at: string; created_by: string|null };

function normalizeText(value: string|null|undefined): string { if (!value) return ''; return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function clampNumber(v: string): number { const n=Number(v); return (Number.isNaN(n)||!Number.isFinite(n))?0:Math.max(0,n); }
const CURRENCY_CODE='EUR', CURRENCY_SYMBOL='€', PAGE_SIZE=5;
function money(n: number) { return (Number(n)||0).toFixed(2); }
function isoToday() { return new Date().toISOString().slice(0,10); }
function isoDateFromTs(ts: string|null|undefined) { if (!ts) return '—'; return ts.length>=10?ts.slice(0,10):ts; }
function getCurrentPeriod() { const d=new Date(); return {year:d.getFullYear(),month:d.getMonth()+1}; }

// ── Edge function helper ──────────────────────────────────────────────────────
async function callEdgeFunction(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.error) throw new Error(res.error.message ?? 'Edge function error');
  return res.data;
}

export default function TutorsPaymentsPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  // ── Theme classes ──
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const cardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const cardHeaderCls = isDark
    ? 'flex items-center justify-between border-b border-slate-800/60 bg-slate-900/30 px-4 py-3'
    : 'flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3';

  const listSearchInputCls = isDark
    ? 'h-8 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 pl-8 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)]'
    : 'h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)]';

  const listItemCls = (active: boolean) => isDark
    ? `flex items-center justify-between gap-3 px-4 py-3 transition-colors ${active?'bg-white/[0.07]':'hover:bg-white/[0.03]'}`
    : `flex items-center justify-between gap-3 px-4 py-3 transition-colors ${active?'bg-slate-100':'hover:bg-slate-50'}`;

  const paginationBtnCls = isDark
    ? 'flex h-6 w-6 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/40 text-slate-400 transition hover:bg-slate-800/50 disabled:opacity-30'
    : 'flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:opacity-30';

  const historyHeaderCls = isDark
    ? 'grid grid-cols-12 border-b border-slate-800/60 bg-slate-900/20 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest'
    : 'grid grid-cols-12 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest';

  const historyRowCls = isDark
    ? 'grid grid-cols-12 items-center px-4 py-2.5 text-xs transition-colors hover:bg-white/[0.02]'
    : 'grid grid-cols-12 items-center px-4 py-2.5 text-xs transition-colors hover:bg-slate-50';

  const modalCardCls = isDark
    ? 'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl';

  const modalFooterCls = isDark
    ? 'mt-5 flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4'
    : 'flex justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-4';

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  const FieldLabel = ({children}: {children: React.ReactNode}) => (
    <div className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark?'text-slate-500':'text-slate-400'}`}>{children}</div>
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, TutorPaymentProfileRow>>({});
  const [search, setSearch] = useState('');
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const selectedTutor = useMemo(() => tutors.find(t=>t.id===selectedTutorId)??null, [tutors, selectedTutorId]);
  const selectedProfile = useMemo(() => selectedTutorId?profilesMap[selectedTutorId]??null:null, [profilesMap, selectedTutorId]);
  const [baseGross, setBaseGross] = useState<number>(0);
  const [baseNet, setBaseNet] = useState<number>(0);
  const [payments, setPayments] = useState<TutorPaymentRow[]>([]);
  const [bonusKind, setBonusKind] = useState<'percent'|'amount'>('percent');
  const [bonusValue, setBonusValue] = useState<number>(0);
  const [bonusDesc, setBonusDesc] = useState<string>('');
  const [paymentDesc, setPaymentDesc] = useState<string>('');
  const historyRef = useRef<HTMLDivElement|null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<TutorPaymentRow|null>(null);
  const [editNet, setEditNet] = useState<number>(0);
  const [editGross, setEditGross] = useState<number>(0);
  const [editBonusTotal, setEditBonusTotal] = useState<number>(0);
  const [editPaidOn, setEditPaidOn] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<TutorPaymentRow|null>(null);

  const filteredTutors = useMemo(() => { const q=normalizeText(search); return q?tutors.filter(t=>normalizeText(t.full_name).includes(q)):tutors; }, [tutors, search]);
  const totalPages = useMemo(() => Math.max(1,Math.ceil(payments.length/PAGE_SIZE)), [payments.length]);
  const pagePayments = useMemo(() => { const s=historyPage*PAGE_SIZE; return payments.slice(s,s+PAGE_SIZE); }, [payments, historyPage]);

  useEffect(() => { if (!selectedTutorId) return; const p=profilesMap[selectedTutorId]; setBaseGross(p?.base_gross??0); setBaseNet(p?.base_net??0); setPaymentDesc(''); setHistoryPage(0); }, [selectedTutorId, profilesMap]);
  useEffect(() => { setHistoryPage(p=>Math.min(p,Math.max(0,totalPages-1))); }, [totalPages]);

  async function loadTutorsAndProfiles() {
    if (!schoolId) return;
    setLoading(true); setError(null);
    try {
      const [tutorsRes, profilesRes] = await Promise.all([
        supabase.from('tutors').select('id,school_id,full_name').eq('school_id',schoolId).order('full_name',{ascending:true}),
        supabase.from('tutor_payment_profiles').select('*').eq('school_id',schoolId),
      ]);
      if (tutorsRes.error) throw tutorsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      const map: Record<string,TutorPaymentProfileRow> = {};
      (profilesRes.data??[]).forEach((p: TutorPaymentProfileRow) => { map[p.tutor_id]=p; });
      setTutors((tutorsRes.data??[]) as TutorRow[]);
      setProfilesMap(map);
      if (!selectedTutorId&&(tutorsRes.data?.length??0)>0) setSelectedTutorId(tutorsRes.data![0].id);
    } catch (e: any) { setError(e?.message??'Κάτι πήγε στραβά.'); }
    finally { setLoading(false); }
  }

  async function loadTutorDetails(tutorId: string) {
    if (!schoolId) return;
    setError(null);
    try {
      const {data,error}=await supabase.from('tutor_payments').select('*').eq('school_id',schoolId).eq('tutor_id',tutorId).order('created_at',{ascending:false}).limit(60);
      if (error) throw error;
      setPayments((data??[]) as TutorPaymentRow[]); setHistoryPage(0);
    } catch (e: any) { setError(e?.message??'Κάτι πήγε στραβά.'); }
  }

  useEffect(() => { loadTutorsAndProfiles(); }, [schoolId]);
  useEffect(() => { if (selectedTutorId) loadTutorDetails(selectedTutorId); }, [selectedTutorId]);

  // ── Save base pay via edge function ───────────────────────────────────────
  async function saveBasePay() {
    if (!schoolId||!user?.id||!selectedTutorId) return;
    setBusy(true); setError(null);
    try {
        const net=Number(baseNet)||0, gross=Number(baseGross)||0;
      const payload = {
        school_id: schoolId, tutor_id: selectedTutorId,
        base_gross: gross, base_net: net, currency: CURRENCY_CODE,
        updated_by: user.id, updated_at: new Date().toISOString(),
      };
      const {data,error}=await supabase.from('tutor_payment_profiles').upsert(payload,{onConflict:'school_id,tutor_id'}).select().single();
      if (error) throw error;
      setProfilesMap(prev=>({...prev,[selectedTutorId]:data as TutorPaymentProfileRow}));
    } catch (e: any) { setError(e?.message??'Αποτυχία αποθήκευσης.'); }
    finally { setBusy(false); }
  }

  // ── Record payment via edge function ──────────────────────────────────────
  async function recordPaymentToday() {
    if (!schoolId||!user?.id||!selectedTutorId) return;
    setBusy(true); setError(null);
    try {
      const bn=Number(baseNet)||0, bg=Number(baseGross)||0;
      if (bn<=0&&bg<=0) throw new Error('Βάλε πρώτα Καθαρά/Μικτά (δεν γίνεται πληρωμή 0).');
      const {year,month}=getCurrentPeriod();
      await callEdgeFunction('tutorspayments-create', {
        payment: {
          tutor_id: selectedTutorId, period_year: year, period_month: month,
          base_net: bn, base_gross: bg, net_total: bn, gross_total: bg, bonus_total: 0,
          paid_on: isoToday(), notes: paymentDesc.trim()||null, created_by: user.id,
        },
      });
      setPaymentDesc(''); await loadTutorDetails(selectedTutorId);
      requestAnimationFrame(()=>historyRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
    } catch (e: any) { setError(e?.message??'Αποτυχία καταγραφής πληρωμής.'); }
    finally { setBusy(false); }
  }

  // ── Add bonus via edge function ───────────────────────────────────────────
  async function addBonus() {
    if (!schoolId||!user?.id||!selectedTutorId) return;
    if ((Number(bonusValue)||0)<=0) return;
    setBusy(true); setError(null);
    try {
      const {year,month}=getCurrentPeriod();
      const defaultNet=Number(selectedProfile?.base_net??baseNet)||0;
      const defaultGross=Number(selectedProfile?.base_gross??baseGross)||0;
      let netBonus=0, grossBonus=0;
      if (bonusKind==='amount'){netBonus=Number(bonusValue)||0;grossBonus=Number(bonusValue)||0;}
      else{const pct=(Number(bonusValue)||0)/100;netBonus=defaultNet*pct;grossBonus=defaultGross*pct;}
      if (netBonus<=0&&grossBonus<=0) throw new Error('Το μπόνους βγήκε 0 (έλεγξε τη βασική αμοιβή προφίλ).');
      const notes = bonusDesc?.trim()||(bonusKind==='percent'?`Μπόνους ${money(bonusValue)}%`:`Μπόνους ${money(bonusValue)} ${CURRENCY_SYMBOL}`);
      await callEdgeFunction('tutorspayments-create', {
        bonus: {
          tutor_id: selectedTutorId, period_year: year, period_month: month,
          kind: bonusKind, value: Number(bonusValue)||0,
          description: bonusDesc?.trim()||null, created_by: user.id,
        },
        payment: {
          tutor_id: selectedTutorId, period_year: year, period_month: month,
          base_net: netBonus, base_gross: grossBonus,
          net_total: netBonus, gross_total: grossBonus, bonus_total: netBonus,
          paid_on: isoToday(), notes, created_by: user.id,
        },
      });
      setBonusValue(0); setBonusDesc(''); await loadTutorDetails(selectedTutorId);
      requestAnimationFrame(()=>historyRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
    } catch (e: any) { setError(e?.message??'Αποτυχία προσθήκης μπόνους.'); }
    finally { setBusy(false); }
  }

  function openEditPayment(p: TutorPaymentRow){setEditingPayment(p);setEditNet(Number(p.net_total)||0);setEditGross(Number(p.gross_total)||0);setEditBonusTotal(Number(p.bonus_total)||0);setEditPaidOn(p.paid_on??isoDateFromTs(p.created_at));setEditNotes(p.notes??'');setEditOpen(true);}
  function closeEditPayment(){if(busy)return;setEditOpen(false);setEditingPayment(null);}

  // ── Save edited payment via edge function ─────────────────────────────────
  async function saveEditedPayment(){
    if (!schoolId||!selectedTutorId||!editingPayment) return;
    setBusy(true); setError(null);
    try {
      const net=Number(editNet)||0, gross=Number(editGross)||0, bonus=Number(editBonusTotal)||0;
      if (net<=0&&gross<=0&&bonus<=0) throw new Error('Δεν γίνεται αποθήκευση με 0 ποσά.');
      await callEdgeFunction('tutorspayments-update', {
        payment_id: editingPayment.id,
        base_net: net, base_gross: gross,
        net_total: net, gross_total: gross, bonus_total: bonus,
        paid_on: editPaidOn||isoToday(),
        notes: editNotes.trim()||null,
      });
      setEditOpen(false); setEditingPayment(null); await loadTutorDetails(selectedTutorId);
    } catch (e: any) { setError(e?.message??'Αποτυχία αποθήκευσης αλλαγών.'); }
    finally { setBusy(false); }
  }

  function askDeletePayment(p: TutorPaymentRow){setDeletingPayment(p);setDeleteOpen(true);}
  function closeDeletePayment(){if(busy)return;setDeleteOpen(false);setDeletingPayment(null);}

  // ── Delete payment via edge function ──────────────────────────────────────
  async function confirmDeletePayment(){
    if (!selectedTutorId||!deletingPayment) return;
    setBusy(true); setError(null);
    try {
      await callEdgeFunction('tutorspayments-delete', { payment_id: deletingPayment.id });
      closeDeletePayment(); await loadTutorDetails(selectedTutorId);
    } catch (e: any) { setError(e?.message??'Αποτυχία διαγραφής.'); }
    finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-accent)' }}/>
        <span className="text-sm">Φόρτωση...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-1">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
          <HandCoins className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }}/>
        </div>
        <div>
          <h1 className={`text-base font-semibold tracking-tight ${isDark?'text-slate-50':'text-slate-800'}`}>Πληρωμές Καθηγητών</h1>
          <p className={`mt-0.5 text-xs ${isDark?'text-slate-400':'text-slate-500'}`}>Βασική αμοιβή, μπόνους και ιστορικό πληρωμών ανά καθηγητή.</p>
        </div>
      </div>

      {error && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${isDark?'border-red-500/40 bg-red-950/40 text-red-200':'border-red-300 bg-red-50 text-red-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400"/>{error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

        {/* ── Tutor list ── */}
        <div className="lg:col-span-4">
          <div className={cardCls}>
            <div className={cardHeaderCls}>
              <span className={`text-xs font-semibold ${isDark?'text-slate-200':'text-slate-700'}`}>Καθηγητές</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark?'border-slate-700/60 bg-slate-900/40 text-slate-400':'border-slate-200 bg-white text-slate-500'}`}>{tutors.length}</span>
            </div>
            <div className={`border-b px-3 py-3 ${isDark?'border-slate-800/60':'border-slate-200'}`}>
              <div className="relative">
                <Search className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none ${isDark?'text-slate-500':'text-slate-400'}`}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Αναζήτηση καθηγητή..." className={listSearchInputCls}/>
              </div>
            </div>
            <div className={`max-h-[480px] overflow-y-auto ${isDark?'divide-y divide-slate-800/40':'divide-y divide-slate-100'}`}>
              {filteredTutors.map(t => {
                const p=profilesMap[t.id], active=t.id===selectedTutorId;
                return (
                  <div key={t.id} className={listItemCls(active)}>
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold ${active?(isDark?'text-slate-50':'text-slate-900'):(isDark?'text-slate-200':'text-slate-700')}`}>{t.full_name??'—'}</div>
                      <div className={`mt-0.5 text-[10px] ${isDark?'text-slate-500':'text-slate-400'}`}>
                        {money(p?.base_net??0)}{CURRENCY_SYMBOL} / {money(p?.base_gross??0)}{CURRENCY_SYMBOL}
                      </div>
                    </div>
                    {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}/>}
                    <button type="button" onClick={()=>setSelectedTutorId(t.id)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${active?'border-[color:var(--color-accent)]/40 text-[color:var(--color-accent)]':(isDark?'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:text-slate-200':'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700')}`}
                      style={active?{background:'color-mix(in srgb, var(--color-accent) 12%, transparent)'}:{}}>
                      <ChevronRight className="h-3.5 w-3.5"/>
                    </button>
                  </div>
                );
              })}
              {filteredTutors.length === 0 && <div className={`px-4 py-6 text-center text-xs ${isDark?'text-slate-500':'text-slate-400'}`}>Δεν βρέθηκαν καθηγητές.</div>}
            </div>
          </div>
        </div>

        {/* ── Right detail ── */}
        <div className="lg:col-span-8">
          {!selectedTutor ? (
            <div className={`flex items-center justify-center rounded-2xl border p-12 text-xs ${isDark?'border-slate-700/50 bg-slate-950/40 text-slate-500 backdrop-blur-md':'border-slate-200 bg-white text-slate-400 shadow-md'}`}>
              Πάτα το βελάκι σε έναν καθηγητή από αριστερά.
            </div>
          ) : (
            <div className="space-y-4">

              {/* Base pay */}
              <div className={cardCls}>
                <div className={cardHeaderCls}>
                  <div>
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>{selectedTutor.full_name??'—'}</span>
                    <span className={`ml-2 text-[11px] ${isDark?'text-slate-500':'text-slate-400'}`}>· Βασική αμοιβή</span>
                  </div>
                  <button type="button" onClick={saveBasePay} disabled={busy}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark?'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:text-slate-200':'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'} disabled:opacity-50`}>
                    {busy?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Save className="h-3.5 w-3.5"/>}
                  </button>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div><FieldLabel>Καθαρά</FieldLabel><input value={baseNet} onChange={e=>setBaseNet(clampNumber(e.target.value))} className={inputCls} inputMode="decimal"/></div>
                    <div><FieldLabel>Μικτά</FieldLabel><input value={baseGross} onChange={e=>setBaseGross(clampNumber(e.target.value))} className={inputCls} inputMode="decimal"/></div>
                    <div><FieldLabel>Νόμισμα</FieldLabel>
                      <div className={`flex h-9 items-center rounded-lg border px-3 text-xs font-semibold ${isDark?'border-slate-700/60 bg-slate-900/40 text-slate-300':'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        <Euro className={`mr-1.5 h-3 w-3 ${isDark?'text-slate-500':'text-slate-400'}`}/>{CURRENCY_SYMBOL}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-end">
                    <div className="flex-1">
                      <FieldLabel>Περιγραφή πληρωμής</FieldLabel>
                      <input value={paymentDesc} onChange={e=>setPaymentDesc(e.target.value)} className={inputCls} placeholder="π.χ. Δεκέμβριος / extra ώρες / παρατηρήσεις"/>
                    </div>
                    <button type="button" onClick={recordPaymentToday} disabled={busy}
                      className="btn-primary shrink-0 gap-2 px-4 py-2 disabled:opacity-50">
                      {busy?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<HandCoins className="h-3.5 w-3.5"/>}
                      Καταγραφή Πληρωμής
                    </button>
                  </div>
                  <p className={`mt-3 text-[11px] ${isDark?'text-slate-600':'text-slate-400'}`}>
                    Τρέχον προφίλ: {selectedProfile?'υπάρχει':'δεν υπάρχει ακόμη (θα δημιουργηθεί με Αποθήκευση)'}
                  </p>
                </div>
              </div>

              {/* Bonus */}
              <div className={cardCls}>
                <div className={cardHeaderCls}>
                  <span className={`text-xs font-semibold ${isDark?'text-slate-200':'text-slate-700'}`}>Μπόνους</span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <FieldLabel>Τύπος</FieldLabel>
                      <select value={bonusKind} onChange={e=>setBonusKind(e.target.value as any)} className={inputCls}>
                        <option value="percent">Ποσοστό (%)</option>
                        <option value="amount">Ποσό</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <FieldLabel>Τιμή</FieldLabel>
                      <input value={bonusValue} onChange={e=>setBonusValue(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" placeholder={bonusKind==='percent'?'π.χ. 10':'π.χ. 50'}/>
                    </div>
                    <div className="md:col-span-4">
                      <FieldLabel>Περιγραφή</FieldLabel>
                      <input value={bonusDesc} onChange={e=>setBonusDesc(e.target.value)} className={inputCls} placeholder="π.χ. Extra ώρες / επίδοση"/>
                    </div>
                    <div className="md:col-span-2">
                      <FieldLabel>&nbsp;</FieldLabel>
                      <button type="button" onClick={addBonus} disabled={busy||(Number(bonusValue)||0)<=0}
                        className="btn-primary h-9 w-full gap-1.5 disabled:opacity-40">
                        {busy?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Plus className="h-3.5 w-3.5"/>}
                        Προσθήκη
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* History */}
              <div ref={historyRef} className={cardCls}>
                <div className={cardHeaderCls}>
                  <div className="flex items-center gap-2">
                    <History className={`h-3.5 w-3.5 ${isDark?'text-slate-400':'text-slate-500'}`}/>
                    <span className={`text-xs font-semibold ${isDark?'text-slate-200':'text-slate-700'}`}>Ιστορικό Πληρωμών</span>
                  </div>
                  {payments.length > PAGE_SIZE && (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={()=>setHistoryPage(p=>Math.max(0,p-1))} disabled={historyPage===0} className={paginationBtnCls}><ChevronLeft className="h-3 w-3"/></button>
                      <span className={`min-w-[48px] text-center text-[11px] ${isDark?'text-slate-400':'text-slate-500'}`}><span className={`font-semibold ${isDark?'text-slate-200':'text-slate-700'}`}>{historyPage+1}</span> / {totalPages}</span>
                      <button type="button" onClick={()=>setHistoryPage(p=>Math.min(totalPages-1,p+1))} disabled={historyPage>=totalPages-1} className={paginationBtnCls}><ChevronRight className="h-3 w-3"/></button>
                    </div>
                  )}
                </div>

                {payments.length === 0 ? (
                  <div className={`flex items-center justify-center py-10 text-xs ${isDark?'text-slate-500':'text-slate-400'}`}>Δεν υπάρχει ιστορικό.</div>
                ) : (
                  <>
                    <div className={historyHeaderCls} style={{ color:'color-mix(in srgb, var(--color-accent) 70%, white)' }}>
                      <div className="col-span-2">Ημερομηνία</div>
                      <div className="col-span-2">Καθαρά</div>
                      <div className="col-span-2">Μικτά</div>
                      <div className="col-span-2">Μπόνους</div>
                      <div className="col-span-2">Κατάσταση</div>
                      <div className="col-span-2 text-right">Ενέργειες</div>
                    </div>
                    <div className={isDark?'divide-y divide-slate-800/40':'divide-y divide-slate-100'}>
                      {pagePayments.map(p=>(
                        <div key={p.id} className={historyRowCls}>
                          <div className={`col-span-2 tabular-nums ${isDark?'text-slate-400':'text-slate-500'}`}>{isoDateFromTs(p.paid_on??p.created_at)}</div>
                          <div className={`col-span-2 font-medium tabular-nums ${isDark?'text-slate-200':'text-slate-700'}`}>{money(p.net_total)} {CURRENCY_SYMBOL}</div>
                          <div className={`col-span-2 tabular-nums ${isDark?'text-slate-300':'text-slate-600'}`}>{money(p.gross_total)} {CURRENCY_SYMBOL}</div>
                          <div className={`col-span-2 tabular-nums ${isDark?'text-slate-400':'text-slate-500'}`}>{money(p.bonus_total)} {CURRENCY_SYMBOL}</div>
                          <div className="col-span-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${isDark?'border-emerald-700/50 bg-emerald-950/30 text-emerald-400':'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>Πληρώθηκε</span>
                          </div>
                          <div className="col-span-2 flex justify-end gap-1.5">
                            <button type="button" onClick={()=>openEditPayment(p)} disabled={busy}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:opacity-50 ${isDark?'border-blue-700/50 bg-blue-950/30 text-blue-400 hover:bg-blue-950/50':'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                              <Pencil className="h-3 w-3"/>
                            </button>
                            <button type="button" onClick={()=>askDeletePayment(p)} disabled={busy}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:opacity-50 ${isDark?'border-rose-800/50 bg-rose-950/30 text-rose-400 hover:bg-rose-950/50':'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
                              <Trash2 className="h-3 w-3"/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmActionModal
        open={deleteOpen}
        title="Διαγραφή πληρωμής"
        message={<div className={isDark?'text-slate-200':'text-slate-700'}>Σίγουρα θέλετε να διαγράψετε αυτή την εγγραφή πληρωμής <span className={`font-semibold ${isDark?'text-slate-50':'text-slate-900'}`}>({deletingPayment?isoDateFromTs(deletingPayment.paid_on??deletingPayment.created_at):'—'})</span>; Η ενέργεια δεν μπορεί να ανακληθεί.</div>}
        confirmLabel="Διαγραφή" cancelLabel="Ακύρωση" confirmColor="red" busy={busy}
        onClose={closeDeletePayment} onConfirm={confirmDeletePayment}
      />

      {/* Edit payment modal */}
      {editOpen && editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={modalCardCls} style={isDark?{background:'var(--color-sidebar)'}:{}}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }}/>
            <div className={`flex items-center justify-between px-6 pt-5 pb-4 ${!isDark?'border-b border-slate-100':''}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background:'color-mix(in srgb, var(--color-accent) 15%, transparent)', border:'1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <Pencil className="h-4 w-4" style={{ color:'var(--color-accent)' }}/>
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${isDark?'text-slate-50':'text-slate-800'}`}>Επεξεργασία Πληρωμής</h3>
                  <p className={`mt-0.5 text-[11px] ${isDark?'text-slate-400':'text-slate-500'}`}>Ημερομηνία: {isoDateFromTs(editingPayment.paid_on??editingPayment.created_at)}</p>
                </div>
              </div>
              <button type="button" onClick={closeEditPayment} disabled={busy}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark?'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:text-slate-200':'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700'} disabled:opacity-50`}>
                <X className="h-3.5 w-3.5"/>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 px-6 pb-2 md:grid-cols-2">
              <div><FieldLabel>Καθαρά</FieldLabel><input value={editNet} onChange={e=>setEditNet(clampNumber(e.target.value))} className={inputCls} inputMode="decimal"/></div>
              <div><FieldLabel>Μικτά</FieldLabel><input value={editGross} onChange={e=>setEditGross(clampNumber(e.target.value))} className={inputCls} inputMode="decimal"/></div>
              <div><FieldLabel>Μπόνους</FieldLabel><input value={editBonusTotal} onChange={e=>setEditBonusTotal(clampNumber(e.target.value))} className={inputCls} inputMode="decimal"/></div>
              <div><FieldLabel>Ημερομηνία πληρωμής</FieldLabel><input type="date" value={editPaidOn} onChange={e=>setEditPaidOn(e.target.value)} className={inputCls}/></div>
              <div className="md:col-span-2"><FieldLabel>Σημειώσεις</FieldLabel><input value={editNotes} onChange={e=>setEditNotes(e.target.value)} className={inputCls} placeholder="π.χ. παρατηρήσεις πληρωμής"/></div>
            </div>
            <div className={modalFooterCls}>
              <button type="button" onClick={closeEditPayment} disabled={busy} className={cancelBtnCls}>Ακύρωση</button>
              <button type="button" onClick={saveEditedPayment} disabled={busy}
                className="btn-primary gap-1.5 px-4 py-1.5 font-semibold hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                {busy?<><Loader2 className="h-3.5 w-3.5 animate-spin"/>Αποθήκευση…</>:'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}