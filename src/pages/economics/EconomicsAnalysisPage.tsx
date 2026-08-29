import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import { Wallet, Loader2, Banknote, CreditCard, Landmark } from 'lucide-react';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';

import type { Mode, TxRow, ExtraExpenseRow } from '../../components/economics/types';
import {
  isoToday, money,
  startOfMonthISO, endOfMonthISO, startOfYearISO, endOfYearISO,
  startOfDayTs, endOfDayTs,
  buildSeriesForPeriod, getCurrentPeriod, hasAll, hasAny,
} from '../../components/economics/utils';
import { PAGE_SIZE, STUDENT_INCOME_TABLE, EXTRA_EXPENSES_TABLE } from '../../components/economics/constants';
import { MultiSeriesChart } from '../../components/economics/analysis/MultiSeriesChart';
import type { SeriesId } from '../../components/economics/analysis/MultiSeriesChart';
import { IncomeExpenseDonut } from '../../components/economics/analysis/IncomeExpenseDonut';
import { EconomicsFilterBar } from '../../components/economics/analysis/EconomicsFilterBar';
import { EconomicsExtraExpenseForm } from '../../components/economics/analysis/EconomicsExtraExpenseForm';
import { isSchoolYearCurrent } from '../../components/school-info/types';
import { EconomicsEditExpenseModal } from '../../components/economics/analysis/EconomicsEditExpenseModal';
import { EconomicsCategoryBreakdown } from '../../components/economics/analysis/EconomicsCategoryBreakdown';
import { EconomicsTransactionsCard } from '../../components/economics/analysis/EconomicsTransactionsCard';

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

export default function EconomicsAnalysisPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;
  const { year: currentYear, month: currentMonth } = getCurrentPeriod();

  const sectionDividerColor = 'color-mix(in srgb, var(--color-accent) 35%, transparent)';

  const incomeAmountCls = isDark ? 'text-emerald-300' : 'text-emerald-600';
  const expenseAmountCls = isDark ? 'text-rose-300' : 'text-rose-600';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  const [rangeStart, setRangeStart] = useState(startOfMonthISO(currentYear, currentMonth));
  const [rangeEnd, setRangeEnd] = useState(isoToday());
  const [schoolYears, setSchoolYears] = useState<{ id: string; name: string; start_date: string; end_date: string }[]>([]);
  const [schoolYearId, setSchoolYearId] = useState('');
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState(isoToday());
  const [expNotes, setExpNotes] = useState('');
  const [txRows, setTxRows] = useState<TxRow[]>([]);
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
  const [cancelConfirmRow, setCancelConfirmRow] = useState<TxRow | null>(null);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [chartActive, setChartActive] = useState<Set<SeriesId>>(new Set(['income', 'expense', 'owed']));

  const toggleChart = (id: SeriesId) => {
    setChartActive(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size === 1) return prev; next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  function getBounds() {
    if (mode === 'month') return { start: startOfMonthISO(year, month), end: endOfMonthISO(year, month) };
    if (mode === 'year') return { start: startOfYearISO(year), end: endOfYearISO(year) };
    if (mode === 'schoolYear') {
      const sy = schoolYears.find(y => y.id === schoolYearId);
      return { start: sy?.start_date ?? isoToday(), end: sy?.end_date ?? isoToday() };
    }
    return { start: rangeStart || isoToday(), end: rangeEnd || isoToday() };
  }
  const bounds = useMemo(() => getBounds(), [mode, month, year, rangeStart, rangeEnd, schoolYearId, schoolYears]);

  useEffect(() => { setCatPage(1); setTxPage(1); }, [schoolId, mode, month, year, rangeStart, rangeEnd, schoolYearId]);

  useEffect(() => {
    if (!schoolId) return;
    supabase.from('school_years').select('id,name,start_date,end_date').eq('school_id', schoolId).order('start_date', { ascending: false })
      .then(({ data }) => {
        const years = (data ?? []) as typeof schoolYears;
        setSchoolYears(years);
        setSchoolYearId((prev) => prev || years.find(y => isSchoolYearCurrent(y))?.id || years[0]?.id || '');
      });
  }, [schoolId]);

  async function safeTutorPayments(start: string, end: string) {
    let res: any = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,paid_on,notes,created_at,status,tutors(full_name)').eq('school_id', schoolId!).neq('status', 'canceled').gte('paid_on', start).lte('paid_on', end).order('paid_on', { ascending: false }).limit(500);
    if (res.error && (hasAny(res.error, 'relationship') || hasAny(res.error, 'foreign key'))) res = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,paid_on,notes,created_at,status').eq('school_id', schoolId!).neq('status', 'canceled').gte('paid_on', start).lte('paid_on', end).order('paid_on', { ascending: false }).limit(500);
    if (res.error && hasAll(res.error, 'paid_on', 'does not exist')) res = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,notes,created_at,status').eq('school_id', schoolId!).neq('status', 'canceled').gte('created_at', startOfDayTs(start)).lte('created_at', endOfDayTs(end)).order('created_at', { ascending: false }).limit(500);
    return res;
  }
  async function safeStudentIncomes(start: string, end: string) {
    let res: any = await supabase
      .from(STUDENT_INCOME_TABLE)
      .select('id, school_id, amount, paid_on, notes, created_at, cancelled_at, subscription_id, payment_method, student_subscriptions(student_id, students(full_name))')
      .eq('school_id', schoolId!)
      .gte('paid_on', start)
      .lte('paid_on', end)
      .order('paid_on', { ascending: false })
      .limit(800);
    if (res.error && hasAny(res.error, 'relationship', 'foreign key', 'schema cache')) {
      res = await supabase
        .from(STUDENT_INCOME_TABLE)
        .select('id, school_id, amount, paid_on, notes, created_at, cancelled_at, subscription_id, payment_method')
        .eq('school_id', schoolId!)
        .gte('paid_on', start)
        .lte('paid_on', end)
        .order('paid_on', { ascending: false })
        .limit(800);
    }
    return res;
  }
  async function safeExtraExpenses(start: string, end: string) {
    let res: any = await supabase.from(EXTRA_EXPENSES_TABLE).select('id,school_id,occurred_on,name,amount,notes,created_at,created_by').eq('school_id', schoolId!).gte('occurred_on', start).lte('occurred_on', end).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(800);
    if (res.error && hasAll(res.error, 'occurred_on', 'does not exist')) res = await supabase.from(EXTRA_EXPENSES_TABLE).select('id,school_id,name,amount,notes,created_at,created_by').eq('school_id', schoolId!).gte('created_at', startOfDayTs(start)).lte('created_at', endOfDayTs(end)).order('created_at', { ascending: false }).limit(800);
    return res as { data: ExtraExpenseRow[] | null; error: any };
  }

  async function safeExtraChargePayments(start: string, end: string) {
    return supabase
      .from('student_extra_charge_payments')
      .select('id, school_id, student_id, amount, created_at, cancelled_at, payment_method, students(full_name)')
      .eq('school_id', schoolId!)
      .gte('created_at', startOfDayTs(start))
      .lte('created_at', endOfDayTs(end))
      .order('created_at', { ascending: false })
      .limit(800);
  }

  async function safePrivateLessonPayments(start: string, end: string) {
    return supabase
      .from('private_lesson_payments')
      .select('id, school_id, student_id, amount, created_at, cancelled_at, payment_method, students(full_name)')
      .eq('school_id', schoolId!)
      .gte('created_at', startOfDayTs(start))
      .lte('created_at', endOfDayTs(end))
      .order('created_at', { ascending: false })
      .limit(800);
  }

  async function safeStudentBalancePayments(start: string, end: string) {
    return supabase
      .from('student_balance_payments')
      .select('id, school_id, student_id, amount, created_at, cancelled_at, payment_method, note, students(full_name)')
      .eq('school_id', schoolId!)
      .gte('created_at', startOfDayTs(start))
      .lte('created_at', endOfDayTs(end))
      .order('created_at', { ascending: false })
      .limit(800);
  }

  async function loadForBounds(start: string, end: string) {
    if (!schoolId) return [];
    const [expRes, tutorRes, studentRes, extraChargeRes, privateLessonRes, balancePaymentRes] = await Promise.all([safeExtraExpenses(start, end), safeTutorPayments(start, end), safeStudentIncomes(start, end), safeExtraChargePayments(start, end), safePrivateLessonPayments(start, end), safeStudentBalancePayments(start, end)]);
    if (expRes.error) throw expRes.error;
    if (tutorRes.error) throw tutorRes.error;
    if (studentRes.error) throw studentRes.error;
    const expRows = (expRes.data ?? []) as ExtraExpenseRow[];
    const mappedExtra: TxRow[] = expRows.map(r => ({ id: r.id, kind: 'expense', source: 'extra_expense', date: (r.occurred_on ?? r.created_at?.slice(0, 10) ?? isoToday()).slice(0, 10), ts: r.created_at ?? '', amount: Number(r.amount) || 0, label: r.name, category: r.name, notes: r.notes ?? null }));
    const mappedTutor: TxRow[] = (tutorRes.data ?? []).map((p: any) => ({ id: p.id, kind: 'expense', source: 'tutor_payment', date: (p.paid_on ?? p.created_at ?? isoToday()).slice(0, 10), ts: p.paid_on ?? p.created_at ?? '', amount: Number(p.net_total) || 0, label: `Πληρωμή Καθηγητή: ${p?.tutors?.full_name ?? 'Καθηγητής'}`, category: 'Καθηγητές', notes: p.notes ?? null }));
    const mappedStudent: TxRow[] = ((studentRes.data as any[] | null) ?? []).map((p: any) => ({ id: p.id, kind: 'income', source: 'student_subscription', date: (p.paid_on ?? p.created_at ?? isoToday()).slice(0, 10), ts: p.paid_on ?? p.created_at ?? '', amount: Number(p.amount) || 0, label: `Συνδρομή: ${p?.student_subscriptions?.students?.full_name ?? 'Μαθητής'}`, notes: p.notes ?? null, cancelled: !!p.cancelled_at, payment_method: p.payment_method ?? null }));
    const mappedExtraCharges: TxRow[] = ((extraChargeRes.data as any[] | null) ?? []).map((p: any) => ({ id: p.id, kind: 'income', source: 'extra_charge', date: (p.created_at ?? isoToday()).slice(0, 10), ts: p.created_at ?? '', amount: Number(p.amount) || 0, label: `Πρόσθετη χρέωση: ${p?.students?.full_name ?? 'Μαθητής'}`, notes: null, cancelled: !!p.cancelled_at, payment_method: p.payment_method ?? null }));
    const mappedPrivateLesson: TxRow[] = ((privateLessonRes.data as any[] | null) ?? []).map((p: any) => ({ id: p.id, kind: 'income', source: 'private_lesson_payment', date: (p.created_at ?? isoToday()).slice(0, 10), ts: p.created_at ?? '', amount: Number(p.amount) || 0, label: `Ιδιαίτερο: ${p?.students?.full_name ?? 'Μαθητής'}`, notes: null, cancelled: !!p.cancelled_at, payment_method: p.payment_method ?? null }));
    const mappedBalancePayments: TxRow[] = ((balancePaymentRes.data as any[] | null) ?? []).map((p: any) => ({ id: p.id, kind: 'income', source: 'balance_payment', date: (p.created_at ?? isoToday()).slice(0, 10), ts: p.created_at ?? '', amount: Number(p.amount) || 0, label: `Πληρωμή: ${p?.students?.full_name ?? 'Μαθητής'}`, notes: p.note ?? null, cancelled: !!p.cancelled_at, payment_method: p.payment_method ?? null }));
    return [...mappedStudent, ...mappedExtraCharges, ...mappedPrivateLesson, ...mappedBalancePayments, ...mappedTutor, ...mappedExtra].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.ts < b.ts ? 1 : -1;
    });
  }

  // Mirrors the per-student "totalBalanceCombined" formula on the student card:
  // charged (subscriptions of any status + extra charges) minus paid (subscription
  // payments + extra charge payments + generic balance payments), clamped at 0 per
  // student so one student's overpayment can't offset another student's debt.
  async function loadOutstandingBalance() {
    if (!schoolId) return;
    const [subsRes, extraChargesRes, extraChargePaymentsRes, balancePaymentsRes] = await Promise.all([
      supabase.from('student_subscriptions_with_totals').select('student_id, charge_amount, price, paid_amount').eq('school_id', schoolId),
      supabase.from('student_extra_charges').select('student_id, amount').eq('school_id', schoolId).is('cancelled_at', null),
      supabase.from('student_extra_charge_payments').select('student_id, amount').eq('school_id', schoolId).is('cancelled_at', null),
      supabase.from('student_balance_payments').select('student_id, amount').eq('school_id', schoolId).is('cancelled_at', null),
    ]);
    const owedByStudent = new Map<string, number>();
    const add = (studentId: string | null | undefined, delta: number) => {
      if (!studentId) return;
      owedByStudent.set(studentId, (owedByStudent.get(studentId) ?? 0) + delta);
    };
    (subsRes.data ?? []).forEach((s: any) => {
      add(s.student_id, Number(s.charge_amount ?? s.price ?? 0));
      add(s.student_id, -(Number(s.paid_amount) || 0));
    });
    (extraChargesRes.data ?? []).forEach((c: any) => add(c.student_id, Number(c.amount) || 0));
    (extraChargePaymentsRes.data ?? []).forEach((p: any) => add(p.student_id, -(Number(p.amount) || 0)));
    (balancePaymentsRes.data ?? []).forEach((p: any) => add(p.student_id, -(Number(p.amount) || 0)));
    const total = Array.from(owedByStudent.values()).reduce((sum, b) => sum + (b > 0 ? b : 0), 0);
    setOutstandingBalance(total);
  }

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true); setError(null);
    try {
      const [rows] = await Promise.all([
        loadForBounds(bounds.start, bounds.end),
        loadOutstandingBalance(),
      ]);
      setTxRows(rows);
    }
    catch (e: any) { setError(e?.message ?? 'Κάτι πήγε στραβά.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, [schoolId, mode, month, year, rangeStart, rangeEnd, schoolYearId]);

  const incomeTotal = useMemo(() => txRows.filter(r => r.kind === 'income' && !r.cancelled).reduce((s, r) => s + (Number(r.amount) || 0), 0), [txRows]);
  const expenseTotal = useMemo(() => txRows.filter(r => r.kind === 'expense' && !r.cancelled).reduce((s, r) => s + (Number(r.amount) || 0), 0), [txRows]);
  const netTotal = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal]);
  const incomeSeries = useMemo(() => buildSeriesForPeriod({ kind: 'income', rows: txRows, mode, year, month, start: bounds.start, end: bounds.end }), [txRows, mode, year, month, bounds.start, bounds.end]);
  const expenseSeries = useMemo(() => buildSeriesForPeriod({ kind: 'expense', rows: txRows, mode, year, month, start: bounds.start, end: bounds.end }), [txRows, mode, year, month, bounds.start, bounds.end]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    txRows.filter(r => r.kind === 'expense' && !r.cancelled).forEach(r => { const k = r.category ?? (r.source === 'extra_expense' ? r.label?.trim() || 'Άλλο' : 'Καθηγητές'); map.set(k, (map.get(k) ?? 0) + (Number(r.amount) || 0)); });
    return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [txRows]);

  const visibleTxRows = useMemo(() => txRows.filter(r => !r.cancelled), [txRows]);

  const collectionByMethod = useMemo(() => {
    const result = { cash: 0, card: 0, bank_transfer: 0 };
    visibleTxRows.filter(r => r.kind === 'income').forEach(r => {
      const m = r.payment_method;
      if (m === 'cash' || m === 'card' || m === 'bank_transfer') result[m] += r.amount;
    });
    return result;
  }, [visibleTxRows]);
  const catTotalPages = useMemo(() => Math.max(1, Math.ceil(expenseByCategory.length / PAGE_SIZE)), [expenseByCategory.length]);
  const txTotalPages = useMemo(() => Math.max(1, Math.ceil(visibleTxRows.length / PAGE_SIZE)), [visibleTxRows.length]);
  useEffect(() => setCatPage(p => Math.min(p, catTotalPages)), [catTotalPages]);
  useEffect(() => setTxPage(p => Math.min(p, txTotalPages)), [txTotalPages]);
  const catPageRows = useMemo(() => { const s = (catPage - 1) * PAGE_SIZE; return expenseByCategory.slice(s, s + PAGE_SIZE); }, [expenseByCategory, catPage]);
  const txPageRows = useMemo(() => { const s = (txPage - 1) * PAGE_SIZE; return visibleTxRows.slice(s, s + PAGE_SIZE); }, [visibleTxRows, txPage]);

  // ── Add extra expense via edge function ───────────────────────────────────
  async function addExtraExpense() {
    if (!schoolId || !user?.id) return;
    const name = expName.trim();
    const amt = Number(expAmount) || 0;
    if (!name || amt <= 0) return;
    setBusy(true); setError(null);
    try {
      await callEdgeFunction('economicsanalysis-create', {
        occurred_on: expDate || isoToday(),
        name,
        amount: amt,
        notes: expNotes.trim() || null,
        created_by: user.id,
      });
      setExpName(''); setExpAmount(0); setExpNotes(''); setExpDate(isoToday());
      await loadAll();
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία προσθήκης εξόδου.'); }
    finally { setBusy(false); }
  }

  function closeEditExpense() { if (busy) return; setEditOpen(false); setEditing(null); }

  // ── Save edit via edge function ───────────────────────────────────────────
  async function saveEditExpense() {
    if (!schoolId || !user?.id || !editing) return;
    const name = editName.trim();
    const amt = Number(editAmount) || 0;
    if (!name || amt <= 0) return;
    setBusy(true); setError(null);
    try {
      await callEdgeFunction('economicsanalysis-update', {
        expense_id: editing.id,
        name,
        amount: amt,
        occurred_on: editDate || null,
        notes: editNotes.trim() || null,
      });
      closeEditExpense(); await loadAll();
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία αποθήκευσης.'); }
    finally { setBusy(false); }
  }

  function closeDeleteExpense() { if (busy) return; setDeleteOpen(false); setDeleting(null); }

  // ── Cancel tx row ─────────────────────────────────────────────────────────
  async function confirmCancelTxRow() {
    const row = cancelConfirmRow;
    if (!row) return;
    setCancelConfirmRow(null);
    setBusy(true); setError(null);
    setTxRows(prev => prev.map(r => r.id === row.id && r.source === row.source ? { ...r, cancelled: true } : r));
    try {
      if (row.source === 'student_subscription') {
        await callEdgeFunction('student-subscription-payment-cancel', { payment_id: row.id });
      } else if (row.source === 'tutor_payment') {
        await callEdgeFunction('tutorspayments-delete', { payment_id: row.id });
      } else if (row.source === 'extra_expense') {
        await callEdgeFunction('economicsanalysis-delete', { expense_id: row.id });
      } else if (row.source === 'extra_charge') {
        await supabase.from('student_extra_charge_payments').update({ cancelled_at: new Date().toISOString() }).eq('id', row.id);
      } else if (row.source === 'private_lesson_payment') {
        await supabase.from('private_lesson_payments').update({ cancelled_at: new Date().toISOString() }).eq('id', row.id);
      } else if (row.source === 'balance_payment') {
        await supabase.from('student_balance_payments').update({ cancelled_at: new Date().toISOString() }).eq('id', row.id);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία ακύρωσης.');
      setTxRows(prev => prev.map(r => r.id === row.id && r.source === row.source ? { ...r, cancelled: false } : r));
    } finally { setBusy(false); }
  }

  // ── Delete via edge function ──────────────────────────────────────────────
  async function confirmDeleteExpense() {
    if (!deleting) return;
    setBusy(true); setError(null);
    try {
      await callEdgeFunction('economicsanalysis-delete', { expense_id: deleting.id });
      closeDeleteExpense(); await loadAll();
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία διαγραφής.'); }
    finally { setBusy(false); }
  }

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

      {/* Header + Filters */}
      <div className="relative z-10">
      <EconomicsFilterBar
        mode={mode} onModeChange={setMode}
        month={month} onMonthChange={setMonth}
        year={year} onYearChange={setYear}
        rangeStart={rangeStart} onRangeStartChange={setRangeStart}
        rangeEnd={rangeEnd} onRangeEndChange={setRangeEnd}
        monthsOptions={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'][i]! }))}
        yearsOptions={(() => { const base = new Date().getFullYear(); return Array.from({ length: 21 }, (_, i) => ({ value: base - 10 + i, label: String(base - 10 + i) })); })()}
        schoolYearId={schoolYearId} onSchoolYearIdChange={setSchoolYearId}
        schoolYearsOptions={schoolYears.map(y => ({ value: y.id, label: y.name }))}
        isDark={isDark}
      />
      </div>

      {/* Error banner */}
      {error && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-red-300 bg-red-50 text-red-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400"/>
          {error}
        </div>
      )}

      {/* Top grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8 lg:border-r-2 lg:pr-6" style={{ borderColor: sectionDividerColor }}>
          {/* Combined chart card */}
          <div className="border-b-2 pb-6" style={{ borderColor: sectionDividerColor }}>
            {/* Stat strip */}
            <div className={`mb-3 flex flex-wrap items-center gap-5 border-b pb-3 ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
              <div>
                <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`}>Έσοδα</p>
                <p className={`text-2xl font-bold tracking-tight ${incomeAmountCls}`}>{money(incomeTotal)}</p>
              </div>
              <div className={`h-8 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div>
                <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-rose-500' : 'text-rose-600'}`}>Έξοδα</p>
                <p className={`text-2xl font-bold tracking-tight ${expenseAmountCls}`}>{money(expenseTotal)}</p>
              </div>
              <div className={`h-8 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div>
                <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>Οφειλές</p>
                <p className={`text-2xl font-bold tracking-tight ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{money(outstandingBalance)}</p>
              </div>

              {/* Segmented series toggle — top right */}
              <div className="ml-auto">
                <div className={`flex items-center divide-x overflow-hidden rounded-lg border text-[10px] font-semibold ${isDark ? 'divide-slate-700 border-slate-700' : 'divide-slate-200 border-slate-200'}`}>
                  {(['income', 'expense', 'owed'] as SeriesId[]).map(id => {
                    const on = chartActive.has(id);
                    const dotColor   = { income: '#10b981', expense: '#f43f5e', owed: '#f59e0b' }[id];
                    const activeBg   = { income: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.10)', expense: isDark ? 'rgba(244,63,94,0.15)' : 'rgba(244,63,94,0.08)', owed: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.10)' }[id];
                    const activeColor = { income: isDark ? '#34d399' : '#059669', expense: isDark ? '#fb7185' : '#e11d48', owed: isDark ? '#fbbf24' : '#d97706' }[id];
                    const label      = { income: 'Έσοδα', expense: 'Έξοδα', owed: 'Οφειλές' }[id];
                    return (
                      <button key={id} type="button" onClick={() => toggleChart(id)}
                        className="flex items-center gap-1.5 px-3 py-2 transition-colors"
                        style={on
                          ? { background: activeBg, color: activeColor }
                          : { background: 'transparent', color: isDark ? '#475569' : '#94a3b8' }}>
                        <span className="h-1.5 w-1.5 rounded-full transition-colors" style={{ backgroundColor: on ? dotColor : (isDark ? '#334155' : '#cbd5e1') }} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <MultiSeriesChart
              incomeSeries={incomeSeries}
              expenseSeries={expenseSeries}
              owedValue={outstandingBalance}
              isDark={isDark}
              active={chartActive}
            />
          </div>

          {/* Collection by payment method */}
          <div className="flex flex-1 flex-col">
            <p className={`mb-3 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Είσπραξη ανά τρόπο πληρωμής</p>
            <div className={`flex flex-1 divide-x ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {([
                { key: 'cash',          label: 'Μετρητά',  Icon: Banknote,   accent: isDark ? '#34d399' : '#059669', bg: isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.07)' },
                { key: 'card',          label: 'Κάρτα',    Icon: CreditCard, accent: isDark ? '#818cf8' : '#4f46e5', bg: isDark ? 'rgba(99,102,241,0.10)'  : 'rgba(99,102,241,0.07)'  },
                { key: 'bank_transfer', label: 'Τράπεζα',  Icon: Landmark,   accent: isDark ? '#fbbf24' : '#d97706', bg: isDark ? 'rgba(245,158,11,0.10)'  : 'rgba(245,158,11,0.07)'  },
              ] as const).map(({ key, label, Icon, accent, bg }) => (
                <div key={key} className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: bg }}>
                    <Icon className="h-5 w-5" style={{ color: accent }} />
                  </span>
                  <div className="text-center">
                    <p className={`mb-1 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
                    <p className={`text-2xl font-bold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{money(collectionByMethod[key])}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">

          {/* Net card */}
          <div className="border-b-2 pb-6" style={{ borderColor: sectionDividerColor }}>
            <div className="mb-1 flex items-center gap-2">
              <Wallet className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}/>
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Καθαρό</span>
            </div>
            <div className={`text-3xl font-bold tracking-tight ${netTotal >= 0 ? (isDark ? 'text-slate-100' : 'text-slate-800') : (isDark ? 'text-rose-400' : 'text-rose-600')}`}>{money(netTotal)}</div>
            <div className={`mt-5 border-t pt-4 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
              <IncomeExpenseDonut income={incomeTotal} expense={expenseTotal} owed={outstandingBalance} isDark={isDark}/>
            </div>
          </div>

          {/* Extra expenses form */}
          <EconomicsExtraExpenseForm
            expName={expName} onExpNameChange={setExpName}
            expAmount={expAmount} onExpAmountChange={setExpAmount}
            expDate={expDate} onExpDateChange={setExpDate}
            expNotes={expNotes} onExpNotesChange={setExpNotes}
            busy={busy} onSubmit={addExtraExpense}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Bottom: categories + transactions */}
      <div className="grid grid-cols-1 gap-6 border-t-2 pt-6 lg:grid-cols-12" style={{ borderColor: sectionDividerColor }}>
        <div className="lg:col-span-4 lg:border-r-2 lg:pr-6" style={{ borderColor: sectionDividerColor }}>
          <EconomicsCategoryBreakdown
            expenseByCategory={expenseByCategory}
            catPageRows={catPageRows}
            catPage={catPage}
            catTotalPages={catTotalPages}
            onPrev={() => setCatPage(p => Math.max(1, p - 1))}
            onNext={() => setCatPage(p => Math.min(catTotalPages, p + 1))}
            isDark={isDark}
          />
        </div>

        <div className="lg:col-span-8">
          <EconomicsTransactionsCard
            txRows={visibleTxRows}
            txPageRows={txPageRows}
            txPage={txPage}
            txTotalPages={txTotalPages}
            onPrev={() => setTxPage(p => Math.max(1, p - 1))}
            onNext={() => setTxPage(p => Math.min(txTotalPages, p + 1))}
            onCancel={setCancelConfirmRow}
            busy={busy}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Cancel tx row confirm */}
      <ConfirmActionModal
        open={!!cancelConfirmRow}
        title="Ακύρωση κίνησης"
        message={<div className={isDark ? 'text-slate-200' : 'text-slate-700'}>Σίγουρα θέλετε να ακυρώσετε την κίνηση <span className={`font-semibold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>{cancelConfirmRow ? `${cancelConfirmRow.label} (${cancelConfirmRow.date})` : '—'}</span>; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.</div>}
        confirmLabel="Ακύρωση κίνησης" cancelLabel="Πίσω" confirmColor="red" busy={busy}
        onClose={() => setCancelConfirmRow(null)} onConfirm={confirmCancelTxRow}
      />

      {/* Delete confirm */}
      <ConfirmActionModal
        open={deleteOpen}
        title="Διαγραφή εξόδου"
        message={<div className={isDark ? 'text-slate-200' : 'text-slate-700'}>Σίγουρα θέλετε να διαγράψετε το έξοδο <span className={`font-semibold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>{deleting ? `${deleting.name} (${(deleting.occurred_on ?? deleting.created_at?.slice(0, 10) ?? isoToday()).slice(0, 10)})` : '—'}</span>; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.</div>}
        confirmLabel="Διαγραφή" cancelLabel="Ακύρωση" confirmColor="red" busy={busy}
        onClose={closeDeleteExpense} onConfirm={confirmDeleteExpense}
      />

      {/* Edit modal */}
      <EconomicsEditExpenseModal
        open={editOpen} editing={editing}
        editName={editName} onEditNameChange={setEditName}
        editAmount={editAmount} onEditAmountChange={setEditAmount}
        editDate={editDate} onEditDateChange={setEditDate}
        editNotes={editNotes} onEditNotesChange={setEditNotes}
        busy={busy} onClose={closeEditExpense} onSave={saveEditExpense}
        isDark={isDark}
      />
    </div>
  );
}