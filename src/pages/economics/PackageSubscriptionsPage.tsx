// src/pages/economics/PackageSubscriptionsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { Loader2, Plus, Save, Trash2, Package } from 'lucide-react';

type PackageType = 'hourly' | 'monthly' | 'yearly';

type PackageRow = {
  id: string;
  school_id: string;
  name: string;
  price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;

  // ✅ NEW (must exist in DB)
  package_type: PackageType | null;
  hours: number | null; // only for hourly
};

type FormRow = {
  id: string;
  name: string;
  price: string; // input string
  currency: string;
  is_active: boolean;
  sort_order: number;

  // ✅ NEW
  package_type: PackageType;
  hours: string; // input string; only meaningful if package_type === 'hourly'
};

function moneyStr(n: number | null | undefined) {
  if (n === null || n === undefined) return '0.00';
  return Number(n).toFixed(2);
}

function numStr(n: number | null | undefined) {
  if (n === null || n === undefined) return '';
  const safe = Number(n);
  return Number.isFinite(safe) ? String(safe) : '';
}

function typeLabel(t: PackageType) {
  if (t === 'hourly') return 'Ωριαίο';
  if (t === 'monthly') return 'Μηνιαίο';
  return 'Ετήσιο';
}

export default function PackageSubscriptionsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [initial, setInitial] = useState<FormRow[] | null>(null);
  const [rows, setRows] = useState<FormRow[] | null>(null);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PackageType>('monthly');
  const [newHours, setNewHours] = useState(''); // only for hourly
  const [newPrice, setNewPrice] = useState('0.00');
  const [newActive, setNewActive] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete confirm modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const isDirty = useMemo(() => {
    if (!initial || !rows) return false;
    if (initial.length !== rows.length) return true;

    return rows.some((r, i) => {
      const a = initial[i];
      return (
        a.id !== r.id ||
        a.name !== r.name ||
        a.price !== r.price ||
        a.currency !== r.currency ||
        a.is_active !== r.is_active ||
        a.sort_order !== r.sort_order ||
        a.package_type !== r.package_type ||
        a.hours !== r.hours
      );
    });
  }, [initial, rows]);

  const load = async () => {
    if (!schoolId) {
      setLoading(false);
      setError('Δεν βρέθηκε school_id στο προφίλ.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    const { data, error } = await supabase
      .from('packages')
      .select('id, school_id, name, price, currency, is_active, sort_order, package_type, hours')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const dbRows = (data ?? []) as PackageRow[];
    const formRows: FormRow[] = dbRows.map((r) => ({
      id: r.id,
      name: r.name ?? '',
      price: moneyStr(r.price),
      currency: r.currency ?? 'EUR',
      is_active: !!r.is_active,
      sort_order: r.sort_order ?? 0,

      package_type: (r.package_type ?? 'monthly') as PackageType,
      hours: numStr(r.hours),
    }));

    setInitial(formRows);
    setRows(formRows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const updateRow = (id: string, patch: Partial<FormRow>) => {
    if (!rows) return;
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveAll = async () => {
    if (!schoolId || !rows) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    const payload = rows.map((r) => {
      const cleanedPrice = (r.price ?? '0').trim().replace(',', '.').replace(/[^0-9.]/g, '');
      const pn = Number(cleanedPrice);
      const safePrice = Number.isFinite(pn) ? Math.max(0, pn) : 0;

      const type = (r.package_type ?? 'monthly') as PackageType;

      // hours: only for hourly; else store null
      const cleanedHours = (r.hours ?? '').trim().replace(/[^0-9]/g, '');
      const hn = Number(cleanedHours);
      const safeHours =
        type === 'hourly' ? (Number.isFinite(hn) ? Math.max(1, Math.floor(hn)) : 0) : null;

      return {
        id: r.id,
        school_id: schoolId,
        name: r.name.trim(),
        price: Number(safePrice.toFixed(2)),
        currency: r.currency || 'EUR',
        is_active: r.is_active,
        sort_order: r.sort_order ?? 0,

        // ✅ NEW
        package_type: type,
        hours: safeHours,
      };
    });

    const badName = payload.find((p) => !p.name);
    if (badName) {
      setError('Το όνομα πακέτου είναι υποχρεωτικό.');
      setSaving(false);
      return;
    }

    const badHourly = payload.find((p) => p.package_type === 'hourly' && (!p.hours || p.hours <= 0));
    if (badHourly) {
      setError('Για ωριαίο πακέτο, οι ώρες είναι υποχρεωτικές (>= 1).');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('packages').upsert(payload, { onConflict: 'id' });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setInfo('Αποθηκεύτηκε!');
    await load();
    setSaving(false);
  };

  const resetChanges = () => {
    if (!initial) return;
    setRows(initial);
    setError(null);
    setInfo(null);
  };

  const openAdd = () => {
    setNewName('');
    setNewType('monthly');
    setNewHours('');
    setNewPrice('0.00');
    setNewActive(true);
    setAddError(null);
    setAddOpen(true);
  };

  const addPackage = async () => {
    if (!schoolId) return;

    const name = newName.trim();
    if (!name) {
      setAddError('Δώσε όνομα πακέτου.');
      return;
    }

    const cleanedPrice = newPrice.trim().replace(',', '.').replace(/[^0-9.]/g, '');
    const pn = Number(cleanedPrice);
    const safePrice = Number.isFinite(pn) ? Math.max(0, pn) : 0;

    const type = newType;

    const cleanedHours = newHours.trim().replace(/[^0-9]/g, '');
    const hn = Number(cleanedHours);
    const safeHours =
      type === 'hourly' ? (Number.isFinite(hn) ? Math.max(1, Math.floor(hn)) : 0) : null;

    if (type === 'hourly' && (!safeHours || safeHours <= 0)) {
      setAddError('Για ωριαίο πακέτο, βάλε ώρες (>= 1).');
      return;
    }

    const nextOrder = rows && rows.length ? Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1 : 1;

    setSaving(true);
    setAddError(null);

    const { error } = await supabase.from('packages').insert({
      school_id: schoolId,
      name,
      price: Number(safePrice.toFixed(2)),
      currency: 'EUR',
      is_active: newActive,
      sort_order: nextOrder,

      // ✅ NEW
      package_type: type,
      hours: safeHours,
    });

    if (error) {
      setAddError(error.message);
      setSaving(false);
      return;
    }

    setAddOpen(false);
    setInfo('Το πακέτο προστέθηκε.');
    await load();
    setSaving(false);
  };

  const requestDeletePackage = (id: string, name: string) => {
    setError(null);
    setInfo(null);
    setDeleteTarget({ id, name });
    setDeleteOpen(true);
  };

  const confirmDeletePackage = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    const { error } = await supabase.from('packages').delete().eq('id', deleteTarget.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setDeleteOpen(false);
    setDeleteTarget(null);

    setInfo('Διαγράφηκε.');
    await load();
    setSaving(false);
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
            <Package className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
            Πακέτα Συνδρομών
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Δημιούργησε πακέτα (όνομα + τύπος + τιμή). Για ωριαίο πακέτο δηλώνεις ώρες.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="btn-primary text-black inline-flex items-center gap-2"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <Plus className="h-4 w-4" />
          Νέο πακέτο
        </button>
      </div>

      {(error || info) && (
        <div
          className={[
            'mb-4 rounded-lg border px-4 py-3 text-sm',
            error
              ? 'border-red-500/40 bg-red-950/30 text-red-200'
              : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200',
          ].join(' ')}
        >
          {error ?? info}
        </div>
      )}

      <div className="rounded-xl border border-slate-400/60 bg-transparent shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15 p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Φόρτωση...
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="text-slate-300">Δεν υπάρχουν πακέτα ακόμα.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="relative rounded-lg border border-slate-800/70 bg-slate-900/30 p-4">
                <div aria-hidden className="pointer-events-none absolute inset-0 rounded-lg bg-slate-950/40" />

                <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 lg:w-[320px]">
                    <div className="text-xs text-slate-400">Όνομα</div>
                    <input
                      value={r.name}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[color:var(--color-accent)]/70"
                      placeholder="π.χ. Πακέτο 10 ωρών"
                    />
                  </div>

                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400">Τύπος</span>
                      <select
                        value={r.package_type}
                        onChange={(e) => {
                          const t = e.target.value as PackageType;
                          // if switching away from hourly, clear hours
                          updateRow(r.id, { package_type: t, hours: t === 'hourly' ? r.hours : '' });
                        }}
                        className="rounded-md border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[color:var(--color-accent)]/70"
                      >
                        <option value="hourly">Ωριαίο</option>
                        <option value="monthly">Μηνιαίο</option>
                        <option value="yearly">Ετήσιο</option>
                      </select>

                      {r.package_type === 'hourly' && (
                        <>
                          <span className="text-xs text-slate-400">Ώρες</span>
                          <input
                            value={r.hours}
                            onChange={(e) =>
                              updateRow(r.id, { hours: e.target.value.replace(/[^0-9]/g, '') })
                            }
                            inputMode="numeric"
                            className="w-24 rounded-md border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[color:var(--color-accent)]/70"
                            placeholder="π.χ. 10"
                          />
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400">Τιμή</span>
                      <input
                        value={r.price}
                        onChange={(e) =>
                          updateRow(r.id, {
                            price: e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''),
                          })
                        }
                        inputMode="decimal"
                        className="w-32 rounded-md border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[color:var(--color-accent)]/70"
                        placeholder="0.00"
                      />
                      <span className="text-xs text-slate-300">{r.currency}</span>

                      <button
                        type="button"
                        onClick={() => updateRow(r.id, { is_active: !r.is_active })}
                        className={[
                          'inline-flex items-center justify-center rounded-md border px-3 py-2 text-xs font-semibold',
                          r.is_active
                            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200 hover:bg-emerald-950/30'
                            : 'border-slate-700/70 bg-slate-950/30 text-slate-300 hover:bg-slate-900/40',
                        ].join(' ')}
                      >
                        {r.is_active ? 'Ενεργό' : 'Ανενεργό'}
                      </button>

                      <button
                        type="button"
                        onClick={() => requestDeletePackage(r.id, r.name)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-700/70 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-red-950/30 hover:text-red-200"
                        aria-label="Διαγραφή"
                        title="Διαγραφή"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-1 text-xs text-slate-400 lg:mt-0">
                    Τύπος: <span className="text-slate-200">{typeLabel(r.package_type)}</span>
                    {r.package_type === 'hourly' ? (
                      <>
                        {' '}
                        · Ώρες: <span className="text-slate-200">{r.hours || '—'}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetChanges}
                disabled={!isDirty || saving}
                className={[
                  'rounded-md border px-3 py-2 text-xs font-semibold',
                  !isDirty || saving
                    ? 'border-slate-800/70 bg-slate-900/20 text-slate-500'
                    : 'border-slate-700/70 bg-slate-900/40 text-slate-200 hover:bg-slate-800/50',
                ].join(' ')}
              >
                Ακύρωση αλλαγών
              </button>

              <button
                type="button"
                onClick={saveAll}
                disabled={!isDirty || saving}
                className={[
                  'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold',
                  !isDirty || saving
                    ? 'border-slate-800/70 bg-slate-900/20 text-slate-500'
                    : 'border border-slate-700/70 bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/30',
                ].join(' ')}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Αποθήκευση
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl p-5 shadow-xl border border-slate-700"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">Νέο πακέτο</h2>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setAddError(null);
                }}
                className="text-xs"
              >
                Κλείσιμο
              </button>
            </div>

            {addError && (
              <div className="mb-3 rounded-lg bg-red-900/60 px-3 py-2 text-xs text-red-100">
                {addError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addPackage();
              }}
              className="space-y-3"
            >
              <div>
                <label className="form-label text-slate-100">Όνομα *</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. Πακέτο 10 ωρών"
                />
              </div>

              <div>
                <label className="form-label text-slate-100">Τύπος *</label>
                <select
                  value={newType}
                  onChange={(e) => {
                    const t = e.target.value as PackageType;
                    setNewType(t);
                    if (t !== 'hourly') setNewHours('');
                  }}
                  className="form-input select-accent"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="hourly">Ωριαίο</option>
                  <option value="monthly">Μηνιαίο</option>
                  <option value="yearly">Ετήσιο</option>
                </select>
              </div>

              {newType === 'hourly' && (
                <div>
                  <label className="form-label text-slate-100">Ώρες *</label>
                  <input
                    value={newHours}
                    onChange={(e) => setNewHours(e.target.value.replace(/[^0-9]/g, ''))}
                    inputMode="numeric"
                    className="form-input"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                    placeholder="π.χ. 10"
                  />
                  <div className="mt-1 text-[11px] text-slate-300">
                    Για ωριαίο πακέτο, οι ώρες χρησιμοποιούνται στους υπολογισμούς του ημερολογίου όπως ήδη έχετε.
                  </div>
                </div>
              )}

              <div>
                <label className="form-label text-slate-100">Τιμή</label>
                <div className="flex items-center gap-2">
                  <input
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    className="form-input"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                    placeholder="0.00"
                  />
                  <span className="text-xs text-slate-300">EUR</span>
                </div>
              </div>

              <div>
                <label className="form-label text-slate-100">Κατάσταση</label>
                <select
                  value={newActive ? 'active' : 'inactive'}
                  onChange={(e) => setNewActive(e.target.value === 'active')}
                  className="form-input select-accent"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="active">Ενεργό</option>
                  <option value="inactive">Ανενεργό</option>
                </select>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setAddError(null);
                  }}
                  className="btn-ghost"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  Ακύρωση
                </button>

                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Προσθήκη...' : 'Προσθήκη'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl p-5 shadow-xl border border-slate-700"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-2">
              <h2 className="text-sm font-semibold text-slate-50">Διαγραφή πακέτου</h2>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              Σίγουρα θέλετε να διαγράψετε το πακέτο{' '}
              <span className="font-semibold text-amber-300">«{deleteTarget.name}»</span>; Η ενέργεια αυτή δεν μπορεί
              να αναιρεθεί.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteTarget(null);
                }}
                className="btn-ghost"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
                disabled={saving}
              >
                Ακύρωση
              </button>

              <button
                type="button"
                onClick={confirmDeletePackage}
                disabled={saving}
                className="rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
              >
                {saving ? 'Διαγραφή...' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
