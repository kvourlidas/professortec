import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../auth';
import { useTheme } from '../../../context/ThemeContext';
import type { PeriodMode, PackageRow, PaymentRow, StudentRow, StudentViewRow, SubscriptionRow } from './types';
import {
  isoToDisplayDate, isHourlyPackageName, isMonthlyPackageName,
  isYearlyPackageName, monthKeyToRange, pad2, parseMoney, parsePct, resolvePackageType, round2, todayLocalISODate,
} from './utils';

const PAGE_SIZE = 15;

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

// ── Shared helper: builds StudentViewRow[] from raw subscription rows ─────────
async function buildViewRows(
  subs: SubscriptionRow[],
  schoolId: string,
): Promise<StudentViewRow[]> {
  if (subs.length === 0) return [];

  // discount_reason from base table
  const subIds = subs.map(s => s.id);
  const { data: drData } = await supabase
    .from('student_subscriptions')
    .select('id,discount_reason')
    .in('id', subIds);
  const drMap = new Map((drData ?? []).map((r: any) => [r.id, r.discount_reason]));
  for (const sub of subs) (sub as any).discount_reason = drMap.get(sub.id) ?? null;

  // student names
  const studentIds = [...new Set(subs.map(s => s.student_id))];
  const { data: sd } = await supabase.from('students').select('id,full_name').in('id', studentIds);
  const nameById = new Map<string, string>();
  for (const s of (sd ?? []) as { id: string; full_name: string | null }[])
    nameById.set(s.id, s.full_name ?? '—');

  // payments
  const payMap = new Map<string, PaymentRow[]>();
  const { data: pd } = await supabase
    .from('student_subscription_payments')
    .select('subscription_id,amount,created_at,payment_method')
    .eq('school_id', schoolId)
    .in('subscription_id', subIds);
  for (const p of (pd ?? []) as PaymentRow[]) {
    const l = payMap.get(p.subscription_id) ?? [];
    l.push(p);
    payMap.set(p.subscription_id, l);
  }
  for (const [sid, l] of payMap.entries()) {
    l.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    payMap.set(sid, l);
  }

  // carried debts from renewed subs
  const carriedDebtMap = new Map<string, { amount: number; fromName: string }>();
  if (studentIds.length > 0) {
    const { data: renewedData } = await supabase
      .from('student_subscriptions_with_totals')
      .select('student_id,package_name,paid_amount,charge_amount,price')
      .eq('school_id', schoolId)
      .eq('status', 'renewed')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false });
    for (const rs of (renewedData ?? []) as any[]) {
      if (carriedDebtMap.has(rs.student_id)) continue;
      const hourly = isHourlyPackageName(rs.package_name ?? '');
      const billedRaw = Number(rs.charge_amount ?? rs.price ?? 0);
      const billed = hourly ? Math.abs(billedRaw) : billedRaw;
      const debt = Math.max(0, billed - Number(rs.paid_amount ?? 0));
      if (debt > 0) carriedDebtMap.set(rs.student_id, { amount: debt, fromName: rs.package_name ?? '—' });
    }
  }

  return subs.map(sub => ({
    student_id:   sub.student_id,
    student_name: nameById.get(sub.student_id) ?? '—',
    sub,
    paid:        Number((sub as any).paid_amount ?? 0),
    balance:     Number((sub as any).balance ?? 0),
    payments:    payMap.get(sub.id) ?? [],
    carriedDebt: carriedDebtMap.get(sub.student_id) ?? null,
  }));
}

export function useSubscriptionsPage() {
  const { profile } = useAuth();
  const { theme }   = useTheme();
  const isDark      = theme === 'dark';
  const schoolId    = profile?.school_id ?? null;

  // ── Active subscriptions ───────────────────────────────────────────────────
  const [loading,    setLoading]    = useState(true);
  const [rows,       setRows]       = useState<StudentViewRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page,       setPage]       = useState(1);

  // ── Expired subscriptions (status = 'expired' only) ───────────────────────
  const [expiredLoading,    setExpiredLoading]    = useState(true);
  const [expiredRows,       setExpiredRows]       = useState<StudentViewRow[]>([]);
  const [expiredTotalCount, setExpiredTotalCount] = useState(0);
  const [expiredPage,       setExpiredPage]       = useState(1);

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [error,       setError]       = useState<string | null>(null);
  const [info,        setInfo]        = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [packages,    setPackages]    = useState<PackageRow[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);

  // ── Payment modal ──────────────────────────────────────────────────────────
  const [paymentModal,  setPaymentModal]  = useState<{ row: StudentViewRow } | null>(null);
  const [paymentInput,  setPaymentInput]  = useState('');
  const [payingLoading, setPayingLoading] = useState(false);

  const pmPaid = useMemo(() => paymentModal?.row.paid ?? 0, [paymentModal]);
  const pmBilled = useMemo(() => {
    const sub = paymentModal?.row.sub;
    if (!sub) return 0;
    const raw = Number((sub as any).charge_amount ?? sub.price ?? 0);
    return isHourlyPackageName(sub.package_name) ? Math.abs(raw) : raw;
  }, [paymentModal]);
  const pmBalance      = useMemo(() => pmBilled - pmPaid, [pmBilled, pmPaid]);
  const pmHistoryTotal = useMemo(() => paymentModal?.row.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0) ?? 0, [paymentModal]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<StudentViewRow | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── Assign / Renew modal ───────────────────────────────────────────────────
  const [assignOpen,       setAssignOpen]       = useState(false);
  const [isRenew,          setIsRenew]          = useState(false);
  const [renewFromSubId,   setRenewFromSubId]   = useState<string | null>(null);
  const [saving,           setSaving]           = useState(false);
  const [assignError,      setAssignError]      = useState<string | null>(null);
  const [selStudent,       setSelStudent]       = useState<StudentRow | null>(null);
  const [selPackage,       setSelPackage]       = useState<PackageRow | null>(null);
  const [customPrice,      setCustomPrice]      = useState('');
  const [discountPct,      setDiscountPct]      = useState('');
  const [discountMode,     setDiscountMode]     = useState<'pct' | 'amount'>('pct');
  const [discountReason,   setDiscountReason]   = useState('');
  const [studentQ,         setStudentQ]         = useState('');
  const [packageQ,         setPackageQ]         = useState('');
  const [studentDrop,      setStudentDrop]      = useState(false);
  const [packageDrop,      setPackageDrop]      = useState(false);
  const [assignStartsOn,   setAssignStartsOn]   = useState('');
  const [assignEndsOn,     setAssignEndsOn]     = useState('');
  const [assignPeriodMode, setAssignPeriodMode] = useState<PeriodMode>('month');
  const [assignMonthNum,   setAssignMonthNum]   = useState(pad2(new Date().getMonth() + 1));
  const [assignYear,       setAssignYear]       = useState(String(new Date().getFullYear()));

  // ── Derived ────────────────────────────────────────────────────────────────
  useEffect(() => { setPage(1); setExpiredPage(1); }, [search]);

  const pageCount        = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),        [totalCount]);
  const expiredPageCount = useMemo(() => Math.max(1, Math.ceil(expiredTotalCount / PAGE_SIZE)), [expiredTotalCount]);

  useEffect(() => setPage(p        => Math.min(Math.max(1, p), pageCount)),        [pageCount]);
  useEffect(() => setExpiredPage(p => Math.min(Math.max(1, p), expiredPageCount)), [expiredPageCount]);

  const packageById = useMemo(() => {
    const m = new Map<string, PackageRow>();
    for (const p of packages) m.set(p.id, p);
    return m;
  }, [packages]);

  const monthOptions = useMemo(() => [
    { value: '01', label: 'Ιανουάριος' }, { value: '02', label: 'Φεβρουάριος' }, { value: '03', label: 'Μάρτιος' },
    { value: '04', label: 'Απρίλιος' },   { value: '05', label: 'Μάιος' },        { value: '06', label: 'Ιούνιος' },
    { value: '07', label: 'Ιούλιος' },    { value: '08', label: 'Αύγουστος' },    { value: '09', label: 'Σεπτέμβριος' },
    { value: '10', label: 'Οκτώβριος' },  { value: '11', label: 'Νοέμβριος' },    { value: '12', label: 'Δεκέμβριος' },
  ], []);
  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(y + i));
  }, []);
  const monthLabel = (m: string) => monthOptions.find(x => x.value === m)?.label ?? '';

  const assignFinalPrice = useMemo(() => {
    const base = customPrice.trim() ? parseMoney(customPrice) : Number(selPackage?.price ?? 0);
    const disc = parseMoney(discountPct);
    if (discountMode === 'pct') {
      return round2(Math.max(0, base * (1 - disc / 100)));
    } else {
      return round2(Math.max(0, base - disc));
    }
  }, [selPackage, customPrice, discountPct, discountMode]);

  const showingFrom        = totalCount === 0       ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo          = Math.min(page * PAGE_SIZE, totalCount);
  const expiredShowingFrom = expiredTotalCount === 0 ? 0 : (expiredPage - 1) * PAGE_SIZE + 1;
  const expiredShowingTo   = Math.min(expiredPage * PAGE_SIZE, expiredTotalCount);

  const filtStudents = allStudents.filter(s => (s.full_name ?? '').toLowerCase().includes(studentQ.toLowerCase()));
  const filtPackages = packages.filter(p => p.name.toLowerCase().includes(packageQ.toLowerCase()));

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadPackages = async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from('packages')
      .select('id,school_id,name,price,currency,is_active,sort_order,created_at,package_type,hours,starts_on,ends_on,is_custom,avatar_color')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { setError(error.message); return; }
    setPackages((data ?? []) as PackageRow[]);
  };

  const loadAllStudents = async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from('students')
      .select('id,school_id,full_name')
      .eq('school_id', schoolId)
      .order('full_name', { ascending: true });
    setAllStudents((data ?? []) as StudentRow[]);
  };

  // Returns matched student IDs for search, or null if no search active, or [] if no matches
  const resolveStudentIds = async (): Promise<string[] | null> => {
    const sq = search.trim();
    if (!sq || !schoolId) return null;
    const { data: ms } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .ilike('full_name', `%${sq}%`);
    return (ms ?? []).map((s: any) => s.id);
  };

  const loadActive = async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE, to = from + PAGE_SIZE - 1;
    const ids = await resolveStudentIds();
    if (ids !== null && ids.length === 0) {
      setRows([]); setTotalCount(0); setLoading(false); return;
    }
    let q = supabase
      .from('student_subscriptions_with_totals')
      .select('id,school_id,student_id,package_id,package_name,price,currency,status,starts_on,ends_on,created_at,used_hours,charge_amount,paid_amount,balance', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (ids !== null) q = q.in('student_id', ids);
    const { data, error, count } = await q.range(from, to);
    if (error) { setError(error.message); setRows([]); setTotalCount(0); setLoading(false); return; }
    const subs = (data ?? []) as SubscriptionRow[];
    setTotalCount(count ?? 0);
    setRows(await buildViewRows(subs, schoolId));
    setLoading(false);
  };

  const loadExpired = async () => {
    if (!schoolId) { setExpiredLoading(false); return; }
    setExpiredLoading(true);
    const from = (expiredPage - 1) * PAGE_SIZE, to = from + PAGE_SIZE - 1;
    const ids = await resolveStudentIds();
    if (ids !== null && ids.length === 0) {
      setExpiredRows([]); setExpiredTotalCount(0); setExpiredLoading(false); return;
    }
    let q = supabase
      .from('student_subscriptions_with_totals')
      .select('id,school_id,student_id,package_id,package_name,price,currency,status,starts_on,ends_on,created_at,used_hours,charge_amount,paid_amount,balance', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('status', 'expired')           // ← only expired, not renewed
      .order('created_at', { ascending: false });
    if (ids !== null) q = q.in('student_id', ids);
    const { data, error, count } = await q.range(from, to);
    if (error) { setError(error.message); setExpiredRows([]); setExpiredTotalCount(0); setExpiredLoading(false); return; }
    const subs = (data ?? []) as SubscriptionRow[];
    setExpiredTotalCount(count ?? 0);
    setExpiredRows(await buildViewRows(subs, schoolId));
    setExpiredLoading(false);
  };

  const load = () => Promise.all([loadActive(), loadExpired()]);

  useEffect(() => { loadPackages(); loadAllStudents(); }, [schoolId]);
  useEffect(() => { loadActive(); },  [schoolId, page, search]);
  useEffect(() => { loadExpired(); }, [schoolId, expiredPage, search]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openPaymentModal = (row: StudentViewRow) => { setPaymentInput(''); setPaymentModal({ row }); };

  const submitPayment = async (method: 'cash' | 'card') => {
    if (!schoolId || !paymentModal?.row.sub) return;
    const amount = parseMoney(paymentInput);
    if (amount <= 0) { setError('Δώσε ποσό μεγαλύτερο από 0.'); return; }
    setPayingLoading(true); setError(null);
    try {
      await callEdgeFunction('student-subscription-payment-create', {
        subscription_id: paymentModal.row.sub.id,
        amount: Number(amount.toFixed(2)),
        payment_method: method,
      });
      setPaymentInput(''); setInfo('Καταχωρήθηκε πληρωμή.');
      await load();
      setPaymentModal(null);
    } catch (err: any) { setError(err.message ?? 'Αποτυχία καταχώρησης πληρωμής.'); }
    setPayingLoading(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.sub) return;
    setDeleting(true); setError(null); setInfo(null);
    try {
      await callEdgeFunction('student-subscription-delete', { subscription_id: deleteTarget.sub.id });
      setDeleteTarget(null); setInfo('Διαγράφηκε η συνδρομή.'); await load();
    } catch (err: any) { setError(err.message ?? 'Αποτυχία διαγραφής συνδρομής.'); }
    setDeleting(false);
  };

  const resetModal = () => {
    setSelPackage(null); setCustomPrice(''); setDiscountPct(''); setDiscountMode('pct'); setDiscountReason(''); setPackageQ('');
    setAssignStartsOn(isoToDisplayDate(todayLocalISODate())); setAssignEndsOn('');
    setAssignPeriodMode('month'); setAssignMonthNum(pad2(new Date().getMonth() + 1)); setAssignYear(String(new Date().getFullYear()));
    setAssignError(null); setRenewFromSubId(null);
  };

  const openAssign = () => { setIsRenew(false); setSelStudent(null); setStudentQ(''); resetModal(); setAssignOpen(true); };

  const openRenew = (row: StudentViewRow) => {
    setIsRenew(true);
    setRenewFromSubId(row.sub?.id ?? null);
    setSelStudent({ id: row.student_id, school_id: schoolId ?? '', full_name: row.student_name });
    setStudentQ('');
    const pkg = row.sub?.package_id ? packageById.get(row.sub.package_id) ?? null : null;
    setSelPackage(pkg); setCustomPrice(''); setDiscountPct(''); setDiscountReason(''); setPackageQ('');
    setAssignStartsOn(isoToDisplayDate(todayLocalISODate())); setAssignEndsOn('');
    setAssignPeriodMode('month'); setAssignMonthNum(pad2(new Date().getMonth() + 1)); setAssignYear(String(new Date().getFullYear()));
    setAssignError(null); setAssignOpen(true);
  };

  const handlePackageSelect = (pkg: PackageRow) => {
    setSelPackage(pkg); setPackageDrop(false); setPackageQ(''); setCustomPrice(''); setDiscountPct('');
    const pt = resolvePackageType(pkg);
    if (pt === 'yearly') {
      setAssignStartsOn(pkg.starts_on ? isoToDisplayDate(pkg.starts_on) : '');
      setAssignEndsOn(pkg.ends_on ? isoToDisplayDate(pkg.ends_on) : '');
      setAssignPeriodMode('range');
    } else if (pt === 'monthly') {
      setAssignPeriodMode('month');
    } else {
      setAssignStartsOn(assignStartsOn || isoToDisplayDate(todayLocalISODate()));
      setAssignEndsOn(pkg.is_custom && pkg.ends_on ? isoToDisplayDate(pkg.ends_on) : '');
      setAssignPeriodMode('range');
    }
  };

  const submitAssign = async () => {
    if (!schoolId) return;
    if (!selStudent) { setAssignError('Επίλεξε μαθητή.'); return; }
    if (!selPackage) { setAssignError('Επίλεξε πακέτο.'); return; }
    const pkg = selPackage;
    const pt = resolvePackageType(pkg);
    const yearly = pt === 'yearly', monthly = pt === 'monthly', hourly = pt === 'hourly';
    let startsISO: string | null = null, endsISO: string | null = null;
    if (yearly) {
      startsISO = pkg.starts_on ?? null; endsISO = pkg.ends_on ?? null;
      if (!startsISO || !endsISO) { setAssignError('Το ετήσιο πακέτο δεν έχει ορισμένο διάστημα. Συμπλήρωσέ το πρώτα στη σελίδα Πακέτων.'); return; }
    } else if (monthly) {
      if (assignPeriodMode === 'range') {
        const s = displayToISODate(assignStartsOn), e = displayToISODate(assignEndsOn);
        if (!s || !e) { setAssignError('Βάλε έγκυρη έναρξη και λήξη.'); return; }
        startsISO = s; endsISO = e;
      } else {
        const range = monthKeyToRange(`${assignYear}-${assignMonthNum}`);
        if (!range) { setAssignError('Επίλεξε μήνα και έτος.'); return; }
        startsISO = range.startISO; endsISO = range.endISO;
      }
    } else if (hourly) {
      startsISO = displayToISODate(assignStartsOn) ?? todayLocalISODate();
      if (pkg.is_custom && assignEndsOn) {
        const e = displayToISODate(assignEndsOn);
        if (!e) { setAssignError('Βάλε έγκυρη ημερομηνία λήξης.'); setSaving(false); return; }
        endsISO = e;
      } else { endsISO = null; }
    }
    setSaving(true); setAssignError(null);
    try {
      await callEdgeFunction('student-subscription-create', {
        student_id: selStudent.id,
        package_id: pkg.id,
        package_name: pkg.name,
        price: assignFinalPrice,
        currency: pkg.currency ?? 'EUR',
        starts_on: startsISO,
        ends_on: endsISO,
        discount_reason: discountReason.trim() || null,
        renew_from_sub_id: isRenew && renewFromSubId ? renewFromSubId : null,
      });
      setAssignOpen(false); setInfo(isRenew ? 'Ανανεώθηκε η συνδρομή.' : 'Ανατέθηκε πακέτο.'); await load();
    } catch (err: any) { setAssignError(err.message ?? 'Αποτυχία αποθήκευσης.'); }
    setSaving(false);
  };

  const assignPeriodDisplay = (): string | null => {
    if (!selPackage) return null;
    const pt = resolvePackageType(selPackage);
    if (pt === 'yearly') {
      const s = selPackage.starts_on ? isoToDisplayDate(selPackage.starts_on) : '';
      const e = selPackage.ends_on   ? isoToDisplayDate(selPackage.ends_on)   : '';
      if (s && e) return `${s} – ${e}`; return null;
    }
    if (pt === 'monthly') {
      if (assignPeriodMode === 'range' && assignStartsOn && assignEndsOn) return `${assignStartsOn} – ${assignEndsOn}`;
      if (assignPeriodMode === 'month' && assignMonthNum && assignYear) return `${monthLabel(assignMonthNum)} ${assignYear}`;
    }
    if (pt === 'hourly') {
      if (selPackage.is_custom && assignStartsOn && assignEndsOn) return `${assignStartsOn} – ${assignEndsOn}`;
      if (assignStartsOn) return `Από ${assignStartsOn}`;
    }
    return null;
  };

  return {
    isDark, schoolId,
    error, setError, info, setInfo,
    search, setSearch,
    packages, allStudents, packageById,

    // active table
    loading, rows, totalCount, page, setPage, pageCount, showingFrom, showingTo,

    // expired table
    expiredLoading, expiredRows, expiredTotalCount,
    expiredPage, setExpiredPage, expiredPageCount,
    expiredShowingFrom, expiredShowingTo,

    // payment modal
    paymentModal, setPaymentModal, paymentInput, setPaymentInput,
    payingLoading, pmPaid, pmBilled, pmBalance, pmHistoryTotal,
    openPaymentModal, submitPayment,

    // delete
    deleteTarget, setDeleteTarget, deleting, confirmDelete,

    // assign / renew
    assignOpen, setAssignOpen, isRenew, saving, assignError, setAssignError,
    selStudent, setSelStudent, selPackage, setSelPackage,
    customPrice, setCustomPrice, discountPct, setDiscountPct,
    discountMode, setDiscountMode, discountReason, setDiscountReason,
    studentQ, setStudentQ, packageQ, setPackageQ,
    studentDrop, setStudentDrop, packageDrop, setPackageDrop,
    assignStartsOn, setAssignStartsOn, assignEndsOn, setAssignEndsOn,
    assignPeriodMode, setAssignPeriodMode,
    assignMonthNum, setAssignMonthNum, assignYear, setAssignYear,
    monthOptions, yearOptions, monthLabel, assignFinalPrice,
    filtStudents, filtPackages,
    openAssign, openRenew, handlePackageSelect, submitAssign, assignPeriodDisplay,
  };
}

function displayToISODate(display: string): string | null {
  if (!display) return null;
  const [d, m, y] = display.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m}-${d}`;
}