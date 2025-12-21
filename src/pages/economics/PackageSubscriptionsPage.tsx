// src/pages/economics/PackageSubscriptionsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { Loader2, Plus, Save, Trash2, Package } from 'lucide-react';

type PackageRow = {
    id: string;
    school_id: string;
    name: string;
    price: number;
    currency: string;
    is_active: boolean;
    sort_order: number;
};

type FormRow = {
    id: string;
    name: string;
    price: string; // input string
    currency: string;
    is_active: boolean;
    sort_order: number;
};

function moneyStr(n: number | null | undefined) {
    if (n === null || n === undefined) return '0.00';
    return Number(n).toFixed(2);
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

    // Add modal (styled like ClassFormModal)
    const [addOpen, setAddOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('0.00');
    const [newActive, setNewActive] = useState(true);
    const [addError, setAddError] = useState<string | null>(null);

    // Delete confirm modal (styled like screenshot)
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
                a.sort_order !== r.sort_order
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
            .select('id, school_id, name, price, currency, is_active, sort_order')
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
            const cleaned = (r.price ?? '0').trim().replace(',', '.').replace(/[^0-9.]/g, '');
            const n = Number(cleaned);
            const safe = Number.isFinite(n) ? Math.max(0, n) : 0;

            return {
                id: r.id,
                school_id: schoolId,
                name: r.name.trim(),
                price: Number(safe.toFixed(2)),
                currency: r.currency || 'EUR',
                is_active: r.is_active,
                sort_order: r.sort_order ?? 0,
            };
        });

        const bad = payload.find((p) => !p.name);
        if (bad) {
            setError('Το όνομα κατηγορίας είναι υποχρεωτικό.');
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
        setNewPrice('0.00');
        setNewActive(true);
        setAddError(null);
        setAddOpen(true);
    };

    const addCategory = async () => {
        if (!schoolId) return;

        const name = newName.trim();
        if (!name) {
            setAddError('Δώσε όνομα κατηγορίας.');
            return;
        }

        const cleaned = newPrice.trim().replace(',', '.').replace(/[^0-9.]/g, '');
        const n = Number(cleaned);
        const safe = Number.isFinite(n) ? Math.max(0, n) : 0;

        const nextOrder =
            rows && rows.length ? Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1 : 1;

        setSaving(true);
        setAddError(null);

        const { error } = await supabase.from('packages').insert({
            school_id: schoolId,
            name,
            price: Number(safe.toFixed(2)),
            currency: 'EUR',
            is_active: newActive,
            sort_order: nextOrder,
        });

        if (error) {
            setAddError(error.message);
            setSaving(false);
            return;
        }

        setAddOpen(false);
        setInfo('Η κατηγορία προστέθηκε.');
        await load();
        setSaving(false);
    };

    // ✅ NEW: open styled delete modal
    const requestDeleteCategory = (id: string, name: string) => {
        setError(null);
        setInfo(null);
        setDeleteTarget({ id, name });
        setDeleteOpen(true);
    };

    // ✅ NEW: delete confirmed from modal
    const confirmDeleteCategory = async () => {
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
                        Δημιούργησε κατηγορίες πακέτων όπως θέλεις (όνομα + τιμή).
                    </p>
                </div>

                <button
                    type="button"
                    onClick={openAdd}
                    className="btn-primary text-black inline-flex items-center gap-2"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                >
                    <Plus className="h-4 w-4" />
                    Νέα κατηγορία
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
                            <div
                                key={r.id}
                                className="relative rounded-lg border border-slate-800/70 bg-slate-900/30 p-4"
                            >
                                {/* ✅ dark underlay ONLY for the row area (keeps the same visual as before) */}
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 rounded-lg bg-slate-950/40"
                                />

                                <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0 md:w-[340px]">
                                        <div className="text-xs text-slate-400">Όνομα</div>
                                        <input
                                            value={r.name}
                                            onChange={(e) => updateRow(r.id, { name: e.target.value })}
                                            className="mt-1 w-full rounded-md border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[color:var(--color-accent)]/70"
                                            placeholder="π.χ. VIP Πακέτο"
                                        />
                                    </div>

                                    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">Τιμή</span>
                                            <input
                                                value={r.price}
                                                onChange={(e) =>
                                                    updateRow(r.id, {
                                                        price: e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''),
                                                    })
                                                }
                                                inputMode="decimal"
                                                className="w-32 rounded-md border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[color:var(--color-accent)]/70"
                                                placeholder="0.00"
                                            />
                                            <span className="text-xs text-slate-300">{r.currency}</span>
                                        </div>

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
                                            onClick={() => requestDeleteCategory(r.id, r.name)}
                                            className="inline-flex items-center justify-center rounded-md border border-slate-700/70 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-red-950/30 hover:text-red-200"
                                            aria-label="Διαγραφή"
                                            title="Διαγραφή"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
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

            {/* Add Modal (ClassFormModal styling) */}
            {addOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div
                        className="w-full max-w-lg rounded-xl p-5 shadow-xl border border-slate-700"
                        style={{ background: 'var(--color-sidebar)' }}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-50">Νέα κατηγορία</h2>
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
                                addCategory();
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
                                <label className="form-label text-slate-100">Τιμή</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        value={newPrice}
                                        onChange={(e) =>
                                            setNewPrice(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))
                                        }
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

            {/* ✅ Delete confirmation modal (matches your screenshot styling) */}
            {deleteOpen && deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div
                        className="w-full max-w-lg rounded-xl p-5 shadow-xl border border-slate-700"
                        style={{ background: 'var(--color-sidebar)' }}
                    >
                        <div className="mb-2">
                            <h2 className="text-sm font-semibold text-slate-50">Διαγραφή κατηγορίας</h2>
                        </div>

                        <p className="text-xs text-slate-200 leading-relaxed">
                            Σίγουρα θέλετε να διαγράψετε την κατηγορία{' '}
                            <span className="font-semibold text-amber-300">«{deleteTarget.name}»</span>;{' '}
                            Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.
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
                                onClick={confirmDeleteCategory}
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
