// src/pages/economics/EconomicsAnalysisPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import {
  TrendingUp,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  ChevronDown,
} from 'lucide-react';
import AppDatePicker from '../../components/ui/AppDatePicker';
import ConfirmActionModal from '../../components/ui/ConfirmActionModal';

type Mode = 'month' | 'year' | 'range';
type TxKind = 'income' | 'expense';
type TxSource = 'student_subscription' | 'tutor_payment' | 'extra_expense';

type TxRow = {
  id: string;
  kind: TxKind;
  source: TxSource;
  date: string; // YYYY-MM-DD
  amount: number; // positive
  label: string;
  notes?: string | null;
  category?: string | null;
};

type ExtraExpenseRow = {
  id: string;
  school_id: string;
  occurred_on?: string | null;
  name: string;
  amount: number;
  notes?: string | null;
  created_at?: string;
  created_by?: string | null;
};

type Point = { label: string; value: number; title?: string };

const PAGE_SIZE = 10;

function money(n: number) {
  const v = Number(n) || 0;
  return `${v.toFixed(2)} €`;
}
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function clampNumber(v: string) {
  const n = Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, n);
}
function monthLabelEl(m: number) {
  const months = [
    'Ιανουάριος',
    'Φεβρουάριος',
    'Μάρτιος',
    'Απρίλιος',
    'Μάιος',
    'Ιούνιος',
    'Ιούλιος',
    'Αύγουστος',
    'Σεπτέμβριος',
    'Οκτώβριος',
    'Νοέμβριος',
    'Δεκέμβριος',
  ];
  return months[m - 1] ?? `Μήνας ${m}`;
}
function monthShortEl(m: number) {
  return monthLabelEl(m).slice(0, 3);
}
function startOfMonthISO(year: number, month: number) {
  return new Date(year, month - 1, 1).toISOString().slice(0, 10);
}
function endOfMonthISO(year: number, month: number) {
  return new Date(year, month, 0).toISOString().slice(0, 10);
}
function startOfYearISO(year: number) {
  return new Date(year, 0, 1).toISOString().slice(0, 10);
}
function endOfYearISO(year: number) {
  return new Date(year, 11, 31).toISOString().slice(0, 10);
}
function startOfDayTs(dateISO: string) {
  return `${dateISO}T00:00:00.000Z`;
}
function endOfDayTs(dateISO: string) {
  return `${dateISO}T23:59:59.999Z`;
}
function fmtDDMM(dateISO: string) {
  const [y, m, d] = dateISO.split('-');
  return `${d}/${m}`;
}
function toUTCDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00.000Z`);
}
function diffDaysInclusive(startISO: string, endISO: string) {
  const a = toUTCDate(startISO).getTime();
  const b = toUTCDate(endISO).getTime();
  const ms = Math.max(0, b - a);
  return Math.floor(ms / 86400000) + 1;
}
function addDaysISO(startISO: string, days: number) {
  const d = toUTCDate(startISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function errMsg(err: any) {
  return String(err?.message ?? err ?? '').toLowerCase();
}
function hasAll(err: any, ...parts: string[]) {
  const m = errMsg(err);
  return parts.every((p) => m.includes(p.toLowerCase()));
}
function hasAny(err: any, ...parts: string[]) {
  const m = errMsg(err);
  return parts.some((p) => m.includes(p.toLowerCase()));
}

/** -------------------------
 *  Custom dropdown (same style as Dashboard widget)
 *  ------------------------- */
function useOutsideClose(
  refs: Array<React.RefObject<HTMLElement | null>>,
  onClose: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside = refs.some((r) => r.current && r.current.contains(target));
      if (!inside) onClose();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled, onClose, refs]);
}

function DropdownShell({
  label,
  open,
  onToggle,
  children,
  widthClass,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`
          inline-flex items-center justify-between gap-2
          rounded-lg border border-white/10 bg-white/[0.04]
          px-3 py-2 text-[11px] text-white/80
          hover:bg-white/[0.06] transition
          ${widthClass ?? 'w-[150px]'}
        `}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className="text-white/60" />
      </button>

      {open && (
        <div
          className="
            absolute left-0 z-50 mt-2 w-full
            rounded-xl border border-white/10
            bg-[#0b1220]/95 backdrop-blur-xl
            shadow-xl overflow-hidden
          "
          role="dialog"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function SparkArea({
  points,
  stroke,
  fillTop,
  fillBottom,
  height = 112,
  id,
}: {
  points: Point[];
  stroke: string;
  fillTop: string;
  fillBottom: string;
  height?: number;
  id: string;
}) {
  const w = 520;
  const h = height;
  const padX = 12;
  const padY = 10;

  const vals = points.map((p) => Math.max(0, Number(p.value) || 0));
  const max = Math.max(1, ...vals);

  const n = Math.max(1, points.length);
  const xAt = (i: number) => {
    if (n === 1) return w / 2;
    return padX + (i * (w - padX * 2)) / (n - 1);
  };
  const yAt = (v: number) => {
    const usable = h - padY * 2;
    const y = h - padY - (Math.max(0, v) / max) * usable;
    return Math.max(padY, Math.min(h - padY, y));
  };
  const bottom = h - padY;

  const pts = points.map((p, i) => ({
    x: xAt(i),
    y: yAt(Number(p.value) || 0),
    p,
  }));
  const lineD =
    pts.length === 0
      ? ''
      : `M ${pts[0]!.x} ${pts[0]!.y} ` +
        pts
          .slice(1)
          .map((t) => `L ${t.x} ${t.y}`)
          .join(' ');

  const areaD =
    pts.length === 0
      ? ''
      : `M ${pts[0]!.x} ${bottom} L ${pts[0]!.x} ${pts[0]!.y} ` +
        pts
          .slice(1)
          .map((t) => `L ${t.x} ${t.y}`)
          .join(' ') +
        ` L ${pts[pts.length - 1]!.x} ${bottom} Z`;

  const labelIdx = useMemo(() => {
    if (points.length <= 1) return [0];
    const mid = Math.floor((points.length - 1) / 2);
    return Array.from(new Set([0, mid, points.length - 1]));
  }, [points.length]);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillTop} />
            <stop offset="100%" stopColor={fillBottom} />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((t) => {
          const y = padY + (h - padY * 2) * t;
          return (
            <line
              key={t}
              x1={padX}
              x2={w - padX}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.18)"
              strokeDasharray="4 5"
            />
          );
        })}

        {areaD ? <path d={areaD} fill={`url(#${id})`} /> : null}

        {lineD ? (
          <path
            d={lineD}
            fill="none"
            stroke={stroke}
            strokeWidth="2.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {pts.map((t, i) => (
          <circle
            key={i}
            cx={t.x}
            cy={t.y}
            r="3.8"
            fill={stroke}
            opacity="0.95"
          >
            <title>{t.p.title ?? `${t.p.label}: ${money(t.p.value)}`}</title>
          </circle>
        ))}
      </svg>

      <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-slate-400">
        {labelIdx.map((i) => (
          <span key={i}>{points[i]?.label ?? ''}</span>
        ))}
      </div>
    </div>
  );
}

function IncomeExpenseDonut({
  income,
  expense,
}: {
  income: number;
  expense: number;
}) {
  const inc = Math.max(0, Number(income) || 0);
  const exp = Math.max(0, Number(expense) || 0);
  const total = inc + exp;
  const incPct = total > 0 ? (inc / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-16 w-16 rounded-full border border-slate-800/80"
        style={{
          background:
            total > 0
              ? `conic-gradient(rgba(52,211,153,0.80) 0 ${incPct}%, rgba(251,113,133,0.80) ${incPct}% 100%)`
              : 'conic-gradient(rgba(148,163,184,0.25) 0 100%)',
        }}
        title="Έσοδα vs Έξοδα"
      >
        <div className="absolute inset-2 rounded-full border border-slate-800/80 bg-slate-950/60" />
      </div>

      <div className="text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
          <span className="text-slate-300">Έσοδα</span>
          <span className="font-semibold text-emerald-200">
            {money(inc)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-300/80" />
          <span className="text-slate-300">Έξοδα</span>
          <span className="font-semibold text-rose-200">{money(exp)}</span>
        </div>
      </div>
    </div>
  );
}

function getCurrentPeriod() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const STUDENT_INCOME_TABLE = 'student_subscription_payments';
const EXTRA_EXPENSES_TABLE = 'school_extra_expenses';

function buildSeriesForPeriod(args: {
  kind: TxKind;
  rows: TxRow[];
  mode: Mode;
  year: number;
  month: number;
  start: string;
  end: string;
}): Point[] {
  const { kind, rows, mode, year, month, start, end } = args;

  const only = rows.filter((r) => r.kind === kind);

  const byDay = new Map<string, number>();
  const byMonth = new Map<string, number>();

  for (const r of only) {
    const d = r.date.slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + (Number(r.amount) || 0));

    const ym = d.slice(0, 7);
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + (Number(r.amount) || 0));
  }

  if (mode === 'year') {
    const pts: Point[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const v = byMonth.get(key) ?? 0;
      pts.push({
        label: monthShortEl(m),
        value: v,
        title: `${monthLabelEl(m)} ${year}: ${money(v)}`,
      });
    }
    return pts;
  }

  if (mode === 'month') {
    const s = startOfMonthISO(year, month);
    const e = endOfMonthISO(year, month);
    const days = diffDaysInclusive(s, e);

    const pts: Point[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDaysISO(s, i);
      const v = byDay.get(d) ?? 0;
      pts.push({ label: fmtDDMM(d), value: v, title: `${d}: ${money(v)}` });
    }
    return pts;
  }

  const days = diffDaysInclusive(start, end);

  if (days <= 31) {
    const pts: Point[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDaysISO(start, i);
      const v = byDay.get(d) ?? 0;
      pts.push({ label: fmtDDMM(d), value: v, title: `${d}: ${money(v)}` });
    }
    return pts;
  }

  if (days <= 120) {
    const weeks = Math.ceil(days / 7);
    const pts: Point[] = [];

    for (let w = 0; w < weeks; w++) {
      const ws = addDaysISO(start, w * 7);
      const we = addDaysISO(start, Math.min(days - 1, w * 7 + 6));

      let sum = 0;
      const bucketDays = diffDaysInclusive(ws, we);
      for (let i = 0; i < bucketDays; i++) {
        const d = addDaysISO(ws, i);
        sum += byDay.get(d) ?? 0;
      }

      pts.push({
        label: fmtDDMM(ws),
        value: sum,
        title: `${ws} → ${we}: ${money(sum)}`,
      });
    }
    return pts;
  }

  const pts: Point[] = [];
  const startYM = start.slice(0, 7);
  const endYM = end.slice(0, 7);

  let curY = Number(startYM.slice(0, 4));
  let curM = Number(startYM.slice(5, 7));

  while (true) {
    const key = `${curY}-${String(curM).padStart(2, '0')}`;
    const v = byMonth.get(key) ?? 0;

    pts.push({
      label: monthShortEl(curM),
      value: v,
      title: `${key}: ${money(v)}`,
    });

    if (key === endYM) break;
    curM++;
    if (curM === 13) {
      curM = 1;
      curY++;
    }
  }

  return pts;
}

export default function EconomicsAnalysisPage() {
  const { user, profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const { year: currentYear, month: currentMonth } = getCurrentPeriod();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);

  // Custom dropdown open state + refs (month/year)
  const [openMonth, setOpenMonth] = useState(false);
  const [openYear, setOpenYear] = useState(false);
  const monthWrapRef = useRef<HTMLDivElement | null>(null);
  const yearWrapRef = useRef<HTMLDivElement | null>(null);

  useOutsideClose(
    [monthWrapRef, yearWrapRef],
    () => {
      setOpenMonth(false);
      setOpenYear(false);
    },
    openMonth || openYear,
  );

  const [rangeStart, setRangeStart] = useState<string>(
    startOfMonthISO(currentYear, currentMonth),
  );
  const [rangeEnd, setRangeEnd] = useState<string>(isoToday());

  // Extra expense form
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState<string>(isoToday());
  const [expNotes, setExpNotes] = useState('');

  // Data
  const [txRows, setTxRows] = useState<TxRow[]>([]);
  const [extraExpenses, setExtraExpenses] = useState<ExtraExpenseRow[]>([]);

  // Pagination
  const [catPage, setCatPage] = useState(1);
  const [txPage, setTxPage] = useState(1);

  // Edit extra expense modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ExtraExpenseRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>(isoToday());
  const [editNotes, setEditNotes] = useState('');

  // Delete confirm modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<ExtraExpenseRow | null>(null);

  const monthsOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: monthLabelEl(i + 1),
      })),
    [],
  );

  // ✅ rolling ±10 years based on current real year (each new year stays correct)
  const yearsOptions = useMemo(() => {
    const base = new Date().getFullYear();
    const start = base - 10;
    const end = base + 10;

    return Array.from({ length: end - start + 1 }, (_, i) => {
      const yy = start + i;
      return { value: yy, label: String(yy) };
    });
  }, []);

  function getBounds() {
    if (mode === 'month') {
      return {
        start: startOfMonthISO(year, month),
        end: endOfMonthISO(year, month),
      };
    }
    if (mode === 'year') {
      return { start: startOfYearISO(year), end: endOfYearISO(year) };
    }
    return { start: rangeStart || isoToday(), end: rangeEnd || isoToday() };
  }

  const bounds = useMemo(
    () => getBounds(),
    [mode, month, year, rangeStart, rangeEnd],
  );

  // reset pagination on filter changes
  useEffect(() => {
    setCatPage(1);
    setTxPage(1);
  }, [schoolId, mode, month, year, rangeStart, rangeEnd]);

  async function safeTutorPayments(start: string, end: string) {
    let res: any = await supabase
      .from('tutor_payments')
      .select(
        'id, school_id, tutor_id, net_total, paid_on, notes, created_at, status, tutors(full_name)',
      )
      .eq('school_id', schoolId!)
      .eq('status', 'paid')
      .gte('paid_on', start)
      .lte('paid_on', end)
      .order('paid_on', { ascending: false })
      .limit(500);

    if (
      res.error &&
      (hasAny(res.error, 'relationship') ||
        hasAny(res.error, 'foreign key'))
    ) {
      res = await supabase
        .from('tutor_payments')
        .select('id, school_id, tutor_id, net_total, paid_on, notes, created_at, status')
        .eq('school_id', schoolId!)
        .eq('status', 'paid')
        .gte('paid_on', start)
        .lte('paid_on', end)
        .order('paid_on', { ascending: false })
        .limit(500);
    }

    if (res.error && hasAll(res.error, 'paid_on', 'does not exist')) {
      res = await supabase
        .from('tutor_payments')
        .select('id, school_id, tutor_id, net_total, notes, created_at, status')
        .eq('school_id', schoolId!)
        .eq('status', 'paid')
        .gte('created_at', startOfDayTs(start))
        .lte('created_at', endOfDayTs(end))
        .order('created_at', { ascending: false })
        .limit(500);
    }

    return res;
  }

  async function safeStudentIncomes(start: string, end: string) {
    let res: any = await supabase
      .from(STUDENT_INCOME_TABLE)
      .select(
        'id, school_id, amount, paid_on, notes, created_at, student_id, students(full_name)',
      )
      .eq('school_id', schoolId!)
      .gte('paid_on', start)
      .lte('paid_on', end)
      .order('paid_on', { ascending: false })
      .limit(800);

    if (res.error && hasAll(res.error, 'student_id', 'does not exist')) {
      res = await supabase
        .from(STUDENT_INCOME_TABLE)
        .select('id, school_id, amount, paid_on, notes, created_at, students(full_name)')
        .eq('school_id', schoolId!)
        .gte('paid_on', start)
        .lte('paid_on', end)
        .order('paid_on', { ascending: false })
        .limit(800);
    }

    if (
      res.error &&
      hasAny(res.error, 'relationship', 'foreign key', 'schema cache')
    ) {
      res = await supabase
        .from(STUDENT_INCOME_TABLE)
        .select('id, school_id, amount, paid_on, notes, created_at')
        .eq('school_id', schoolId!)
        .gte('paid_on', start)
        .lte('paid_on', end)
        .order('paid_on', { ascending: false })
        .limit(800);
    }

    if (res.error && hasAll(res.error, 'paid_on', 'does not exist')) {
      res = await supabase
        .from(STUDENT_INCOME_TABLE)
        .select('id, school_id, amount, notes, created_at')
        .eq('school_id', schoolId!)
        .gte('created_at', startOfDayTs(start))
        .lte('created_at', endOfDayTs(end))
        .order('created_at', { ascending: false })
        .limit(800);
    }

    return res;
  }

  async function safeExtraExpenses(start: string, end: string) {
    let res: any = await supabase
      .from(EXTRA_EXPENSES_TABLE)
      .select(
        'id, school_id, occurred_on, name, amount, notes, created_at, created_by',
      )
      .eq('school_id', schoolId!)
      .gte('occurred_on', start)
      .lte('occurred_on', end)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(800);

    if (res.error && hasAll(res.error, 'occurred_on', 'does not exist')) {
      res = await supabase
        .from(EXTRA_EXPENSES_TABLE)
        .select('id, school_id, name, amount, notes, created_at, created_by')
        .eq('school_id', schoolId!)
        .gte('created_at', startOfDayTs(start))
        .lte('created_at', endOfDayTs(end))
        .order('created_at', { ascending: false })
        .limit(800);
    }

    return res as { data: ExtraExpenseRow[] | null; error: any };
  }

  async function loadForBounds(start: string, end: string) {
    if (!schoolId) return [];

    const expRes = await safeExtraExpenses(start, end);
    if (expRes.error) throw expRes.error;

    const tutorRes = await safeTutorPayments(start, end);
    if (tutorRes.error) throw tutorRes.error;

    const studentRes = await safeStudentIncomes(start, end);
    if (studentRes.error) throw studentRes.error;

    const expRows = (expRes.data ?? []) as ExtraExpenseRow[];
    const tutorRows = tutorRes.data ?? [];
    const studentRows = studentRes.data ?? [];

    setExtraExpenses(expRows);

    const mappedExtra: TxRow[] = expRows.map((r) => {
      const date = (
        r.occurred_on ??
        r.created_at?.slice(0, 10) ??
        isoToday()
      ).slice(0, 10);
      return {
        id: r.id,
        kind: 'expense',
        source: 'extra_expense',
        date,
        amount: Number(r.amount) || 0,
        label: r.name,
        category: r.name,
        notes: r.notes ?? null,
      };
    });

    const mappedTutor: TxRow[] = (tutorRows as any[]).map((p) => {
      const name = p?.tutors?.full_name ?? 'Καθηγητής';
      const date = (p.paid_on ?? p.created_at ?? isoToday()).slice(0, 10);
      return {
        id: p.id,
        kind: 'expense',
        source: 'tutor_payment',
        date,
        amount: Number(p.net_total) || 0,
        label: `Πληρωμή Καθηγητή: ${name}`,
        category: 'Καθηγητές',
        notes: p.notes ?? null,
      };
    });

    const mappedStudent: TxRow[] = ((studentRes.data as any[] | null) ??
      []).map((p: any) => {
      const name = p?.students?.full_name ?? 'Μαθητής';
      const date = (p.paid_on ?? p.created_at ?? isoToday()).slice(0, 10);
      return {
        id: p.id,
        kind: 'income',
        source: 'student_subscription',
        date,
        amount: Number(p.amount) || 0,
        label: `Συνδρομή: ${name}`,
        notes: p.notes ?? null,
      };
    });

    return [...mappedStudent, ...mappedTutor, ...mappedExtra].sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
  }

  async function loadAll() {
    if (!schoolId) return;

    setLoading(true);
    setError(null);

    try {
      const rows = await loadForBounds(bounds.start, bounds.end);
      setTxRows(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Κάτι πήγε στραβά.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, mode, month, year, rangeStart, rangeEnd]);

  const incomeTotal = useMemo(
    () =>
      txRows
        .filter((r) => r.kind === 'income')
        .reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [txRows],
  );
  const expenseTotal = useMemo(
    () =>
      txRows
        .filter((r) => r.kind === 'expense')
        .reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [txRows],
  );
  const netTotal = useMemo(
    () => incomeTotal - expenseTotal,
    [incomeTotal, expenseTotal],
  );

  const incomeSeries = useMemo(
    () =>
      buildSeriesForPeriod({
        kind: 'income',
        rows: txRows,
        mode,
        year,
        month,
        start: bounds.start,
        end: bounds.end,
      }),
    [txRows, mode, year, month, bounds.start, bounds.end],
  );

  const expenseSeries = useMemo(
    () =>
      buildSeriesForPeriod({
        kind: 'expense',
        rows: txRows,
        mode,
        year,
        month,
        start: bounds.start,
        end: bounds.end,
      }),
    [txRows, mode, year, month, bounds.start, bounds.end],
  );

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    txRows
      .filter((r) => r.kind === 'expense')
      .forEach((r) => {
        const key =
          r.category ??
          (r.source === 'extra_expense'
            ? r.label?.trim() || 'Άλλο'
            : 'Καθηγητές');
        map.set(key, (map.get(key) ?? 0) + (Number(r.amount) || 0));
      });

    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [txRows]);

  // Pagination
  const catTotalPages = useMemo(
    () => Math.max(1, Math.ceil(expenseByCategory.length / PAGE_SIZE)),
    [expenseByCategory.length],
  );
  const txTotalPages = useMemo(
    () => Math.max(1, Math.ceil(txRows.length / PAGE_SIZE)),
    [txRows.length],
  );

  useEffect(() => setCatPage((p) => Math.min(p, catTotalPages)), [catTotalPages]);
  useEffect(() => setTxPage((p) => Math.min(p, txTotalPages)), [txTotalPages]);

  const catPageRows = useMemo(() => {
    const start = (catPage - 1) * PAGE_SIZE;
    return expenseByCategory.slice(start, start + PAGE_SIZE);
  }, [expenseByCategory, catPage]);

  const txPageRows = useMemo(() => {
    const start = (txPage - 1) * PAGE_SIZE;
    return txRows.slice(start, start + PAGE_SIZE);
  }, [txRows, txPage]);

  async function addExtraExpense() {
    if (!schoolId || !user?.id) return;

    const name = expName.trim();
    const amt = Number(expAmount) || 0;
    if (!name || amt <= 0) return;

    setBusy(true);
    setError(null);

    try {
      const payload: any = {
        school_id: schoolId,
        occurred_on: expDate || isoToday(),
        name,
        amount: amt,
        notes: expNotes.trim() ? expNotes.trim() : null,
        created_by: user.id,
      };

      let ins: any = await supabase.from(EXTRA_EXPENSES_TABLE).insert(payload);

      if (ins.error && hasAll(ins.error, 'occurred_on', 'does not exist')) {
        const fallbackPayload = {
          school_id: schoolId,
          name,
          amount: amt,
          notes: expNotes.trim() ? expNotes.trim() : null,
          created_by: user.id,
        };
        ins = await supabase.from(EXTRA_EXPENSES_TABLE).insert(fallbackPayload);
      }

      if (ins.error) throw ins.error;

      setExpName('');
      setExpAmount(0);
      setExpNotes('');
      setExpDate(isoToday());

      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία προσθήκης εξόδου.');
    } finally {
      setBusy(false);
    }
  }

  function openEditExpense(r: ExtraExpenseRow) {
    setEditing(r);
    setEditName(r.name);
    setEditAmount(Number(r.amount) || 0);
    setEditDate(
      (
        r.occurred_on ??
        r.created_at?.slice(0, 10) ??
        isoToday()
      ).slice(0, 10),
    );
    setEditNotes(r.notes ?? '');
    setEditOpen(true);
  }

  function closeEditExpense() {
    if (busy) return;
    setEditOpen(false);
    setEditing(null);
  }

  async function saveEditExpense() {
    if (!schoolId || !user?.id || !editing) return;

    const name = editName.trim();
    const amt = Number(editAmount) || 0;
    if (!name || amt <= 0) return;

    setBusy(true);
    setError(null);

    try {
      const patch: any = {
        name,
        amount: amt,
        notes: editNotes.trim() ? editNotes.trim() : null,
      };

      if (editDate) patch.occurred_on = editDate;

      let upd: any = await supabase
        .from(EXTRA_EXPENSES_TABLE)
        .update(patch)
        .eq('id', editing.id);

      if (upd.error && hasAll(upd.error, 'occurred_on', 'does not exist')) {
        const { occurred_on: _drop, ...withoutOccurredOn } = patch;
        upd = await supabase
          .from(EXTRA_EXPENSES_TABLE)
          .update(withoutOccurredOn)
          .eq('id', editing.id);
      }

      if (upd.error) throw upd.error;

      closeEditExpense();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setBusy(false);
    }
  }

  function askDeleteExpense(r: ExtraExpenseRow) {
    setDeleting(r);
    setDeleteOpen(true);
  }

  function closeDeleteExpense() {
    if (busy) return;
    setDeleteOpen(false);
    setDeleting(null);
  }

  async function confirmDeleteExpense() {
    if (!deleting) return;

    setBusy(true);
    setError(null);

    try {
      const { error: delErr } = await supabase
        .from(EXTRA_EXPENSES_TABLE)
        .delete()
        .eq('id', deleting.id);
      if (delErr) throw delErr;

      closeDeleteExpense();
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? 'Αποτυχία διαγραφής.');
    } finally {
      setBusy(false);
    }
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
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-amber-300" />
          <h1 className="text-lg font-semibold text-slate-50">
            Ανάλυση Οικονομικών
          </h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
            <CalendarDays className="h-4 w-4 text-slate-300" />
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="rounded-md border border-slate-700/80 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
            >
              <option value="month">Μηνιαία</option>
              <option value="year">Ετήσια</option>
              <option value="range">Εύρος ημερομηνιών</option>
            </select>
          </div>

          {/* ✅ Month mode: custom dropdowns */}
          {mode === 'month' ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
              <div ref={monthWrapRef}>
                <DropdownShell
                  label={monthLabelEl(month)}
                  open={openMonth}
                  onToggle={() => {
                    setOpenYear(false);
                    setOpenMonth((v) => !v);
                  }}
                  widthClass="w-[150px]"
                >
                  <div className="max-h-72 overflow-auto p-1">
                    {monthsOptions.map((m) => {
                      const active = m.value === month;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setMonth(m.value);
                            setOpenMonth(false);
                          }}
                          className={`
                            w-full text-left px-3 py-2 text-[11px]
                            rounded-lg transition
                            ${active ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/8'}
                          `}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </DropdownShell>
              </div>

              <div ref={yearWrapRef}>
                <DropdownShell
                  label={String(year)}
                  open={openYear}
                  onToggle={() => {
                    setOpenMonth(false);
                    setOpenYear((v) => !v);
                  }}
                  widthClass="w-[86px]"
                >
                  <div className="max-h-72 overflow-auto p-1">
                    {yearsOptions.map((y) => {
                      const active = y.value === year;
                      return (
                        <button
                          key={y.value}
                          type="button"
                          onClick={() => {
                            setYear(y.value);
                            setOpenYear(false);
                          }}
                          className={`
                            w-full text-left px-3 py-2 text-[11px]
                            rounded-lg transition
                            ${active ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/8'}
                          `}
                        >
                          {y.label}
                        </button>
                      );
                    })}
                  </div>
                </DropdownShell>
              </div>
            </div>
          ) : null}

          {/* ✅ Year mode: custom dropdown */}
          {mode === 'year' ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
              <div ref={yearWrapRef}>
                <DropdownShell
                  label={String(year)}
                  open={openYear}
                  onToggle={() => {
                    setOpenMonth(false);
                    setOpenYear((v) => !v);
                  }}
                  widthClass="w-[86px]"
                >
                  <div className="max-h-72 overflow-auto p-1">
                    {yearsOptions.map((y) => {
                      const active = y.value === year;
                      return (
                        <button
                          key={y.value}
                          type="button"
                          onClick={() => {
                            setYear(y.value);
                            setOpenYear(false);
                          }}
                          className={`
                            w-full text-left px-3 py-2 text-[11px]
                            rounded-lg transition
                            ${active ? 'bg-white/10 text-white' : 'text-white/85 hover:bg-white/8'}
                          `}
                        >
                          {y.label}
                        </button>
                      );
                    })}
                  </div>
                </DropdownShell>
              </div>
            </div>
          ) : null}

          {mode === 'range' ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2">
              <div className="text-[11px] font-semibold text-slate-300">
                Από
              </div>
              <div className="min-w-[170px]">
                <AppDatePicker
                  value={rangeStart as any}
                  onChange={(v: any) => setRangeStart(v)}
                />
              </div>

              <div className="text-[11px] font-semibold text-slate-300">
                Έως
              </div>
              <div className="min-w-[170px]">
                <AppDatePicker
                  value={rangeEnd as any}
                  onChange={(v: any) => setRangeEnd(v)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {/* TOP */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT */}
        <div className="space-y-4 lg:col-span-8">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-5">
            <div className="text-xs font-semibold text-slate-400">Έσοδα</div>
            <div className="mt-1 text-4xl font-semibold text-emerald-200">
              {money(incomeTotal)}
            </div>
            <div className="mt-3">
              <SparkArea
                id="spark-income"
                points={incomeSeries}
                stroke="rgba(52,211,153,0.95)"
                fillTop="rgba(52,211,153,0.22)"
                fillBottom="rgba(52,211,153,0.00)"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-5">
            <div className="text-xs font-semibold text-slate-400">Έξοδα</div>
            <div className="mt-1 text-4xl font-semibold text-rose-200">
              {money(expenseTotal)}
            </div>
            <div className="mt-3">
              <SparkArea
                id="spark-expense"
                points={expenseSeries}
                stroke="rgba(251,113,133,0.95)"
                fillTop="rgba(251,113,133,0.22)"
                fillBottom="rgba(251,113,133,0.00)"
              />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-5">
            <div className="text-xs font-semibold text-slate-400">Καθαρό</div>
            <div
              className={[
                'mt-1 text-4xl font-semibold',
                netTotal >= 0 ? 'text-slate-100' : 'text-rose-200',
              ].join(' ')}
            >
              {money(netTotal)}
            </div>
            <div className="mt-4">
              <IncomeExpenseDonut
                income={incomeTotal}
                expense={expenseTotal}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold text-slate-100">
              Extra Έξοδα
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <div className="text-[11px] font-semibold text-slate-300">
                  Όνομα εξόδου
                </div>
                <input
                  value={expName}
                  onChange={(e) => setExpName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  placeholder="π.χ. Ενοίκιο / ΔΕΗ / Internet"
                  disabled={busy}
                />
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-5">
                  <div className="text-[11px] font-semibold text-slate-300">
                    Ποσό
                  </div>
                  <input
                    value={expAmount}
                    onChange={(e) => setExpAmount(clampNumber(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                    inputMode="decimal"
                    disabled={busy}
                  />
                </div>

                <div className="col-span-7">
                  <div className="text-[11px] font-semibold text-slate-300">
                    Ημερομηνία
                  </div>
                  <div className="mt-1">
                    <AppDatePicker
                      value={expDate as any}
                      onChange={(v: any) => setExpDate(v)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300">
                  Σημειώσεις
                </div>
                <input
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  placeholder="προαιρετικό"
                  disabled={busy}
                />
              </div>

              <button
                type="button"
                onClick={addExtraExpense}
                disabled={
                  busy ||
                  !expName.trim() ||
                  (Number(expAmount) || 0) <= 0
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-950/45 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Προσθήκη
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: category + transactions */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-100">
              Έξοδα ανά κατηγορία
            </div>

            {expenseByCategory.length > PAGE_SIZE ? (
              <div className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => setCatPage((p) => Math.max(1, p - 1))}
                  disabled={catPage <= 1}
                  className="rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1 font-semibold text-slate-200 hover:bg-slate-800/50 disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="font-semibold">
                  {catPage} / {catTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCatPage((p) => Math.min(catTotalPages, p + 1))
                  }
                  disabled={catPage >= catTotalPages}
                  className="rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1 font-semibold text-slate-200 hover:bg-slate-800/50 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {expenseByCategory.length === 0 ? (
              <div className="text-sm text-slate-400">
                Δεν υπάρχουν έξοδα στο φίλτρο.
              </div>
            ) : (
              catPageRows.map((c) => {
                const max = Math.max(
                  1,
                  ...expenseByCategory.map((x) => x.amount),
                );
                const w = Math.round((c.amount / max) * 100);

                return (
                  <div
                    key={c.category}
                    className="rounded-lg border border-slate-800/80 bg-slate-950/30 px-3 py-2"
                  >
                    <div className="flex items-center justify-between text-[12px]">
                      <div className="font-semibold text-slate-100">
                        {c.category}
                      </div>
                      <div className="text-slate-300">{money(c.amount)}</div>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-slate-900/60">
                      <div
                        className="h-2 rounded-full bg-rose-400/70"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {expenseByCategory.length > PAGE_SIZE ? (
            <div className="mt-3 text-[11px] text-slate-500">
              Εμφάνιση{' '}
              {Math.min(
                expenseByCategory.length,
                (catPage - 1) * PAGE_SIZE + 1,
              )}
              –
              {Math.min(expenseByCategory.length, catPage * PAGE_SIZE)} από{' '}
              {expenseByCategory.length}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 lg:col-span-8">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-100">
              Κινήσεις (έσοδα / έξοδα)
            </div>

            {txRows.length > PAGE_SIZE ? (
              <div className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  disabled={txPage <= 1}
                  className="rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1 font-semibold text-slate-200 hover:bg-slate-800/50 disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="font-semibold">
                  {txPage} / {txTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                  disabled={txPage >= txTotalPages}
                  className="rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1 font-semibold text-slate-200 hover:bg-slate-800/50 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-800/80">
            <div className="grid grid-cols-12 bg-slate-900/60 px-3 py-2 text-[11px] font-semibold text-slate-300">
              <div className="col-span-2">Ημερομηνία</div>
              <div className="col-span-2">Τύπος</div>
              <div className="col-span-6">Περιγραφή</div>
              <div className="col-span-2 text-right">Ποσό</div>
            </div>

            {txRows.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-400">
                Δεν υπάρχουν κινήσεις στο φίλτρο.
              </div>
            ) : (
              txPageRows.map((r) => (
                <div
                  key={`${r.source}-${r.id}`}
                  className="grid grid-cols-12 items-center border-t border-slate-900/60 px-3 py-2 text-sm text-slate-100"
                >
                  <div className="col-span-2 text-[12px] text-slate-200">
                    {r.date}
                  </div>

                  <div className="col-span-2">
                    <span
                      className={[
                        'inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold',
                        r.kind === 'income'
                          ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-200'
                          : 'border-rose-900/60 bg-rose-950/30 text-rose-200',
                      ].join(' ')}
                    >
                      {r.kind === 'income' ? 'Έσοδο' : 'Έξοδο'}
                    </span>
                  </div>

                  <div className="col-span-6 text-[12px] text-slate-300">
                    {r.label}
                    {r.notes ? (
                      <span className="text-slate-500"> — {r.notes}</span>
                    ) : null}
                  </div>

                  <div
                    className={[
                      'col-span-2 text-right text-[12px] font-semibold',
                      r.kind === 'income'
                        ? 'text-emerald-200'
                        : 'text-rose-200',
                    ].join(' ')}
                  >
                    {r.kind === 'income' ? '+' : '-'} {money(r.amount)}
                  </div>
                </div>
              ))
            )}
          </div>

          {txRows.length > PAGE_SIZE ? (
            <div className="mt-3 text-[11px] text-slate-500">
              Εμφάνιση{' '}
              {Math.min(txRows.length, (txPage - 1) * PAGE_SIZE + 1)}–
              {Math.min(txRows.length, txPage * PAGE_SIZE)} από {txRows.length}
            </div>
          ) : null}
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmActionModal
        open={deleteOpen}
        title="Διαγραφή εξόδου"
        message={
          <div className="text-slate-200">
            Σίγουρα θέλετε να διαγράψετε το έξοδο{' '}
            <span className="font-semibold text-slate-50">
              {deleting
                ? `${deleting.name} (${(
                    deleting.occurred_on ??
                    deleting.created_at?.slice(0, 10) ??
                    isoToday()
                  ).slice(0, 10)})`
                : '—'}
            </span>
            ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
          </div>
        }
        confirmLabel="Διαγραφή"
        cancelLabel="Ακύρωση"
        confirmColor="red"
        busy={busy}
        onClose={closeDeleteExpense}
        onConfirm={confirmDeleteExpense}
      />

      {/* Edit modal */}
      {editOpen && editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-50">
                  Επεξεργασία Εξόδου
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  Ενημέρωση ονόματος / ποσού / ημερομηνίας / σημειώσεων.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditExpense}
                className="inline-flex items-center justify-center rounded-md border border-slate-700/70 bg-slate-900/40 p-2 text-slate-200 hover:bg-slate-800/50"
                title="Κλείσιμο"
                disabled={busy}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="text-[11px] font-semibold text-slate-300">
                  Όνομα εξόδου
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  disabled={busy}
                />
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300">
                  Ποσό
                </div>
                <input
                  value={editAmount}
                  onChange={(e) =>
                    setEditAmount(clampNumber(e.target.value))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  inputMode="decimal"
                  disabled={busy}
                />
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-300">
                  Ημερομηνία
                </div>
                <div className="mt-1">
                  <AppDatePicker
                    value={editDate as any}
                    onChange={(v: any) => setEditDate(v)}
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-[11px] font-semibold text-slate-300">
                  Σημειώσεις
                </div>
                <input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                  disabled={busy}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditExpense}
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
                onClick={saveEditExpense}
                disabled={
                  busy || !editName.trim() || (Number(editAmount) || 0) <= 0
                }
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
