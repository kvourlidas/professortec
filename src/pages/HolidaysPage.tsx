// src/pages/HolidaysPage.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { Trash2, CalendarOff, CalendarDays, X } from 'lucide-react';
import DatePickerField from '../components/ui/AppDatePicker';

type HolidayRow = {
  id: string;
  school_id: string;
  date: string;
  name: string | null;
  created_at: string | null;
};

type HolidayGroup = {
  ids: string[];
  startDate: string;
  endDate?: string | null;
  name: string | null;
};

type Mode = 'single' | 'range';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatLocalYMD = (d: Date): string => {
  const y = d.getFullYear(); const m = pad2(d.getMonth() + 1); const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
};
const addDays = (d: Date, days: number): Date => { const copy = new Date(d); copy.setDate(copy.getDate() + days); return copy; };
const parseYMD = (s: string): Date => new Date(s + 'T00:00:00');
const formatDisplay = (iso: string) => { const [y, m, d] = iso.split('-'); if (!y || !m || !d) return iso; return `${d}/${m}/${y}`; };
const formatDateDisplayFromDate = (d: Date | null): string => {
  if (!d) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const parseDisplayToDate = (display: string): Date | null => {
  if (!display) return null;
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr); const month = Number(mStr); const year = Number(yStr);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

const inputCls = 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

export default function HolidaysPage() {
  const { profile } = useAuth();
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

  const loadHolidays = useCallback(async () => {
    if (!schoolId) { setHolidays([]); return; }
    setLoading(true); setPageError(null);
    const { data, error } = await supabase.from('school_holidays').select('*').eq('school_id', schoolId).order('date', { ascending: true });
    if (error) { console.error(error); setPageError('Αποτυχία φόρτωσης αργιών.'); setHolidays([]); }
    else { setHolidays((data ?? []) as HolidayRow[]); }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  const handleAdd = async () => {
    if (!schoolId) return;
    const trimmedName = name.trim() || null;
    try {
      setSaving(true); setPageError(null);
      if (mode === 'single') {
        if (!singleDate) return;
        const { error } = await supabase.from('school_holidays').upsert({ school_id: schoolId, date: formatLocalYMD(singleDate), name: trimmedName }, { onConflict: 'school_id,date' });
        if (error) throw error;
        setSingleDate(null); setName(''); await loadHolidays();
      } else {
        if (!rangeStart || !rangeEnd) return;
        let start = rangeStart; let end = rangeEnd;
        if (end < start) { const tmp = start; start = end; end = tmp; }
        const rowsToUpsert: { school_id: string; date: string; name: string | null }[] = [];
        let current = new Date(start);
        while (current <= end) { rowsToUpsert.push({ school_id: schoolId, date: formatLocalYMD(current), name: trimmedName }); current = addDays(current, 1); }
        const { error } = await supabase.from('school_holidays').upsert(rowsToUpsert, { onConflict: 'school_id,date' });
        if (error) throw error;
        setRangeStart(null); setRangeEnd(null); setName(''); await loadHolidays();
      }
    } catch (err: any) {
      console.error(err);
      setPageError(err?.message ? `Αποτυχία αποθήκευσης: ${err.message}` : 'Αποτυχία αποθήκευσης αργίας.');
    } finally { setSaving(false); }
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

  const handleConfirmDelete = async () => {
    if (!deleteGroup) return;
    const idsToDelete = deleteGroup.ids; const prev = holidays;
    try {
      setDeleting(true); setPageError(null);
      setHolidays((list) => list.filter((h) => !idsToDelete.includes(h.id)));
      const { error } = await supabase.from('school_holidays').delete().in('id', idsToDelete);
      if (error) { console.error(error); setPageError('Αποτυχία διαγραφής αργίας.'); setHolidays(prev); }
      else { await loadHolidays(); }
      setDeleteGroup(null);
    } catch (err) { console.error(err); setPageError('Αποτυχία διαγραφής αργίας.'); setHolidays(prev); setDeleteGroup(null); }
    finally { setDeleting(false); }
  };

  const canSave = mode === 'single' ? !!singleDate : !!rangeStart && !!rangeEnd;

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
        >
          <CalendarOff className="h-4 w-4 text-black" />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight text-slate-50">Αργίες σχολείου</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Ορίστε μονοήμερες αργίες ή περιόδους αργιών για το σχολείο σας.
          </p>
          {schoolId && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/50 px-2.5 py-0.5 text-[11px] text-slate-300">
                <CalendarOff className="h-3 w-3 text-slate-400" />
                {groupedHolidays.length} καταχωρήσεις
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Alerts ── */}
      {pageError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {pageError}
        </div>
      )}

      {/* ── Add form card ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
        <div className="border-b border-slate-800/70 bg-slate-900/30 px-5 py-3">
          <p className="text-xs font-semibold text-slate-300">Προσθήκη αργίας</p>
        </div>
        <div className="space-y-4 p-5">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['single', 'range'] as Mode[]).map((m) => {
              const active = mode === m;
              const label = m === 'single' ? 'Μονοήμερη αργία' : 'Περίοδος αργιών';
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                  style={active ? {
                    backgroundColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                    color: 'var(--color-accent)',
                  } : {
                    backgroundColor: 'transparent',
                    borderColor: 'rgb(71 85 105 / 0.5)',
                    color: 'rgb(148 163 184)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Περιγραφή
              </label>
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
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {saving ? 'Αποθήκευση…' : 'Προσθήκη αργίας'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Holidays table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
        {loading ? (
          <div className="divide-y divide-slate-800/60">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="h-3 w-1/3 rounded-full bg-slate-800" />
                <div className="h-3 w-1/4 rounded-full bg-slate-800/70" />
              </div>
            ))}
          </div>
        ) : groupedHolidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50">
              <CalendarOff className="h-6 w-6 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Δεν έχουν καταχωρηθεί αργίες</p>
              <p className="mt-1 text-xs text-slate-500">Χρησιμοποιήστε τη φόρμα παραπάνω για να προσθέσετε την πρώτη αργία.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-900/40">
                  {[
                    { icon: <CalendarDays className="h-3 w-3" />, label: 'ΗΜΕΡΟΜΗΝΙΑ / ΠΕΡΙΟΔΟΣ' },
                    { icon: <CalendarOff className="h-3 w-3" />, label: 'ΠΕΡΙΓΡΑΦΗ' },
                  ].map(({ icon, label }) => (
                    <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="opacity-60">{icon}</span>{label}
                      </span>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                    ΕΝΕΡΓΕΙΕΣ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {groupedHolidays.map((g, idx) => {
                  const rangeLabel =
                    g.endDate && g.endDate !== g.startDate
                      ? `${formatDisplay(g.startDate)} – ${formatDisplay(g.endDate)}`
                      : formatDisplay(g.startDate);
                  const isRange = !!(g.endDate && g.endDate !== g.startDate);
                  return (
                    <tr key={`${g.startDate}-${g.endDate ?? ''}-${idx}`} className="group transition-colors hover:bg-white/[0.025]">
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          isRange
                            ? 'border-slate-600/50 bg-slate-800/60 text-slate-300'
                            : 'border-slate-600/50 bg-slate-800/60 text-slate-300'
                        }`}>
                          {rangeLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {g.name || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setDeleteGroup(g)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-300"
                            title="Διαγραφή"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <CalendarOff className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">Διαγραφή αργίας</h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Σίγουρα θέλετε να διαγράψετε{' '}
                {deleteGroup.name
                  ? <><span className="font-semibold text-slate-100">«{deleteGroup.name}»</span>{' '}</>
                  : 'την αργία '}
                για{' '}
                <span className="font-semibold text-slate-100">
                  {deleteGroup.endDate && deleteGroup.endDate !== deleteGroup.startDate
                    ? `${formatDisplay(deleteGroup.startDate)} – ${formatDisplay(deleteGroup.endDate)}`
                    : formatDisplay(deleteGroup.startDate)}
                </span>;{' '}
                Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={() => { if (!deleting) setDeleteGroup(null); }} disabled={deleting}
                  className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50">
                  Ακύρωση
                </button>
                <button type="button" onClick={handleConfirmDelete} disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
                  {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}