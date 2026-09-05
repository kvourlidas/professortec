// A month-calendar view of a tutor's weekly recurring schedule + tests,
// ported from the student card's MonthCalendar (src/pages/StudentCardPage.tsx)
// so both cards present a schedule the same way.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export type TutorCalendarSlot = {
  id: string;
  groupId: string;
  groupTitle: string;
  groupSubtitle: string | null;
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type TutorCalendarTest = {
  id: string;
  test_date: string;
  title: string | null;
  label: string;
  start_time: string | null;
  end_time: string | null;
};

const DAYS = [
  { value: 'monday', js: 1 }, { value: 'tuesday', js: 2 }, { value: 'wednesday', js: 3 },
  { value: 'thursday', js: 4 }, { value: 'friday', js: 5 }, { value: 'saturday', js: 6 }, { value: 'sunday', js: 0 },
];
const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
];
const CLASS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const jsToGrid = (js: number) => (js === 0 ? 6 : js - 1);

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

function fmtDateLong(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TutorScheduleCalendar({ slots, tests, holidayDates, isDark }: {
  slots: TutorCalendarSlot[]; tests: TutorCalendarTest[]; holidayDates: Set<string>; isDark: boolean;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(toISODate(today));

  const uniqueGroups = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; title: string; subtitle: string | null }[] = [];
    slots.forEach((s) => { if (!seen.has(s.groupId)) { seen.add(s.groupId); out.push({ id: s.groupId, title: s.groupTitle, subtitle: s.groupSubtitle }); } });
    return out;
  }, [slots]);

  const colorOf = useMemo(() => {
    const m = new Map<string, string>();
    uniqueGroups.forEach((g, i) => m.set(g.id, CLASS_COLORS[i % CLASS_COLORS.length]));
    return m;
  }, [uniqueGroups]);

  const slotsByJsDay = useMemo(() => {
    const m = new Map<number, TutorCalendarSlot[]>();
    slots.forEach((s) => {
      const d = DAYS.find((d) => d.value === s.day_of_week);
      if (!d) return;
      if (!m.has(d.js)) m.set(d.js, []);
      m.get(d.js)!.push(s);
    });
    return m;
  }, [slots]);

  const testsByDate = useMemo(() => {
    const m = new Map<string, TutorCalendarTest[]>();
    tests.forEach((t) => {
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
  for (let i = startPad - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= lastOfMonth.getDate(); d++) cells.push({ date: new Date(year, month, d), current: true });
  while (cells.length < 42) cells.push({ date: new Date(year, month + 1, cells.length - startPad - lastOfMonth.getDate() + 1), current: false });

  const selJsDay = selected ? new Date(selected + 'T12:00:00').getDay() : -1;
  const selSlots = (slotsByJsDay.get(selJsDay) ?? []).filter((s) => {
    if (s.start_date && selected < s.start_date) return false;
    if (s.end_date && selected > s.end_date) return false;
    return true;
  }).sort((a, b) => {
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });
  const selTests = testsByDate.get(selected) ?? [];

  function prev() { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }
  function next() { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }
  function goToday() { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(toISODate(today)); }

  const border = isDark ? 'border-slate-700/50' : 'border-slate-200';
  const cellBorder = isDark ? 'border-slate-800/50' : 'border-slate-100';
  const headerBg = isDark ? 'bg-slate-900/60' : 'bg-slate-50';
  const navBtnCls = `flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'}`;
  const abbrev = (t: string) => (t.length > 13 ? t.slice(0, 12) + '…' : t);

  return (
    <div className={`rounded-xl border overflow-hidden ${border} ${isDark ? 'bg-slate-900/30' : 'bg-white'}`}>
      {/* ── Navigation ── */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${border} ${headerBg}`}>
        <button type="button" onClick={prev} className={navBtnCls}><ChevronLeft className="h-3.5 w-3.5" /></button>
        <span className={`flex-1 text-center text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{MONTH_NAMES[month]} {year}</span>
        <button type="button" onClick={goToday}
          className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
          Σήμερα
        </button>
        <button type="button" onClick={next} className={navBtnCls}><ChevronRight className="h-3.5 w-3.5" /></button>
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
            ? (slotsByJsDay.get(jsDay) ?? []).filter((s) => {
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
                  ? 'bg-[color:var(--color-accent)]/[0.08]'
                  : isHoliday
                    ? isDark ? 'bg-red-950/20 hover:bg-red-950/30' : 'bg-red-50/60 hover:bg-red-50'
                    : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/80',
              ].filter(Boolean).join(' ')}
              style={{ minHeight: '62px' }}>

              {isHoliday && <span className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r-full bg-red-400/50" />}

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

              <div className="flex flex-col gap-px">
                {daySlots.slice(0, 2).map((s) => (
                  <div key={s.id}
                    className="rounded-[3px] px-1 leading-[14px] text-[8.5px] font-semibold truncate"
                    style={isHoliday
                      ? { background: 'rgba(239,68,68,0.12)', color: isDark ? '#fca5a5' : '#b91c1c', border: '1px solid rgba(239,68,68,0.25)', opacity: 0.85 }
                      : { background: colorOf.get(s.groupId) ?? 'var(--color-accent)', color: '#fff' }}>
                    {abbrev(s.groupTitle)}
                  </div>
                ))}
                {dayTests.length > 0 && (
                  <div className="rounded-[3px] px-1 leading-[14px] text-[8.5px] font-bold truncate"
                    style={{ background: 'rgba(245,158,11,0.15)', color: isDark ? '#fbbf24' : '#b45309', border: '1px solid rgba(245,158,11,0.3)' }}>
                    Διαγ.
                  </div>
                )}
                {daySlots.length > 2 && (
                  <span className={`text-[8px] text-center leading-[14px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>+{daySlots.length - 2}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Legend ── */}
      {uniqueGroups.length > 0 && (
        <div className={`flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 border-t ${border} ${isDark ? 'bg-slate-900/40' : 'bg-slate-50/80'}`}>
          {uniqueGroups.map((g) => (
            <div key={g.id} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colorOf.get(g.id) }} />
              <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{g.title}</span>
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
            <span className={`text-[11px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{selected ? fmtDateLong(selected) : '—'}</span>
            {selected && holidayDates.has(selected) && (
              <span className="shrink-0 rounded-full border border-red-400/40 bg-red-400/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-red-400">Αργία</span>
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
            {selSlots.map((slot) => {
              const selIsHoliday = selected ? holidayDates.has(selected) : false;
              return (
                <div key={slot.id} className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${isDark ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50/80'}`}
                  style={selIsHoliday ? { opacity: 0.7 } : undefined}>
                  <div className="w-0.5 self-stretch rounded-full shrink-0"
                    style={{ background: selIsHoliday ? 'rgba(239,68,68,0.5)' : (colorOf.get(slot.groupId) ?? 'var(--color-accent)'), minHeight: '32px' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-semibold leading-snug ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{slot.groupTitle}</p>
                      {selIsHoliday && <span className={`text-[8px] font-bold ${isDark ? 'text-red-400' : 'text-red-500'}`}>ΑΡΓΙΑ</span>}
                    </div>
                    {slot.groupSubtitle && <p className={`text-[10px] leading-tight mt-px ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{slot.groupSubtitle}</p>}
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
            {selTests.map((test) => (
              <div key={test.id} className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${isDark ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50/80'}`}>
                <div className="w-0.5 self-stretch rounded-full bg-amber-400 shrink-0" style={{ minHeight: '32px' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`inline-flex rounded px-1 py-px text-[8px] font-bold tracking-wide shrink-0 ${isDark ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>ΔΙΑΓ</span>
                    <p className={`text-xs font-semibold truncate ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{test.title ?? 'Διαγώνισμα'}</p>
                  </div>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{test.label}</p>
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
