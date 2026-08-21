// src/pages/HolidaysPage.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { Trash2, CalendarOff, Calendar, CalendarRange } from 'lucide-react';
import DatePickerField from '../components/ui/AppDatePicker';
import type { HolidayRow, HolidayGroup, Mode } from '../components/holidays/types';
import { formatLocalYMD, addDays, parseYMD, formatDisplay, formatDateDisplayFromDate, parseDisplayToDate } from '../components/holidays/utils';
import HolidayDeleteModal from '../components/holidays/HolidayDeleteModal';

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

export default function HolidaysPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('single');
  const [singleDate, setSingleDate] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteGroup, setDeleteGroup] = useState<HolidayGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Dynamic classes ──
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const formRuleCls = isDark ? 'border-slate-800' : 'border-slate-200';

  const railLineCls = isDark ? 'bg-slate-800' : 'bg-slate-200';

  const emptyBoxCls = isDark
    ? 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';

  const emptyTitleCls = isDark ? 'text-sm font-medium text-slate-200' : 'text-sm font-medium text-slate-700';
  const emptySubCls = isDark ? 'mt-1 text-xs text-slate-500' : 'mt-1 text-xs text-slate-400';

  const labelCls = `flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`;

  // ── Load (still direct read — no list edge function) ──
  const loadHolidays = useCallback(async () => {
    if (!schoolId) { setHolidays([]); return; }
    setLoading(true); setPageError(null);
    const { data, error } = await supabase.from('school_holidays').select('*').eq('school_id', schoolId).order('date', { ascending: true });
    if (error) { console.error(error); setPageError('Αποτυχία φόρτωσης αργιών.'); setHolidays([]); }
    else { setHolidays((data ?? []) as HolidayRow[]); }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  // ── Add via edge function ────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!schoolId) return;
    const trimmedName = name.trim() || null;
    setSaving(true); setPageError(null);
    try {
      if (mode === 'single') {
        if (!singleDate) return;
        await callEdgeFunction('holidays-create', {
          rows: [{ date: formatLocalYMD(singleDate), name: trimmedName }],
        });
        setSingleDate(null); setName('');
      } else {
        if (!rangeStart || !rangeEnd) return;
        let start = rangeStart; let end = rangeEnd;
        if (end < start) { const tmp = start; start = end; end = tmp; }
        const rows: { date: string; name: string | null }[] = [];
        let current = new Date(start);
        while (current <= end) {
          rows.push({ date: formatLocalYMD(current), name: trimmedName });
          current = addDays(current, 1);
        }
        await callEdgeFunction('holidays-create', { rows });
        setRangeStart(null); setRangeEnd(null); setName('');
      }
      await loadHolidays();
    } catch (err: any) {
      console.error(err);
      setPageError(err?.message ? `Αποτυχία αποθήκευσης: ${err.message}` : 'Αποτυχία αποθήκευσης αργίας.');
    } finally {
      setSaving(false);
    }
  };

  const groupedHolidays = useMemo<HolidayGroup[]>(() => {
    if (!holidays.length) return [];
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    const result: HolidayGroup[] = [];
    let current: HolidayGroup | null = null;
    for (const h of sorted) {
      if (!current) { current = { ids: [h.id], startDate: h.date, endDate: undefined, name: h.name ?? null }; result.push(current); continue; }
      const lastDate = parseYMD(current.endDate ?? current.startDate);
      const thisDate = parseYMD(h.date);
      const diffDays = (thisDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      const sameName = (current.name ?? null) === (h.name ?? null);
      if (sameName && diffDays === 1) { current.ids.push(h.id); current.endDate = h.date; }
      else { current = { ids: [h.id], startDate: h.date, endDate: undefined, name: h.name ?? null }; result.push(current); }
    }
    return result;
  }, [holidays]);

  // ── Delete via edge function ─────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteGroup) return;
    const idsToDelete = deleteGroup.ids;
    const prev = holidays;
    setDeleting(true); setPageError(null);
    setHolidays((list) => list.filter((h) => !idsToDelete.includes(h.id)));
    try {
      await callEdgeFunction('holidays-delete', { ids: idsToDelete });
      await loadHolidays();
      setDeleteGroup(null);
    } catch (err) {
      console.error(err);
      setPageError('Αποτυχία διαγραφής αργίας.');
      setHolidays(prev);
      setDeleteGroup(null);
    } finally {
      setDeleting(false);
    }
  };

  const canSave = mode === 'single' ? !!singleDate : !!rangeStart && !!rangeEnd;

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      {schoolId && (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
            <CalendarOff className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            {groupedHolidays.length} καταχωρήσεις
          </span>
        </div>
      )}

      {/* ── Alerts ── */}
      {pageError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {pageError}
        </div>
      )}

      {/* ── Add form — flat inline bar, no card chrome ── */}
      <div>
        <p className={`mb-3 text-[10px] font-bold uppercase tracking-[0.22em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Προσθήκη αργίας
        </p>
        <div className={`flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end ${formRuleCls}`}>
          {/* Mode toggle — icon cards, so the icon itself reinforces what each mode means */}
          <div className="flex shrink-0 gap-2">
            {(['single', 'range'] as Mode[]).map((m) => {
              const active = mode === m;
              const label = m === 'single' ? 'Μονοήμερη' : 'Περίοδος';
              const Icon = m === 'single' ? Calendar : CalendarRange;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="flex flex-col items-center gap-1 rounded-xl border px-4 py-2.5 transition"
                  style={active ? {
                    borderColor: 'color-mix(in srgb, var(--color-accent) 50%, transparent)',
                    background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                  } : {
                    borderColor: isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgb(226 232 240)',
                    background: 'transparent',
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: active ? 'var(--color-accent)' : (isDark ? '#64748b' : '#94a3b8') }} />
                  <span className="text-[11px] font-semibold" style={{ color: active ? 'var(--color-accent)' : (isDark ? '#94a3b8' : '#64748b') }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Form fields */}
          <div className="flex-1">
            <DatePickerField
              label={mode === 'single' ? 'Ημερομηνία αργίας' : 'Από'}
              value={mode === 'single' ? formatDateDisplayFromDate(singleDate) : formatDateDisplayFromDate(rangeStart)}
              onChange={(val) => { const d = parseDisplayToDate(val); if (mode === 'single') setSingleDate(d); else setRangeStart(d); }}
              placeholder="π.χ. 24/12/2025"
            />
          </div>
          {mode === 'range' && (
            <div className="flex-1">
              <DatePickerField
                label="Έως"
                value={formatDateDisplayFromDate(rangeEnd)}
                onChange={(val) => setRangeEnd(parseDisplayToDate(val))}
                placeholder="π.χ. 02/01/2026"
              />
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <label className={labelCls}>Περιγραφή</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. Χριστούγεννα (προαιρετικά)"
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !canSave}
            className="btn-primary h-9 shrink-0 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Αποθήκευση…' : 'Προσθήκη αργίας'}
          </button>
        </div>
      </div>

      {/* ── Holidays timeline ── */}
      <div>
        {loading ? (
          <div className="space-y-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 animate-pulse">
                <div className={`h-3 w-3 shrink-0 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className="flex-1 space-y-1.5">
                  <div className={`h-3 w-1/3 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                  <div className={`h-2.5 w-1/4 rounded-full ${isDark ? 'bg-slate-800/70' : 'bg-slate-200/70'}`} />
                </div>
              </div>
            ))}
          </div>
        ) : groupedHolidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}>
              <CalendarOff className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={emptyTitleCls}>Δεν έχουν καταχωρηθεί αργίες</p>
              <p className={emptySubCls}>Χρησιμοποιήστε τη φόρμα παραπάνω για να προσθέσετε την πρώτη αργία.</p>
            </div>
          </div>
        ) : (
          <div>
            {groupedHolidays.map((g, idx) => {
              const rangeLabel =
                g.endDate && g.endDate !== g.startDate
                  ? `${formatDisplay(g.startDate)} – ${formatDisplay(g.endDate)}`
                  : formatDisplay(g.startDate);
              const isLast = idx === groupedHolidays.length - 1;
              return (
                <div key={`${g.startDate}-${g.endDate ?? ''}-${idx}`} className="group flex gap-4">
                  {/* Rail: dot + connecting line down to the next entry */}
                  <div className="flex w-3 shrink-0 flex-col items-center">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border-2"
                      style={{ borderColor: 'var(--color-accent)', background: isDark ? '#0f172a' : '#fff' }}
                    />
                    {!isLast && <span className={`w-px flex-1 ${railLineCls}`} />}
                  </div>

                  {/* Content */}
                  <div className={`flex flex-1 items-start justify-between gap-3 pb-6 ${isLast ? 'pb-0' : ''}`}>
                    <div className="min-w-0 -mt-0.5">
                      <p className={`text-sm font-bold tabular-nums ${isDark ? 'text-white' : 'text-black'}`}>{rangeLabel}</p>
                      <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {g.name || <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>Χωρίς περιγραφή</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteGroup(g)}
                      className={`shrink-0 opacity-0 transition group-hover:opacity-100 -mt-0.5 ${isDark
                        ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400'
                        : 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500'}`}
                      title="Διαγραφή"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      <HolidayDeleteModal
        deleteGroup={deleteGroup}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteGroup(null); }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}