// src/pages/StudentCardPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Phone, Mail, Calendar,
  FileText, Layers, Pencil, Loader2, CheckCircle2, Lock,
  Users, BookOpen, UserCheck, AlertCircle, ChevronLeft, ChevronRight,
  GraduationCap, TrendingUp, Wallet, Receipt, BarChart3, HandCoins,
  Banknote, CreditCard, Landmark, Tag, Ban, Plus, Trash2,
  Copy, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient.ts';
import { useAuth } from '../auth.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import DatePickerField from '../components/ui/AppDatePicker.tsx';
import type { StudentRow, LevelRow, SubscriptionRow, ClassEnrollment, ProgramSlot } from '../components/students/types.ts';
import { STUDENT_SELECT, formatDateToGreek, isoToDisplay, displayToIso } from '../components/students/types.ts';
import type { StudentGradeRow } from '../components/grades/types.ts';
import { StudentSlotModal } from '../components/students/StudentSlotModal';
import { computeAccruedCharges, type ChargeOverrideRow } from '../components/students/chargeUtils';

// ── Constants ──────────────────────────────────────────────────────────────

const DAYS = [
  { value: 'monday', label: 'Δευτέρα', js: 1 },
  { value: 'tuesday', label: 'Τρίτη', js: 2 },
  { value: 'wednesday', label: 'Τετάρτη', js: 3 },
  { value: 'thursday', label: 'Πέμπτη', js: 4 },
  { value: 'friday', label: 'Παρασκευή', js: 5 },
  { value: 'saturday', label: 'Σάββατο', js: 6 },
  { value: 'sunday', label: 'Κυριακή', js: 0 },
];

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];

const CLASS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const PAYMENTS_PER_PAGE = 5;
const UNIFIED_HISTORY_PER_PAGE = 10;

const DAY_LABEL: Record<string, string> = {
  monday: 'Δευτέρα', tuesday: 'Τρίτη', wednesday: 'Τετάρτη',
  thursday: 'Πέμπτη', friday: 'Παρασκευή', saturday: 'Σάββατο', sunday: 'Κυριακή',
};

type PaymentRow = { id: string; subscription_id: string; amount: number; created_at: string | null; payment_method?: string | null; cancelled_at?: string | null; notes?: string | null };

type ExtraChargeRow = { id: string; description: string; amount: number; notes: string | null; created_at: string; cancelled_at: string | null };
type ExtraChargePaymentRow = { id: string; charge_id: string; amount: number; payment_method: string; created_at: string; cancelled_at: string | null };

type LessonPaymentRow = { id: string; amount: number; payment_method: string | null; note: string | null; created_at: string; cancelled_at: string | null };
type LessonHistoryEntry =
  | { kind: 'charge'; date: string; amount: number; label: string }
  | { kind: 'payment'; date: string; amount: number; label: string; payment: LessonPaymentRow }
  | { kind: 'extra_charge'; date: string; amount: number; label: string; chargeId: string }
  | { kind: 'extra_payment'; date: string; amount: number; label: string; paymentId: string; method: string; chargeLabel: string };

type UnifiedHistoryEntry =
  | { kind: 'sub_charge'; date: string; ts: string; amount: number; label: string; subId: string; subStatus: SubscriptionRow['status'] }
  | { kind: 'extra_charge'; date: string; ts: string; amount: number; label: string; chargeId: string; cancelled: boolean }
  | { kind: 'payment'; source: 'subscription'; date: string; ts: string; amount: number; method: string | null; cancelled: boolean; paymentId: string; notes?: string | null }
  | { kind: 'payment'; source: 'extra_charge'; date: string; ts: string; amount: number; method: string; cancelled: boolean; paymentId: string; chargeLabel: string };

type CalendarTest = {
  id: string;
  test_date: string;
  title: string | null;
  class_id: string;
  class_title: string;
  start_time: string | null;
  end_time: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt12(t: string | null): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = Number(hStr); const m = Number(mStr ?? 0);
  const period = h < 12 ? 'πμ' : 'μμ';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDateLong(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const dayLabel = DAYS.find(x => x.js === d.getDay())?.label ?? '';
  return `${dayLabel} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// Monday-first grid index (Mon=0 … Sun=6)
const jsToGrid = (js: number) => (js === 0 ? 6 : js - 1);

// ── Calendar ───────────────────────────────────────────────────────────────

function MonthCalendar({ slots, tests, holidayDates, isDark }: { slots: ProgramSlot[]; tests: CalendarTest[]; holidayDates: Set<string>; isDark: boolean }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(toISODate(today));

  const uniqueClasses = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; title: string; subject: string | null }[] = [];
    slots.forEach(s => { if (!seen.has(s.class_id)) { seen.add(s.class_id); out.push({ id: s.class_id, title: s.class_title, subject: s.class_subject }); } });
    return out;
  }, [slots]);

  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    uniqueClasses.forEach((c, i) => m.set(c.id, CLASS_COLORS[i % CLASS_COLORS.length]));
    return m;
  }, [uniqueClasses]);

  const slotsByJsDay = useMemo(() => {
    const m = new Map<number, ProgramSlot[]>();
    slots.forEach(s => {
      const d = DAYS.find(d => d.value === s.day_of_week);
      if (!d) return;
      if (!m.has(d.js)) m.set(d.js, []);
      m.get(d.js)!.push(s);
    });
    return m;
  }, [slots]);

  const testsByDate = useMemo(() => {
    const m = new Map<string, CalendarTest[]>();
    tests.forEach(t => {
      if (!t.test_date) return;
      if (!m.has(t.test_date)) m.set(t.test_date, []);
      m.get(t.test_date)!.push(t);
    });
    return m;
  }, [tests]);

  const todayStr = toISODate(today);
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startPad = jsToGrid(firstOfMonth.getDay());

  const cells: { date: Date; current: boolean }[] = [];
  for (let i = startPad - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= lastOfMonth.getDate(); d++)
    cells.push({ date: new Date(year, month, d), current: true });
  while (cells.length < 42)
    cells.push({ date: new Date(year, month + 1, cells.length - startPad - lastOfMonth.getDate() + 1), current: false });

  const selJsDay = selected ? new Date(selected + 'T12:00:00').getDay() : -1;
  const selSlots = (slotsByJsDay.get(selJsDay) ?? []).filter(s => {
    if (s.start_date && selected < s.start_date) return false;
    if (s.end_date && selected > s.end_date) return false;
    return true;
  }).sort((a, b) => {
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });
  const selTests = testsByDate.get(selected) ?? [];

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function next() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(toISODate(today)); }

  const border = isDark ? 'border-slate-700/50' : 'border-slate-200';
  const cellBorder = isDark ? 'border-slate-800/50' : 'border-slate-100';
  const headerBg = isDark ? 'bg-slate-900/60' : 'bg-slate-50';
  const navBtnCls = `flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'}`;
  const abbrev = (t: string) => t.length > 13 ? t.slice(0, 12) + '…' : t;

  return (
    <div className={`rounded-xl border overflow-hidden ${border} ${isDark ? 'bg-slate-900/30' : 'bg-white'}`}>

      {/* ── Navigation ── */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${border} ${headerBg}`}>
        <button type="button" onClick={prev} className={navBtnCls}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className={`flex-1 text-center text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button type="button" onClick={goToday}
          className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
          Σήμερα
        </button>
        <button type="button" onClick={next} className={navBtnCls}>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Day headers ── */}
      <div className={`grid grid-cols-7 border-b ${border} ${isDark ? 'bg-slate-900/40' : 'bg-slate-50/80'}`}>
        {['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ'].map((h, i) => (
          <div key={i} className={`py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const dStr = toISODate(cell.date);
          const jsDay = cell.date.getDay();
          const daySlots = cell.current
            ? (slotsByJsDay.get(jsDay) ?? []).filter(s => {
                if (s.start_date && dStr < s.start_date) return false;
                if (s.end_date && dStr > s.end_date) return false;
                return true;
              })
            : [];
          const dayTests = cell.current ? (testsByDate.get(dStr) ?? []) : [];
          const isToday = dStr === todayStr;
          const isSel = dStr === selected;
          const isHoliday = cell.current && holidayDates.has(dStr);
          const col = i % 7;
          const row = Math.floor(i / 7);

          return (
            <button key={i} type="button" onClick={() => setSelected(dStr)}
              className={[
                'relative flex flex-col items-stretch p-1 text-left transition-colors',
                col < 6 ? `border-r ${cellBorder}` : '',
                row < 5 ? `border-b ${cellBorder}` : '',
                isSel
                  ? isDark ? 'bg-[color:var(--color-accent)]/[0.08]' : 'bg-blue-50/60'
                  : isHoliday
                    ? isDark ? 'bg-red-950/20 hover:bg-red-950/30' : 'bg-red-50/60 hover:bg-red-50'
                    : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80',
              ].filter(Boolean).join(' ')}
              style={{ minHeight: '62px' }}>

              {/* Holiday stripe */}
              {isHoliday && (
                <span className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r-full bg-red-400/50" />
              )}

              {/* Date number */}
              <div className="flex justify-center mb-0.5">
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full text-[12px] transition',
                    isSel ? 'font-bold text-white'
                      : isToday ? 'font-bold'
                      : isHoliday ? isDark ? 'text-red-400' : 'text-red-500'
                      : cell.current ? isDark ? 'text-slate-200' : 'text-slate-700'
                      : isDark ? 'text-slate-700' : 'text-slate-300',
                  ].join(' ')}
                  style={
                    isSel ? { background: 'var(--color-accent)' }
                      : isToday ? { color: 'var(--color-accent)', outline: '2px solid var(--color-accent)', outlineOffset: '-2px' }
                      : undefined
                  }>
                  {cell.date.getDate()}
                </span>
              </div>

              {/* Class pills */}
              <div className="flex flex-col gap-px">
                {daySlots.slice(0, 2).map(s => (
                  <div key={s.id}
                    className="rounded-[3px] px-1 leading-[14px] text-[8.5px] font-semibold truncate"
                    style={isHoliday
                      ? { background: 'rgba(239,68,68,0.12)', color: isDark ? '#fca5a5' : '#b91c1c', border: '1px solid rgba(239,68,68,0.25)', opacity: 0.85 }
                      : { background: colorOf.get(s.class_id) ?? 'var(--color-accent)', color: '#fff' }}>
                    {abbrev(s.class_title)}
                  </div>
                ))}
                {dayTests.length > 0 && (
                  <div className="rounded-[3px] px-1 leading-[14px] text-[8.5px] font-bold truncate"
                    style={{ background: 'rgba(245,158,11,0.15)', color: isDark ? '#fbbf24' : '#b45309', border: '1px solid rgba(245,158,11,0.3)' }}>
                    Διαγ.
                  </div>
                )}
                {daySlots.length > 2 && (
                  <span className={`text-[8px] text-center leading-[14px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    +{daySlots.length - 2}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Legend ── */}
      {uniqueClasses.length > 0 && (
        <div className={`flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 border-t ${border} ${isDark ? 'bg-slate-900/40' : 'bg-slate-50/80'}`}>
          {uniqueClasses.map(c => (
            <div key={c.id} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colorOf.get(c.id) }} />
              <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.title}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0 bg-amber-400" />
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Διαγώνισμα</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0 bg-red-400/60" />
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Αργία</span>
          </div>
        </div>
      )}

      {/* ── Selected day panel ── */}
      <div className={`border-t ${border}`}>
        <div className={`flex items-center justify-between px-3.5 py-2.5 ${headerBg}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className={`h-3 w-3 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <span className={`text-[11px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {selected ? fmtDateLong(selected) : '—'}
            </span>
            {selected && holidayDates.has(selected) && (
              <span className="shrink-0 rounded-full border border-red-400/40 bg-red-400/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-red-400">
                Αργία
              </span>
            )}
          </div>
          {(selSlots.length > 0 || selTests.length > 0) && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
              {selSlots.length + selTests.length}
            </span>
          )}
        </div>

        {selSlots.length > 0 || selTests.length > 0 ? (
          <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {selSlots.map(slot => {
              const selIsHoliday = selected ? holidayDates.has(selected) : false;
              return (
              <div key={slot.id} className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${isDark ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50/80'}`}
                style={selIsHoliday ? { opacity: 0.7 } : undefined}>
                <div className="w-0.5 self-stretch rounded-full shrink-0"
                  style={{ background: selIsHoliday ? 'rgba(239,68,68,0.5)' : (colorOf.get(slot.class_id) ?? 'var(--color-accent)'), minHeight: '32px' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-semibold leading-snug ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{slot.class_title}</p>
                    {selIsHoliday && (
                      <span className={`text-[8px] font-bold ${isDark ? 'text-red-400' : 'text-red-500'}`}>ΑΡΓΙΑ</span>
                    )}
                  </div>
                  {slot.class_subject && (
                    <p className={`text-[10px] leading-tight mt-px ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{slot.class_subject}</p>
                  )}
                </div>
                {slot.start_time && (
                  <div className="shrink-0 text-right">
                    <p className={`text-[11px] tabular-nums font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt12(slot.start_time)}</p>
                    {slot.end_time && <p className={`text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmt12(slot.end_time)}</p>}
                  </div>
                )}
              </div>
              );
            })}
            {selTests.map(test => (
              <div key={test.id} className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${isDark ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50/80'}`}>
                <div className="w-0.5 self-stretch rounded-full bg-amber-400 shrink-0" style={{ minHeight: '32px' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`inline-flex rounded px-1 py-px text-[8px] font-bold tracking-wide shrink-0 ${isDark ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>ΔΙΑΓ</span>
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{test.title ?? 'Διαγώνισμα'}</p>
                  </div>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{test.class_title}</p>
                </div>
                {test.start_time && (
                  <div className="shrink-0 text-right">
                    <p className={`text-[11px] tabular-nums font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt12(test.start_time)}</p>
                    {test.end_time && <p className={`text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmt12(test.end_time)}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`flex items-center gap-2.5 px-3.5 py-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <p className="text-[11px]">Χωρίς δραστηριότητα για αυτή τη μέρα</p>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Shared field components ────────────────────────────────────────────────

function CopyButton({ text, isDark }: { text: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" title="Αντιγραφή"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className={`ml-1 shrink-0 rounded p-0.5 transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function ReadField({ label, value, isDark, copyable }: { label: string; value: string | null | undefined; isDark: boolean; copyable?: boolean }) {
  return (
    <div>
      <div className={`mb-0.5 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
      <div className={`flex items-center rounded-lg border px-2.5 py-1.5 text-xs ${isDark ? 'border-slate-700/40 bg-slate-900/30 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        {value?.trim() ? (
          <>
            <span className="flex-1 truncate">{value}</span>
            {copyable && <CopyButton text={value} isDark={isDark} />}
          </>
        ) : (
          <span className={isDark ? 'italic text-slate-600' : 'italic text-slate-400'}>—</span>
        )}
      </div>
    </div>
  );
}

function EditField({ label, icon, children, isDark }: { label: string; icon?: React.ReactNode; children: React.ReactNode; isDark: boolean }) {
  return (
    <div className="space-y-1">
      <label className={`flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {icon && <span className="opacity-60">{icon}</span>}{label}
      </label>
      {children}
    </div>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────

function DashCard({ title, icon, isDark, onEdit, editing, onAdd, children }: {
  title: string; icon: React.ReactNode; isDark: boolean;
  onEdit?: () => void; editing?: boolean;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${isDark
      ? 'border-slate-700/50 bg-slate-950/40 backdrop-blur-sm ring-1 ring-inset ring-white/[0.04]'
      : 'border-slate-200 bg-white shadow-sm'}`}>
      <div className="flex shrink-0 items-center justify-between px-4 py-3" style={{ background: 'var(--ch-bg)', borderBottom: '1px solid var(--ch-divider)' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--ch-icon)' }}>{icon}</span>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ch-text)' }}>{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {onAdd && (
            <button type="button" onClick={onAdd}
              className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition"
              style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
              <Plus className="h-2.5 w-2.5" />Προσθήκη
            </button>
          )}
          {onEdit && !editing && (
            <button type="button" onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-medium transition"
              style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
              <Pencil className="h-2.5 w-2.5" />Επεξεργασία
            </button>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────────────────

function StatTile({ label, value, color, isDark }: { label: string; value: string; color: 'green' | 'red' | 'blue' | 'neutral'; isDark: boolean }) {
  const bg = { green: isDark ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50', red: isDark ? 'border-rose-500/30 bg-rose-950/30' : 'border-rose-200 bg-rose-50', blue: isDark ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-blue-50', neutral: isDark ? 'border-slate-700/50 bg-slate-900/30' : 'border-slate-200 bg-slate-50' };
  const vc = { green: isDark ? 'text-emerald-300' : 'text-emerald-700', red: isDark ? 'text-rose-300' : 'text-rose-700', blue: isDark ? 'text-blue-300' : 'text-blue-700', neutral: isDark ? 'text-slate-200' : 'text-slate-700' };
  return (
    <div className={`rounded-xl border px-3 py-2 ${bg[color]}`}>
      <p className={`text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-sm font-bold tabular-nums ${vc[color]}`}>{value}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function StudentCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [classes, setClasses] = useState<ClassEnrollment[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ProgramSlot[]>([]);
  const [calendarTests, setCalendarTests] = useState<CalendarTest[]>([]);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [grades, setGrades] = useState<StudentGradeRow[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [unifiedHistoryPage, setUnifiedHistoryPage] = useState(0);

  // frontistiria payment modal
  const [subPayModalOpen, setSubPayModalOpen] = useState(false);
  const [subPayMethod, setSubPayMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [subPayNote, setSubPayNote] = useState('');
  const [paymentInput, setPaymentInput] = useState('');
  const [payingLoading, setPayingLoading] = useState(false);
  const [payingError, setPayingError] = useState<string | null>(null);
  const [cancellingPaymentId, setCancellingPaymentId] = useState<string | null>(null);

  const [editingStudent, setEditingStudent] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [studentSuccess, setStudentSuccess] = useState(false);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [levelId, setLevelId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [editingParents, setEditingParents] = useState(false);
  const [savingParents, setSavingParents] = useState(false);
  const [parentsError, setParentsError] = useState<string | null>(null);
  const [parentsSuccess, setParentsSuccess] = useState(false);
  const [fatherName, setFatherName] = useState('');
  const [fatherDob, setFatherDob] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [fatherEmail, setFatherEmail] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherDob, setMotherDob] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [motherEmail, setMotherEmail] = useState('');

  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotDeleting, setSlotDeleting] = useState<string | null>(null);
  const [subjectNameMap, setSubjectNameMap] = useState<Map<string, string>>(new Map());

  // idiaitera: per-session charges + private lesson payments
  const [lessonOverrides, setLessonOverrides] = useState<ChargeOverrideRow[]>([]);
  const [lessonPayments, setLessonPayments] = useState<LessonPaymentRow[]>([]);
  const [lessonPayModalOpen, setLessonPayModalOpen] = useState(false);
  const [lessonPaymentAmount, setLessonPaymentAmount] = useState('');
  const [lessonPaymentMethod, setLessonPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [lessonPaymentNote, setLessonPaymentNote] = useState('');
  const [lessonPaymentSaving, setLessonPaymentSaving] = useState(false);
  const [lessonPaymentError, setLessonPaymentError] = useState<string | null>(null);
  const [cancellingLessonPaymentId, setCancellingLessonPaymentId] = useState<string | null>(null);
  const [lessonHistoryPage, setLessonHistoryPage] = useState(0);

  // extra charges (all account types)
  const [extraCharges, setExtraCharges] = useState<ExtraChargeRow[]>([]);
  const [extraChargePayments, setExtraChargePayments] = useState<ExtraChargePaymentRow[]>([]);
  const [addChargeOpen, setAddChargeOpen] = useState(false);
  const [newChargeDesc, setNewChargeDesc] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [newChargeNotes, setNewChargeNotes] = useState('');
  const [addChargeSaving, setAddChargeSaving] = useState(false);
  const [addChargeError, setAddChargeError] = useState<string | null>(null);
  const [payingExtraChargeId, setPayingExtraChargeId] = useState<string | null>(null);
  const [extraPayAmount, setExtraPayAmount] = useState('');
  const [extraPayMethod, setExtraPayMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [extraPaySaving, setExtraPaySaving] = useState(false);
  const [cancellingExtraChargeId, setCancellingExtraChargeId] = useState<string | null>(null);
  const [cancellingExtraPaymentId, setCancellingExtraPaymentId] = useState<string | null>(null);

  const [histContextMenu, setHistContextMenu] = useState<{ x: number; y: number; entry: UnifiedHistoryEntry } | null>(null);
  const [confirmCancelEntry, setConfirmCancelEntry] = useState<UnifiedHistoryEntry | null>(null);
  const [confirmCancelling, setConfirmCancelling] = useState(false);

  const [lessonContextMenu, setLessonContextMenu] = useState<{ x: number; y: number; entry: LessonHistoryEntry } | null>(null);
  const [confirmCancelLessonEntry, setConfirmCancelLessonEntry] = useState<LessonHistoryEntry | null>(null);
  const [confirmCancelLessonRunning, setConfirmCancelLessonRunning] = useState(false);

  const inputCls = `h-8 w-full rounded-lg border px-2.5 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const cancelBtnCls = `btn border px-3 py-1.5 text-xs disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`;

  const levelNameById = useMemo(() => new Map(levels.map(l => [l.id, l.name])), [levels]);
  const isIdiaiterou = profile?.account_type === 'idiaiterou';

  const activeSub = useMemo(() => subscriptions.find(s => s.status === 'active') ?? null, [subscriptions]);
  const totalCharged = useMemo(() => subscriptions.reduce((a, s) => a + Number(s.charge_amount ?? s.price ?? 0), 0), [subscriptions]);
  // Use view-computed paid_amount so totalPaid stays consistent with totalBalance (both from the same DB view)
  const totalPaid = useMemo(() => subscriptions.reduce((a, s) => a + Number((s as any).paid_amount ?? 0), 0), [subscriptions]);
  const totalBalance = useMemo(() => subscriptions.reduce((a, s) => a + Math.max(0, Number(s.balance ?? 0)), 0), [subscriptions]);
  const hasBalanceData = activeSub && activeSub.balance != null;
  const owes = hasBalanceData && totalBalance > 0;

  // idiaitera: accrued session charges (computed, not stored) + payment history
  const accruedCharges = useMemo(() => {
    if (!isIdiaiterou) return [];
    const items = scheduleSlots
      .filter(s => s.charge_per_session != null)
      .map(s => ({ id: s.id, day_of_week: s.day_of_week, start_date: s.start_date, end_date: s.end_date, charge_per_session: s.charge_per_session ?? null, subject_id: null }));
    return computeAccruedCharges(items, lessonOverrides, holidayDates, toISODate(new Date()));
  }, [isIdiaiterou, scheduleSlots, lessonOverrides, holidayDates]);

  const lessonTotalCharged = useMemo(() =>
    accruedCharges.reduce((a, c) => a + c.amount, 0) +
    extraCharges.filter(c => !c.cancelled_at).reduce((a, c) => a + Number(c.amount), 0),
    [accruedCharges, extraCharges]);
  const lessonTotalPaid = useMemo(() =>
    lessonPayments.filter(p => !p.cancelled_at).reduce((a, p) => a + Number(p.amount), 0) +
    extraChargePayments.filter(p => !p.cancelled_at).reduce((a, p) => a + Number(p.amount), 0),
    [lessonPayments, extraChargePayments]);
  const lessonBalance = lessonTotalCharged - lessonTotalPaid;

  const lessonHistory = useMemo<LessonHistoryEntry[]>(() => {
    const slotById = new Map(scheduleSlots.map(s => [s.id, s]));
    const entries: LessonHistoryEntry[] = [];
    accruedCharges.forEach(c => entries.push({ kind: 'charge', date: c.date, amount: c.amount, label: slotById.get(c.programItemId)?.class_title ?? 'Μάθημα' }));
    lessonPayments.filter(p => !p.cancelled_at).forEach(p => entries.push({ kind: 'payment', date: p.created_at.slice(0, 10), amount: Number(p.amount), label: 'Πληρωμή', payment: p }));
    extraCharges.filter(c => !c.cancelled_at).forEach(c => entries.push({ kind: 'extra_charge', date: c.created_at.slice(0, 10), amount: Number(c.amount), label: c.description, chargeId: c.id }));
    extraChargePayments.filter(p => !p.cancelled_at).forEach(p => {
      const chargeLabel = extraCharges.find(c => c.id === p.charge_id)?.description ?? 'Πρόσθετη χρέωση';
      entries.push({ kind: 'extra_payment', date: p.created_at.slice(0, 10), amount: Number(p.amount), label: `Πληρωμή: ${chargeLabel}`, paymentId: p.id, method: p.payment_method, chargeLabel });
    });
    return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [accruedCharges, lessonPayments, scheduleSlots, extraCharges, extraChargePayments]);

  const lessonHistoryPageCount = Math.max(1, Math.ceil(lessonHistory.length / UNIFIED_HISTORY_PER_PAGE));
  const lessonHistoryPageRows = lessonHistory.slice(lessonHistoryPage * UNIFIED_HISTORY_PER_PAGE, (lessonHistoryPage + 1) * UNIFIED_HISTORY_PER_PAGE);

  // ── Combined stats (subscriptions + extra charges) ─────────────────────────
  const totalChargedCombined = useMemo(() =>
    subscriptions.reduce((a, s) => a + Number(s.charge_amount ?? s.price ?? 0), 0) +
    extraCharges.filter(c => !c.cancelled_at).reduce((a, c) => a + Number(c.amount), 0),
    [subscriptions, extraCharges]);
  const totalPaidCombined = useMemo(() =>
    subscriptions.reduce((a, s) => a + Number((s as any).paid_amount ?? 0), 0) +
    extraChargePayments.filter(p => !p.cancelled_at).reduce((a, p) => a + Number(p.amount), 0),
    [subscriptions, extraChargePayments]);
  const totalBalanceCombined = useMemo(() => Math.max(0, totalChargedCombined - totalPaidCombined), [totalChargedCombined, totalPaidCombined]);

  const unifiedHistory = useMemo<UnifiedHistoryEntry[]>(() => {
    const entries: UnifiedHistoryEntry[] = [];
    subscriptions.forEach(sub => {
      entries.push({ kind: 'sub_charge', date: sub.starts_on ?? sub.created_at?.slice(0, 10) ?? '', ts: sub.created_at ?? '', amount: Number(sub.charge_amount ?? sub.price ?? 0), label: sub.package_name ?? 'Συνδρομή', subId: sub.id, subStatus: sub.status });
    });
    extraCharges.forEach(c => {
      entries.push({ kind: 'extra_charge', date: c.created_at.slice(0, 10), ts: c.created_at, amount: Number(c.amount), label: c.description, chargeId: c.id, cancelled: !!c.cancelled_at });
    });
    payments.forEach(p => {
      entries.push({ kind: 'payment', source: 'subscription', date: p.created_at?.slice(0, 10) ?? '', ts: p.created_at ?? '', amount: Number(p.amount), method: p.payment_method ?? null, cancelled: !!p.cancelled_at, paymentId: p.id, notes: p.notes });
    });
    extraChargePayments.forEach(p => {
      const label = extraCharges.find(c => c.id === p.charge_id)?.description ?? 'Πρόσθετη χρέωση';
      entries.push({ kind: 'payment', source: 'extra_charge', date: p.created_at.slice(0, 10), ts: p.created_at, amount: Number(p.amount), method: p.payment_method, cancelled: !!p.cancelled_at, paymentId: p.id, chargeLabel: label });
    });
    const all = entries.sort((a, b) => a.date !== b.date ? (a.date < b.date ? 1 : -1) : (a.ts < b.ts ? 1 : -1));
    return all.filter(e => {
      if (e.kind === 'sub_charge') return e.subStatus !== 'canceled';
      if (e.kind === 'extra_charge') return !e.cancelled;
      if (e.kind === 'payment') return !e.cancelled;
      return true;
    });
  }, [subscriptions, extraCharges, payments, extraChargePayments]);

  const unifiedHistoryPageCount = Math.max(1, Math.ceil(unifiedHistory.length / UNIFIED_HISTORY_PER_PAGE));
  const unifiedHistoryPageRows = unifiedHistory.slice(unifiedHistoryPage * UNIFIED_HISTORY_PER_PAGE, (unifiedHistoryPage + 1) * UNIFIED_HISTORY_PER_PAGE);


  useEffect(() => {
    if (!id || !schoolId) return;
    const load = async () => {
      setLoading(true);
      await supabase.rpc('run_subscription_expiry', { p_school_id: schoolId });
      const [stuRes, lvlRes, subRes, csRes, progRes] = await Promise.all([
        supabase.from('students').select(STUDENT_SELECT).eq('id', id).eq('school_id', schoolId).maybeSingle(),
        supabase.from('levels').select('id, school_id, name, created_at').eq('school_id', schoolId).order('name'),
        supabase.from('student_subscriptions_with_totals')
          .select('id, school_id, student_id, package_id, package_name, price, currency, status, starts_on, ends_on, created_at, balance, paid_amount, charge_amount, notes, plan_id, period_month, discount_pct')
          .eq('student_id', id).eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('class_students').select('class_id').eq('student_id', id).eq('school_id', schoolId),
        supabase.from('programs').select('id').eq('school_id', schoolId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
      ]);
      if (stuRes.error || !stuRes.data) { setNotFound(true); setLoading(false); return; }
      const s = stuRes.data as StudentRow;
      setStudent(s); populateStudentForm(s); populateParentsForm(s);
      setLevels((lvlRes.data ?? []) as LevelRow[]);
      const subs = (subRes.data ?? []) as SubscriptionRow[];
      const subIds = subs.map(s => s.id);
      if (subIds.length > 0) {
        const [{ data: payData }, { data: drData }] = await Promise.all([
          supabase.from('student_subscription_payments')
            .select('id, subscription_id, amount, created_at, payment_method, cancelled_at, notes')
            .eq('school_id', schoolId).in('subscription_id', subIds)
            .order('created_at', { ascending: false }),
          supabase.from('student_subscriptions').select('id, discount_reason').in('id', subIds),
        ]);
        setPayments((payData ?? []) as PaymentRow[]);
        const drMap = new Map((drData ?? []).map((r: any) => [r.id, r.discount_reason]));
        for (const sub of subs) { (sub as any).discount_reason = drMap.get(sub.id) ?? null; }
      }
      if (!subRes.error) setSubscriptions([...subs]);
      const classIds = (csRes.data ?? []).map((r: any) => r.class_id as string).filter(Boolean);
      const programId = (progRes.data as any)?.id;

      // Fetch class details separately to avoid unreliable embedded-join resolution
      const classInfoMap = new Map<string, { title: string; subject: string | null }>();
      const classEnrollments: ClassEnrollment[] = [];
      if (classIds.length > 0) {
        const { data: classData } = await supabase.from('classes')
          .select('id, title, subject').eq('school_id', schoolId).in('id', classIds);
        (classData ?? []).forEach((c: any) => {
          classInfoMap.set(c.id, { title: c.title, subject: c.subject ?? null });
          classEnrollments.push({ class_id: c.id, classes: { id: c.id, title: c.title, subject: c.subject ?? null } });
        });
      }
      setClasses(classEnrollments);

      if (classIds.length > 0 && programId) {
        const { data: itemData, error: itemErr } = await supabase
          .from('program_items').select('id, class_id, day_of_week, start_time, end_time, start_date, end_date')
          .eq('program_id', programId).in('class_id', classIds);
        if (!itemErr) {
          setScheduleSlots((itemData ?? []).map((item: any) => ({
            id: item.id, class_id: item.class_id,
            class_title: classInfoMap.get(item.class_id)?.title ?? '—',
            class_subject: classInfoMap.get(item.class_id)?.subject ?? null,
            day_of_week: item.day_of_week, start_time: item.start_time, end_time: item.end_time,
            start_date: item.start_date ?? null, end_date: item.end_date ?? null,
          })));
        }
      }

      if (profile?.account_type === 'idiaiterou') {
        const { data: subjData } = await supabase.from('subjects').select('id, name');
        const subMap = new Map((subjData ?? []).map((sub: any) => [sub.id, sub.name as string]));
        setSubjectNameMap(subMap);

        const { data: studentSlotData } = await supabase
          .from('program_items')
          .select('id, student_id, subject_id, day_of_week, start_time, end_time, start_date, end_date, charge_per_session')
          .eq('student_id', id!);
        if (studentSlotData) {
          setScheduleSlots(studentSlotData.map((item: any) => ({
            id: item.id,
            class_id: (item.subject_id ?? s.id) as string,
            class_title: (item.subject_id ? subMap.get(item.subject_id) : null) ?? s.full_name,
            class_subject: null,
            day_of_week: item.day_of_week,
            start_time: item.start_time ?? null,
            end_time: item.end_time ?? null,
            start_date: item.start_date ?? null,
            end_date: item.end_date ?? null,
            charge_per_session: item.charge_per_session ?? null,
          })));
          const slotIds = studentSlotData.map((item: any) => item.id as string);
          if (slotIds.length > 0) {
            const { data: overrideData } = await supabase
              .from('program_item_overrides')
              .select('program_item_id, override_date, is_deleted, is_inactive, holiday_active_override, charge_amount')
              .in('program_item_id', slotIds);
            setLessonOverrides((overrideData ?? []) as ChargeOverrideRow[]);
          }
        }

        const { data: lessonPaymentData } = await supabase
          .from('private_lesson_payments')
          .select('id, amount, payment_method, note, created_at, cancelled_at')
          .eq('student_id', id!)
          .order('created_at', { ascending: false });
        setLessonPayments((lessonPaymentData ?? []) as LessonPaymentRow[]);
      }

      if (classIds.length > 0) {
        const { data: testsData } = await supabase
          .from('tests').select('id, class_id, test_date, start_time, end_time, title')
          .eq('school_id', schoolId).in('class_id', classIds);
        if (testsData) {
          setCalendarTests(testsData.map((t: any) => ({
            id: t.id, test_date: t.test_date, title: t.title,
            class_id: t.class_id, class_title: classInfoMap.get(t.class_id)?.title ?? '—',
            start_time: t.start_time, end_time: t.end_time,
          })));
        }
      }

      const { data: holidaysData } = await supabase
        .from('school_holidays').select('date').eq('school_id', schoolId);
      if (holidaysData) setHolidayDates(new Set((holidaysData as { date: string }[]).map(h => h.date)));

      setGradesLoading(true);
      const { data: gradesData } = await supabase
        .from('student_test_grades')
        .select('id, student_id, test_id, test_name, test_date, start_time, end_time, class_title, subject_id, subject_name, grade, graded_at')
        .eq('school_id', schoolId).eq('student_id', id)
        .order('test_date', { ascending: false });
      if (gradesData) setGrades(gradesData as StudentGradeRow[]);
      setGradesLoading(false);

      // Load extra charges for all account types
      const { data: ecData } = await supabase
        .from('student_extra_charges')
        .select('id, description, amount, notes, created_at, cancelled_at')
        .eq('student_id', id).eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      const loadedCharges = (ecData ?? []) as ExtraChargeRow[];
      setExtraCharges(loadedCharges);
      if (loadedCharges.length > 0) {
        const chargeIds = loadedCharges.map(c => c.id);
        const { data: ecpData } = await supabase
          .from('student_extra_charge_payments')
          .select('id, charge_id, amount, payment_method, created_at, cancelled_at')
          .in('charge_id', chargeIds)
          .order('created_at', { ascending: false });
        setExtraChargePayments((ecpData ?? []) as ExtraChargePaymentRow[]);
      }

      setLoading(false);
    };
    load();
  }, [id, schoolId]);

  const reloadSubsAndPayments = async (): Promise<{ subs: SubscriptionRow[]; pays: PaymentRow[] }> => {
    if (!id || !schoolId) return { subs: [], pays: [] };
    const { data: subData } = await supabase
      .from('student_subscriptions_with_totals')
      .select('id, school_id, student_id, package_id, package_name, price, currency, status, starts_on, ends_on, created_at, balance, paid_amount, charge_amount, notes, plan_id, period_month, discount_pct')
      .eq('student_id', id).eq('school_id', schoolId).order('created_at', { ascending: false });
    const subs = (subData ?? []) as SubscriptionRow[];
    let pays: PaymentRow[] = [];
    const subIds = subs.map(s => s.id);
    if (subIds.length > 0) {
      const [{ data: payData }, { data: drData }] = await Promise.all([
        supabase.from('student_subscription_payments')
          .select('id, subscription_id, amount, created_at, payment_method, cancelled_at, notes')
          .eq('school_id', schoolId).in('subscription_id', subIds)
          .order('created_at', { ascending: false }),
        supabase.from('student_subscriptions').select('id, discount_reason').in('id', subIds),
      ]);
      pays = (payData ?? []) as PaymentRow[];
      setPayments(pays);
      const drMap = new Map((drData ?? []).map((r: any) => [r.id, r.discount_reason]));
      for (const sub of subs) { (sub as any).discount_reason = drMap.get(sub.id) ?? null; }
    }
    setSubscriptions([...subs]);
    return { subs, pays };
  };

  const submitPayment = async () => {
    if (!schoolId || !activeSub) return;
    const amount = Number(paymentInput.replace(',', '.'));
    if (!paymentInput.trim() || Number.isNaN(amount) || amount <= 0) {
      setPayingError('Συμπληρώστε έγκυρο ποσό.');
      return;
    }
    setPayingLoading(true);
    setPayingError(null);
    const { error } = await supabase.from('student_subscription_payments')
      .insert({ school_id: schoolId, subscription_id: activeSub.id, amount: Number(amount.toFixed(2)), payment_method: subPayMethod, notes: subPayNote.trim() || null });
    setPayingLoading(false);
    if (error) { setPayingError('Αποτυχία καταχώρησης πληρωμής.'); return; }
    setPaymentInput('');
    setSubPayNote('');
    setSubPayModalOpen(false);
    await reloadSubsAndPayments();
  };

  const cancelPayment = async (paymentId: string) => {
    setCancellingPaymentId(paymentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await supabase.functions.invoke('student-subscription-payment-cancel', {
        body: { payment_id: paymentId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.error) throw new Error(res.error.message ?? 'Error');
      // Reload from DB — refreshes subscriptions (view-computed balance/paid) and payments
      const { subs, pays } = await reloadSubsAndPayments();
      // Sync open modal with the freshly loaded view data so all stats match
      setPaymentModal(prev => {
        if (!prev) return null;
        const subId = prev.row.sub.id;
        const freshSub = subs.find(s => s.id === subId);
        const freshPays = pays.filter(p => p.subscription_id === subId);
        const allStudentPayments = [...pays].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
        return {
          ...prev,
          row: {
            ...prev.row,
            sub: freshSub ?? prev.row.sub,
            payments: freshPays as any,
            paid: Number((freshSub as any)?.paid_amount ?? 0),
            balance: Number(freshSub?.balance ?? prev.row.balance),
          },
          allStudentPayments,
        };
      });
    } catch (err: any) {
      console.error('Cancel payment error:', err?.message);
    } finally {
      setCancellingPaymentId(null);
    }
  };

  // ── idiaitera: private lesson payments (direct table access, no subscription/view involved) ──
  const addLessonPayment = async () => {
    if (!schoolId || !id) return;
    const amount = Number(lessonPaymentAmount.replace(',', '.'));
    if (!lessonPaymentAmount.trim() || Number.isNaN(amount) || amount <= 0) {
      setLessonPaymentError('Συμπληρώστε έγκυρο ποσό.');
      return;
    }
    setLessonPaymentSaving(true);
    setLessonPaymentError(null);
    const { data, error } = await supabase
      .from('private_lesson_payments')
      .insert({ school_id: schoolId, student_id: id, amount: Number(amount.toFixed(2)), payment_method: lessonPaymentMethod, note: lessonPaymentNote.trim() || null })
      .select('id, amount, payment_method, note, created_at, cancelled_at')
      .maybeSingle();
    setLessonPaymentSaving(false);
    if (error || !data) {
      setLessonPaymentError('Αποτυχία καταχώρησης πληρωμής.');
      return;
    }
    setLessonPayments(prev => [data as LessonPaymentRow, ...prev]);
    setLessonPaymentAmount(''); setLessonPaymentNote(''); setLessonHistoryPage(0);
    setLessonPayModalOpen(false);
  };

  const cancelLessonPayment = async (paymentId: string) => {
    setCancellingLessonPaymentId(paymentId);
    const { error } = await supabase
      .from('private_lesson_payments')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', paymentId);
    setCancellingLessonPaymentId(null);
    if (error) { setLessonPaymentError('Αποτυχία ακύρωσης πληρωμής.'); return; }
    setLessonPayments(prev => prev.map(p => (p.id === paymentId ? { ...p, cancelled_at: new Date().toISOString() } : p)));
  };

  // ── Extra charges ──────────────────────────────────────────────────────────

  const reloadExtraCharges = async () => {
    if (!id || !schoolId) return;
    const { data: ecData } = await supabase
      .from('student_extra_charges')
      .select('id, description, amount, notes, created_at, cancelled_at')
      .eq('student_id', id).eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    const charges = (ecData ?? []) as ExtraChargeRow[];
    setExtraCharges(charges);
    if (charges.length > 0) {
      const chargeIds = charges.map(c => c.id);
      const { data: ecpData } = await supabase
        .from('student_extra_charge_payments')
        .select('id, charge_id, amount, payment_method, created_at, cancelled_at')
        .in('charge_id', chargeIds)
        .order('created_at', { ascending: false });
      setExtraChargePayments((ecpData ?? []) as ExtraChargePaymentRow[]);
    } else {
      setExtraChargePayments([]);
    }
  };

  const addExtraCharge = async () => {
    if (!schoolId || !id) return;
    const amt = Number(newChargeAmount.replace(',', '.'));
    if (!newChargeDesc.trim() || !newChargeAmount.trim() || Number.isNaN(amt) || amt <= 0) {
      setAddChargeError('Συμπληρώστε περιγραφή και έγκυρο ποσό.');
      return;
    }
    setAddChargeSaving(true); setAddChargeError(null);
    const { error } = await supabase.from('student_extra_charges').insert({
      school_id: schoolId, student_id: id,
      description: newChargeDesc.trim(),
      amount: Number(amt.toFixed(2)),
      notes: newChargeNotes.trim() || null,
    });
    setAddChargeSaving(false);
    if (error) { setAddChargeError('Αποτυχία καταχώρησης χρέωσης.'); return; }
    setAddChargeOpen(false); setNewChargeDesc(''); setNewChargeAmount(''); setNewChargeNotes('');
    await reloadExtraCharges();
  };

  const payExtraCharge = async (chargeId: string) => {
    if (!schoolId || !id) return;
    const amt = Number(extraPayAmount.replace(',', '.'));
    if (!extraPayAmount.trim() || Number.isNaN(amt) || amt <= 0) return;
    setExtraPaySaving(true);
    const { error } = await supabase.from('student_extra_charge_payments').insert({
      school_id: schoolId, student_id: id, charge_id: chargeId,
      amount: Number(amt.toFixed(2)), payment_method: extraPayMethod,
    });
    setExtraPaySaving(false);
    if (error) return;
    setExtraPayAmount(''); setPayingExtraChargeId(null);
    await reloadExtraCharges();
  };

  const cancelExtraCharge = async (chargeId: string) => {
    setCancellingExtraChargeId(chargeId);
    await supabase.from('student_extra_charges').update({ cancelled_at: new Date().toISOString() }).eq('id', chargeId);
    setCancellingExtraChargeId(null);
    await reloadExtraCharges();
  };

  const cancelSubscriptionCharge = async (subId: string) => {
    await supabase.from('student_subscriptions').update({ status: 'canceled' }).eq('id', subId);
    await reloadSubsAndPayments();
  };

  const cancelExtraChargePayment = async (paymentId: string) => {
    setCancellingExtraPaymentId(paymentId);
    await supabase.from('student_extra_charge_payments').update({ cancelled_at: new Date().toISOString() }).eq('id', paymentId);
    setCancellingExtraPaymentId(null);
    await reloadExtraCharges();
  };

  function populateStudentForm(s: StudentRow) {
    setFullName(s.full_name ?? ''); setDateOfBirth(isoToDisplay(s.date_of_birth));
    setPhone(s.phone ?? ''); setEmail(s.email ?? '');
    setSpecialNotes(s.special_notes ?? ''); setLevelId(s.level_id ?? ''); setNewPassword('');
  }
  function populateParentsForm(s: StudentRow) {
    setFatherName(s.father_name ?? ''); setFatherDob(isoToDisplay(s.father_date_of_birth));
    setFatherPhone(s.father_phone ?? ''); setFatherEmail(s.father_email ?? '');
    setMotherName(s.mother_name ?? ''); setMotherDob(isoToDisplay(s.mother_date_of_birth));
    setMotherPhone(s.mother_phone ?? ''); setMotherEmail(s.mother_email ?? '');
  }

  const handleSaveStudent = async () => {
    if (!student || !schoolId) return;

    const nameTrimmed = fullName.trim();
    if (!nameTrimmed) {
      setStudentError('Το ονοματεπώνυμο είναι υποχρεωτικό.');
      return;
    }

    setSavingStudent(true);
    setStudentError(null);

    const payload = {
      student_id: student.id,
      full_name: nameTrimmed,
      date_of_birth: displayToIso(dateOfBirth) || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      special_notes: specialNotes.trim() || null,
      level_id: levelId || null,
      father_name: student.father_name ?? null,
      father_date_of_birth: student.father_date_of_birth ?? null,
      father_phone: student.father_phone ?? null,
      father_email: student.father_email ?? null,
      mother_name: student.mother_name ?? null,
      mother_date_of_birth: student.mother_date_of_birth ?? null,
      mother_phone: student.mother_phone ?? null,
      mother_email: student.mother_email ?? null,
    };

    const { data, error } = await supabase.functions.invoke('student-update', {
      body: payload,
    });

    if (error || !data?.item) {
      console.error(error ?? data);
      setStudentError('Αποτυχία αποθήκευσης.');
      setSavingStudent(false);
      return;
    }

    const updated = data.item as StudentRow;
    setStudent(updated);

    const np = newPassword.trim();
    if (np) {
      if (np.length < 6) {
        setStudentError('Ο κωδικός πρέπει ≥ 6 χαρακτήρες.');
        setSavingStudent(false);
        return;
      }

      const { error: pwErr } = await supabase.functions.invoke('set-student-password', {
        body: {
          school_id: schoolId,
          student_id: student.id,
          new_password: np,
        },
      });

      if (pwErr) console.error(pwErr);
    }

    setSavingStudent(false);
    setEditingStudent(false);
    setStudentSuccess(true);
    setTimeout(() => setStudentSuccess(false), 3000);
  };

  const saveNotes = async () => {
    if (!student || !schoolId) return;
    setSavingNotes(true);
    const { data, error } = await supabase.functions.invoke('student-update', {
      body: {
        student_id: student.id,
        full_name: student.full_name,
        date_of_birth: student.date_of_birth ?? null,
        phone: student.phone ?? null,
        email: student.email ?? null,
        special_notes: specialNotes.trim() || null,
        level_id: student.level_id ?? null,
        father_name: student.father_name ?? null,
        father_date_of_birth: student.father_date_of_birth ?? null,
        father_phone: student.father_phone ?? null,
        father_email: student.father_email ?? null,
        mother_name: student.mother_name ?? null,
        mother_date_of_birth: student.mother_date_of_birth ?? null,
        mother_phone: student.mother_phone ?? null,
        mother_email: student.mother_email ?? null,
      },
    });
    setSavingNotes(false);
    if (!error && data?.item) {
      setStudent(data.item as StudentRow);
      setEditingNotes(false);
    }
  };

  const handleSaveParents = async () => {
    if (!student || !schoolId) return;

    setSavingParents(true);
    setParentsError(null);

    const payload = {
      student_id: student.id,
      full_name: student.full_name ?? null,
      date_of_birth: student.date_of_birth ?? null,
      phone: student.phone ?? null,
      email: student.email ?? null,
      special_notes: student.special_notes ?? null,
      level_id: student.level_id ?? null,
      father_name: fatherName.trim() || null,
      father_date_of_birth: displayToIso(fatherDob) || null,
      father_phone: fatherPhone.trim() || null,
      father_email: fatherEmail.trim() || null,
      mother_name: motherName.trim() || null,
      mother_date_of_birth: displayToIso(motherDob) || null,
      mother_phone: motherPhone.trim() || null,
      mother_email: motherEmail.trim() || null,
    };

    const { data, error } = await supabase.functions.invoke('student-update', {
      body: payload,
    });

    if (error || !data?.item) {
      console.error(error ?? data);
      setParentsError('Αποτυχία αποθήκευσης.');
      setSavingParents(false);
      return;
    }

    setStudent(data.item as StudentRow);
    setSavingParents(false);
    setEditingParents(false);
    setParentsSuccess(true);
    setTimeout(() => setParentsSuccess(false), 3000);
  };

  const handleSlotCreated = async (_item: any) => {
    setSlotModalOpen(false);
    if (!id || !student) return;
    const { data: slotData } = await supabase
      .from('program_items')
      .select('id, student_id, subject_id, day_of_week, start_time, end_time, start_date, end_date')
      .eq('student_id', id);
    if (slotData) {
      setScheduleSlots(slotData.map((item: any) => ({
        id: item.id,
        class_id: (item.subject_id ?? student.id) as string,
        class_title: (item.subject_id ? subjectNameMap.get(item.subject_id) : null) ?? student.full_name,
        class_subject: null,
        day_of_week: item.day_of_week,
        start_time: item.start_time ?? null,
        end_time: item.end_time ?? null,
        start_date: item.start_date ?? null,
        end_date: item.end_date ?? null,
      })));
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    setSlotDeleting(slotId);
    const res = await supabase.functions.invoke('student-slot-delete', {
      body: { program_item_id: slotId },
    });
    setSlotDeleting(null);
    if (!res.error) {
      setScheduleSlots(prev => prev.filter(s => s.id !== slotId));
    }
  };

  function statusBadge(status: SubscriptionRow['status']) {
    const map: Record<string, { label: string; cls: string }> = {
      active:    { label: 'Ενεργή',     cls: isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700' },
      completed: { label: 'Ληγμένη',    cls: isDark ? 'border-slate-600/50 bg-slate-800/40 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500' },
      expired:   { label: 'Ληγμένη',    cls: isDark ? 'border-slate-600/50 bg-slate-800/40 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500' },
      renewed:   { label: 'Ανανεώθηκε', cls: isDark ? 'border-sky-500/40 bg-sky-950/30 text-sky-400' : 'border-sky-200 bg-sky-50 text-sky-600' },
      canceled:  { label: 'Ακυρώθηκε', cls: isDark ? 'border-red-500/40 bg-red-950/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600' },
    };
    const { label, cls } = map[status] ?? map.completed;
    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      </div>
    );
  }
  if (notFound || !student) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Users className={`h-10 w-10 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Ο μαθητής δεν βρέθηκε.</p>
        <button type='button' onClick={() => navigate('/students')} className="btn-primary px-4 py-2 text-xs font-semibold">Επιστροφή</button>
      </div>
    );
  }

  const levelName = student.level_id ? (levelNameById.get(student.level_id) ?? '—') : '—';

  return (
    <div className="space-y-4 px-1">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/students')}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--color-accent)' }}>
          <GraduationCap className="h-3.5 w-3.5" style={{ color: 'var(--ch-icon)' }} />
        </div>
        <h1 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{student.full_name}</h1>
        {hasBalanceData && (
          owes
            ? <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-red-500/40 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-600'}`}><AlertCircle className="h-2.5 w-2.5" />Οφείλει {totalBalance.toFixed(2)}€</span>
            : <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-2.5 w-2.5" />Εξοφλημένος</span>
        )}
      </div>

      {studentSuccess && <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-3 w-3 shrink-0" />Στοιχεία μαθητή αποθηκεύτηκαν.</div>}
      {parentsSuccess && <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isDark ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="h-3 w-3 shrink-0" />Στοιχεία γονέων αποθηκεύτηκαν.</div>}

      {/* ── Grid ── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* ── Left: info + parents + economics ── */}
        <div className="flex flex-col gap-4">

          {/* Student info */}
          <DashCard title="Στοιχεια Μαθητη" icon={<User className="h-3.5 w-3.5" />} isDark={isDark}
            onEdit={() => { setStudentError(null); setEditingStudent(true); }} editing={editingStudent}>
            {studentError && (
              <div className={`mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{studentError}
              </div>
            )}
            {editingStudent ? (
              <div className="space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <EditField label="Ονοματεπώνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}><input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)} autoFocus /></EditField>
                  <EditField label="Επίπεδο" icon={<Layers className="h-3 w-3" />} isDark={isDark}>
                    <select className={inputCls} value={levelId} onChange={e => setLevelId(e.target.value)}>
                      <option value="">Χωρίς επίπεδο</option>
                      {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </EditField>
                  <EditField label="Ημ. Γέννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}><DatePickerField label="" value={dateOfBirth} onChange={setDateOfBirth} placeholder="24/12/2010" id="card-dob" /></EditField>
                  <EditField label="Τηλέφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}><input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} /></EditField>
                  <EditField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}><input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} /></EditField>
                  <EditField label="Νέος Κωδικός" icon={<Lock className="h-3 w-3" />} isDark={isDark}><input type="password" className={inputCls} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Κενό = χωρίς αλλαγή" /></EditField>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditingStudent(false); populateStudentForm(student); setStudentError(null); }} disabled={savingStudent} className={cancelBtnCls}>Ακύρωση</button>
                  <button type="button" onClick={handleSaveStudent} disabled={savingStudent} className="btn-primary gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                    {savingStudent ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                <ReadField label="Ονοματεπώνυμο" value={student.full_name} isDark={isDark} />
                <ReadField label="Επίπεδο" value={levelName} isDark={isDark} />
                <ReadField label="Ημ. Γέννησης" value={formatDateToGreek(student.date_of_birth)} isDark={isDark} />
                <ReadField label="Τηλέφωνο" value={student.phone} isDark={isDark} />
                <ReadField label="Email" value={student.email} isDark={isDark} copyable />
              </div>
            )}
          </DashCard>

          {/* Parents */}
          <DashCard title="Στοιχεια Γονεων" icon={<UserCheck className="h-3.5 w-3.5" />} isDark={isDark}
            onEdit={() => { setParentsError(null); setEditingParents(true); }} editing={editingParents}>
            {parentsError && (
              <div className={`mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{parentsError}
              </div>
            )}
            {editingParents ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { title: 'Πατέρας', name: fatherName, setName: setFatherName, dob: fatherDob, setDob: setFatherDob, dobId: 'card-fdob', phone: fatherPhone, setPhone: setFatherPhone, email: fatherEmail, setEmail: setFatherEmail },
                    { title: 'Μητέρα', name: motherName, setName: setMotherName, dob: motherDob, setDob: setMotherDob, dobId: 'card-mdob', phone: motherPhone, setPhone: setMotherPhone, email: motherEmail, setEmail: setMotherEmail },
                  ].map(({ title, name, setName, dob, setDob, dobId, phone: ph, setPhone: setPh, email: em, setEmail: setEm }) => (
                    <div key={title} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700/50 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
                      <p className={`mb-2 text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
                      <div className="space-y-2">
                        <EditField label="Ονοματεπώνυμο" isDark={isDark}><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></EditField>
                        <EditField label="Ημ. Γέννησης" isDark={isDark}><DatePickerField label="" value={dob} onChange={setDob} placeholder="24/12/1980" id={dobId} /></EditField>
                        <EditField label="Τηλέφωνο" isDark={isDark}><input className={inputCls} value={ph} onChange={e => setPh(e.target.value)} /></EditField>
                        <EditField label="Email" isDark={isDark}><input type="email" className={inputCls} value={em} onChange={e => setEm(e.target.value)} /></EditField>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditingParents(false); populateParentsForm(student); setParentsError(null); }} disabled={savingParents} className={cancelBtnCls}>Ακύρωση</button>
                  <button type="button" onClick={handleSaveParents} disabled={savingParents} className="btn-primary gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                    {savingParents ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: 'Πατερας', name: student.father_name, dob: student.father_date_of_birth, phone: student.father_phone, email: student.father_email },
                  { title: 'Μητερα', name: student.mother_name, dob: student.mother_date_of_birth, phone: student.mother_phone, email: student.mother_email },
                ].map(({ title, name, dob, phone: ph, email: em }) => (
                  <div key={title}>
                    <p className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
                    <div className="grid gap-1.5 grid-cols-2">
                      <ReadField label="Ονοματεπωνυμο" value={name} isDark={isDark} />
                      <ReadField label="Ημ. Γεννησης" value={formatDateToGreek(dob)} isDark={isDark} />
                      <ReadField label="Τηλεφωνο" value={ph} isDark={isDark} />
                      <ReadField label="Email" value={em} isDark={isDark} copyable />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashCard>

          {/* Notes */}
          <DashCard title="Σημειώσεις" icon={<FileText className="h-3.5 w-3.5" />} isDark={isDark}
            onEdit={() => { setSpecialNotes(student?.special_notes ?? ''); setEditingNotes(true); }} editing={editingNotes}>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  rows={4}
                  className={`w-full resize-none rounded-lg border px-2.5 py-2 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`}
                  placeholder="Σημειώσεις για τον μαθητή..."
                  value={specialNotes}
                  onChange={e => setSpecialNotes(e.target.value)}
                  disabled={savingNotes}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingNotes(false)} disabled={savingNotes} className={cancelBtnCls}>Ακύρωση</button>
                  <button type="button" onClick={saveNotes} disabled={savingNotes} className="btn-primary gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                    {savingNotes ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : 'Αποθήκευση'}
                  </button>
                </div>
              </div>
            ) : student?.special_notes ? (
              <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{student.special_notes}</p>
            ) : (
              <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Δεν υπάρχουν σημειώσεις.</p>
            )}
          </DashCard>

          {/* Economics */}
          <DashCard title="Οικονομικα & Ιστορικο" icon={<Wallet className="h-3.5 w-3.5" />} isDark={isDark}>
            {!isIdiaiterou && (
              <div className="space-y-4">
                {/* Active subscription badge */}
                {activeSub && (
                  <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      {statusBadge(activeSub.status)}
                      <div>
                        <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{activeSub.package_name}</span>
                        {activeSub.notes && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{activeSub.notes}</p>}
                        {activeSub.discount_reason && (
                          <p className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Tag className="h-2.5 w-2.5 shrink-0" />{activeSub.discount_reason}
                          </p>
                        )}
                      </div>
                    </div>
                    {(activeSub.starts_on || activeSub.ends_on) && (
                      <span className={`text-[10px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {activeSub.starts_on ? formatDateToGreek(activeSub.starts_on) : '—'} → {activeSub.ends_on ? formatDateToGreek(activeSub.ends_on) : '—'}
                      </span>
                    )}
                  </div>
                )}

                {/* Stats + independent pay button */}
                <div className="flex items-stretch gap-3">
                  <div className="grid flex-1 grid-cols-3 gap-2">
                    <StatTile label="Χρεωση" value={`${totalChargedCombined.toFixed(2)}€`} color="blue" isDark={isDark} />
                    <StatTile label="Πληρωμενο" value={`${totalPaidCombined.toFixed(2)}€`} color="green" isDark={isDark} />
                    <StatTile label="Υπολοιπο" value={`${totalBalanceCombined.toFixed(2)}€`} color={totalBalanceCombined > 0 ? 'red' : 'green'} isDark={isDark} />
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {activeSub && totalBalanceCombined > 0 && (
                      <button type="button"
                        onClick={() => { setSubPayModalOpen(true); setPayingError(null); setPaymentInput(''); setSubPayMethod('cash'); setSubPayNote(''); }}
                        className="btn-primary flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold">
                        <HandCoins className="h-3.5 w-3.5" />
                        <span>Πληρωμή</span>
                      </button>
                    )}
                    <button type="button"
                      onClick={() => { setAddChargeOpen(true); setAddChargeError(null); setNewChargeDesc(''); setNewChargeAmount(''); setNewChargeNotes(''); }}
                      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition"
                      style={{ background: '#d97706', border: '1px solid #b45309', color: '#ffffff' }}>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Πρόσθετη Χρέωση</span>
                    </button>
                  </div>
                </div>

                {/* Unified history */}
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'}`}>
                    <Receipt className={`h-2.5 w-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ιστορικο ({unifiedHistory.length})</span>
                  </div>
                  {unifiedHistory.length === 0 ? (
                    <div className={`flex items-center gap-2 px-3 py-2.5 ${isDark ? 'bg-slate-950/20' : 'bg-white'}`}>
                      <TrendingUp className={`h-3 w-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Δεν υπάρχει ιστορικό ακόμα.</span>
                    </div>
                  ) : (
                    <>
                      <div className={`divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
                        {unifiedHistoryPageRows.map((entry, i) => {
                          const isCharge = entry.kind === 'sub_charge' || entry.kind === 'extra_charge';
                          const method = entry.kind === 'payment' ? entry.method : null;
                          const label = entry.kind === 'sub_charge' ? entry.label
                            : entry.kind === 'extra_charge' ? entry.label
                            : entry.source === 'extra_charge' ? `Πληρωμή: ${entry.chargeLabel}`
                            : entry.notes ?? '';
                          return (
                            <div key={`${entry.kind}-${i}`}
                              onContextMenu={(e) => { e.preventDefault(); setHistContextMenu({ x: e.clientX, y: e.clientY, entry }); }}
                              className={`select-none cursor-context-menu flex items-center justify-between px-3 py-2 ${isDark ? 'bg-slate-950/20' : 'bg-white'}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${isCharge ? (isDark ? 'bg-sky-400' : 'bg-sky-500') : (isDark ? 'bg-emerald-400' : 'bg-emerald-500')}`} />
                                <span className={`shrink-0 text-[11px] tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{entry.date ? formatDateToGreek(entry.date) : '—'}</span>
                                {label && <span className={`truncate text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>· {label}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {entry.kind === 'payment' && method === 'card' && <span className={`flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-sky-400' : 'text-sky-600'}`}><CreditCard className="h-3 w-3" />Κάρτα</span>}
                                {entry.kind === 'payment' && method === 'cash' && <span className={`flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}><Banknote className="h-3 w-3" />Μετρητά</span>}
                                {entry.kind === 'payment' && method === 'bank_transfer' && <span className={`flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-violet-400' : 'text-violet-600'}`}><Landmark className="h-3 w-3" />Τράπεζα</span>}
                                <span className={`text-xs font-semibold tabular-nums ${isCharge ? (isDark ? 'text-sky-300' : 'text-sky-700') : (isDark ? 'text-emerald-300' : 'text-emerald-700')}`}>
                                  {isCharge ? '−' : '+'}{entry.amount.toFixed(2)}€
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {unifiedHistoryPageCount > 1 && (
                        <div className={`flex items-center justify-between gap-2 px-3 py-2 border-t ${isDark ? 'border-slate-800/60 bg-slate-900/30' : 'border-slate-100 bg-slate-50'}`}>
                          <button type="button" disabled={unifiedHistoryPage <= 0} onClick={() => setUnifiedHistoryPage(p => Math.max(0, p - 1))}
                            className={`flex h-6 w-6 items-center justify-center rounded border transition disabled:opacity-30 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{unifiedHistoryPage + 1} / {unifiedHistoryPageCount}</span>
                          <button type="button" disabled={unifiedHistoryPage >= unifiedHistoryPageCount - 1} onClick={() => setUnifiedHistoryPage(p => Math.min(unifiedHistoryPageCount - 1, p + 1))}
                            className={`flex h-6 w-6 items-center justify-center rounded border transition disabled:opacity-30 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>
            )}

            {isIdiaiterou && (
              <div className="space-y-4 mb-4">
                <div className="flex items-stretch gap-3">
                  <div className="grid flex-1 grid-cols-3 gap-2">
                    <StatTile label="Χρεωση" value={`${lessonTotalCharged.toFixed(2)}€`} color="blue" isDark={isDark} />
                    <StatTile label="Πληρωμενο" value={`${lessonTotalPaid.toFixed(2)}€`} color="green" isDark={isDark} />
                    <StatTile label="Υπολοιπο" value={`${Math.max(0, lessonBalance).toFixed(2)}€`} color={lessonBalance > 0 ? 'red' : 'green'} isDark={isDark} />
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button type="button"
                      onClick={() => { setLessonPayModalOpen(true); setLessonPaymentError(null); setLessonPaymentAmount(''); setLessonPaymentNote(''); setLessonPaymentMethod('cash'); }}
                      className="btn-primary flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold">
                      <HandCoins className="h-3.5 w-3.5" />
                      <span>Πληρωμή</span>
                    </button>
                    <button type="button"
                      onClick={() => { setAddChargeOpen(true); setAddChargeError(null); setNewChargeDesc(''); setNewChargeAmount(''); setNewChargeNotes(''); }}
                      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition"
                      style={{ background: '#d97706', border: '1px solid #b45309', color: '#ffffff' }}>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Πρόσθετη Χρέωση</span>
                    </button>
                  </div>
                </div>

                {/* History */}
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'}`}>
                    <Receipt className={`h-2.5 w-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ιστορικο ({lessonHistory.length})</span>
                  </div>
                  {lessonHistory.length === 0 ? (
                    <div className={`flex items-center gap-2 px-3 py-2.5 ${isDark ? 'bg-slate-950/20' : 'bg-white'}`}>
                      <TrendingUp className={`h-3 w-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                      <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Δεν υπάρχει ιστορικό ακόμα.</span>
                    </div>
                  ) : (
                    <>
                      <div className={`divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
                        {lessonHistoryPageRows.map((entry, i) => {
                          const isCharge = entry.kind === 'charge' || entry.kind === 'extra_charge';
                          const method = entry.kind === 'payment' ? entry.payment.payment_method : entry.kind === 'extra_payment' ? entry.method : null;
                          return (
                            <div key={`${entry.kind}-${i}-${entry.date}`}
                              onContextMenu={(e) => { e.preventDefault(); setLessonContextMenu({ x: e.clientX, y: e.clientY, entry }); }}
                              className={`select-none cursor-context-menu flex items-center justify-between px-3 py-2 ${isDark ? 'bg-slate-950/20' : 'bg-white'}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${isCharge ? (isDark ? 'bg-sky-400' : 'bg-sky-500') : (isDark ? 'bg-emerald-400' : 'bg-emerald-500')}`} />
                                <span className={`shrink-0 text-[11px] tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDateToGreek(entry.date)}</span>
                                <span className={`truncate text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>· {entry.label}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {method === 'card' && <span className={`flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-sky-400' : 'text-sky-600'}`}><CreditCard className="h-3 w-3" />Κάρτα</span>}
                                {method === 'cash' && <span className={`flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}><Banknote className="h-3 w-3" />Μετρητά</span>}
                                {method === 'bank_transfer' && <span className={`flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-violet-400' : 'text-violet-600'}`}><Landmark className="h-3 w-3" />Τράπεζα</span>}
                                <span className={`text-xs font-semibold tabular-nums ${isCharge ? (isDark ? 'text-sky-300' : 'text-sky-700') : (isDark ? 'text-emerald-300' : 'text-emerald-700')}`}>
                                  {isCharge ? '−' : '+'}{entry.amount.toFixed(2)}€
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {lessonHistoryPageCount > 1 && (
                        <div className={`flex items-center justify-between gap-2 px-3 py-2 border-t ${isDark ? 'border-slate-800/60 bg-slate-900/30' : 'border-slate-100 bg-slate-50'}`}>
                          <button type="button" disabled={lessonHistoryPage <= 0} onClick={() => setLessonHistoryPage(p => Math.max(0, p - 1))}
                            className={`flex h-6 w-6 items-center justify-center rounded border transition disabled:opacity-30 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{lessonHistoryPage + 1} / {lessonHistoryPageCount}</span>
                          <button type="button" disabled={lessonHistoryPage >= lessonHistoryPageCount - 1} onClick={() => setLessonHistoryPage(p => Math.min(lessonHistoryPageCount - 1, p + 1))}
                            className={`flex h-6 w-6 items-center justify-center rounded border transition disabled:opacity-30 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

          </DashCard>
        </div>

        {/* ── Right: program + calendar ── */}
        <div className="flex flex-col gap-4">

          <DashCard title="Προγραμμα" icon={<BookOpen className="h-3.5 w-3.5" />} isDark={isDark}
            onAdd={isIdiaiterou ? () => setSlotModalOpen(true) : undefined}>
            {classes.length > 0 && (
              <div className={`mb-3 flex flex-wrap gap-1.5 pb-3 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
                {classes.map(c => {
                  if (!c.classes) return null;
                  return (
                    <span key={c.class_id} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${isDark ? 'border-slate-700/50 bg-slate-900/30 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                      <BookOpen className="h-3 w-3 shrink-0" style={{ color: 'var(--color-accent)' }} />
                      {c.classes.title}
                      {c.classes.subject && <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'}`}>· {c.classes.subject}</span>}
                    </span>
                  );
                })}
              </div>
            )}
            {isIdiaiterou && scheduleSlots.length > 0 && (
              <div className={`mb-3 space-y-1.5 border-b pb-3 ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
                {scheduleSlots.map(slot => {
                  const isDeleting = slotDeleting === slot.id;
                  return (
                    <div key={slot.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${isDark ? 'border-slate-700/40 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--color-accent)' }} />
                      <span className={`w-16 shrink-0 text-[11px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{DAY_LABEL[slot.day_of_week] ?? slot.day_of_week}</span>
                      <span className={`flex-1 truncate text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{slot.class_title}</span>
                      <span className={`shrink-0 tabular-nums text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmt12(slot.start_time)} – {fmt12(slot.end_time)}</span>
                      <button type="button" onClick={() => handleDeleteSlot(slot.id)} disabled={!!slotDeleting}
                        className={`flex h-5 w-5 items-center justify-center rounded border transition disabled:opacity-40 ${isDark ? 'border-slate-700 bg-slate-800 text-slate-500 hover:border-red-800 hover:text-red-400' : 'border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:text-red-500'}`}>
                        {isDeleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <MonthCalendar slots={scheduleSlots} tests={calendarTests} holidayDates={holidayDates} isDark={isDark} />
            {!isIdiaiterou && classes.length === 0 && scheduleSlots.length === 0 && (
              <p className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ο μαθητής δεν έχει ενταχθεί σε τμήμα.</p>
            )}
            {isIdiaiterou && scheduleSlots.length === 0 && (
              <p className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν έχει οριστεί ωράριο. Πάτησε «Προσθήκη» για να ορίσεις.</p>
            )}
          </DashCard>

          {/* ── Grades ── */}
          <DashCard title="Βαθμοι" icon={<BarChart3 className="h-3.5 w-3.5" />} isDark={isDark}>
            {gradesLoading ? (
              <div className={`divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'} rounded-xl border overflow-hidden ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4 px-4 py-3 animate-pulse">
                    <div className={`h-3 w-1/5 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    <div className={`h-3 w-2/5 rounded-full ${isDark ? 'bg-slate-800/70' : 'bg-slate-200/70'}`} />
                    <div className={`h-3 w-1/5 rounded-full ml-auto ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} />
                  </div>
                ))}
              </div>
            ) : grades.length === 0 ? (
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δεν υπάρχουν καταχωρημένοι βαθμοί.</p>
            ) : (
              <>
                {/* Summary */}
                {(() => {
                  const graded = grades.filter(g => g.grade !== null);
                  const avg = graded.length > 0 ? graded.reduce((a, g) => a + Number(g.grade), 0) / graded.length : null;
                  return avg !== null ? (
                    <div className={`mb-3 flex items-center justify-between rounded-xl border px-3 py-2 ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                      <div>
                        <p className={`text-[11px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Μέσος όρος βαθμών</p>
                        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Βασισμένος σε {graded.length} διαγωνίσματα</p>
                      </div>
                      <span className="text-xl font-bold" style={{ color: 'var(--color-accent)' }}>{avg.toFixed(1)}</span>
                    </div>
                  ) : null;
                })()}
                {/* Table */}
                <div className={`overflow-hidden rounded-xl border ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="min-w-full border-collapse text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className={isDark ? 'border-b border-slate-700/60 bg-slate-900/80' : 'border-b border-slate-200 bg-slate-50'}>
                          {['Ημερομηνία', 'Διαγώνισμα', 'Τμήμα', 'Βαθμός'].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest"
                              style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100'}>
                        {grades.map(g => (
                          <tr key={g.id} className={isDark ? 'hover:bg-white/[0.025] transition-colors' : 'hover:bg-slate-50 transition-colors'}>
                            <td className={`px-3 py-2 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {g.test_date ? formatDateToGreek(g.test_date) : '—'}
                            </td>
                            <td className={`px-3 py-2 font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
                              <p className="truncate max-w-[140px]">{g.test_name ?? '—'}</p>
                              {g.subject_name && <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{g.subject_name}</p>}
                            </td>
                            <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{g.class_title ?? '—'}</td>
                            <td className="px-3 py-2">
                              {g.grade !== null
                                ? <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                                    {g.grade}
                                  </span>
                                : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </DashCard>

        </div>
      </div>

      {/* Lesson payment modal (idiaitera) */}
      {lessonPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!lessonPaymentSaving) setLessonPayModalOpen(false); }} />
          <div className={`relative z-10 w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className="mb-4 flex items-center gap-2">
              <HandCoins className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Νέα Πληρωμή</h3>
            </div>
            <div className="space-y-3">
              <input type="text" inputMode="decimal" placeholder="Ποσό"
                className={inputCls} value={lessonPaymentAmount}
                onChange={e => setLessonPaymentAmount(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                disabled={lessonPaymentSaving} autoFocus />
              <div className="flex gap-2">
                {([{ m: 'cash', Icon: Banknote, label: 'Μετρητά' }, { m: 'card', Icon: CreditCard, label: 'Κάρτα' }, { m: 'bank_transfer', Icon: Landmark, label: 'Τράπεζα' }] as { m: 'cash' | 'card' | 'bank_transfer'; Icon: React.ElementType; label: string }[]).map(({ m, Icon, label }) => (
                  <button key={m} type="button" title={label} disabled={lessonPaymentSaving}
                    onClick={() => setLessonPaymentMethod(m)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition disabled:opacity-50 ${lessonPaymentMethod === m ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)]' : isDark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-300 bg-white text-slate-500'}`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Σημείωση (προαιρετικό)"
                className={inputCls} value={lessonPaymentNote}
                onChange={e => setLessonPaymentNote(e.target.value)}
                disabled={lessonPaymentSaving} />
              {lessonPaymentError && (
                <p className={`text-[11px] ${isDark ? 'text-red-400' : 'text-red-600'}`}>{lessonPaymentError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" disabled={lessonPaymentSaving}
                  onClick={() => setLessonPayModalOpen(false)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  Άκυρο
                </button>
                <button type="button" onClick={addLessonPayment} disabled={lessonPaymentSaving}
                  className="flex-1 flex items-center justify-center gap-1.5 btn-primary px-3 py-2 text-xs font-semibold disabled:opacity-60">
                  {lessonPaymentSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
                  Καταχώρηση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu for idiaitera history */}
      {lessonContextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setLessonContextMenu(null)} onContextMenu={e => { e.preventDefault(); setLessonContextMenu(null); }} />
          <div
            className={`fixed z-[61] min-w-[160px] rounded-xl border shadow-xl py-1 ${isDark ? 'bg-slate-900 border-slate-700/70' : 'bg-white border-slate-200'}`}
            style={{ top: lessonContextMenu.y, left: lessonContextMenu.x }}>
            <button type="button"
              onClick={() => { setConfirmCancelLessonEntry(lessonContextMenu.entry); setLessonContextMenu(null); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition ${isDark ? 'text-red-400 hover:bg-red-950/40' : 'text-red-600 hover:bg-red-50'}`}>
              <Ban className="h-3.5 w-3.5" />
              {lessonContextMenu.entry.kind === 'payment' || lessonContextMenu.entry.kind === 'extra_payment' ? 'Ακύρωση Πληρωμής' : 'Ακύρωση Χρέωσης'}
            </button>
          </div>
        </>
      )}

      {/* Confirm cancel modal for idiaitera history */}
      {confirmCancelLessonEntry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!confirmCancelLessonRunning) setConfirmCancelLessonEntry(null); }} />
          <div className={`relative z-10 w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-red-950/50' : 'bg-red-50'}`}>
                <Ban className={`h-5 w-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {confirmCancelLessonEntry.kind === 'payment' || confirmCancelLessonEntry.kind === 'extra_payment' ? 'Ακύρωση Πληρωμής' : 'Ακύρωση Χρέωσης'}
                </p>
                <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Είσαι σίγουρος ότι θέλεις να ακυρώσεις {confirmCancelLessonEntry.kind === 'payment' || confirmCancelLessonEntry.kind === 'extra_payment' ? 'την πληρωμή' : 'τη χρέωση'} των <span className="font-semibold">{confirmCancelLessonEntry.amount.toFixed(2)}€</span>;
                </p>
              </div>
              <div className="flex w-full gap-2 pt-1">
                <button type="button" disabled={confirmCancelLessonRunning}
                  onClick={() => setConfirmCancelLessonEntry(null)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  Άκυρο
                </button>
                <button type="button" disabled={confirmCancelLessonRunning}
                  onClick={async () => {
                    if (!confirmCancelLessonEntry) return;
                    setConfirmCancelLessonRunning(true);
                    const e = confirmCancelLessonEntry;
                    if (e.kind === 'payment') {
                      await cancelLessonPayment(e.payment.id);
                    } else if (e.kind === 'extra_payment') {
                      await cancelExtraChargePayment(e.paymentId);
                    } else if (e.kind === 'extra_charge') {
                      await cancelExtraCharge(e.chargeId);
                    }
                    setConfirmCancelLessonRunning(false);
                    setConfirmCancelLessonEntry(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                  {confirmCancelLessonRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  Ακύρωση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu for history payments */}
      {histContextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setHistContextMenu(null)} onContextMenu={e => { e.preventDefault(); setHistContextMenu(null); }} />
          <div
            className={`fixed z-[61] min-w-[160px] rounded-xl border shadow-xl py-1 ${isDark ? 'bg-slate-900 border-slate-700/70' : 'bg-white border-slate-200'}`}
            style={{ top: histContextMenu.y, left: histContextMenu.x }}>
            <button type="button"
              onClick={() => { setConfirmCancelEntry(histContextMenu.entry); setHistContextMenu(null); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium transition ${isDark ? 'text-red-400 hover:bg-red-950/40' : 'text-red-600 hover:bg-red-50'}`}>
              <Ban className="h-3.5 w-3.5" />
              {histContextMenu.entry.kind === 'payment' ? 'Ακύρωση Πληρωμής' : 'Ακύρωση Χρέωσης'}
            </button>
          </div>
        </>
      )}

      {/* Confirm cancel payment modal */}
      {confirmCancelEntry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!confirmCancelling) setConfirmCancelEntry(null); }} />
          <div className={`relative z-10 w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-red-950/50' : 'bg-red-50'}`}>
                <Ban className={`h-5 w-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {confirmCancelEntry.kind === 'payment' ? 'Ακύρωση Πληρωμής' : 'Ακύρωση Χρέωσης'}
                </p>
                <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Είσαι σίγουρος ότι θέλεις να ακυρώσεις {confirmCancelEntry.kind === 'payment' ? 'την πληρωμή' : 'τη χρέωση'} των <span className="font-semibold">{confirmCancelEntry.amount.toFixed(2)}€</span>;
                </p>
              </div>
              <div className="flex w-full gap-2 pt-1">
                <button type="button" disabled={confirmCancelling}
                  onClick={() => setConfirmCancelEntry(null)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  Άκυρο
                </button>
                <button type="button" disabled={confirmCancelling}
                  onClick={async () => {
                    if (!confirmCancelEntry) return;
                    setConfirmCancelling(true);
                    if (confirmCancelEntry.kind === 'payment') {
                      if (confirmCancelEntry.source === 'subscription') {
                        await cancelPayment(confirmCancelEntry.paymentId);
                      } else {
                        await cancelExtraChargePayment(confirmCancelEntry.paymentId);
                      }
                    } else if (confirmCancelEntry.kind === 'extra_charge') {
                      await cancelExtraCharge(confirmCancelEntry.chargeId);
                    } else if (confirmCancelEntry.kind === 'sub_charge') {
                      await cancelSubscriptionCharge(confirmCancelEntry.subId);
                    }
                    setConfirmCancelling(false);
                    setConfirmCancelEntry(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                  {confirmCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  Ακύρωση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Extra Charge modal */}
      {addChargeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!addChargeSaving) setAddChargeOpen(false); }} />
          <div className={`relative w-full max-w-sm rounded-2xl border p-5 shadow-xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <h2 className={`mb-4 text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Νέα Πρόσθετη Χρέωση</h2>
            {addChargeError && (
              <div className={`mb-3 rounded-lg border px-3 py-2 text-[11px] ${isDark ? 'border-red-500/30 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>{addChargeError}</div>
            )}
            <div className="space-y-3">
              <EditField label="Περιγραφή" isDark={isDark}>
                <input className={inputCls} value={newChargeDesc} onChange={e => setNewChargeDesc(e.target.value)} placeholder="π.χ. Βιβλία, Εγγραφή…" autoFocus disabled={addChargeSaving} />
              </EditField>
              <EditField label="Ποσό (€)" isDark={isDark}>
                <input className={inputCls} type="text" inputMode="decimal" value={newChargeAmount}
                  onChange={e => setNewChargeAmount(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                  placeholder="0.00" disabled={addChargeSaving} />
              </EditField>
              <EditField label="Σημειώσεις (προαιρετικό)" isDark={isDark}>
                <input className={inputCls} value={newChargeNotes} onChange={e => setNewChargeNotes(e.target.value)} disabled={addChargeSaving} />
              </EditField>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAddChargeOpen(false)} disabled={addChargeSaving} className={cancelBtnCls}>Ακύρωση</button>
              <button type="button" onClick={addExtraCharge} disabled={addChargeSaving}
                className="btn-primary gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                {addChargeSaving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση…</> : 'Προσθήκη'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frontistiria subscription payment modal */}
      {subPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!payingLoading) setSubPayModalOpen(false); }} />
          <div className={`relative z-10 w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className="mb-4 flex items-center gap-2">
              <HandCoins className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Νέα Πληρωμή</h3>
            </div>
            <div className="space-y-3">
              <input type="text" inputMode="decimal" placeholder="Ποσό"
                className={inputCls} value={paymentInput}
                onChange={e => setPaymentInput(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                disabled={payingLoading} autoFocus />
              <div className="flex gap-2">
                {([{ m: 'cash', Icon: Banknote, label: 'Μετρητά' }, { m: 'card', Icon: CreditCard, label: 'Κάρτα' }, { m: 'bank_transfer', Icon: Landmark, label: 'Τράπεζα' }] as { m: 'cash' | 'card' | 'bank_transfer'; Icon: React.ElementType; label: string }[]).map(({ m, Icon, label }) => (
                  <button key={m} type="button" title={label} disabled={payingLoading}
                    onClick={() => setSubPayMethod(m)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition disabled:opacity-50 ${subPayMethod === m ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)]' : isDark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-300 bg-white text-slate-500'}`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Σημείωση (προαιρετικό)"
                className={inputCls} value={subPayNote}
                onChange={e => setSubPayNote(e.target.value)}
                disabled={payingLoading} />
              {payingError && <p className={`text-[11px] ${isDark ? 'text-red-400' : 'text-red-600'}`}>{payingError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" disabled={payingLoading}
                  onClick={() => setSubPayModalOpen(false)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  Άκυρο
                </button>
                <button type="button" onClick={submitPayment} disabled={payingLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 btn-primary px-3 py-2 text-xs font-semibold disabled:opacity-60">
                  {payingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
                  Καταχώρηση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isIdiaiterou && slotModalOpen && student && (
        <StudentSlotModal
          studentId={student.id}
          levelId={student.level_id}
          onClose={() => setSlotModalOpen(false)}
          onCreated={handleSlotCreated}
        />
      )}
    </div>
  );
}
