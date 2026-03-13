import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import { TrendingUp, TrendingDown, Wallet, Loader2 } from 'lucide-react';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';

import type { Mode, TxRow, ExtraExpenseRow } from '../../components/economics/types';
import {
  isoToday, money,
  startOfMonthISO, endOfMonthISO, startOfYearISO, endOfYearISO,
  startOfDayTs, endOfDayTs,
  buildSeriesForPeriod, getCurrentPeriod, hasAll, hasAny,
} from '../../components/economics/utils';
import { PAGE_SIZE, STUDENT_INCOME_TABLE, EXTRA_EXPENSES_TABLE } from '../../components/economics/constants';
import { SparkArea } from '../../components/economics/analysis/SparkArea';
import { IncomeExpenseDonut } from '../../components/economics/analysis/IncomeExpenseDonut';
import { EconomicsFilterBar } from '../../components/economics/analysis/EconomicsFilterBar';
import { EconomicsExtraExpenseForm } from '../../components/economics/analysis/EconomicsExtraExpenseForm';
import { EconomicsEditExpenseModal } from '../../components/economics/analysis/EconomicsEditExpenseModal';
import { EconomicsCategoryBreakdown } from '../../components/economics/analysis/EconomicsCategoryBreakdown';
import { EconomicsTransactionsCard } from '../../components/economics/analysis/EconomicsTransactionsCard';

export default function EconomicsAnalysisPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;
  const { year: currentYear, month: currentMonth } = getCurrentPeriod();

  const sparkCardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 p-5 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-md';

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

  function getBounds() {
    if (mode === 'month') return { start: startOfMonthISO(year, month), end: endOfMonthISO(year, month) };
    if (mode === 'year') return { start: startOfYearISO(year), end: endOfYearISO(year) };
    return { start: rangeStart || isoToday(), end: rangeEnd || isoToday() };
  }
  const bounds = useMemo(() => getBounds(), [mode, month, year, rangeStart, rangeEnd]);

  useEffect(() => { setCatPage(1); setTxPage(1); }, [schoolId, mode, month, year, rangeStart, rangeEnd]);

  async function safeTutorPayments(start: string, end: string) {
    let res: any = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,paid_on,notes,created_at,status,tutors(full_name)').eq('school_id', schoolId!).eq('status', 'paid').gte('paid_on', start).lte('paid_on', end).order('paid_on', { ascending: false }).limit(500);
    if (res.error && (hasAny(res.error, 'relationship') || hasAny(res.error, 'foreign key'))) res = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,paid_on,notes,created_at,status').eq('school_id', schoolId!).eq('status', 'paid').gte('paid_on', start).lte('paid_on', end).order('paid_on', { ascending: false }).limit(500);
    if (res.error && hasAll(res.error, 'paid_on', 'does not exist')) res = await supabase.from('tutor_payments').select('id,school_id,tutor_id,net_total,notes,created_at,status').eq('school_id', schoolId!).eq('status', 'paid').gte('created_at', startOfDayTs(start)).lte('created_at', endOfDayTs(end)).order('created_at', { ascending: false }).limit(500);
    return res;
  }
  async function safeStudentIncomes(start: string, end: string) {
    let res: any = await supabase.from(STUDENT_INCOME_TABLE).select('id,school_id,amount,paid_on,notes,created_at,student_id,students(full_name)').eq('school_id', schoolId!).gte('paid_on', start).lte('paid_on', end).order('paid_on', { ascending: false }).limit(800);
    if (res.error && hasAll(res.error, 'student_id', 'does not exist')) res = await supabase.from(STUDENT_INCOME_TABLE).select('id,school_id,amount,paid_on,notes,created_at,students(full_name)').eq('school_id', schoolId!).gte('paid_on', start).lte('paid_on', end).order('paid_on', { ascending: false }).limit(800);
    if (res.error && hasAny(res.error, 'relationship', 'foreign key', 'schema cache')) res = await supabase.from(STUDENT_INCOME_TABLE).select('id,school_id,amount,paid_on,notes,created_at').eq('school_id', schoolId!).gte('paid_on', start).lte('paid_on', end).order('paid_on', { ascending: false }).limit(800);
    if (res.error && hasAll(res.error, 'paid_on', 'does not exist')) res = await supabase.from(STUDENT_INCOME_TABLE).select('id,school_id,amount,notes,created_at').eq('school_id', schoolId!).gte('created_at', startOfDayTs(start)).lte('created_at', endOfDayTs(end)).order('created_at', { ascending: false }).limit(800);
    return res;
  }
  async function safeExtraExpenses(start: string, end: string) {
    let res: any = await supabase.from(EXTRA_EXPENSES_TABLE).select('id,school_id,occurred_on,name,amount,notes,created_at,created_by').eq('school_id', schoolId!).gte('occurred_on', start).lte('occurred_on', end).order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(800);
    if (res.error && hasAll(res.error, 'occurred_on', 'does not exist')) res = await supabase.from(EXTRA_EXPENSES_TABLE).select('id,school_id,name,amount,notes,created_at,created_by').eq('school_id', schoolId!).gte('created_at', startOfDayTs(start)).lte('created_at', endOfDayTs(end)).order('created_at', { ascending: false }).limit(800);
    return res as { data: ExtraExpenseRow[] | null; error: any };
  }

  async function loadForBounds(start: string, end: string) {
    if (!schoolId) return [];
    const [expRes, tutorRes, studentRes] = await Promise.all([safeExtraExpenses(start, end), safeTutorPayments(start, end), safeStudentIncomes(start, end)]);
    if (expRes.error) throw expRes.error;
    if (tutorRes.error) throw tutorRes.error;
    if (studentRes.error) throw studentRes.error;
    const expRows = (expRes.data ?? []) as ExtraExpenseRow[];
    const mappedExtra: TxRow[] = expRows.map(r => ({ id: r.id, kind: 'expense', source: 'extra_expense', date: (r.occurred_on ?? r.created_at?.slice(0, 10) ?? isoToday()).slice(0, 10), amount: Number(r.amount) || 0, label: r.name, category: r.name, notes: r.notes ?? null }));
    const mappedTutor: TxRow[] = (tutorRes.data ?? []).map((p: any) => ({ id: p.id, kind: 'expense', source: 'tutor_payment', date: (p.paid_on ?? p.created_at ?? isoToday()).slice(0, 10), amount: Number(p.net_total) || 0, label: `Πληρωμή Καθηγητή: ${p?.tutors?.full_name ?? 'Καθηγητής'}`, category: 'Καθηγητές', notes: p.notes ?? null }));
    const mappedStudent: TxRow[] = ((studentRes.data as any[] | null) ?? []).map((p: any) => ({ id: p.id, kind: 'income', source: 'student_subscription', date: (p.paid_on ?? p.created_at ?? isoToday()).slice(0, 10), amount: Number(p.amount) || 0, label: `Συνδρομή: ${p?.students?.full_name ?? 'Μαθητής'}`, notes: p.notes ?? null }));
    return [...mappedStudent, ...mappedTutor, ...mappedExtra].sort((a, b) => a.date < b.date ? 1 : -1);
  }

  async function loadAll() {
    if (!schoolId) return;
    setLoading(true); setError(null);
    try { setTxRows(await loadForBounds(bounds.start, bounds.end)); }
    catch (e: any) { setError(e?.message ?? 'Κάτι πήγε στραβά.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, [schoolId, mode, month, year, rangeStart, rangeEnd]);

  const incomeTotal = useMemo(() => txRows.filter(r => r.kind === 'income').reduce((s, r) => s + (Number(r.amount) || 0), 0), [txRows]);
  const expenseTotal = useMemo(() => txRows.filter(r => r.kind === 'expense').reduce((s, r) => s + (Number(r.amount) || 0), 0), [txRows]);
  const netTotal = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal]);
  const incomeSeries = useMemo(() => buildSeriesForPeriod({ kind: 'income', rows: txRows, mode, year, month, start: bounds.start, end: bounds.end }), [txRows, mode, year, month, bounds.start, bounds.end]);
  const expenseSeries = useMemo(() => buildSeriesForPeriod({ kind: 'expense', rows: txRows, mode, year, month, start: bounds.start, end: bounds.end }), [txRows, mode, year, month, bounds.start, bounds.end]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    txRows.filter(r => r.kind === 'expense').forEach(r => { const k = r.category ?? (r.source === 'extra_expense' ? r.label?.trim() || 'Άλλο' : 'Καθηγητές'); map.set(k, (map.get(k) ?? 0) + (Number(r.amount) || 0)); });
    return Array.from(map.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [txRows]);

  const catTotalPages = useMemo(() => Math.max(1, Math.ceil(expenseByCategory.length / PAGE_SIZE)), [expenseByCategory.length]);
  const txTotalPages = useMemo(() => Math.max(1, Math.ceil(txRows.length / PAGE_SIZE)), [txRows.length]);
  useEffect(() => setCatPage(p => Math.min(p, catTotalPages)), [catTotalPages]);
  useEffect(() => setTxPage(p => Math.min(p, txTotalPages)), [txTotalPages]);
  const catPageRows = useMemo(() => { const s = (catPage - 1) * PAGE_SIZE; return expenseByCategory.slice(s, s + PAGE_SIZE); }, [expenseByCategory, catPage]);
  const txPageRows = useMemo(() => { const s = (txPage - 1) * PAGE_SIZE; return txRows.slice(s, s + PAGE_SIZE); }, [txRows, txPage]);

  async function addExtraExpense() {
    if (!schoolId || !user?.id) return;
    const name = expName.trim(); const amt = Number(expAmount) || 0;
    if (!name || amt <= 0) return;
    setBusy(true); setError(null);
    try {
      const payload: any = { school_id: schoolId, occurred_on: expDate || isoToday(), name, amount: amt, notes: expNotes.trim() || null, created_by: user.id };
      let ins: any = await supabase.from(EXTRA_EXPENSES_TABLE).insert(payload);
      if (ins.error && hasAll(ins.error, 'occurred_on', 'does not exist')) ins = await supabase.from(EXTRA_EXPENSES_TABLE).insert({ school_id: schoolId, name, amount: amt, notes: expNotes.trim() || null, created_by: user.id });
      if (ins.error) throw ins.error;
      setExpName(''); setExpAmount(0); setExpNotes(''); setExpDate(isoToday());
      await loadAll();
    } catch (e: any) { setError(e?.message ?? 'Αποτυχία προσθήκης εξόδου.'); }
    finally { setBusy(false); }
  }

  function openEditExpense(r: ExtraExpenseRow) {
    setEditing(r); setEditName(r.name); setEditAmount(Number(r.amount) || 0);
    setEditDate((r.occurred_on ?? r.created_at?.slice(0, 10) ?? isoToday()).slice(0, 10));
    setEditNotes(r.notes ?? ''); setEditOpen(true);
  }
  function closeEditExpense() { if (busy) return; setEditOpen(false); setEditing(null); }

  async function saveEditExpense() {
    if (!schoolId || !user?.id || !editing) return;
    const name = editName.trim(); const amt = Number(editAmount) || 0;
    if (!name || amt <= 0) return;
    setBusy(true); setError(null);
    try {
      const patch: any = { name, amount: amt, notes: editNotes.trim() || null };
      if (editDate) patch.occurred_on = editDate;
      let upd: any = await supabase.from(EXTRA_EXPENSES_TABLE).update(patch).eq('id', editing.id);
      if (upd.error && hasAll(upd.error, 'occurred_on', 'does not exist')) { const { occurred_on: _, ...rest } = patch; upd = await supabase.from(EXTRA_EXPENSES_TABLE).update(rest).eq('id', editing.id); }
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
      const { error: delErr } = await supabase.from(EXTRA_EXPENSES_TABLE).delete().eq('id', deleting.id);
      if (delErr) throw delErr;
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">

          {/* Income card */}
          <div className={sparkCardCls}>
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp className={`h-3.5 w-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}/>
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-emerald-500' : 'text-emerald-600'}`}>Έσοδα</span>
            </div>
            <div className={`text-3xl font-bold tracking-tight ${incomeAmountCls}`}>{money(incomeTotal)}</div>
            <div className="mt-4">
              <SparkArea id="spark-income" isDark={isDark} points={incomeSeries}
                stroke={isDark ? 'rgba(52,211,153,0.95)' : 'rgba(16,185,129,0.90)'}
                fillTop={isDark ? 'rgba(52,211,153,0.18)' : 'rgba(16,185,129,0.12)'}
                fillBottom="rgba(52,211,153,0.00)"/>
            </div>
          </div>

          {/* Expense card */}
          <div className={sparkCardCls}>
            <div className="mb-1 flex items-center gap-2">
              <TrendingDown className={`h-3.5 w-3.5 ${isDark ? 'text-rose-400' : 'text-rose-500'}`}/>
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-rose-500' : 'text-rose-600'}`}>Έξοδα</span>
            </div>
            <div className={`text-3xl font-bold tracking-tight ${expenseAmountCls}`}>{money(expenseTotal)}</div>
            <div className="mt-4">
              <SparkArea id="spark-expense" isDark={isDark} points={expenseSeries}
                stroke={isDark ? 'rgba(251,113,133,0.95)' : 'rgba(244,63,94,0.85)'}
                fillTop={isDark ? 'rgba(251,113,133,0.18)' : 'rgba(244,63,94,0.10)'}
                fillBottom="rgba(251,113,133,0.00)"/>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">

          {/* Net card */}
          <div className={sparkCardCls}>
            <div className="mb-1 flex items-center gap-2">
              <Wallet className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}/>
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Καθαρό</span>
            </div>
            <div className={`text-3xl font-bold tracking-tight ${netTotal >= 0 ? (isDark ? 'text-slate-100' : 'text-slate-800') : (isDark ? 'text-rose-400' : 'text-rose-600')}`}>{money(netTotal)}</div>
            <div className={`mt-5 border-t pt-4 ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
              <IncomeExpenseDonut income={incomeTotal} expense={expenseTotal} isDark={isDark}/>
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <EconomicsCategoryBreakdown
          expenseByCategory={expenseByCategory}
          catPageRows={catPageRows}
          catPage={catPage}
          catTotalPages={catTotalPages}
          onPrev={() => setCatPage(p => Math.max(1, p - 1))}
          onNext={() => setCatPage(p => Math.min(catTotalPages, p + 1))}
          isDark={isDark}
        />

        <EconomicsTransactionsCard
          txRows={txRows}
          txPageRows={txPageRows}
          txPage={txPage}
          txTotalPages={txTotalPages}
          onPrev={() => setTxPage(p => Math.max(1, p - 1))}
          onNext={() => setTxPage(p => Math.min(txTotalPages, p + 1))}
          isDark={isDark}
        />
      </div>

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
