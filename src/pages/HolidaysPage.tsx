// src/pages/HolidaysPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

type HolidayRow = {
  id: string;
  school_id: string;
  date: string; // "YYYY-MM-DD"
  name: string | null;
  created_at: string | null;
};

type HolidayGroup = {
  ids: string[];
  startDate: string;        // first date in group
  endDate?: string | null;  // last date (if multi-day)
  name: string | null;
};

type Mode = 'single' | 'range';

const pad2 = (n: number) => n.toString().padStart(2, '0');

// local → "YYYY-MM-DD"
const formatLocalYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const parseYMD = (s: string): Date => {
  // safe local date from "YYYY-MM-DD"
  return new Date(s + 'T00:00:00');
};

const formatDisplay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('el-GR');

export default function HolidaysPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(false);

  // form state
  const [mode, setMode] = useState<Mode>('single');
  const [singleDate, setSingleDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // delete confirmation modal
  const [deleteGroup, setDeleteGroup] = useState<HolidayGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  // load holidays
  useEffect(() => {
    if (!schoolId) {
      setHolidays([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('school_holidays')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: true });

      if (error) {
        console.error('Failed to load school holidays', error);
        setHolidays([]);
      } else {
        setHolidays((data ?? []) as HolidayRow[]);
      }
      setLoading(false);
    };

    load();
  }, [schoolId]);

  const handleAdd = async () => {
    if (!schoolId) return;

    const trimmedName = name.trim() || null;

    try {
      setSaving(true);

      if (mode === 'single') {
        if (!singleDate) return;

        const { data, error } = await supabase
          .from('school_holidays')
          .insert({
            school_id: schoolId,
            date: singleDate, // already "YYYY-MM-DD"
            name: trimmedName,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setHolidays((prev) => {
            const next = [...prev, data as HolidayRow];
            next.sort((a, b) => a.date.localeCompare(b.date));
            return next;
          });
        }

        setSingleDate('');
        setName('');
      } else {
        // range mode
        if (!rangeStart || !rangeEnd) return;

        let start = parseYMD(rangeStart);
        let end = parseYMD(rangeEnd);
        if (end < start) {
          const tmp = start;
          start = end;
          end = tmp;
        }

        const rowsToInsert: { school_id: string; date: string; name: string | null }[] = [];
        let current = new Date(start);

        while (current <= end) {
          rowsToInsert.push({
            school_id: schoolId,
            date: formatLocalYMD(current),
            name: trimmedName,
          });
          current = addDays(current, 1);
        }

        const { data, error } = await supabase
          .from('school_holidays')
          .insert(rowsToInsert)
          .select();

        if (error) throw error;

        if (data && Array.isArray(data)) {
          setHolidays((prev) => {
            const next = [...prev, ...(data as HolidayRow[])];
            next.sort((a, b) => a.date.localeCompare(b.date));
            return next;
          });
        }

        setRangeStart('');
        setRangeEnd('');
        setName('');
      }
    } catch (err) {
      console.error('Failed to insert holiday(s)', err);
    } finally {
      setSaving(false);
    }
  };

  // group continuous holidays with same name into single "event"
  const groupedHolidays = useMemo<HolidayGroup[]>(() => {
    if (!holidays.length) return [];

    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    const result: HolidayGroup[] = [];

    let current: HolidayGroup | null = null;

    for (const h of sorted) {
      if (!current) {
        current = {
          ids: [h.id],
          startDate: h.date,
          endDate: undefined,
          name: h.name ?? null,
        };
        result.push(current);
        continue;
      }

      const lastDateStr = current.endDate ?? current.startDate;
      const lastDate = parseYMD(lastDateStr);
      const thisDate = parseYMD(h.date);
      const diffDays =
        (thisDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

      const sameName = (current.name ?? null) === (h.name ?? null);

      if (sameName && diffDays === 1) {
        // extend group
        current.ids.push(h.id);
        current.endDate = h.date;
      } else {
        // start new group
        current = {
          ids: [h.id],
          startDate: h.date,
          endDate: undefined,
          name: h.name ?? null,
        };
        result.push(current);
      }
    }

    return result;
  }, [holidays]);

  const handleOpenDeleteModal = (group: HolidayGroup) => {
    setDeleteGroup(group);
  };

  const handleConfirmDelete = async () => {
    if (!deleteGroup) return;

    const idsToDelete = deleteGroup.ids;
    const prev = holidays;

    try {
      setDeleting(true);
      // optimistic update
      setHolidays((list) => list.filter((h) => !idsToDelete.includes(h.id)));

      const { error } = await supabase
        .from('school_holidays')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        console.error('Failed to delete holiday group', error);
        setHolidays(prev); // rollback
      }

      setDeleteGroup(null);
    } catch (err) {
      console.error('Failed to delete holiday group', err);
      setHolidays(prev);
      setDeleteGroup(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteGroup(null);
  };

  const canSave =
    mode === 'single'
      ? !!singleDate
      : !!rangeStart && !!rangeEnd;

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold text-slate-50">
        Αργίες σχολείου
      </h1>

      <div className="border border-slate-700 rounded-md bg-[color:var(--color-sidebar)] p-4 space-y-4">
        {/* mode toggle */}
        <div className="flex gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`px-3 py-1 rounded-full border text-xs ${
              mode === 'single'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-200'
            }`}
          >
            Μονοήμερη αργία
          </button>
          <button
            type="button"
            onClick={() => setMode('range')}
            className={`px-3 py-1 rounded-full border text-xs ${
              mode === 'range'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-200'
            }`}
          >
            Περίοδος αργιών
          </button>
        </div>

        {/* form */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] text-slate-200">
              {mode === 'single' ? 'Ημερομηνία αργίας' : 'Από'}
            </label>
            <input
              type="date"
              value={mode === 'single' ? singleDate : rangeStart}
              onChange={(e) =>
                mode === 'single'
                  ? setSingleDate(e.target.value)
                  : setRangeStart(e.target.value)
              }
              className="w-full rounded-md border border-slate-600 bg-[color:var(--color-input-bg)] px-2 py-1 text-xs text-white outline-none"
            />
          </div>

          {mode === 'range' && (
            <div className="flex-1 space-y-1">
              <label className="text-[11px] text-slate-200">Έως</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-[color:var(--color-input-bg)] px-2 py-1 text-xs text-white outline-none"
              />
            </div>
          )}

          <div className="flex-1 space-y-1">
            <label className="text-[11px] text-slate-200">
              Περιγραφή (π.χ. Χριστούγεννα)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Προαιρετικά"
              className="w-full rounded-md border border-slate-600 bg-[color:var(--color-input-bg)] px-2 py-1 text-xs text-white outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !canSave}
            className="mt-1 md:mt-0 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-[11px] text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Αποθήκευση…' : 'Προσθήκη αργίας'}
          </button>
        </div>

        {/* list */}
        <div className="border-t border-slate-700 pt-3">
          {loading ? (
            <p className="text-[11px] text-slate-300">
              Φόρτωση αργιών…
            </p>
          ) : groupedHolidays.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Δεν έχουν καταχωρηθεί ακόμη αργίες για το σχολείο σας.
            </p>
          ) : (
            <table className="w-full text-[11px] text-slate-100">
              <thead>
                <tr className="text-left border-b border-slate-700">
                  <th className="py-1">Ημερομηνία / Περίοδος</th>
                  <th className="py-1">Περιγραφή</th>
                  <th className="py-1 text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {groupedHolidays.map((g, idx) => {
                  const rangeLabel =
                    g.endDate && g.endDate !== g.startDate
                      ? `${formatDisplay(g.startDate)} – ${formatDisplay(
                          g.endDate,
                        )}`
                      : formatDisplay(g.startDate);

                  return (
                    <tr
                      key={idx}
                      className="border-b border-slate-800/60"
                      style={{
                        background:
                          'radial-gradient(circle at top left, rgba(37, 99, 235, 0.22), transparent), var(--color-sidebar)',
                      }}
                    >
                      <td className="py-2 px-3">{rangeLabel}</td>
                      <td className="py-2 px-3">
                        {g.name || '—'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(g)}
                          className="px-2 py-[3px] rounded bg-red-600 hover:bg-red-500 text-white text-[10px]"
                        >
                          Διαγραφή
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-md bg-slate-900 border border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-50 mb-1">
              Διαγραφή αργίας
            </h3>
            <p className="text-[11px] text-slate-300">
              Είσαι σίγουρος ότι θέλεις να διαγράψεις την αργία{' '}
              {deleteGroup.name ? `"${deleteGroup.name}"` : 'αυτή'}
              {' '}
              για{' '}
              {deleteGroup.endDate && deleteGroup.endDate !== deleteGroup.startDate
                ? `${formatDisplay(deleteGroup.startDate)} – ${formatDisplay(
                    deleteGroup.endDate,
                  )}`
                : formatDisplay(deleteGroup.startDate)}
              ;
            </p>

            <div className="pt-3 mt-2 flex justify-between items-center border-t border-slate-700">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deleting}
                className="text-[11px] px-3 py-1 rounded border border-slate-600 text-slate-200 hover:bg-slate-700/60 disabled:opacity-60"
              >
                Άκυρο
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="text-[11px] px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-60"
              >
                {deleting ? 'Διαγραφή…' : 'Ναι, διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
