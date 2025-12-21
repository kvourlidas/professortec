import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { Loader2, Save, HandCoins, History, X, Briefcase } from 'lucide-react';
import YearlySubscriptionModal from '../../components/economics/YearlySubscriptionModal';
import MonthlySubscriptionModal, {
  type PeriodMode as MonthlyPeriodMode,
} from '../../components/economics/MonthlySubscriptionModal';

type StudentRow = {
  id: string;
  school_id: string;
  full_name: string | null;
};

type PackageRow = {
  id: string;
  school_id: string;
  name: string;
  price: number; // may come as string from PostgREST, we always Number() it when needed
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string | null;
};

// NOTE: For hourly, price = hourly rate, but charge_amount = rate * used_hours
type SubscriptionRow = {
  id: string;
  school_id: string;
  student_id: string;
  package_id: string | null;
  package_name: string;
  price: number;
  currency: string;
  status: 'active' | 'completed' | 'canceled';
  starts_on: string | null;
  ends_on: string | null;
  created_at: string | null;

  // from student_subscriptions_with_totals view
  used_hours?: number | null;
  charge_amount?: number | null;
  paid_amount?: number | null;
  balance?: number | null;
};

type PaymentRow = {
  subscription_id: string;
  amount: number;
  created_at: string | null;
};

type StudentViewRow = {
  student_id: string;
  student_name: string;
  sub: SubscriptionRow | null;

  // display values (prefer view totals)
  paid: number;
  balance: number;

  payments: PaymentRow[];
};

const CURRENCY_SYMBOL = '€';

function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

function parseMoney(input: string) {
  const cleaned = (input ?? '')
    .trim()
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/* ------------------- DATE HELPERS ------------------- */

const pad2 = (n: number) => String(n).padStart(2, '0');

function todayLocalISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "dd/mm/yyyy" -> "yyyy-mm-dd" */
function displayToISODate(display: string): string | null {
  const v = (display ?? '').trim();
  if (!v) return null;

  const parts = v.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;

  const [dStr, mStr, yStr] = parts;
  const d = Number(dStr);
  const m = Number(mStr);
  const y = Number(yStr);
  if (!d || !m || !y) return null;

  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    return null;

  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** "yyyy-mm-dd" or timestamp -> "dd/mm/yyyy" */
function isoToDisplayDate(iso: string | null | undefined): string {
  const v = (iso ?? '').trim();
  if (!v) return '';

  if (v.includes('T')) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
  }

  const parts = v.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    if (y && m && d) return `${pad2(Number(d))}/${pad2(Number(m))}/${y}`;
  }

  return v;
}

/** given "yyyy-mm" -> { startISO, endISO } */
function monthKeyToRange(monthKey: string): { startISO: string; endISO: string } | null {
  const mk = (monthKey ?? '').trim();
  if (!mk) return null;
  const [yStr, mStr] = mk.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m || m < 1 || m > 12) return null;

  const startISO = `${y}-${pad2(m)}-01`;
  const end = new Date(y, m, 0); // last day
  const endISO = `${y}-${pad2(m)}-${pad2(end.getDate())}`;
  return { startISO, endISO };
}

function monthKeyFromISO(iso: string | null | undefined): string {
  const v = (iso ?? '').trim();
  if (!v) return '';
  const base = v.includes('T') ? v.split('T')[0] : v;
  const parts = base.split('-');
  if (parts.length < 2) return '';
  const [y, m] = parts;
  if (!y || !m) return '';
  return `${y}-${m}`;
}

/* ------------------- TEXT HELPERS ------------------- */

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isYearlyPackageName(name: string | null | undefined) {
  const n = normalizeText(name);
  return n.includes('ετησι') || n.includes('ετησιο') || n.includes('annual') || n.includes('year');
}

function isMonthlyPackageName(name: string | null | undefined) {
  const n = normalizeText(name);
  return n.includes('μην') || n.includes('monthly') || n.includes('month');
}

function isHourlyPackageName(name: string | null | undefined) {
  const n = normalizeText(name);
  return n.includes('ωρια') || n.includes('hour') || n.includes('hourly');
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StudentsSubscriptionsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const pageSize = 15;

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
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [payingStudentId, setPayingStudentId] = useState<string | null>(null);

  // UI state (dd/mm/yyyy)
  const [startsOn, setStartsOn] = useState<Record<string, string>>({});
  const [endsOn, setEndsOn] = useState<Record<string, string>>({});

  // monthly mode + month/year
  const [periodMode, setPeriodMode] = useState<Record<string, MonthlyPeriodMode>>({});
  const [selectedMonthNum, setSelectedMonthNum] = useState<Record<string, string>>({}); // "01".."12"
  const [selectedYear, setSelectedYear] = useState<Record<string, string>>({}); // "2025"

  // modals open state
  const [yearlyModal, setYearlyModal] = useState<{
    studentId: string;
    studentName: string;
    pkgId: string;
    pkgName: string;
    prevPkgId: string;
  } | null>(null);

  const [monthlyModal, setMonthlyModal] = useState<{
    studentId: string;
    studentName: string;
    pkgId: string;
    pkgName: string;
    prevPkgId: string;
  } | null>(null);

  // history modal
  const [historyTarget, setHistoryTarget] = useState<{
    studentName: string;
    payments: PaymentRow[];
  } | null>(null);

  const historyTotalPaid = useMemo(() => {
    if (!historyTarget) return 0;
    return historyTarget.payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  }, [historyTarget]);

  useEffect(() => setPage(1), [search]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalStudents / pageSize)),
    [totalStudents],
  );

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const packageById = useMemo(() => {
    const map = new Map<string, PackageRow>();
    for (const p of packages) map.set(p.id, p);
    return map;
  }, [packages]);

  const monthOptions = useMemo(
    () => [
      { value: '01', label: 'Ιανουάριος' },
      { value: '02', label: 'Φεβρουάριος' },
      { value: '03', label: 'Μάρτιος' },
      { value: '04', label: 'Απρίλιος' },
      { value: '05', label: 'Μάιος' },
      { value: '06', label: 'Ιούνιος' },
      { value: '07', label: 'Ιούλιος' },
      { value: '08', label: 'Αύγουστος' },
      { value: '09', label: 'Σεπτέμβριος' },
      { value: '10', label: 'Οκτώβριος' },
      { value: '11', label: 'Νοέμβριος' },
      { value: '12', label: 'Δεκέμβριος' },
    ],
    [],
  );

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    const years: string[] = [];
    for (let i = 0; i <= 5; i++) years.push(String(y + i));
    return years;
  }, []);

  const monthLabel = (m: string) => monthOptions.find((x) => x.value === m)?.label ?? '';

  const loadPackages = async () => {
    if (!schoolId) return;

    const { data, error } = await supabase
      .from('packages')
      .select('id, school_id, name, price, currency, is_active, sort_order, created_at')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
      setPackages([]);
      return;
    }

    setPackages((data ?? []) as PackageRow[]);
  };

  const load = async () => {
    if (!schoolId) {
      setLoading(false);
      setError('Δεν βρέθηκε school_id στο προφίλ.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let stQ = supabase
      .from('students')
      .select('id, school_id, full_name', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('full_name', { ascending: true })
      .range(from, to);

    const q = search.trim();
    if (q) stQ = stQ.ilike('full_name', `%${q}%`);

    const stRes = await stQ;

    if (stRes.error) {
      setError(stRes.error.message);
      setRows([]);
      setTotalStudents(0);
      setLoading(false);
      return;
    }

    const students = (stRes.data ?? []) as StudentRow[];
    setTotalStudents(stRes.count ?? 0);

    if (students.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const studentIds = students.map((s) => s.id);

    // ✅ IMPORTANT: load from the totals VIEW (handles hourly used_hours/charge_amount/balance)
    const subRes = await supabase
      .from('student_subscriptions_with_totals')
      .select(
        'id, school_id, student_id, package_id, package_name, price, currency, status, starts_on, ends_on, created_at, used_hours, charge_amount, paid_amount, balance',
      )
      .eq('school_id', schoolId)
      .in('student_id', studentIds)
      .order('created_at', { ascending: false });

    if (subRes.error) {
      setError(subRes.error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const subs = (subRes.data ?? []) as SubscriptionRow[];
    const latestSubByStudent = new Map<string, SubscriptionRow>();
    for (const s of subs) {
      if (!latestSubByStudent.has(s.student_id)) latestSubByStudent.set(s.student_id, s);
    }

    const subIds = Array.from(latestSubByStudent.values()).map((s) => s.id);

    // payments for history modal (still needed)
    const paymentsBySubId = new Map<string, PaymentRow[]>();

    if (subIds.length > 0) {
      const payRes = await supabase
        .from('student_subscription_payments')
        .select('subscription_id, amount, created_at')
        .eq('school_id', schoolId)
        .in('subscription_id', subIds);

      if (payRes.error) {
        setError(payRes.error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const pays = (payRes.data ?? []) as PaymentRow[];
      for (const p of pays) {
        const list = paymentsBySubId.get(p.subscription_id) ?? [];
        list.push(p);
        paymentsBySubId.set(p.subscription_id, list);
      }

      for (const [sid, list] of paymentsBySubId.entries()) {
        list.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
        paymentsBySubId.set(sid, list);
      }
    }

    const view: StudentViewRow[] = students.map((st) => {
      const sub = latestSubByStudent.get(st.id) ?? null;

      const paid = sub ? Number((sub as any).paid_amount ?? 0) : 0;
      const balance = sub ? Number((sub as any).balance ?? 0) : 0;

      const payments = sub ? paymentsBySubId.get(sub.id) ?? [] : [];

      return {
        student_id: st.id,
        student_name: st.full_name ?? '—',
        sub,
        paid,
        balance,
        payments,
      };
    });

    setRows(view);

    setSelectedPackage((prev) => {
      const next = { ...prev };
      for (const r of view) {
        if (!(r.student_id in next)) next[r.student_id] = r.sub?.package_id ?? '';
        if (!prev[r.student_id]) next[r.student_id] = r.sub?.package_id ?? '';
      }
      return next;
    });

    setPaymentInput((prev) => {
      const next = { ...prev };
      for (const r of view) if (!(r.student_id in next)) next[r.student_id] = '';
      return next;
    });

    setStartsOn((prev) => {
      const next = { ...prev };
      for (const r of view) {
        if (!(r.student_id in next)) next[r.student_id] = isoToDisplayDate(r.sub?.starts_on);
      }
      return next;
    });

    setEndsOn((prev) => {
      const next = { ...prev };
      for (const r of view) {
        if (!(r.student_id in next)) next[r.student_id] = isoToDisplayDate(r.sub?.ends_on);
      }
      return next;
    });

    // infer monthly year/month from starts_on
    const now = new Date();
    const defY = String(now.getFullYear());
    const defM = pad2(now.getMonth() + 1);

    setPeriodMode((prev) => {
      const next = { ...prev };
      for (const r of view) {
        if (!(r.student_id in next)) {
          next[r.student_id] = isMonthlyPackageName(r.sub?.package_name ?? '') ? 'month' : 'range';
        }
      }
      return next;
    });

    setSelectedYear((prev) => {
      const next = { ...prev };
      for (const r of view) {
        if (r.student_id in next) continue;
        const mk = monthKeyFromISO(r.sub?.starts_on);
        const y = mk ? mk.split('-')[0] : defY;
        next[r.student_id] = yearOptions.includes(y) ? y : defY;
      }
      return next;
    });

    setSelectedMonthNum((prev) => {
      const next = { ...prev };
      for (const r of view) {
        if (r.student_id in next) continue;
        const mk = monthKeyFromISO(r.sub?.starts_on);
        const m = mk ? mk.split('-')[1] : defM;
        next[r.student_id] = m || defM;
      }
      return next;
    });

    setLoading(false);
  };

  useEffect(() => {
    loadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, page, search]);

  const openPackageModalIfNeeded = (
    studentId: string,
    studentName: string,
    nextPkgId: string,
    prevPkgId: string,
  ) => {
    const pkg = nextPkgId ? packageById.get(nextPkgId) : null;
    if (!pkg) return;

    if (isYearlyPackageName(pkg.name)) {
      setYearlyModal({
        studentId,
        studentName,
        pkgId: nextPkgId,
        pkgName: pkg.name,
        prevPkgId,
      });
      return;
    }

    if (isMonthlyPackageName(pkg.name)) {
      setMonthlyModal({
        studentId,
        studentName,
        pkgId: nextPkgId,
        pkgName: pkg.name,
        prevPkgId,
      });
      return;
    }

    // hourly: set starts_on = today by default (if empty)
    if (isHourlyPackageName(pkg.name)) {
      setStartsOn((p) => ({
        ...p,
        [studentId]: (p[studentId] ?? '').trim() || isoToDisplayDate(todayLocalISODate()),
      }));
      setEndsOn((p) => ({ ...p, [studentId]: '' }));
      setPeriodMode((p) => ({ ...p, [studentId]: 'range' }));
      return;
    }

    // other packages: no modal
    setStartsOn((p) => ({ ...p, [studentId]: '' }));
    setEndsOn((p) => ({ ...p, [studentId]: '' }));
    setPeriodMode((p) => ({ ...p, [studentId]: 'range' }));
  };

  const saveStudentPackage = async (studentId: string) => {
    if (!schoolId) return;

    const pkgId = (selectedPackage[studentId] ?? '').trim();
    if (!pkgId) {
      setError('Επέλεξε πακέτο πρώτα.');
      return;
    }

    const pkg = packageById.get(pkgId);
    if (!pkg) {
      setError('Το επιλεγμένο πακέτο δεν βρέθηκε.');
      return;
    }

    const yearly = isYearlyPackageName(pkg.name);
    const monthly = isMonthlyPackageName(pkg.name);
    const hourly = isHourlyPackageName(pkg.name);

    const sOnDisplay = (startsOn[studentId] ?? '').trim();
    const eOnDisplay = (endsOn[studentId] ?? '').trim();

    let startsISO: string | null = null;
    let endsISO: string | null = null;

    if (yearly) {
      const s = displayToISODate(sOnDisplay);
      const e = displayToISODate(eOnDisplay);
      if (!s || !e) {
        setError('Για το ετήσιο πακέτο βάλε έγκυρη ημερομηνία έναρξης και λήξης.');
        return;
      }
      if (new Date(s).getTime() > new Date(e).getTime()) {
        setError('Η ημερομηνία έναρξης δεν μπορεί να είναι μετά τη λήξη.');
        return;
      }
      startsISO = s;
      endsISO = e;
    } else if (monthly) {
      const mode: MonthlyPeriodMode = periodMode[studentId] ?? 'month';
      if (mode === 'range') {
        const s = displayToISODate(sOnDisplay);
        const e = displayToISODate(eOnDisplay);
        if (!s || !e) {
          setError('Βάλε έγκυρη ημερομηνία έναρξης και λήξης.');
          return;
        }
        if (new Date(s).getTime() > new Date(e).getTime()) {
          setError('Η ημερομηνία έναρξης δεν μπορεί να είναι μετά τη λήξη.');
          return;
        }
        startsISO = s;
        endsISO = e;
      } else {
        const y = (selectedYear[studentId] ?? '').trim();
        const m = (selectedMonthNum[studentId] ?? '').trim();
        const range = monthKeyToRange(`${y}-${m}`);
        if (!range) {
          setError('Επέλεξε μήνα και έτος για τη συνδρομή.');
          return;
        }
        startsISO = range.startISO;
        endsISO = range.endISO;
      }
    } else if (hourly) {
      // ✅ Hourly: start date MUST be the day we assign the package
      startsISO = displayToISODate(sOnDisplay) ?? todayLocalISODate();
      endsISO = null;

      // keep UI state consistent
      setStartsOn((p) => ({ ...p, [studentId]: isoToDisplayDate(startsISO) }));
      setEndsOn((p) => ({ ...p, [studentId]: '' }));
    } else {
      startsISO = null;
      endsISO = null;
    }

    const row = rows.find((r) => r.student_id === studentId) ?? null;

    setSavingStudentId(studentId);
    setError(null);
    setInfo(null);

    const payload = {
      school_id: schoolId,
      student_id: studentId,
      package_id: pkg.id,
      package_name: pkg.name,
      price: Number(Number((pkg as any).price ?? 0).toFixed(2)), // hourly rate or fixed price
      currency: pkg.currency ?? 'EUR',
      status: 'active' as const,
      starts_on: startsISO,
      ends_on: endsISO,
    };

    if (!row?.sub) {
      const { error } = await supabase.from('student_subscriptions').insert(payload);
      if (error) {
        setError(error.message);
        setSavingStudentId(null);
        return;
      }
      setInfo('Ανατέθηκε πακέτο.');
      await load();
      setSavingStudentId(null);
      return;
    }

    const { error } = await supabase
      .from('student_subscriptions')
      .update(payload)
      .eq('id', row.sub.id)
      .eq('school_id', schoolId);

    if (error) {
      setError(error.message);
      setSavingStudentId(null);
      return;
    }

    setInfo('Ενημερώθηκε το πακέτο.');
    await load();
    setSavingStudentId(null);
  };

  const addPayment = async (studentId: string) => {
    if (!schoolId) return;

    const row = rows.find((r) => r.student_id === studentId) ?? null;
    if (!row?.sub) {
      setError('Ο μαθητής δεν έχει πακέτο. Ανάθεσε πακέτο πρώτα.');
      return;
    }

    const amount = parseMoney(paymentInput[studentId] ?? '');
    if (amount <= 0) {
      setError('Δώσε ποσό μεγαλύτερο από 0.');
      return;
    }

    setPayingStudentId(studentId);
    setError(null);
    setInfo(null);

    const { error } = await supabase.from('student_subscription_payments').insert({
      school_id: schoolId,
      subscription_id: row.sub.id,
      amount: Number(amount.toFixed(2)),
    });

    if (error) {
      setError(error.message);
      setPayingStudentId(null);
      return;
    }

    setPaymentInput((prev) => ({ ...prev, [studentId]: '' }));
    setInfo('Καταχωρήθηκε πληρωμή.');
    await load();
    setPayingStudentId(null);
  };

  const showingFrom = totalStudents === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalStudents);

  const periodSummary = (
    studentId: string,
    pkgName: string | null | undefined,
    sub: SubscriptionRow | null,
  ) => {
    if (!pkgName) return '—';

    if (isYearlyPackageName(pkgName)) {
      const a = (startsOn[studentId] ?? '').trim();
      const b = (endsOn[studentId] ?? '').trim();
      return a && b ? `${a} – ${b}` : '—';
    }

    if (isMonthlyPackageName(pkgName)) {
      const mode = periodMode[studentId] ?? 'month';
      if (mode === 'range') {
        const a = (startsOn[studentId] ?? '').trim();
        const b = (endsOn[studentId] ?? '').trim();
        return a && b ? `${a} – ${b}` : '—';
      }
      const y = (selectedYear[studentId] ?? '').trim();
      const m = (selectedMonthNum[studentId] ?? '').trim();
      if (!y || !m) return '—';
      const label = monthLabel(m);
      return label ? `${label} ${y}` : `${m}/${y}`;
    }

    if (isHourlyPackageName(pkgName)) {
      const s = (startsOn[studentId] ?? '').trim() || isoToDisplayDate(sub?.starts_on);
      const hrs = sub ? Number((sub as any).used_hours ?? 0) : 0;
      return s ? `Από ${s} · ${money(hrs)} ώρες` : '—';
    }

    return '—';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[color:var(--color-accent)]">
            <Briefcase className="h-4 w-4" />
            Συνδρομές Μαθητών
          </h1>
          <p className="text-sm text-slate-300">
            Ανάθεση πακέτου & πληρωμές (υπολογίζει αυτόματα υπόλοιπο).
          </p>
        </div>

        <input
          className="form-input w-full sm:w-64"
          style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
          placeholder="Αναζήτηση μαθητή..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {(error || info) && (
        <div
          className={[
            'rounded border px-4 py-2 text-xs',
            error
              ? 'border-red-500 bg-red-900/40 text-red-100'
              : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200',
          ].join(' ')}
        >
          {error ?? info}
        </div>
      )}

      <div className="rounded-xl border border-slate-400/60 bg-transparent backdrop-blur-md shadow-lg ring-1 ring-inset ring-slate-300/15">
        <div className="overflow-x-auto overflow-y-visible">
          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-200 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Φόρτωση…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-200">Δεν βρέθηκαν μαθητές.</div>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΜΑΘΗΤΗΣ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΠΑΚΕΤΟ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΔΙΑΣΤΗΜΑ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-right">ΤΙΜΗ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-right">ΠΛΗΡΩΘΗΚΕ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-right">ΥΠΟΛΟΙΠΟ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΚΑΤΑΣΤΑΣΗ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-right">ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => {
                  const rowBg = idx % 2 === 0 ? 'bg-slate-950/45' : 'bg-slate-900/25';

                  const hasSub = !!r.sub;
                  const paid = r.paid;
                  const balance = r.balance;

                  const paidCls =
                    !hasSub ? 'text-slate-400' : paid > 0 ? 'text-emerald-200' : 'text-slate-300';
                  const balanceCls =
                    !hasSub ? 'text-slate-400' : balance > 0 ? 'text-amber-200' : 'text-emerald-200';

                  const badge = !hasSub
                    ? { text: 'Χωρίς πακέτο', cls: 'border-slate-600/60 bg-slate-900/30 text-slate-200' }
                    : paid <= 0
                      ? { text: 'Δεν πλήρωσε', cls: 'border-red-500/40 bg-red-950/20 text-red-200' }
                      : balance > 0
                        ? { text: 'Υπόλοιπο', cls: 'border-amber-500/40 bg-amber-950/20 text-amber-200' }
                        : { text: 'Εξοφλημένο', cls: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200' };

                  const selectedPkgId = selectedPackage[r.student_id] ?? '';
                  const selectedPkg = selectedPkgId ? packageById.get(selectedPkgId) ?? null : null;

                  const summary = periodSummary(
                    r.student_id,
                    selectedPkg?.name ?? r.sub?.package_name,
                    r.sub,
                  );

                  // ✅ show computed billed amount (hourly uses charge_amount)
                  const billedAmount = r.sub ? Number((r.sub as any).charge_amount ?? r.sub.price ?? 0) : 0;

                  return (
                    <tr key={r.student_id} className={`${rowBg} hover:bg-slate-800/40 transition-colors`}>
                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <span className="text-slate-50 font-medium">{r.student_name}</span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <select
                          value={selectedPkgId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            const prevId = selectedPackage[r.student_id] ?? '';

                            setSelectedPackage((prev) => ({ ...prev, [r.student_id]: nextId }));

                            // clearing selection
                            if (!nextId) {
                              setStartsOn((p) => ({ ...p, [r.student_id]: '' }));
                              setEndsOn((p) => ({ ...p, [r.student_id]: '' }));
                              setPeriodMode((p) => ({ ...p, [r.student_id]: 'month' }));
                              const now = new Date();
                              setSelectedYear((p) => ({ ...p, [r.student_id]: String(now.getFullYear()) }));
                              setSelectedMonthNum((p) => ({ ...p, [r.student_id]: pad2(now.getMonth() + 1) }));
                              return;
                            }

                            openPackageModalIfNeeded(r.student_id, r.student_name, nextId, prevId);
                          }}
                          className="form-input select-accent w-full max-w-[320px] px-2 py-1.5 text-[11px]"
                          style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        >
                          <option value="">— Επιλογή πακέτου —</option>
                          {packages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {money(p.price)} {CURRENCY_SYMBOL}
                              {p.is_active ? '' : ' (ανενεργό)'}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <span className="inline-flex rounded-md border border-slate-700/70 bg-slate-900/20 px-2.5 py-1 text-[11px] text-slate-100">
                          {summary}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle text-right text-slate-100">
                        {r.sub ? `${money(billedAmount)} ${CURRENCY_SYMBOL}` : '—'}
                      </td>

                      <td className={`border-b border-slate-700 px-4 py-2 align-middle text-right ${paidCls}`}>
                        {r.sub ? `${money(paid)} ${CURRENCY_SYMBOL}` : '—'}
                      </td>

                      <td className={`border-b border-slate-700 px-4 py-2 align-middle text-right ${balanceCls}`}>
                        {r.sub ? `${money(balance)} ${CURRENCY_SYMBOL}` : '—'}
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] ${badge.cls}`}>
                          {badge.text}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            value={paymentInput[r.student_id] ?? ''}
                            onChange={(e) =>
                              setPaymentInput((prev) => ({
                                ...prev,
                                [r.student_id]: e.target.value
                                  .replace(',', '.')
                                  .replace(/[^0-9.]/g, ''),
                              }))
                            }
                            disabled={!hasSub || payingStudentId === r.student_id}
                            inputMode="decimal"
                            placeholder="Πληρωμή"
                            className={[
                              'w-24 rounded-md border border-slate-700/70 bg-slate-950/40 px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-[color:var(--color-accent)]/70',
                              !hasSub || payingStudentId === r.student_id ? 'opacity-60' : '',
                            ].join(' ')}
                          />

                          <button
                            type="button"
                            onClick={() => addPayment(r.student_id)}
                            disabled={!hasSub || payingStudentId === r.student_id}
                            className={[
                              'inline-flex h-9 w-9 items-center justify-center rounded-md border',
                              hasSub
                                ? 'border-emerald-500/40 bg-emerald-950/15 text-emerald-300 hover:bg-emerald-950/25'
                                : 'border-slate-800/70 bg-slate-900/20 text-slate-500 cursor-not-allowed',
                            ].join(' ')}
                            title="Προσθήκη πληρωμής"
                            aria-label="Προσθήκη πληρωμής"
                          >
                            {payingStudentId === r.student_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <HandCoins className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => saveStudentPackage(r.student_id)}
                            disabled={savingStudentId === r.student_id}
                            className={[
                              'inline-flex h-9 w-9 items-center justify-center rounded-md border',
                              'border-slate-700/70 bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/30',
                              savingStudentId === r.student_id ? 'opacity-60 cursor-not-allowed' : '',
                            ].join(' ')}
                            title="Αποθήκευση πακέτου"
                            aria-label="Αποθήκευση πακέτου"
                          >
                            {savingStudentId === r.student_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (!hasSub) return;
                              setHistoryTarget({ studentName: r.student_name, payments: r.payments });
                            }}
                            disabled={!hasSub}
                            className={[
                              'inline-flex h-9 w-9 items-center justify-center rounded-md border',
                              hasSub
                                ? 'border-slate-700/70 bg-slate-900/30 text-slate-200 hover:bg-slate-800/40'
                                : 'border-slate-800/70 bg-slate-900/20 text-slate-500 cursor-not-allowed',
                            ].join(' ')}
                            title="Ιστορικό πληρωμών"
                            aria-label="Ιστορικό πληρωμών"
                          >
                            <History className="h-4 w-4" />
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
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3">
            <div className="text-[11px] text-slate-300">
              Εμφάνιση <span className="text-slate-100">{showingFrom}</span>-
              <span className="text-slate-100">{showingTo}</span> από{' '}
              <span className="text-slate-100">{totalStudents}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Προηγ.
              </button>

              <div className="rounded-md border border-slate-700 bg-slate-900/20 px-3 py-1.5 text-[11px] text-slate-200">
                Σελίδα <span className="text-slate-50">{page}</span> /{' '}
                <span className="text-slate-50">{pageCount}</span>
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Επόμ.
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Yearly Modal */}
      <YearlySubscriptionModal
        open={!!yearlyModal}
        studentName={yearlyModal?.studentName ?? ''}
        packageName={yearlyModal?.pkgName ?? ''}
        initialStart={startsOn[yearlyModal?.studentId ?? ''] ?? ''}
        initialEnd={endsOn[yearlyModal?.studentId ?? ''] ?? ''}
        onCancel={() => {
          if (yearlyModal) {
            setSelectedPackage((p) => ({ ...p, [yearlyModal.studentId]: yearlyModal.prevPkgId }));
          }
          setYearlyModal(null);
        }}
        onSave={(startDisplay, endDisplay) => {
          if (!yearlyModal) return;
          const sid = yearlyModal.studentId;

          setStartsOn((p) => ({ ...p, [sid]: startDisplay }));
          setEndsOn((p) => ({ ...p, [sid]: endDisplay }));
          setPeriodMode((p) => ({ ...p, [sid]: 'range' })); // not used, but safe
          setYearlyModal(null);
        }}
      />

      {/* ✅ Monthly Modal */}
      <MonthlySubscriptionModal
        open={!!monthlyModal}
        studentName={monthlyModal?.studentName ?? ''}
        packageName={monthlyModal?.pkgName ?? ''}
        yearOptions={yearOptions}
        monthOptions={monthOptions}
        initialMode={periodMode[monthlyModal?.studentId ?? ''] ?? 'month'}
        initialMonth={selectedMonthNum[monthlyModal?.studentId ?? ''] ?? pad2(new Date().getMonth() + 1)}
        initialYear={selectedYear[monthlyModal?.studentId ?? ''] ?? String(new Date().getFullYear())}
        initialStart={startsOn[monthlyModal?.studentId ?? ''] ?? ''}
        initialEnd={endsOn[monthlyModal?.studentId ?? ''] ?? ''}
        onCancel={() => {
          if (monthlyModal) {
            setSelectedPackage((p) => ({ ...p, [monthlyModal.studentId]: monthlyModal.prevPkgId }));
          }
          setMonthlyModal(null);
        }}
        onSave={({ mode, month, year, startDisplay, endDisplay }) => {
          if (!monthlyModal) return;
          const sid = monthlyModal.studentId;

          setPeriodMode((p) => ({ ...p, [sid]: mode }));

          if (mode === 'month') {
            setSelectedMonthNum((p) => ({ ...p, [sid]: month }));
            setSelectedYear((p) => ({ ...p, [sid]: year }));

            const range = monthKeyToRange(`${year}-${month}`);
            if (range) {
              setStartsOn((p) => ({ ...p, [sid]: isoToDisplayDate(range.startISO) }));
              setEndsOn((p) => ({ ...p, [sid]: isoToDisplayDate(range.endISO) }));
            }
          } else {
            setStartsOn((p) => ({ ...p, [sid]: startDisplay }));
            setEndsOn((p) => ({ ...p, [sid]: endDisplay }));
          }

          setMonthlyModal(null);
        }}
      />

      {/* ✅ History Modal */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-50">Ιστορικό πληρωμών</div>
                <div className="mt-0.5 text-xs text-slate-300">
                  Μαθητής:{' '}
                  <span className="font-semibold text-[color:var(--color-accent)]">
                    {historyTarget.studentName}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="rounded-md border border-slate-700/70 bg-slate-900/30 p-2 text-slate-200 hover:bg-slate-800/40"
                aria-label="Κλείσιμο"
                title="Κλείσιμο"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {historyTarget.payments.length === 0 ? (
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/20 px-4 py-3 text-xs text-slate-200">
                Δεν υπάρχουν πληρωμές ακόμα.
              </div>
            ) : (
              <div className="rounded-lg border border-slate-700/70 overflow-hidden">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/40 text-[11px] uppercase tracking-wide text-slate-200">
                      <th className="border-b border-slate-700 px-4 py-2 text-left">ΗΜΕΡΟΜΗΝΙΑ</th>
                      <th className="border-b border-slate-700 px-4 py-2 text-right">ΠΟΣΟ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyTarget.payments.map((p, i) => (
                      <tr
                        key={`${p.created_at ?? 'na'}-${i}`}
                        className={i % 2 === 0 ? 'bg-slate-950/35' : 'bg-slate-900/20'}
                      >
                        <td className="border-b border-slate-700 px-4 py-2 text-slate-100">
                          {formatDateTime(p.created_at)}
                        </td>
                        <td className="border-b border-slate-700 px-4 py-2 text-right text-emerald-200">
                          {money(p.amount)} {CURRENCY_SYMBOL}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                Σύνολο πληρωμών:{' '}
                <span className="font-semibold text-emerald-200">
                  {money(historyTotalPaid)} {CURRENCY_SYMBOL}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="rounded-md border border-slate-700/70 bg-slate-900/30 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800/40"
              >
                Κλείσιμο
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
