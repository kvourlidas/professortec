// src/pages/HolidaysPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { Trash2 } from 'lucide-react';
import DatePickerField from '../components/ui/AppDatePicker';

type HolidayRow = {
  id: string;
  school_id: string;
  date: string; // "YYYY-MM-DD"
  name: string | null;
  created_at: string | null;
};

type HolidayGroup = {
  ids: string[];
  startDate: string; // first date in group
  endDate?: string | null; // last date (if multi-day)
  name: string | null;
};

type Mode = 'single' | 'range';

const pad2 = (n: number) => n.toString().padStart(2, '0');

// local Date → "YYYY-MM-DD"
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

// "YYYY-MM-DD" -> "dd/mm/yyyy"
const formatDisplay = (iso: string) => {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

// Date -> "dd/mm/yyyy" (for AppDatePicker value)
const formatDateDisplayFromDate = (d: Date | null): string => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${day}/${m}/${y}`;
};

// "dd/mm/yyyy" -> Date | null (for AppDatePicker onChange)
const parseDisplayToDate = (display: string): Date | null => {
  if (!display) return null;
  const parts = display.split(/[\/\-\.]/); // dd / mm / yyyy
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr);
  const month = Number(mStr);
  const year = Number(yStr);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

export default function HolidaysPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(false);

  // state: Date objects
  const [mode, setMode] = useState<Mode>('single');
  const [singleDate, setSingleDate] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
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
            date: formatLocalYMD(singleDate), // "YYYY-MM-DD"
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

        setSingleDate(null);
        setName('');
      } else {
        // range mode
        if (!rangeStart || !rangeEnd) return;

        let start = rangeStart;
        let end = rangeEnd;
        if (end < start) {
          const tmp = start;
          start = end;
          end = tmp;
        }

        const rowsToInsert: {
          school_id: string;
          date: string;
          name: string | null;
        }[] = [];
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

        setRangeStart(null);
        setRangeEnd(null);
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
        current.ids.push(h.id);
        current.endDate = h.date;
      } else {
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
      setHolidays((list) => list.filter((h) => !idsToDelete.includes(h.id)));

      const { error } = await supabase
        .from('school_holidays')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        console.error('Failed to delete holiday group', error);
        setHolidays(prev);
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

  const canSave = mode === 'single' ? !!singleDate : !!rangeStart && !!rangeEnd;

  return (
    <div className="space-y-4">
      <h1 className="text-sm font-semibold text-slate-50">Αργίες σχολείου</h1>

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
          <div className="flex-1">
            <DatePickerField
              label={mode === 'single' ? 'Ημερομηνία αργίας' : 'Από'}
              value={
                mode === 'single'
                  ? formatDateDisplayFromDate(singleDate)
                  : formatDateDisplayFromDate(rangeStart)
              }
              onChange={(val) => {
                const d = parseDisplayToDate(val);
                if (mode === 'single') setSingleDate(d);
                else setRangeStart(d);
              }}
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
            <p className="text-[11px] text-slate-300">Φόρτωση αργιών…</p>
          ) : groupedHolidays.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Δεν έχουν καταχωρηθεί ακόμη αργίες για το σχολείο σας.
            </p>
          ) : (
            // ✅ same card + row look as the other tables
            <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr
                      className="text-[11px] uppercase tracking-wide"
                      style={{
                        color: 'var(--color-text-main)',
                        fontFamily:
                          '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      }}
                    >
                      <th className="border-b border-slate-600 px-4 py-2 text-left">
                        ΗΜΕΡΟΜΗΝΙΑ / ΠΕΡΙΟΔΟΣ
                      </th>
                      <th className="border-b border-slate-600 px-4 py-2 text-left">
                        ΠΕΡΙΓΡΑΦΗ
                      </th>
                      <th className="border-b border-slate-600 px-4 py-2 text-right">
                        ΕΝΕΡΓΕΙΕΣ
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {groupedHolidays.map((g, idx) => {
                      const rangeLabel =
                        g.endDate && g.endDate !== g.startDate
                          ? `${formatDisplay(g.startDate)} – ${formatDisplay(g.endDate)}`
                          : formatDisplay(g.startDate);

                      const rowBg =
                        idx % 2 === 0 ? 'bg-slate-950/45' : 'bg-slate-900/25';

                      return (
                        <tr
                          key={`${g.startDate}-${g.endDate ?? ''}-${idx}`}
                          className={`${rowBg} backdrop-blur-sm hover:bg-slate-800/40 transition-colors`}
                        >
                          <td className="border-b border-slate-700 px-4 py-2 align-middle">
                            <span className="text-xs text-slate-100" style={{ color: 'var(--color-text-td)' }}>
                              {rangeLabel}
                            </span>
                          </td>

                          <td className="border-b border-slate-700 px-4 py-2 align-middle">
                            <span className="text-xs text-slate-100" style={{ color: 'var(--color-text-td)' }}>
                              {g.name || '—'}
                            </span>
                          </td>

                          <td className="border-b border-slate-700 px-4 py-2 align-middle">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(g)}
                                className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-red-600/10"
                                style={{
                                  borderColor: '#f97373',
                                  color: '#f97373',
                                }}
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
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal – styled like the rest */}
      {deleteGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-50">
              Διαγραφή αργίας
            </h3>
            <p className="mb-4 text-xs text-slate-200">
              Σίγουρα θέλετε να διαγράψετε την αργία{' '}
              {deleteGroup.name ? (
                <span className="font-semibold text-[color:var(--color-accent)]">
                  «{deleteGroup.name}»
                </span>
              ) : (
                <span className="font-semibold text-slate-100">αυτή</span>
              )}{' '}
              για{' '}
              <span className="font-semibold text-slate-100">
                {deleteGroup.endDate && deleteGroup.endDate !== deleteGroup.startDate
                  ? `${formatDisplay(deleteGroup.startDate)} – ${formatDisplay(deleteGroup.endDate)}`
                  : formatDisplay(deleteGroup.startDate)}
              </span>
              ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
            </p>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="btn-ghost px-3 py-1"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
                disabled={deleting}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-md px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: '#dc2626' }}
              >
                {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
