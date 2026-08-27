import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../auth';
import { useTheme } from '../../../context/ThemeContext';
import type { DiscountScope, PackageRow, PaymentRow, SchoolYearRow, StudentRow, StudentViewRow, SubscriptionRow } from './types';
import {
  isoToDisplayDate, monthKeyList, monthKeyToRange, pad2, parseMoney, resolvePackageType, round2, todayLocalISODate,
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

  // discount fields from base table (not exposed on the totals view)
  const subIds = subs.map(s => s.id);
  const { data: drData } = await supabase
    .from('student_subscriptions')
    .select('id,discount_reason,original_price,discount_mode,discount_value')
    .in('id', subIds);
  const drMap = new Map((drData ?? []).map((r: any) => [r.id, r]));
  for (const sub of subs) {
    const extra = drMap.get(sub.id);
    sub.discount_reason = extra?.discount_reason ?? null;
    sub.original_price = extra?.original_price ?? null;
    sub.discount_mode = extra?.discount_mode ?? null;
    sub.discount_value = extra?.discount_value ?? null;
  }

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
    .select('id,subscription_id,amount,created_at,payment_method,cancelled_at')
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
      const billed = Number(rs.charge_amount ?? rs.price ?? 0);
      const debt = Math.max(0, billed - Number(rs.paid_amount ?? 0));
      if (debt > 0) carriedDebtMap.set(rs.student_id, { amount: debt, fromName: rs.package_name ?? '—' });
    }
  }

  // monthly-plan ranges + fixed monthly price / discount (the plan's price never
  // grows — only the accumulated `student_subscriptions.price` does, via the
  // monthly charge-generation job)
  const planIds = [...new Set(subs.map(s => s.plan_id).filter((v): v is string => !!v))];
  const planRangeMap = new Map<string, { start_month: string; end_month: string }>();
  const planInfoMap = new Map<string, import('./types').PlanInfo>();
  if (planIds.length > 0) {
    const { data: planData } = await supabase
      .from('student_subscription_plans')
      .select('id,start_month,end_month,monthly_price,discount_mode,discount_value,discount_reason,discount_scope,discount_months')
      .in('id', planIds);
    for (const p of (planData ?? []) as any[]) {
      planRangeMap.set(p.id, { start_month: p.start_month, end_month: p.end_month });
      planInfoMap.set(p.id, {
        start_month: p.start_month,
        end_month: p.end_month,
        monthly_price: Number(p.monthly_price ?? 0),
        discount_mode: (p.discount_mode ?? 'none') as import('./types').DiscountMode,
        discount_value: Number(p.discount_value ?? 0),
        discount_reason: p.discount_reason ?? null,
        discount_scope: (p.discount_scope ?? 'range') as import('./types').DiscountScope,
        discount_months: Array.isArray(p.discount_months) ? p.discount_months as string[] : [],
      });
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
    planRange:   sub.plan_id ? (planRangeMap.get(sub.plan_id) ?? null) : null,
    plan:        sub.plan_id ? (planInfoMap.get(sub.plan_id) ?? null) : null,
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
  const [error,        setError]        = useState<string | null>(null);
  const [info,         setInfo]         = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [payFilter, setPayFilter] = useState<'all' | 'settled' | 'owes' | 'unpaid'>('all');
  const [packages,    setPackages]    = useState<PackageRow[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<StudentViewRow | null>(null);
  const [cancelling,   setCancelling]   = useState(false);

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
  const [assignMonthNum,   setAssignMonthNum]   = useState(pad2(new Date().getMonth() + 1));
  const [assignYear,       setAssignYear]       = useState(String(new Date().getFullYear()));
  const [assignEndMonthNum, setAssignEndMonthNum] = useState(pad2(new Date().getMonth() + 1));
  const [assignEndYear,     setAssignEndYear]     = useState(String(new Date().getFullYear()));
  const [discountScope,     setDiscountScope]     = useState<DiscountScope>('range');
  const [discountMonths,    setDiscountMonths]    = useState<string[]>([]);

  // ── Derived ────────────────────────────────────────────────────────────────
  useEffect(() => { setPage(1); setExpiredPage(1); }, [search, payFilter]);

  const pageCount        = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),        [totalCount]);
  const expiredPageCount = useMemo(() => Math.max(1, Math.ceil(expiredTotalCount / PAGE_SIZE)), [expiredTotalCount]);

  useEffect(() => setPage(p        => Math.min(Math.max(1, p), pageCount)),        [pageCount]);
  useEffect(() => setExpiredPage(p => Math.min(Math.max(1, p), expiredPageCount)), [expiredPageCount]);

  const packageById = useMemo(() => {
    const m = new Map<string, PackageRow>();
    for (const p of packages) m.set(p.id, p);
    return m;
  }, [packages]);

  const schoolYearById = useMemo(() => {
    const m = new Map<string, SchoolYearRow>();
    for (const y of schoolYears) m.set(y.id, y);
    return m;
  }, [schoolYears]);

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

  // ── Multi-month plan preview (monthly, non-custom packages) ────────────────
  const planMonthKeys = useMemo(() => {
    return monthKeyList(`${assignYear}-${assignMonthNum}`, `${assignEndYear}-${assignEndMonthNum}`);
  }, [assignYear, assignMonthNum, assignEndYear, assignEndMonthNum]);

  useEffect(() => {
    setDiscountMonths(prev => prev.filter(k => planMonthKeys.includes(k)));
  }, [planMonthKeys]);

  const toggleDiscountMonth = (key: string) => {
    setDiscountMonths(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const planTotalPreview = useMemo(() => {
    const base = customPrice.trim() ? parseMoney(customPrice) : Number(selPackage?.price ?? 0);
    const hasDiscount = parseMoney(discountPct) > 0;
    return round2(planMonthKeys.reduce((sum, key) => {
      const discounted = hasDiscount && (discountScope === 'range' || discountMonths.includes(key));
      return sum + (discounted ? assignFinalPrice : base);
    }, 0));
  }, [planMonthKeys, customPrice, selPackage, discountPct, discountScope, discountMonths, assignFinalPrice]);

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
      .select('id,school_id,name,price,currency,is_active,sort_order,created_at,package_type,starts_on,ends_on,school_year_id,is_custom,avatar_color')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { setError(error.message); return; }
    setPackages((data ?? []) as PackageRow[]);
  };

  const loadSchoolYears = async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from('school_years')
      .select('id,name')
      .eq('school_id', schoolId);
    if (error) { setError(error.message); return; }
    setSchoolYears((data ?? []) as SchoolYearRow[]);
  };

  const loadAllStudents = async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from('students')
      .select('id,school_id,full_name')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
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
      .is('deleted_at', null)
      .ilike('full_name', `%${sq}%`);
    return (ms ?? []).map((s: any) => s.id);
  };

  const loadActive = async () => {
    if (!schoolId) { setLoading(false); return; }
    // Monthly charge generation / expiry runs from the student's card page only —
    // this list shows the fixed plan price and shouldn't trigger new charges.
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE, to = from + PAGE_SIZE - 1;
    const ids = await resolveStudentIds();
    if (ids !== null && ids.length === 0) {
      setRows([]); setTotalCount(0); setLoading(false); return;
    }
    let q = supabase
      .from('student_subscriptions_with_totals')
      .select('id,school_id,student_id,package_id,package_name,price,currency,status,starts_on,ends_on,created_at,charge_amount,paid_amount,balance,plan_id', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (ids !== null) q = q.in('student_id', ids);
    if (payFilter === 'settled') q = (q as any).lte('balance', 0);
    if (payFilter === 'owes')    q = (q as any).gt('balance', 0);
    if (payFilter === 'unpaid')  q = (q as any).eq('paid_amount', 0).gt('balance', 0);
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
      .select('id,school_id,student_id,package_id,package_name,price,currency,status,starts_on,ends_on,created_at,charge_amount,paid_amount,balance,plan_id', { count: 'exact' })
      .eq('school_id', schoolId)
      .in('status', ['completed', 'expired', 'renewed', 'canceled']) // completed = expired by date/hours; renewed = manually renewed
      .order('created_at', { ascending: false });
    if (ids !== null) q = q.in('student_id', ids);
    if (payFilter === 'settled') q = (q as any).lte('balance', 0);
    if (payFilter === 'owes')    q = (q as any).gt('balance', 0);
    if (payFilter === 'unpaid')  q = (q as any).eq('paid_amount', 0).gt('balance', 0);
    const { data, error, count } = await q.range(from, to);
    if (error) { setError(error.message); setExpiredRows([]); setExpiredTotalCount(0); setExpiredLoading(false); return; }
    const subs = (data ?? []) as SubscriptionRow[];
    setExpiredTotalCount(count ?? 0);
    setExpiredRows(await buildViewRows(subs, schoolId));
    setExpiredLoading(false);
  };

  const load = async () => {
    await Promise.all([loadActive(), loadExpired()]);
  };

  useEffect(() => { loadPackages(); loadAllStudents(); loadSchoolYears(); }, [schoolId]);
  useEffect(() => { loadActive(); },  [schoolId, page, search, payFilter]);
  useEffect(() => { loadExpired(); }, [schoolId, expiredPage, search, payFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  // Mirrors StudentCardPage.cancelActiveSubscription — same status flip on the
  // same row, so a subscription cancelled from either page is cancelled on both.
  const confirmCancel = async () => {
    if (!cancelTarget?.sub) return;
    setCancelling(true); setError(null); setInfo(null);
    try {
      if (cancelTarget.sub.plan_id) {
        await callEdgeFunction('student-subscription-plan-cancel', { plan_id: cancelTarget.sub.plan_id });
      }
      const { error } = await supabase.from('student_subscriptions').update({ status: 'canceled' }).eq('id', cancelTarget.sub.id);
      if (error) throw error;
      setCancelTarget(null); setInfo('Η συνδρομή ακυρώθηκε.'); await load();
    } catch (err: any) { setError(err.message ?? 'Αποτυχία ακύρωσης συνδρομής.'); }
    setCancelling(false);
  };

  const resetModal = () => {
    setSelPackage(null); setCustomPrice(''); setDiscountPct(''); setDiscountMode('pct'); setDiscountReason(''); setPackageQ('');
    setAssignStartsOn(isoToDisplayDate(todayLocalISODate())); setAssignEndsOn('');
    setAssignMonthNum(pad2(new Date().getMonth() + 1)); setAssignYear(String(new Date().getFullYear()));
    setAssignEndMonthNum(pad2(new Date().getMonth() + 1)); setAssignEndYear(String(new Date().getFullYear()));
    setDiscountScope('range'); setDiscountMonths([]);
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
    setAssignMonthNum(pad2(new Date().getMonth() + 1)); setAssignYear(String(new Date().getFullYear()));
    setAssignEndMonthNum(pad2(new Date().getMonth() + 1)); setAssignEndYear(String(new Date().getFullYear()));
    setDiscountScope('range'); setDiscountMonths([]);
    setAssignError(null); setAssignOpen(true);
  };

  const handlePackageSelect = (pkg: PackageRow) => {
    setSelPackage(pkg); setPackageDrop(false); setPackageQ(''); setCustomPrice(''); setDiscountPct('');
    setDiscountScope('range'); setDiscountMonths([]);
    const pt = resolvePackageType(pkg);
    if (pt === 'yearly') {
      setAssignStartsOn(pkg.starts_on ? isoToDisplayDate(pkg.starts_on) : '');
      setAssignEndsOn(pkg.ends_on ? isoToDisplayDate(pkg.ends_on) : '');
    } else if (pt === 'monthly') {
      setAssignMonthNum(pad2(new Date().getMonth() + 1)); setAssignYear(String(new Date().getFullYear()));
      setAssignEndMonthNum(pad2(new Date().getMonth() + 1)); setAssignEndYear(String(new Date().getFullYear()));
    }
  };

  const submitAssign = async () => {
    if (!schoolId) return;
    if (!selStudent) { setAssignError('Επίλεξε μαθητή.'); return; }
    if (!selPackage) { setAssignError('Επίλεξε πακέτο.'); return; }
    const pkg = selPackage;
    const pt = resolvePackageType(pkg);
    const yearly = pt === 'yearly', monthly = pt === 'monthly';

    // Multi-month plan flow: monthly, non-custom packages. Auto-charges each
    // month as it starts — no manual renewal needed.
    if (monthly && !pkg.is_custom) {
      const startKey = `${assignYear}-${assignMonthNum}`;
      const endKey = `${assignEndYear}-${assignEndMonthNum}`;
      if (endKey < startKey) { setAssignError('Ο μήνας λήξης δεν μπορεί να είναι πριν τον μήνα έναρξης.'); return; }
      const disc = parseMoney(discountPct);
      const hasDiscount = disc > 0;
      if (hasDiscount && discountScope === 'months' && discountMonths.length === 0) {
        setAssignError('Επίλεξε τουλάχιστον έναν μήνα για την έκπτωση, ή άλλαξε σε «Όλο το διάστημα».');
        return;
      }
      if (!isRenew) {
        const { data: existingActivePlan } = await supabase
          .from('student_subscription_plans')
          .select('id')
          .eq('school_id', schoolId)
          .eq('student_id', selStudent.id)
          .eq('status', 'active')
          .limit(1);
        if (existingActivePlan && existingActivePlan.length > 0) {
          setAssignError('Ο μαθητής έχει ήδη ενεργό πρόγραμμα συνδρομής. Δεν επιτρέπεται προσθήκη δεύτερου ενεργού προγράμματος.');
          return;
        }
      }

      setSaving(true); setAssignError(null);
      try {
        await callEdgeFunction('student-subscription-plan-create', {
          student_id: selStudent.id,
          package_id: pkg.id,
          package_name: pkg.name,
          monthly_price: customPrice.trim() ? parseMoney(customPrice) : Number(pkg.price ?? 0),
          currency: pkg.currency ?? 'EUR',
          start_month: startKey,
          end_month: endKey,
          discount_mode: hasDiscount ? discountMode : 'none',
          discount_value: hasDiscount ? disc : 0,
          discount_scope: discountScope,
          discount_months: hasDiscount ? discountMonths : [],
          discount_reason: hasDiscount ? (discountReason.trim() || null) : null,
        });
        setAssignOpen(false); setInfo('Δημιουργήθηκε το πρόγραμμα συνδρομής.'); await load();
      } catch (err: any) { setAssignError(err.message ?? 'Αποτυχία αποθήκευσης.'); }
      setSaving(false);
      return;
    }

    // Legacy single-period flow: yearly packages, and any custom package.
    let startsISO: string | null = null, endsISO: string | null = null;
    if (yearly) {
      startsISO = pkg.starts_on ?? null; endsISO = pkg.ends_on ?? null;
      if (!startsISO || !endsISO) { setAssignError('Το ετήσιο πακέτο δεν έχει ορισμένο διάστημα. Συμπλήρωσέ το πρώτα στη σελίδα Πακέτων.'); return; }
    } else if (monthly) {
      // pkg.is_custom here — prefer the explicit date range from the picker,
      // fall back to the month/year selects.
      const s = displayToISODate(assignStartsOn), e = displayToISODate(assignEndsOn);
      if (s && e) {
        startsISO = s; endsISO = e;
      } else {
        const range = monthKeyToRange(`${assignYear}-${assignMonthNum}`);
        if (!range) { setAssignError('Επίλεξε μήνα και έτος.'); return; }
        startsISO = range.startISO; endsISO = range.endISO;
      }
    }
    if (!isRenew) {
      const { data: existingActive } = await supabase
        .from('student_subscriptions')
        .select('id')
        .eq('school_id', schoolId)
        .eq('student_id', selStudent.id)
        .eq('status', 'active')
        .limit(1);
      if (existingActive && existingActive.length > 0) {
        setAssignError('Ο μαθητής έχει ήδη ενεργή συνδρομή. Δεν επιτρέπεται προσθήκη δεύτερης ενεργής συνδρομής.');
        return;
      }
    }

    const legacyBase = customPrice.trim() ? parseMoney(customPrice) : Number(pkg.price ?? 0);
    const legacyDisc = parseMoney(discountPct);
    const hasLegacyDiscount = legacyDisc > 0;

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
        original_price: hasLegacyDiscount ? legacyBase : null,
        discount_mode: hasLegacyDiscount ? discountMode : null,
        discount_value: hasLegacyDiscount ? legacyDisc : null,
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
      if (selPackage.is_custom) {
        if (assignStartsOn && assignEndsOn) return `${assignStartsOn} – ${assignEndsOn}`;
        return null;
      }
      if (assignMonthNum && assignYear && assignEndMonthNum && assignEndYear) {
        const startLabel = `${monthLabel(assignMonthNum)} ${assignYear}`;
        const endLabel = `${monthLabel(assignEndMonthNum)} ${assignEndYear}`;
        return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
      }
    }
    return null;
  };

  return {
    isDark, schoolId,
    error, setError, info, setInfo,
    search, setSearch,
    payFilter, setPayFilter,
    packages, allStudents, packageById, schoolYearById,

    // active table
    loading, rows, totalCount, page, setPage, pageCount, showingFrom, showingTo,

    // expired table
    expiredLoading, expiredRows, expiredTotalCount,
    expiredPage, setExpiredPage, expiredPageCount,
    expiredShowingFrom, expiredShowingTo,

    // cancel
    cancelTarget, setCancelTarget, cancelling, confirmCancel,

    // assign / renew
    assignOpen, setAssignOpen, isRenew, saving, assignError, setAssignError,
    selStudent, setSelStudent, selPackage, setSelPackage,
    customPrice, setCustomPrice, discountPct, setDiscountPct,
    discountMode, setDiscountMode, discountReason, setDiscountReason,
    studentQ, setStudentQ, packageQ, setPackageQ,
    studentDrop, setStudentDrop, packageDrop, setPackageDrop,
    assignStartsOn, setAssignStartsOn, assignEndsOn, setAssignEndsOn,
    assignMonthNum, setAssignMonthNum, assignYear, setAssignYear,
    assignEndMonthNum, setAssignEndMonthNum, assignEndYear, setAssignEndYear,
    discountScope, setDiscountScope, discountMonths, toggleDiscountMonth,
    planMonthKeys, planTotalPreview,
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