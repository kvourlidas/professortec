// src/pages/economics/TutorsPaymentsPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import {
  Loader2, Save, HandCoins, Plus, Trash2, History,
  Pencil, ChevronRight, ChevronLeft, Search, X, Euro,
  ChevronDown, User, Check,
} from 'lucide-react';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';

type TutorRow = { id: string; school_id: string; full_name: string | null };
type TutorPaymentProfileRow = { id: string; school_id: string; tutor_id: string; base_gross: number; base_net: number; currency: string; updated_at: string; updated_by: string | null };
type TutorBonusRow = { id: string; school_id: string; tutor_id: string; period_year: number; period_month: number; kind: 'percent'|'amount'; value: number; description: string|null; is_active: boolean; created_at: string; created_by: string|null };
type TutorPaymentRow = { id: string; school_id: string; tutor_id: string; period_year: number; period_month: number; base_gross: number; base_net: number; bonus_total: number; gross_total: number; net_total: number; status: 'draft'|'paid'|'canceled'; paid_on: string|null; notes: string|null; created_at: string; created_by: string|null };

function normalizeText(value: string|null|undefined): string { if (!value) return ''; return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function clampNumber(v: string): number { const n=Number(v); return (Number.isNaN(n)||!Number.isFinite(n))?0:Math.max(0,n); }
const CURRENCY_CODE='EUR', CURRENCY_SYMBOL='€', PAGE_SIZE=8;
function money(n: number) { return (Number(n)||0).toFixed(2); }
function isoToday() { return new Date().toISOString().slice(0,10); }
function isoDateFromTs(ts: string|null|undefined) { if (!ts) return '—'; return ts.length>=10?ts.slice(0,10):ts; }
function getCurrentPeriod() { const d=new Date(); return {year:d.getFullYear(),month:d.getMonth()+1}; }

async function callEdgeFunction(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const res = await supabase.functions.invoke(name, { body, headers: { Authorization: `Bearer ${token}` } });
  if (res.error) throw new Error(res.error.message ?? 'Edge function error');
  return res.data;
}

// ── Scrollbar + animation styles injected once ────────────────────────────────
const INJECTED_STYLE = `
  .tutor-dropdown-list::-webkit-scrollbar { width: 4px; }
  .tutor-dropdown-list::-webkit-scrollbar-track { background: transparent; }
  .tutor-dropdown-list::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-accent) 40%, transparent);
    border-radius: 99px;
  }
  .tutor-dropdown-list::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--color-accent) 70%, transparent);
  }
  .tutor-dropdown-list {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--color-accent) 40%, transparent) transparent;
  }

  @keyframes fadeSlideDown {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .dropdown-animate { animation: fadeSlideDown 0.18s cubic-bezier(0.16,1,0.3,1) forwards; }

  @keyframes historyRowIn {
    from { opacity: 0; transform: translateX(-3px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .history-row { animation: historyRowIn 0.18s ease forwards; }
`;

export default function TutorsPaymentsPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  // inject styles once
  useEffect(() => {
    const id = 'tutor-payments-injected-style';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = INJECTED_STYLE;
      document.head.appendChild(s);
    }
  }, []);

  // ── Theme helpers ────────────────────────────────────────────────────────
  const surface = isDark
    ? 'border border-slate-700/50 bg-slate-950/60 backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'border border-slate-200/80 bg-white shadow-sm';

  const cardCls = `overflow-hidden rounded-2xl shadow-xl ${surface}`;

  const cardHeaderCls = isDark
    ? 'flex items-center justify-between border-b border-slate-800/60 bg-gradient-to-r from-slate-900/60 to-slate-900/20 px-5 py-3.5'
    : 'flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5';

  const inputCls = isDark
    ? 'h-10 w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-3.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/20'
    : 'h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[color:var(--color-accent)] focus:bg-white focus:ring-2 focus:ring-[color:var(--color-accent)]/15';

  const paginationBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/50 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-25'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-25';

  const cancelBtnCls = isDark
    ? 'btn border border-slate-700/60 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/60 disabled:opacity-50'
    : 'btn border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50';

  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <div className={`mb-1.5 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{children}</div>
  );

  const SectionDivider = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }} />
      <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
      <div className="h-px flex-1" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }} />
    </div>
  );

  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, TutorPaymentProfileRow>>({});
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const selectedTutor = useMemo(() => tutors.find(t => t.id === selectedTutorId) ?? null, [tutors, selectedTutorId]);
  const selectedProfile = useMemo(() => selectedTutorId ? profilesMap[selectedTutorId] ?? null : null, [profilesMap, selectedTutorId]);

  // Dropdown
  const [dropOpen, setDropOpen] = useState(false);
  const [dropSearch, setDropSearch] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);
  const dropSearchRef = useRef<HTMLInputElement>(null);
  const filteredTutors = useMemo(() => {
    const q = normalizeText(dropSearch);
    return q ? tutors.filter(t => normalizeText(t.full_name).includes(q)) : tutors;
  }, [tutors, dropSearch]);

  // Pay form
  const [baseGross, setBaseGross] = useState(0);
  const [baseNet, setBaseNet] = useState(0);
  const [paymentDesc, setPaymentDesc] = useState('');

  // Bonus form
  const [bonusKind, setBonusKind] = useState<'percent' | 'amount'>('percent');
  const [bonusValue, setBonusValue] = useState(0);
  const [bonusDesc, setBonusDesc] = useState('');

  // History
  const [payments, setPayments] = useState<TutorPaymentRow[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(payments.length / PAGE_SIZE)), [payments.length]);
  const pagePayments = useMemo(() => { const s = historyPage * PAGE_SIZE; return payments.slice(s, s + PAGE_SIZE); }, [payments, historyPage]);
  const historyRef = useRef<HTMLDivElement | null>(null);

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<TutorPaymentRow | null>(null);
  const [editNet, setEditNet] = useState(0);
  const [editGross, setEditGross] = useState(0);
  const [editBonusTotal, setEditBonusTotal] = useState(0);
  const [editPaidOn, setEditPaidOn] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<TutorPaymentRow | null>(null);

  // ── Close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    if (!dropOpen) return;
    const h = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dropOpen]);

  useEffect(() => { if (dropOpen) setTimeout(() => dropSearchRef.current?.focus(), 60); }, [dropOpen]);

  // ── Sync form when tutor changes ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedTutorId) return;
    const p = profilesMap[selectedTutorId];
    setBaseGross(p?.base_gross ?? 0);
    setBaseNet(p?.base_net ?? 0);
    setPaymentDesc('');
    setHistoryPage(0);
  }, [selectedTutorId, profilesMap]);

  useEffect(() => { setHistoryPage(p => Math.min(p, Math.max(0, totalPages - 1))); }, [totalPages]);

  // ── Data loading ─────────────────────────────────────────────────────────
  async function loadTutorsAndProfiles() {
    if (!schoolId) return;
    setLoading(true); setError(null);
    try {
      const [tutorsRes, profilesRes] = await Promise.all([
        supabase.from('tutors').select('id,school_id,full_name').eq('school_id', schoolId).order('full_name', { ascending: true }),
        supabase.from('tutor_payment_profiles').select('*').eq('school_id', schoolId),
      ]);
      if (tutorsRes.error) throw tutorsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      const map: Record<string, TutorPaymentProfileRow> = {};
      (profilesRes.data ?? []).forEach((p: TutorPaymentProfileRow) => { map[p.tutor_id] = p; });
      setTutors((tutorsRes.data ?? []) as TutorRow[]);
      setProfilesMap(map);
      if (!selectedTutorId && (tutorsRes.data?.length ?? 0) > 0) setSelectedTutorId(tutorsRes.data![0].id);
    } catch (e: any) { setError(e?.message ?? 'Κάτι πήγε στραβά.'); }
    finally { setLoading(false); }
  }

  async function loadTutorDetails(tutorId: string) {
    if (!schoolId) return;
    setError(null);
    try {
      const { data, error } = await supabase.from('tutor_payments').select('*').eq('school_id', schoolId).eq('tutor_id', tutorId).order('created_at', { ascending: false }).limit(120);
      if (error) throw error;
      setPayments((data ?? []) as TutorPaymentRow[]); setHistoryPage(0);
    } catch (e: any) { setError(e?.message ?? 'Κάτι πήγε στραβά.'); }
  }

  useEffect(() => { loadTutorsAndProfiles(); }, [schoolId]);
  useEffect(() => { if (selectedTutorId) loadTutorDetails(selectedTutorId); }, [selectedTutorId]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function saveBasePay() {
    if (!schoolId || !user?.id || !selectedTutorId) return;
    setBusy(true); setError(null);
    try {
      const net = Number(baseNet) || 0, gross = Number(baseGross) || 0;
      const { data, error } = await supabase.from('tutor_payment_profiles').upsert(
        { school_id: schoolId, tutor_id: selectedTutorId, base_gross: gross, base_net: net, currency: CURRENCY_CODE, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: 'school_id,tutor_id' }
      ).select().single();
      if (error) throw error;
      setProfilesMap(prev => ({ ...prev, [selectedTutorId]: data as TutorPaymentProfileRow }));
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία αποθήκευσης.'); }
    finally { setBusy(false); }
  }

  async function recordPaymentToday() {
    if (!schoolId || !user?.id || !selectedTutorId) return;
    setBusy(true); setError(null);
    try {
      const bn = Number(baseNet) || 0, bg = Number(baseGross) || 0;
      if (bn <= 0 && bg <= 0) throw new Error('Βάλε πρώτα Καθαρά/Μικτά (δεν γίνεται πληρωμή 0).');
      const { year, month } = getCurrentPeriod();
      await callEdgeFunction('tutorspayments-create', {
        payment: { tutor_id: selectedTutorId, period_year: year, period_month: month, base_net: bn, base_gross: bg, net_total: bn, gross_total: bg, bonus_total: 0, paid_on: isoToday(), notes: paymentDesc.trim() || null, created_by: user.id },
      });
      setPaymentDesc(''); await loadTutorDetails(selectedTutorId);
      requestAnimationFrame(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία καταγραφής πληρωμής.'); }
    finally { setBusy(false); }
  }

  async function addBonus() {
    if (!schoolId || !user?.id || !selectedTutorId) return;
    if ((Number(bonusValue) || 0) <= 0) return;
    setBusy(true); setError(null);
    try {
      const { year, month } = getCurrentPeriod();
      const defaultNet = Number(selectedProfile?.base_net ?? baseNet) || 0;
      const defaultGross = Number(selectedProfile?.base_gross ?? baseGross) || 0;
      let netBonus = 0, grossBonus = 0;
      if (bonusKind === 'amount') { netBonus = Number(bonusValue) || 0; grossBonus = Number(bonusValue) || 0; }
      else { const pct = (Number(bonusValue) || 0) / 100; netBonus = defaultNet * pct; grossBonus = defaultGross * pct; }
      if (netBonus <= 0 && grossBonus <= 0) throw new Error('Το μπόνους βγήκε 0 (έλεγξε τη βασική αμοιβή προφίλ).');
      const notes = bonusDesc?.trim() || (bonusKind === 'percent' ? `Μπόνους ${money(bonusValue)}%` : `Μπόνους ${money(bonusValue)} ${CURRENCY_SYMBOL}`);
      await callEdgeFunction('tutorspayments-create', {
        bonus: { tutor_id: selectedTutorId, period_year: year, period_month: month, kind: bonusKind, value: Number(bonusValue) || 0, description: bonusDesc?.trim() || null, created_by: user.id },
        payment: { tutor_id: selectedTutorId, period_year: year, period_month: month, base_net: netBonus, base_gross: grossBonus, net_total: netBonus, gross_total: grossBonus, bonus_total: netBonus, paid_on: isoToday(), notes, created_by: user.id },
      });
      setBonusValue(0); setBonusDesc(''); await loadTutorDetails(selectedTutorId);
      requestAnimationFrame(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία προσθήκης μπόνους.'); }
    finally { setBusy(false); }
  }

  function openEditPayment(p: TutorPaymentRow) { setEditingPayment(p); setEditNet(Number(p.net_total) || 0); setEditGross(Number(p.gross_total) || 0); setEditBonusTotal(Number(p.bonus_total) || 0); setEditPaidOn(p.paid_on ?? isoDateFromTs(p.created_at)); setEditNotes(p.notes ?? ''); setEditOpen(true); }
  function closeEditPayment() { if (busy) return; setEditOpen(false); setEditingPayment(null); }

  async function saveEditedPayment() {
    if (!schoolId || !selectedTutorId || !editingPayment) return;
    setBusy(true); setError(null);
    try {
      const net = Number(editNet) || 0, gross = Number(editGross) || 0, bonus = Number(editBonusTotal) || 0;
      if (net <= 0 && gross <= 0 && bonus <= 0) throw new Error('Δεν γίνεται αποθήκευση με 0 ποσά.');
      await callEdgeFunction('tutorspayments-update', { payment_id: editingPayment.id, base_net: net, base_gross: gross, net_total: net, gross_total: gross, bonus_total: bonus, paid_on: editPaidOn || isoToday(), notes: editNotes.trim() || null });
      setEditOpen(false); setEditingPayment(null); await loadTutorDetails(selectedTutorId);
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία αποθήκευσης αλλαγών.'); }
    finally { setBusy(false); }
  }

  function askDeletePayment(p: TutorPaymentRow) { setDeletingPayment(p); setDeleteOpen(true); }
  function closeDeletePayment() { if (busy) return; setDeleteOpen(false); setDeletingPayment(null); }

  async function confirmDeletePayment() {
    if (!selectedTutorId || !deletingPayment) return;
    setBusy(true); setError(null);
    try {
      await callEdgeFunction('tutorspayments-delete', { payment_id: deletingPayment.id });
      closeDeletePayment(); await loadTutorDetails(selectedTutorId);
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία διαγραφής.'); }
    finally { setBusy(false); }
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalNet   = useMemo(() => payments.reduce((s, p) => s + (Number(p.net_total)   || 0), 0), [payments]);
  const totalGross = useMemo(() => payments.reduce((s, p) => s + (Number(p.gross_total) || 0), 0), [payments]);
  const totalBonus = useMemo(() => payments.reduce((s, p) => s + (Number(p.bonus_total) || 0), 0), [payments]);

  // ── Loading screen ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-accent)' }} />
        <span className="text-sm">Φόρτωση...</span>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 px-1 pb-10">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 55%, #000))' }}>
          <HandCoins className="h-5 w-5" style={{ color: 'var(--color-input-bg)' }} />
        </div>
        <div>
          <h1 className={`text-[15px] font-bold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Πληρωμές Καθηγητών</h1>
          <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Βασική αμοιβή, μπόνους και ιστορικό πληρωμών ανά καθηγητή.</p>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-600'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TUTOR SELECTOR DROPDOWN BAR
      ══════════════════════════════════════════════════════════════════ */}
      <div ref={dropRef} className="relative z-30">

        {/* Trigger */}
        <button
          type="button"
          onClick={() => { setDropOpen(v => !v); setDropSearch(''); }}
          className={`group flex w-full items-center gap-4 rounded-2xl px-5 py-3.5 text-left shadow-lg transition-all ${
            isDark
              ? 'border border-slate-700/60 bg-slate-900/70 backdrop-blur-md hover:border-slate-600/70'
              : 'border border-slate-200 bg-white hover:border-slate-300'
          } ${dropOpen
              ? isDark
                ? 'border-[color:var(--color-accent)]/50 ring-2 ring-[color:var(--color-accent)]/20'
                : 'border-[color:var(--color-accent)]/40 ring-2 ring-[color:var(--color-accent)]/12'
              : ''
          }`}
        >
          {/* Tutor avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm transition-all"
            style={{
              background: selectedTutor
                ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)'
                : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              border: selectedTutor
                ? '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)'
                : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              color: selectedTutor ? 'var(--color-accent)' : isDark ? '#64748b' : '#94a3b8',
            }}>
            {selectedTutor ? (selectedTutor.full_name ?? '?').charAt(0).toUpperCase() : <User className="h-4 w-4" />}
          </div>

          {/* Name / placeholder */}
          <div className="min-w-0 flex-1">
            {selectedTutor ? (
              <>
                <div className={`text-sm font-semibold leading-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{selectedTutor.full_name ?? '—'}</div>
                <div className={`mt-0.5 text-[11px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {selectedProfile
                    ? `${money(selectedProfile.base_net)}${CURRENCY_SYMBOL} καθαρά · ${money(selectedProfile.base_gross)}${CURRENCY_SYMBOL} μικτά`
                    : 'Δεν υπάρχει προφίλ ακόμη'}
                </div>
              </>
            ) : (
              <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Επιλέξτε καθηγητή…</span>
            )}
          </div>

          {/* Count badge + chevron */}
          <div className="flex shrink-0 items-center gap-2.5">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tabular-nums ${isDark ? 'border-slate-700/60 bg-slate-800/60 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
              {tutors.length}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${dropOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
        </button>

        {/* Dropdown panel */}
        {dropOpen && (
          <div className={`dropdown-animate absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl shadow-2xl ${
            isDark
              ? 'border border-slate-700/60 bg-slate-900/95 backdrop-blur-xl ring-1 ring-white/[0.05]'
              : 'border border-slate-200 bg-white ring-1 ring-slate-900/5'
          }`}>

            {/* Search */}
            <div className={`px-3 pt-3 pb-2.5 ${isDark ? 'border-b border-slate-800/60' : 'border-b border-slate-100'}`}>
              <div className="relative">
                <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  ref={dropSearchRef}
                  value={dropSearch}
                  onChange={e => setDropSearch(e.target.value)}
                  placeholder="Αναζήτηση καθηγητή…"
                  className={`h-9 w-full rounded-xl pl-9 pr-8 text-xs outline-none transition-all ${
                    isDark
                      ? 'border border-slate-700/50 bg-slate-800/70 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/60 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/50 focus:bg-white'
                  }`}
                />
                {dropSearch && (
                  <button type="button" onClick={() => setDropSearch('')}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="tutor-dropdown-list max-h-64 overflow-y-auto py-1.5">
              {filteredTutors.length === 0 && (
                <div className={`px-4 py-6 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν βρέθηκαν αποτελέσματα.</div>
              )}
              {filteredTutors.map(t => {
                const p = profilesMap[t.id];
                const active = t.id === selectedTutorId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelectedTutorId(t.id); setDropOpen(false); setDropSearch(''); }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      active
                        ? isDark ? 'bg-white/[0.07]' : 'bg-slate-50'
                        : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Avatar initial */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all"
                      style={active
                        ? { background: 'var(--color-accent)', color: 'var(--color-input-bg)' }
                        : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: isDark ? '#64748b' : '#94a3b8' }
                      }>
                      {(t.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-semibold leading-tight ${active ? (isDark ? 'text-slate-50' : 'text-slate-900') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                        {t.full_name ?? '—'}
                      </div>
                      <div className={`mt-0.5 text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {money(p?.base_net ?? 0)}{CURRENCY_SYMBOL} · {money(p?.base_gross ?? 0)}{CURRENCY_SYMBOL}
                      </div>
                    </div>

                    {active && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════════════════ */}
      {!selectedTutor ? (
        <div className={`flex flex-col items-center justify-center gap-3 rounded-2xl border p-16 text-center ${isDark ? 'border-slate-700/50 bg-slate-950/40 backdrop-blur-md' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <User className={`h-5 w-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Επιλέξτε καθηγητή από το μενού παραπάνω.</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ════════════════════════════════════════════════════════
              CARD 1 — BASE PAY + BONUS
          ════════════════════════════════════════════════════════ */}
          <div className={cardCls}>
            {/* Accent top strip */}
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 15%, transparent))' }} />

            {/* Header */}
            <div className={cardHeaderCls}>
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)' }}>
                  <HandCoins className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                </div>
                <span className={`text-sm font-bold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{selectedTutor.full_name ?? '—'}</span>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>· Αμοιβή & Μπόνους</span>
              </div>
              <button type="button" onClick={saveBasePay} disabled={busy}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                  isDark ? 'border-slate-700/60 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Αποθήκευση
              </button>
            </div>

            <div className="space-y-6 px-5 pt-5 pb-6">

              {/* ── Base pay ── */}
              <div>
                <SectionDivider label="Βασική Αμοιβή" />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <FieldLabel>Καθαρά</FieldLabel>
                    <div className="relative">
                      <input value={baseNet} onChange={e => setBaseNet(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" />
                      <span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{CURRENCY_SYMBOL}</span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Μικτά</FieldLabel>
                    <div className="relative">
                      <input value={baseGross} onChange={e => setBaseGross(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" />
                      <span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{CURRENCY_SYMBOL}</span>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Νόμισμα</FieldLabel>
                    <div className={`flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${isDark ? 'border-slate-700/50 bg-slate-900/50 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      <Euro className="h-3.5 w-3.5" />{CURRENCY_SYMBOL} EUR
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <FieldLabel>Περιγραφή πληρωμής</FieldLabel>
                    <input value={paymentDesc} onChange={e => setPaymentDesc(e.target.value)} className={inputCls} placeholder="π.χ. Δεκέμβριος / extra ώρες / παρατηρήσεις" />
                  </div>
                  <button type="button" onClick={recordPaymentToday} disabled={busy}
                    className="btn-primary flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
                    Καταγραφή Πληρωμής
                  </button>
                </div>
                {selectedProfile && (
                  <p className={`mt-2 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Τελευταία ενημέρωση: {isoDateFromTs(selectedProfile.updated_at)}
                  </p>
                )}
              </div>

              {/* ── Bonus ── */}
              <div>
                <SectionDivider label="Μπόνους" />
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <FieldLabel>Τύπος</FieldLabel>
                    <select value={bonusKind} onChange={e => setBonusKind(e.target.value as any)} className={inputCls}>
                      <option value="percent">Ποσοστό (%)</option>
                      <option value="amount">Ποσό (€)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <FieldLabel>Τιμή</FieldLabel>
                    <div className="relative">
                      <input value={bonusValue} onChange={e => setBonusValue(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" placeholder={bonusKind === 'percent' ? 'π.χ. 10' : 'π.χ. 50'} />
                      <span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {bonusKind === 'percent' ? '%' : CURRENCY_SYMBOL}
                      </span>
                    </div>
                  </div>
                  <div className="sm:col-span-4">
                    <FieldLabel>Περιγραφή</FieldLabel>
                    <input value={bonusDesc} onChange={e => setBonusDesc(e.target.value)} className={inputCls} placeholder="π.χ. Extra ώρες / επίδοση" />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>&nbsp;</FieldLabel>
                    <button type="button" onClick={addBonus} disabled={busy || (Number(bonusValue) || 0) <= 0}
                      className="btn-primary flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Προσθήκη
                    </button>
                  </div>
                </div>

                {/* Live bonus preview */}
                {(Number(bonusValue) || 0) > 0 && selectedProfile && (
                  <div className={`mt-3 flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs ${isDark ? 'border border-slate-700/50 bg-slate-900/40' : 'border border-slate-200 bg-slate-50'}`}>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Εκτιμώμενο μπόνους:</span>
                    <span className="font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                      {bonusKind === 'percent'
                        ? `${money(selectedProfile.base_net * (Number(bonusValue) / 100))} ${CURRENCY_SYMBOL} καθαρά · ${money(selectedProfile.base_gross * (Number(bonusValue) / 100))} ${CURRENCY_SYMBOL} μικτά`
                        : `${money(Number(bonusValue))} ${CURRENCY_SYMBOL}`
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════
              CARD 2 — HISTORY
          ════════════════════════════════════════════════════════ */}
          <div ref={historyRef} className={cardCls}>
            <div className={cardHeaderCls}>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <History className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                </div>
                <span className={`text-sm font-bold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Ιστορικό Πληρωμών</span>
                {payments.length > 0 && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${isDark ? 'border-slate-700/60 bg-slate-800/60 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                    {payments.length}
                  </span>
                )}
              </div>
              {payments.length > PAGE_SIZE && (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0} className={paginationBtnCls}><ChevronLeft className="h-3.5 w-3.5" /></button>
                  <span className={`min-w-[52px] text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{historyPage + 1}</span> / {totalPages}
                  </span>
                  <button type="button" onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))} disabled={historyPage >= totalPages - 1} className={paginationBtnCls}><ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>

            {payments.length === 0 ? (
              <div className={`flex flex-col items-center justify-center gap-3 py-14 text-center`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'}`}>
                  <History className={`h-4 w-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Δεν υπάρχει ιστορικό για αυτόν τον καθηγητή.</p>
              </div>
            ) : (
              <>
                {/* Summary totals */}
                <div className={`grid grid-cols-3 gap-px ${isDark ? 'border-b border-slate-800/60 bg-slate-800/20' : 'border-b border-slate-100 bg-slate-100/40'}`}>
                  {[
                    { label: 'Σύνολο Καθαρά', value: totalNet },
                    { label: 'Σύνολο Μικτά',  value: totalGross },
                    { label: 'Σύνολο Μπόνους', value: totalBonus },
                  ].map(({ label, value }) => (
                    <div key={label} className={`px-5 py-3 ${isDark ? 'bg-slate-950/50' : 'bg-white'}`}>
                      <div className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{label}</div>
                      <div className={`mt-0.5 text-sm font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                        {money(value)} <span className={`text-xs font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{CURRENCY_SYMBOL}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Table header */}
                <div className={`grid grid-cols-12 px-5 py-3 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'border-b border-slate-800/60 bg-slate-900/30' : 'border-b border-slate-100 bg-slate-50/80'}`}
                  style={{ color: 'color-mix(in srgb, var(--color-accent) 65%, white)' }}>
                  <div className="col-span-2">Ημερομηνία</div>
                  <div className="col-span-2">Καθαρά</div>
                  <div className="col-span-2">Μικτά</div>
                  <div className="col-span-2">Μπόνους</div>
                  <div className="col-span-2">Κατάσταση</div>
                  <div className="col-span-2 text-right">Ενέργειες</div>
                </div>

                {/* Rows */}
                <div>
                  {pagePayments.map((p, i) => (
                    <div key={p.id}
                      className={`history-row grid grid-cols-12 items-center px-5 py-3 text-xs transition-colors ${
                        i > 0 ? (isDark ? 'border-t border-slate-800/40' : 'border-t border-slate-100') : ''
                      } ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/60'}`}
                      style={{ animationDelay: `${i * 25}ms` }}>
                      <div className={`col-span-2 tabular-nums text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{isoDateFromTs(p.paid_on ?? p.created_at)}</div>
                      <div className={`col-span-2 font-semibold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{money(p.net_total)} {CURRENCY_SYMBOL}</div>
                      <div className={`col-span-2 tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{money(p.gross_total)} {CURRENCY_SYMBOL}</div>
                      <div className="col-span-2 tabular-nums">
                        {Number(p.bonus_total) > 0
                          ? <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>+{money(p.bonus_total)} {CURRENCY_SYMBOL}</span>
                          : <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>—</span>
                        }
                      </div>
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${isDark ? 'border-emerald-700/40 bg-emerald-950/40 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                          Πληρώθηκε
                        </span>
                      </div>
                      <div className="col-span-2 flex justify-end gap-1.5">
                        <button type="button" onClick={() => openEditPayment(p)} disabled={busy}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all hover:scale-105 active:scale-95 disabled:opacity-40 ${isDark ? 'border-blue-800/50 bg-blue-950/40 text-blue-400 hover:bg-blue-950/70' : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => askDeletePayment(p)} disabled={busy}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all hover:scale-105 active:scale-95 disabled:opacity-40 ${isDark ? 'border-rose-800/50 bg-rose-950/40 text-rose-400 hover:bg-rose-950/70' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom pagination */}
                {payments.length > PAGE_SIZE && (
                  <div className={`flex items-center justify-between px-5 py-3 ${isDark ? 'border-t border-slate-800/50' : 'border-t border-slate-100'}`}>
                    <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {historyPage * PAGE_SIZE + 1}–{Math.min((historyPage + 1) * PAGE_SIZE, payments.length)} από {payments.length} εγγραφές
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0} className={paginationBtnCls}><ChevronLeft className="h-3.5 w-3.5" /></button>
                      <span className={`min-w-[52px] text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{historyPage + 1}</span> / {totalPages}
                      </span>
                      <button type="button" onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))} disabled={historyPage >= totalPages - 1} className={paginationBtnCls}><ChevronRight className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DELETE MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <ConfirmActionModal
        open={deleteOpen}
        title="Διαγραφή πληρωμής"
        message={
          <div className={isDark ? 'text-slate-200' : 'text-slate-700'}>
            Σίγουρα θέλετε να διαγράψετε αυτή την εγγραφή{' '}
            <span className={`font-semibold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
              ({deletingPayment ? isoDateFromTs(deletingPayment.paid_on ?? deletingPayment.created_at) : '—'})
            </span>; Η ενέργεια δεν μπορεί να ανακληθεί.
          </div>
        }
        confirmLabel="Διαγραφή" cancelLabel="Ακύρωση" confirmColor="red" busy={busy}
        onClose={closeDeletePayment} onConfirm={confirmDeletePayment}
      />

      {/* ══════════════════════════════════════════════════════════════════
          EDIT MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {editOpen && editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl ${isDark ? 'border border-slate-700/60 bg-slate-900' : 'border border-slate-200 bg-white'}`}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 15%, transparent))' }} />

            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-slate-800/60' : 'border-b border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 28%, transparent)' }}>
                  <Pencil className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Επεξεργασία Πληρωμής</h3>
                  <p className={`mt-0.5 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{isoDateFromTs(editingPayment.paid_on ?? editingPayment.created_at)}</p>
                </div>
              </div>
              <button type="button" onClick={closeEditPayment} disabled={busy}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/60 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700'} disabled:opacity-50`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
              <div>
                <FieldLabel>Καθαρά</FieldLabel>
                <div className="relative"><input value={editNet} onChange={e => setEditNet(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" /><span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold ${isDark?'text-slate-500':'text-slate-400'}`}>{CURRENCY_SYMBOL}</span></div>
              </div>
              <div>
                <FieldLabel>Μικτά</FieldLabel>
                <div className="relative"><input value={editGross} onChange={e => setEditGross(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" /><span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold ${isDark?'text-slate-500':'text-slate-400'}`}>{CURRENCY_SYMBOL}</span></div>
              </div>
              <div>
                <FieldLabel>Μπόνους</FieldLabel>
                <div className="relative"><input value={editBonusTotal} onChange={e => setEditBonusTotal(clampNumber(e.target.value))} className={inputCls} inputMode="decimal" /><span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold ${isDark?'text-slate-500':'text-slate-400'}`}>{CURRENCY_SYMBOL}</span></div>
              </div>
              <div>
                <FieldLabel>Ημερομηνία πληρωμής</FieldLabel>
                <input type="date" value={editPaidOn} onChange={e => setEditPaidOn(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Σημειώσεις</FieldLabel>
                <input value={editNotes} onChange={e => setEditNotes(e.target.value)} className={inputCls} placeholder="π.χ. παρατηρήσεις πληρωμής" />
              </div>
            </div>

            <div className={`flex justify-end gap-2.5 px-6 py-4 ${isDark ? 'border-t border-slate-800/60 bg-slate-900/40' : 'border-t border-slate-100 bg-slate-50'}`}>
              <button type="button" onClick={closeEditPayment} disabled={busy} className={cancelBtnCls}>Ακύρωση</button>
              <button type="button" onClick={saveEditedPayment} disabled={busy}
                className="btn-primary flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Αποθήκευση…</> : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}