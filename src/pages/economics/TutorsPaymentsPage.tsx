// src/pages/economics/TutorsPaymentsPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import {
  Loader2,
  Save,
  HandCoins,
  Plus,
  Trash2,
  History,
  Pencil,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';

type TutorRow = {
  id: string;
  school_id: string;
  full_name: string | null;
};

type TutorPaymentProfileRow = {
  id: string;
  school_id: string;
  tutor_id: string;
  base_gross: number;
  base_net: number;
  currency: string;
  updated_at: string;
  updated_by: string | null;
};

type TutorBonusRow = {
  id: string;
  school_id: string;
  tutor_id: string;
  period_year: number;
  period_month: number;
  kind: 'percent' | 'amount';
  value: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
};

type TutorPaymentRow = {
  id: string;
  school_id: string;
  tutor_id: string;
  period_year: number;
  period_month: number;
  base_gross: number;
  base_net: number;
  bonus_total: number;
  gross_total: number;
  net_total: number;
  status: 'draft' | 'paid' | 'canceled';
  paid_on: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

// helper: normalize greek/latin text (remove accents, toLowerCase)
function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function clampNumber(v: string): number {
  const n = Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

const CURRENCY_CODE = 'EUR';
const CURRENCY_SYMBOL = '€';
const PAGE_SIZE = 5;

function money(n: number) {
  return (Number(n) || 0).toFixed(2);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoDateFromTs(ts: string | null | undefined) {
  if (!ts) return '—';
  return ts.length >= 10 ? ts.slice(0, 10) : ts;
}

function getCurrentPeriod() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function TutorsPaymentsPage() {
  const { user, profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, TutorPaymentProfileRow>>({});

  const [search, setSearch] = useState('');
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);

  const selectedTutor = useMemo(
    () => tutors.find((t) => t.id === selectedTutorId) ?? null,
    [tutors, selectedTutorId]
  );

  const selectedProfile = useMemo(
    () => (selectedTutorId ? profilesMap[selectedTutorId] ?? null : null),
    [profilesMap, selectedTutorId]
  );

  const [baseGross, setBaseGross] = useState<number>(0);
  const [baseNet, setBaseNet] = useState<number>(0);

  const [payments, setPayments] = useState<TutorPaymentRow[]>([]);

  // Add bonus form
  const [bonusKind, setBonusKind] = useState<'percent' | 'amount'>('percent');
  const [bonusValue, setBonusValue] = useState<number>(0);
  const [bonusDesc, setBonusDesc] = useState<string>('');

  // Payment description (notes)
  const [paymentDesc, setPaymentDesc] = useState<string>('');

  // scroll target
  const historyRef = useRef<HTMLDivElement | null>(null);

  // History pagination
  const [historyPage, setHistoryPage] = useState(0);

  // Edit payment modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<TutorPaymentRow | null>(null);
  const [editNet, setEditNet] = useState<number>(0);
  const [editGross, setEditGross] = useState<number>(0);
  const [editBonusTotal, setEditBonusTotal] = useState<number>(0);
  const [editPaidOn, setEditPaidOn] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  // Delete confirmation modal (styled like other pages)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<TutorPaymentRow | null>(null);

  const filteredTutors = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return tutors;
    return tutors.filter((t) => normalizeText(t.full_name).includes(q));
  }, [tutors, search]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  }, [payments.length]);

  const pagePayments = useMemo(() => {
    const start = historyPage * PAGE_SIZE;
    return payments.slice(start, start + PAGE_SIZE);
  }, [payments, historyPage]);

  // Keep base fields in sync when selecting tutor
  useEffect(() => {
    if (!selectedTutorId) return;
    const p = profilesMap[selectedTutorId];
    setBaseGross(p?.base_gross ?? 0);
    setBaseNet(p?.base_net ?? 0);
    setPaymentDesc('');
    setHistoryPage(0);
  }, [selectedTutorId, profilesMap]);

  useEffect(() => {
    // clamp historyPage if list shrinks
    setHistoryPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  async function loadTutorsAndProfiles() {
    if (!schoolId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: tutorsData, error: tutorsErr } = await supabase
        .from('tutors')
        .select('id, school_id, full_name')
        .eq('school_id', schoolId)
        .order('full_name', { ascending: true });

      if (tutorsErr) throw tutorsErr;

      const { data: profilesData, error: profilesErr } = await supabase
        .from('tutor_payment_profiles')
        .select('*')
        .eq('school_id', schoolId);

      if (profilesErr) throw profilesErr;

      const map: Record<string, TutorPaymentProfileRow> = {};
      (profilesData ?? []).forEach((p: TutorPaymentProfileRow) => {
        map[p.tutor_id] = p;
      });

      setTutors((tutorsData ?? []) as TutorRow[]);
      setProfilesMap(map);

      if (!selectedTutorId && (tutorsData?.length ?? 0) > 0) {
        setSelectedTutorId(tutorsData![0].id);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Κάτι πήγε στραβά.');
    } finally {
      setLoading(false);
    }
  }

  async function loadTutorDetails(tutorId: string) {
    if (!schoolId) return;

    setError(null);
    try {
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('tutor_payments')
        .select('*')
        .eq('school_id', schoolId)
        .eq('tutor_id', tutorId)
        .order('created_at', { ascending: false })
        .limit(60);

      if (paymentsErr) throw paymentsErr;

      setPayments((paymentsData ?? []) as TutorPaymentRow[]);
      setHistoryPage(0);
    } catch (e: any) {
      setError(e?.message ?? 'Κάτι πήγε στραβά.');
    }
  }

  useEffect(() => {
    loadTutorsAndProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    if (!selectedTutorId) return;
    loadTutorDetails(selectedTutorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTutorId]);

  async function saveBasePay() {
    if (!schoolId || !user?.id || !selectedTutorId) return;
    setBusy(true);
    setError(null);

    try {
      const payload = {
        school_id: schoolId,
        tutor_id: selectedTutorId,
        base_gross: Number(baseGross) || 0,
        base_net: Number(baseNet) || 0,
        currency: CURRENCY_CODE,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error: upsertErr } = await supabase
        .from('tutor_payment_profiles')
        .upsert(payload, { onConflict: 'school_id,tutor_id' })
        .select()
        .single();

      if (upsertErr) throw upsertErr;

      setProfilesMap((prev) => ({ ...prev, [selectedTutorId]: data as TutorPaymentProfileRow }));
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setBusy(false);
    }
  }

  async function insertPaymentRow(args: {
    netAmount: number;
    grossAmount: number;
    bonusAmount: number;
    notes: string | null;
  }) {
    if (!schoolId || !user?.id || !selectedTutorId) return;

    const net = Number(args.netAmount) || 0;
    const gross = Number(args.grossAmount) || 0;
    const bonus = Number(args.bonusAmount) || 0;

    if (net <= 0 && gross <= 0 && bonus <= 0) {
      throw new Error('Το ποσό πληρωμής είναι 0.');
    }

    const { year, month } = getCurrentPeriod();

    const payload = {
      school_id: schoolId,
      tutor_id: selectedTutorId,
      period_year: year,
      period_month: month,

      // keep these aligned with what we show in the table
      base_net: net,
      base_gross: gross,
      net_total: net,
      gross_total: gross,
      bonus_total: bonus,

      status: 'paid' as const,
      paid_on: isoToday(),
      notes: args.notes,

      created_by: user.id,
    };

    const { error: insErr } = await supabase.from('tutor_payments').insert(payload);
    if (insErr) throw insErr;
  }

  async function recordPaymentToday() {
    if (!schoolId || !user?.id || !selectedTutorId) return;

    setBusy(true);
    setError(null);

    try {
      const bn = Number(baseNet) || 0;
      const bg = Number(baseGross) || 0;

      if (bn <= 0 && bg <= 0) {
        throw new Error('Βάλε πρώτα Καθαρά/Μικτά (δεν γίνεται πληρωμή 0).');
      }

      await insertPaymentRow({
        netAmount: bn,
        grossAmount: bg,
        bonusAmount: 0,
        notes: paymentDesc.trim() ? paymentDesc.trim() : null,
      });

      setPaymentDesc('');
      await loadTutorDetails(selectedTutorId);

      requestAnimationFrame(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία καταγραφής πληρωμής.');
    } finally {
      setBusy(false);
    }
  }

  async function addBonus() {
    if (!schoolId || !user?.id || !selectedTutorId) return;
    if ((Number(bonusValue) || 0) <= 0) return;

    setBusy(true);
    setError(null);

    try {
      const { year, month } = getCurrentPeriod();

      // store bonus entry (for bookkeeping)
      const bonusPayload = {
        school_id: schoolId,
        tutor_id: selectedTutorId,
        period_year: year,
        period_month: month,
        kind: bonusKind,
        value: Number(bonusValue) || 0,
        description: bonusDesc?.trim() ? bonusDesc.trim() : null,
        is_active: true,
        created_by: user.id,
      };

      const { error: insBonusErr } = await supabase.from('tutor_payment_bonuses').insert(bonusPayload);
      if (insBonusErr) throw insBonusErr;

      // ✅ bonus payment is ALWAYS calculated from DEFAULT profile amounts
      const defaultNet = Number(selectedProfile?.base_net ?? baseNet) || 0;
      const defaultGross = Number(selectedProfile?.base_gross ?? baseGross) || 0;

      let netBonus = 0;
      let grossBonus = 0;

      if (bonusKind === 'amount') {
        netBonus = Number(bonusValue) || 0;
        grossBonus = Number(bonusValue) || 0;
      } else {
        const pct = (Number(bonusValue) || 0) / 100;
        netBonus = defaultNet * pct;
        grossBonus = defaultGross * pct;
      }

      if (netBonus <= 0 && grossBonus <= 0) {
        throw new Error('Το μπόνους βγήκε 0 (έλεγξε τη βασική αμοιβή προφίλ).');
      }

      await insertPaymentRow({
        netAmount: netBonus,
        grossAmount: grossBonus,
        // show bonus as the net bonus in the "Μπόνους" column
        bonusAmount: netBonus,
        notes: bonusDesc?.trim()
          ? bonusDesc.trim()
          : bonusKind === 'percent'
          ? `Μπόνους ${money(bonusValue)}%`
          : `Μπόνους ${money(bonusValue)} ${CURRENCY_SYMBOL}`,
      });

      setBonusValue(0);
      setBonusDesc('');

      await loadTutorDetails(selectedTutorId);

      requestAnimationFrame(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία προσθήκης μπόνους.');
    } finally {
      setBusy(false);
    }
  }

  function openEditPayment(p: TutorPaymentRow) {
    setEditingPayment(p);
    setEditNet(Number(p.net_total) || 0);
    setEditGross(Number(p.gross_total) || 0);
    setEditBonusTotal(Number(p.bonus_total) || 0);
    setEditPaidOn(p.paid_on ?? isoDateFromTs(p.created_at));
    setEditNotes(p.notes ?? '');
    setEditOpen(true);
  }

  function closeEditPayment() {
    if (busy) return;
    setEditOpen(false);
    setEditingPayment(null);
  }

  async function saveEditedPayment() {
    if (!schoolId || !selectedTutorId || !editingPayment) return;

    setBusy(true);
    setError(null);

    try {
      const net = Number(editNet) || 0;
      const gross = Number(editGross) || 0;
      const bonus = Number(editBonusTotal) || 0;

      if (net <= 0 && gross <= 0 && bonus <= 0) {
        throw new Error('Δεν γίνεται αποθήκευση με 0 ποσά.');
      }

      const patch: any = {
        // keep aligned with what we display
        base_net: net,
        base_gross: gross,
        net_total: net,
        gross_total: gross,
        bonus_total: bonus,

        status: 'paid',
        paid_on: editPaidOn || isoToday(),
        notes: editNotes.trim() ? editNotes.trim() : null,
      };

      const { error: updErr } = await supabase.from('tutor_payments').update(patch).eq('id', editingPayment.id);
      if (updErr) throw updErr;

      setEditOpen(false);
      setEditingPayment(null);

      await loadTutorDetails(selectedTutorId);
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία αποθήκευσης αλλαγών.');
    } finally {
      setBusy(false);
    }
  }

  function askDeletePayment(p: TutorPaymentRow) {
    setDeletingPayment(p);
    setDeleteOpen(true);
  }

  function closeDeletePayment() {
    if (busy) return;
    setDeleteOpen(false);
    setDeletingPayment(null);
  }

  async function confirmDeletePayment() {
    if (!selectedTutorId || !deletingPayment) return;

    setBusy(true);
    setError(null);

    try {
      const { error: delErr } = await supabase.from('tutor_payments').delete().eq('id', deletingPayment.id);
      if (delErr) throw delErr;

      closeDeletePayment();
      await loadTutorDetails(selectedTutorId);
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία διαγραφής.');
    } finally {
      setBusy(false);
    }
  }

  function openTutor(tutorId: string) {
    setSelectedTutorId(tutorId);
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center gap-2 text-slate-200">
        <Loader2 className="h-5 w-5 animate-spin" />
        Φόρτωση...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <HandCoins className="h-5 w-5 text-amber-300" />
        <h1 className="text-lg font-semibold text-slate-100">Πληρωμές Καθηγητών</h1>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Καθηγητές</div>
              <div className="text-[11px] text-slate-400">{tutors.length}</div>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση..."
              className="mt-2 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />

            <div className="mt-3 max-h-[520px] overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/40 custom-scrollbar">
              {filteredTutors.map((t) => {
                const p = profilesMap[t.id];
                const active = t.id === selectedTutorId;

                return (
                  <div
                    key={t.id}
                    className={[
                      'flex w-full items-start justify-between gap-3 border-b border-slate-900/60 px-3 py-2 text-left',
                      active ? 'bg-slate-900/70' : 'hover:bg-slate-900/40',
                    ].join(' ')}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100">{t.full_name ?? '—'}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        Βάση: {money(p?.base_net ?? 0)}
                        {CURRENCY_SYMBOL} / {money(p?.base_gross ?? 0)}
                        {CURRENCY_SYMBOL}
                      </div>
                    </div>

                    {/* Glass icon-only open button */}
                    <button
                      type="button"
                      onClick={() => openTutor(t.id)}
                      title="Άνοιγμα"
                      className={[
                        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur-sm transition',
                        'shadow-sm',
                        active
                          ? 'border-amber-300/35 bg-amber-400/10 text-amber-100'
                          : 'border-slate-700/70 bg-slate-950/20 text-slate-200 hover:border-amber-300/25 hover:bg-amber-400/5 hover:text-amber-100',
                      ].join(' ')}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                );
              })}

              {filteredTutors.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-400">Δεν βρέθηκαν καθηγητές.</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-8">
          {!selectedTutor ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 text-slate-300">
              Πάτα το βελάκι σε έναν καθηγητή από αριστερά.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Base pay */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
                      {selectedTutor.full_name ?? '—'}
                    </div>
                    <div className="text-xs text-slate-400">Βασική αμοιβή (καθαρά/μικτά)</div>
                  </div>

                  <button
                    type="button"
                    onClick={saveBasePay}
                    disabled={busy}
                    title="Αποθήκευση"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/60 text-slate-100 hover:bg-slate-800/60 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-300">Καθαρά</div>
                    <input
                      value={baseNet}
                      onChange={(e) => setBaseNet(clampNumber(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-300">Μικτά</div>
                    <input
                      value={baseGross}
                      onChange={(e) => setBaseGross(clampNumber(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-300">Νόμισμα</div>
                    <div className="mt-1 flex h-[42px] items-center rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 text-sm font-semibold text-slate-100">
                      {CURRENCY_SYMBOL}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold text-slate-300">Περιγραφή</div>
                    <input
                      value={paymentDesc}
                      onChange={(e) => setPaymentDesc(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                      placeholder="π.χ. Δεκέμβριος / extra ώρες / παρατηρήσεις"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={recordPaymentToday}
                    disabled={busy}
                    className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
                    Καταγραφή Πληρωμής
                  </button>
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  Τρέχον προφίλ: {selectedProfile ? 'υπάρχει' : 'δεν υπάρχει ακόμη (θα δημιουργηθεί με Αποθήκευση)'}
                </div>
              </div>

              {/* Bonuses */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <div className="text-sm font-semibold text-slate-100">Μπόνους</div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <div className="text-[11px] font-semibold text-slate-300">Τύπος</div>
                    <select
                      value={bonusKind}
                      onChange={(e) => setBonusKind(e.target.value as any)}
                      className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="percent">Ποσοστό (%)</option>
                      <option value="amount">Ποσό</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <div className="text-[11px] font-semibold text-slate-300">Τιμή</div>
                    <input
                      value={bonusValue}
                      onChange={(e) => setBonusValue(clampNumber(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                      inputMode="decimal"
                      placeholder={bonusKind === 'percent' ? 'π.χ. 10' : 'π.χ. 50'}
                    />
                  </div>

                  <div className="md:col-span-4">
                    <div className="text-[11px] font-semibold text-slate-300">Περιγραφή</div>
                    <input
                      value={bonusDesc}
                      onChange={(e) => setBonusDesc(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                      placeholder="π.χ. Extra ώρες / επίδοση"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="text-[11px] font-semibold text-slate-300">&nbsp;</div>
                    <button
                      type="button"
                      onClick={addBonus}
                      disabled={busy || (Number(bonusValue) || 0) <= 0}
                      className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Προσθήκη
                    </button>
                  </div>
                </div>
              </div>

              {/* History */}
              <div ref={historyRef} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-300" />
                    <div className="text-sm font-semibold text-slate-100">Ιστορικό Πληρωμών</div>
                  </div>

                  {/* Pagination controls */}
                  {payments.length > PAGE_SIZE ? (
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-slate-400">
                        Σελίδα <span className="font-semibold text-slate-200">{historyPage + 1}</span> /{' '}
                        <span className="font-semibold text-slate-200">{totalPages}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                        disabled={historyPage === 0}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/40 text-slate-200 hover:bg-slate-800/50 disabled:opacity-50"
                        title="Προηγούμενη"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={historyPage >= totalPages - 1}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/40 text-slate-200 hover:bg-slate-800/50 disabled:opacity-50"
                        title="Επόμενη"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-800/80">
                  <div className="grid grid-cols-12 bg-slate-900/60 px-3 py-2 text-[11px] font-semibold text-slate-300">
                    <div className="col-span-2">Ημερομηνία</div>
                    <div className="col-span-2">Καθαρά</div>
                    <div className="col-span-2">Μικτά</div>
                    <div className="col-span-2">Μπόνους</div>
                    <div className="col-span-2">&nbsp;</div>
                    <div className="col-span-2 text-right">Ενέργειες</div>
                  </div>

                  {payments.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-slate-400">Δεν υπάρχει ιστορικό.</div>
                  ) : (
                    pagePayments.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-12 items-center border-t border-slate-900/60 px-3 py-2 text-sm text-slate-100"
                      >
                        <div className="col-span-2 text-[12px] text-slate-200">
                          {isoDateFromTs(p.paid_on ?? p.created_at)}
                        </div>

                        <div className="col-span-2 text-[12px] text-slate-200">
                          {money(p.net_total)} {CURRENCY_SYMBOL}
                        </div>

                        <div className="col-span-2 text-[12px] text-slate-200">
                          {money(p.gross_total)} {CURRENCY_SYMBOL}
                        </div>

                        <div className="col-span-2 text-[12px] text-slate-300">
                          {money(p.bonus_total)} {CURRENCY_SYMBOL}
                        </div>

                        <div className="col-span-2 text-[12px] text-slate-400">Πληρώθηκε</div>

                        <div className="col-span-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditPayment(p)}
                            disabled={busy}
                            className="inline-flex items-center justify-center rounded-md border border-blue-500/40 bg-blue-950/20 p-1.5 text-blue-200 hover:bg-blue-950/35"
                            title="Επεξεργασία"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* ✅ red delete button */}
                          <button
                            type="button"
                            onClick={() => askDeletePayment(p)}
                            disabled={busy}
                            className="inline-flex items-center justify-center rounded-md border border-rose-900/60 bg-rose-950/30 p-1.5 text-rose-200 hover:bg-rose-950/50"
                            title="Διαγραφή"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Styled delete modal */}
      <ConfirmActionModal
        open={deleteOpen}
        title="Διαγραφή πληρωμής"
        message={
          <div className="text-slate-200">
            Σίγουρα θέλετε να διαγράψετε αυτή την εγγραφή πληρωμής
            <span className="font-semibold text-slate-50">
              {' '}
              ({deletingPayment ? isoDateFromTs(deletingPayment.paid_on ?? deletingPayment.created_at) : '—'})
            </span>
            ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
          </div>
        }
        confirmLabel="Διαγραφή"
        cancelLabel="Ακύρωση"
        confirmColor="red"
        busy={busy}
        onClose={closeDeletePayment}
        onConfirm={confirmDeletePayment}
      />

      {/* Edit payment modal */}
      {editOpen && editingPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-50">Επεξεργασία Πληρωμής</h3>
                <p className="mt-1 text-xs text-slate-300">
                  Ημερομηνία: {isoDateFromTs(editingPayment.paid_on ?? editingPayment.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditPayment}
                className="text-xs text-slate-300 hover:text-slate-100"
                disabled={busy}
              >
                Κλείσιμο
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold text-slate-300">Καθαρά</div>
                <input
                  value={editNet}
                  onChange={(e) => setEditNet(clampNumber(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  inputMode="decimal"
                />
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300">Μικτά</div>
                <input
                  value={editGross}
                  onChange={(e) => setEditGross(clampNumber(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  inputMode="decimal"
                />
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300">Μπόνους</div>
                <input
                  value={editBonusTotal}
                  onChange={(e) => setEditBonusTotal(clampNumber(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  inputMode="decimal"
                />
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300">Ημερομηνία πληρωμής</div>
                <input
                  type="date"
                  value={editPaidOn}
                  onChange={(e) => setEditPaidOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <div className="text-[11px] font-semibold text-slate-300">Σημειώσεις</div>
                <input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  placeholder="π.χ. παρατηρήσεις πληρωμής"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditPayment}
                disabled={busy}
                className="btn-ghost px-3 py-1 disabled:opacity-60"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              >
                Ακύρωση
              </button>

              <button
                type="button"
                onClick={saveEditedPayment}
                disabled={busy}
                className="rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Αποθήκευση…
                  </span>
                ) : (
                  'Αποθήκευση'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
