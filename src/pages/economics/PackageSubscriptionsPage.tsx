// src/pages/economics/PackageSubscriptionsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import {
  Loader2, Plus, Save, Trash2, Package, Clock,
  CalendarDays, Repeat, CheckCircle2, XCircle, ChevronDown, X, Pencil,
} from 'lucide-react';
import AppDatePicker from '../../components/ui/AppDatePicker';

type PackageType = 'hourly' | 'monthly' | 'yearly';
type PackageRow = {
  id: string; school_id: string; name: string; price: number; currency: string;
  is_active: boolean; sort_order: number; package_type: PackageType | null;
  hours: number | null; starts_on: string | null; ends_on: string | null;
  avatar_color?: string | null; is_custom?: boolean | null;
};
type FormRow = {
  id: string; name: string; price: string; currency: string; is_active: boolean;
  sort_order: number; package_type: PackageType; hours: string;
  starts_on: string; ends_on: string; avatar_color: string; is_custom: boolean;
};

function moneyStr(n: number | null | undefined) { if (n === null || n === undefined) return '0.00'; return Number(n).toFixed(2); }
function numStr(n: number | null | undefined) { if (n === null || n === undefined) return ''; const s = Number(n); return Number.isFinite(s) ? String(s) : ''; }
function typeLabel(t: PackageType) { if (t === 'hourly') return 'Ωριαίο'; if (t === 'monthly') return 'Μηνιαίο'; return 'Ετήσιο'; }

function isoToDisplay(v: string | null | undefined): string {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; }
  return v;
}
function displayToIso(v: string): string | null {
  if (!v.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  const parts = v.trim().split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return null;
}

function TypeIcon({ type, className }: { type: PackageType; className?: string }) {
  if (type === 'hourly') return <Clock className={className} />;
  if (type === 'monthly') return <CalendarDays className={className} />;
  return <Repeat className={className} />;
}

const TYPE_COLORS: Record<PackageType, { badge: string; icon: string }> = {
  hourly:  { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',          icon: 'text-sky-400' },
  monthly: { badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: 'text-violet-400' },
  yearly:  { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',    icon: 'text-amber-400' },
};
const TYPE_COLORS_LIGHT: Record<PackageType, { badge: string; icon: string }> = {
  hourly:  { badge: 'bg-sky-50 text-sky-600 border-sky-200',          icon: 'text-sky-500' },
  monthly: { badge: 'bg-violet-50 text-violet-600 border-violet-200', icon: 'text-violet-500' },
  yearly:  { badge: 'bg-amber-50 text-amber-600 border-amber-200',    icon: 'text-amber-500' },
};

const AVATAR_COLORS = [
  { value: '#6366f1', label: 'Indigo'    },
  { value: '#0ea5e9', label: 'Μπλε'      },
  { value: '#06b6d4', label: 'Cyan'      },
  { value: '#10b981', label: 'Πράσινο'   },
  { value: '#f59e0b', label: 'Κίτρινο'   },
  { value: '#f97316', label: 'Πορτοκαλί' },
  { value: '#f43f5e', label: 'Κόκκινο'   },
  { value: '#a855f7', label: 'Μωβ'       },
];

function PackageAvatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: `${color}22`, borderColor: `${color}55`, color }}
    >
      {name || '?'}
    </span>
  );
}

function ColorPalette({ currentColor, onSelect, onReset, isDark }: {
  currentColor: string; onSelect: (c: string) => void; onReset?: () => void; isDark: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl overflow-hidden ${
        isDark ? 'border-white/10 bg-slate-900/95' : 'border-slate-200 bg-white/95'
      }`}
      style={{ width: 216 }}
    >
      <div className="h-0.5 w-full rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #6366f1, #f43f5e, #f97316, #a855f7)' }} />
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Χρώμα</span>
        {onReset && (
          <button type="button" onClick={onReset}
            className={`text-[10px] transition hover:underline ${isDark ? 'text-slate-600 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
            Επαναφορά
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2.5 px-4 pb-4">
        {AVATAR_COLORS.map((c) => {
          const isActive = currentColor === c.value;
          return (
            <button key={c.value} type="button" onClick={() => onSelect(c.value)}
              aria-label={c.label} title={c.label}
              className="relative flex h-9 w-9 items-center justify-center rounded-[10px] transition-transform duration-100 hover:scale-110 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${c.value}dd, ${c.value})`,
                boxShadow: isActive
                  ? `0 0 0 2px ${isDark ? '#0f172a' : '#fff'}, 0 0 0 4px ${c.value}, 0 4px 12px ${c.value}80`
                  : `0 3px 8px ${c.value}55`,
              }}>
              {isActive && (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

export default function PackageSubscriptionsPage() {
  const { profile } = useAuth();
  const { theme }   = useTheme();
  const isDark      = theme === 'dark';
  const schoolId    = profile?.school_id ?? null;

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [info,     setInfo]     = useState<string | null>(null);
  const [initial,  setInitial]  = useState<FormRow[] | null>(null);
  const [rows,     setRows]     = useState<FormRow[] | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const [addOpen,        setAddOpen]        = useState(false);
  const [newName,        setNewName]        = useState('');
  const [newInputType,   setNewInputType]   = useState<'date_range' | 'hours'>('date_range');
  const [newHours,       setNewHours]       = useState('');
  const [newPrice,       setNewPrice]       = useState('');
  const [newActive,      setNewActive]      = useState(true);
  const [newStartsOn,    setNewStartsOn]    = useState('');
  const [newEndsOn,      setNewEndsOn]      = useState('');
  const [newAvatarColor, setNewAvatarColor] = useState(AVATAR_COLORS[0].value);
  const [addError,       setAddError]       = useState<string | null>(null);
  const [editingId,      setEditingId]      = useState<string | null>(null);

  const newType: PackageType = newInputType === 'hours' ? 'hourly' : 'yearly';

  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const pageCardCls = isDark
    ? 'rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'rounded-2xl border border-slate-200 bg-white shadow-md';

  const pkgCardCls = isDark
    ? 'group relative rounded-xl border border-slate-800/60 bg-slate-900/30 transition-all hover:border-slate-700/60 hover:bg-slate-900/50'
    : 'group relative rounded-xl border border-slate-200 bg-slate-50/80 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm';

  const smallInputCls = isDark
    ? 'rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)]/70'
    : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-[color:var(--color-accent)]/70';

  const selectCls = isDark
    ? 'rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)]/70'
    : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-[color:var(--color-accent)]/70';

  const cancelBtnCls = isDark
    ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-2 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50'
    : 'btn border border-slate-300 bg-white px-4 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50';

  const modalCardCls = isDark
    ? 'w-full max-w-lg rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden'
    : 'w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden';

  const isDirty = useMemo(() => {
    if (!initial || !rows) return false;
    if (initial.length !== rows.length) return true;
    return rows.some((r, i) => {
      const a = initial[i];
      return a.id !== r.id || a.name !== r.name || a.price !== r.price ||
        a.currency !== r.currency || a.is_active !== r.is_active ||
        a.sort_order !== r.sort_order || a.package_type !== r.package_type ||
        a.hours !== r.hours || a.starts_on !== r.starts_on || a.ends_on !== r.ends_on ||
        a.avatar_color !== r.avatar_color;
    });
  }, [initial, rows]);

  const load = async () => {
    if (!schoolId) { setLoading(false); setError('Δεν βρέθηκε school_id στο προφίλ.'); return; }
    setLoading(true); setError(null); setInfo(null);
    const { data, error } = await supabase
      .from('packages')
      .select('id,school_id,name,price,currency,is_active,sort_order,package_type,hours,starts_on,ends_on,avatar_color,is_custom')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { setError(error.message); setLoading(false); return; }
    const formRows: FormRow[] = ((data ?? []) as PackageRow[]).map(r => ({
      id: r.id, name: r.name ?? '', price: moneyStr(r.price),
      currency: r.currency ?? 'EUR', is_active: !!r.is_active,
      sort_order: r.sort_order ?? 0,
      package_type: (r.package_type ?? 'monthly') as PackageType,
      hours: numStr(r.hours),
      starts_on: isoToDisplay(r.starts_on),
      ends_on:   isoToDisplay(r.ends_on),
      avatar_color: r.avatar_color ?? AVATAR_COLORS[0].value,
      is_custom: !!r.is_custom,
    }));
    setInitial(formRows); setRows(formRows); setLoading(false);
  };

  useEffect(() => { load(); }, [schoolId]);

  const updateRow = (id: string, patch: Partial<FormRow>) => {
    if (!rows) return;
    setRows(rows.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const toggleDateExpand = (id: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Save all via edge function ─────────────────────────────────────────────
  const saveAll = async () => {
    if (!schoolId || !rows) return;
    setSaving(true); setError(null); setInfo(null);

    const packages = rows.map(r => {
      const pn = Number((r.price ?? '0').trim().replace(',', '.').replace(/[^0-9.]/g, ''));
      const safePrice = Number.isFinite(pn) ? Math.max(0, pn) : 0;
      const type = (r.package_type ?? 'monthly') as PackageType;
      const hn = Number((r.hours ?? '').trim().replace(/[^0-9]/g, ''));
      const safeHours = type === 'hourly' ? (Number.isFinite(hn) ? Math.max(1, Math.floor(hn)) : 0) : null;
      return {
        id: r.id, name: r.name.trim(),
        price: Number(safePrice.toFixed(2)), currency: r.currency || 'EUR',
        is_active: r.is_active, sort_order: r.sort_order ?? 0,
        package_type: type, hours: safeHours,
        starts_on: type === 'yearly' ? (displayToIso(r.starts_on) ?? null) : null,
        ends_on:   type === 'yearly' ? (displayToIso(r.ends_on)   ?? null) : null,
        avatar_color: r.avatar_color ?? AVATAR_COLORS[0].value,
        is_custom: r.is_custom ?? false,
      };
    });

    if (packages.find(p => !p.name)) { setError('Το όνομα πακέτου είναι υποχρεωτικό.'); setSaving(false); return; }
    if (packages.find(p => p.package_type === 'hourly' && (!p.hours || p.hours <= 0))) { setError('Για ωριαίο πακέτο, οι ώρες είναι υποχρεωτικές (>= 1).'); setSaving(false); return; }

    try {
      await callEdgeFunction('packagesubscriptions-update', { packages });
      setInfo('Αποθηκεύτηκε!');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => { if (!initial) return; setRows(initial); setError(null); setInfo(null); };

  const openAdd = () => {
    setNewName(''); setNewInputType('date_range'); setNewHours('');
    setNewPrice(''); setNewActive(true);
    setNewStartsOn(''); setNewEndsOn('');
    setNewAvatarColor(AVATAR_COLORS[0].value);
    setAddError(null); setAddOpen(true);
  };

  const cancelAdd = () => { setAddOpen(false); setAddError(null); };

  // ── Add package via edge function ─────────────────────────────────────────
  const addPackage = async () => {
    if (!schoolId) return;
    const name = newName.trim();
    if (!name) { setAddError('Δώσε όνομα πακέτου.'); return; }
    const pn = Number(newPrice.trim().replace(',', '.').replace(/[^0-9.]/g, ''));
    const safePrice = Number.isFinite(pn) ? Math.max(0, pn) : 0;
    const type = newType;
    const hn = Number(newHours.trim().replace(/[^0-9]/g, ''));
    const safeHours = type === 'hourly' ? (Number.isFinite(hn) ? Math.max(1, Math.floor(hn)) : 0) : null;
    if (type === 'hourly' && (!safeHours || safeHours <= 0)) { setAddError('Για ωριαίο πακέτο, βάλε ώρες (>= 1).'); return; }
    const nextOrder = rows && rows.length ? Math.max(...rows.map(r => r.sort_order ?? 0)) + 1 : 1;

    setSaving(true); setAddError(null);
    try {
      await callEdgeFunction('packagesubscriptions-create', {
        name,
        price: Number(safePrice.toFixed(2)),
        currency: 'EUR',
        is_active: newActive,
        sort_order: nextOrder,
        package_type: type,
        hours: safeHours,
        starts_on: type === 'yearly' ? (displayToIso(newStartsOn) ?? null) : null,
        ends_on:   type === 'yearly' ? (displayToIso(newEndsOn)   ?? null) : null,
        avatar_color: newAvatarColor,
        is_custom: true,
      });
      setAddOpen(false); setInfo('Το πακέτο προστέθηκε.');
      await load();
    } catch (err: any) {
      setAddError(err?.message ?? 'Αποτυχία προσθήκης πακέτου.');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (id: string, name: string) => {
    setError(null); setInfo(null); setDeleteTarget({ id, name }); setDeleteOpen(true);
  };

  // ── Delete package via edge function ──────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true); setError(null); setInfo(null);
    try {
      await callEdgeFunction('packagesubscriptions-delete', { package_id: deleteTarget.id });
      setDeleteOpen(false); setDeleteTarget(null); setInfo('Διαγράφηκε.');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία διαγραφής.');
    } finally {
      setSaving(false);
    }
  };

  const tc = (t: PackageType) => isDark ? TYPE_COLORS[t] : TYPE_COLORS_LIGHT[t];

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <Package className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Πακέτα Συνδρομών</h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Δημιούργησε πακέτα (όνομα + τύπος + τιμή). Για ωριαίο δηλώνεις ώρες.</p>
          </div>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary gap-2 px-4 py-2">
          <Plus className="h-3.5 w-3.5" />Νέο πακέτο
        </button>
      </div>

      {/* Feedback */}
      {(error || info) && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${error ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>
          <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${error ? 'bg-red-400' : 'bg-emerald-400'}`} />
          {error ?? info}
        </div>
      )}

      {/* ── Package list ── */}
      <div className={pageCardCls}>
        <div className={`flex items-center justify-between px-5 py-3.5 ${isDark ? 'border-b border-slate-800/60 bg-slate-900/30' : 'border-b border-slate-200 bg-slate-50'}`}>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Πακέτα</span>
          {rows && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-slate-700/60 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-white text-slate-500'}`}>
              {rows.length}
            </span>
          )}
        </div>

        <div className="p-4">
          {loading ? (
            <div className={`flex items-center gap-2.5 py-8 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-accent)' }} />Φόρτωση...
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows && rows.length > 0 && rows.map(r => {
                const colors = tc(r.package_type);
                const dateExpanded = expandedDates.has(r.id);
                const hasDateRange = !!(r.starts_on || r.ends_on);
                const isEditing = editingId === r.id;

                if (r.is_custom && isEditing) {
                  const inputType: 'date_range' | 'hours' = r.package_type === 'hourly' ? 'hours' : 'date_range';
                  return (
                    <div key={r.id} className={`relative rounded-xl border-2 border-dashed overflow-hidden ${isDark ? 'border-slate-700/80 bg-slate-900/40' : 'border-slate-300 bg-slate-50/80'}`}>
                      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${r.avatar_color}, ${r.avatar_color}55)` }} />
                      <div className="p-4 pt-5 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <PackageAvatar name={r.name} color={r.avatar_color} />
                          <input autoFocus value={r.name} onChange={e => updateRow(r.id, { name: e.target.value })}
                            placeholder="Όνομα πακέτου…"
                            className={`flex-1 min-w-[160px] rounded-lg border px-3 py-1.5 text-sm font-medium outline-none transition ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/70' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/70'}`} />
                          <ColorPalette isDark={isDark} currentColor={r.avatar_color}
                            onSelect={c => updateRow(r.id, { avatar_color: c })}
                            onReset={() => updateRow(r.id, { avatar_color: AVATAR_COLORS[0].value })} />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Τύπος</span>
                            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: isDark ? 'rgba(51,65,85,0.7)' : '#e2e8f0' }}>
                              {(['date_range', 'hours'] as const).map(t => (
                                <button key={t} type="button"
                                  onClick={() => updateRow(r.id, { package_type: t === 'hours' ? 'hourly' : 'yearly', hours: t === 'hours' ? r.hours : '' })}
                                  className={`px-3 py-1.5 text-[11px] font-medium transition ${inputType === t ? 'text-white' : isDark ? 'bg-slate-900/60 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 hover:text-slate-700'}`}
                                  style={inputType === t ? { background: 'var(--color-accent)' } : {}}>
                                  {t === 'date_range' ? 'Ημερομηνίες' : 'Ώρες'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {r.package_type === 'hourly' && (
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ΩΡ</span>
                              <input value={r.hours} onChange={e => updateRow(r.id, { hours: e.target.value.replace(/[^0-9]/g, '') })}
                                inputMode="numeric" className={`w-16 ${smallInputCls}`} placeholder="10" />
                            </div>
                          )}

                          {r.package_type !== 'hourly' && (
                            <div className="flex items-center gap-2">
                              <div className="w-36"><AppDatePicker value={r.starts_on} onChange={v => updateRow(r.id, { starts_on: v })} /></div>
                              <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>
                              <div className="w-36"><AppDatePicker value={r.ends_on} onChange={v => updateRow(r.id, { ends_on: v })} /></div>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>€</span>
                            <input value={r.price} onChange={e => updateRow(r.id, { price: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })}
                              inputMode="decimal" className={`w-24 ${smallInputCls}`} placeholder="0.00" />
                          </div>

                          <button type="button" onClick={() => updateRow(r.id, { is_active: !r.is_active })}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${r.is_active ? (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100') : (isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:bg-slate-800/40' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50')}`}>
                            {r.is_active ? <><CheckCircle2 className="h-3 w-3" />Ενεργό</> : <><XCircle className="h-3 w-3" />Ανενεργό</>}
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <button type="button" onClick={() => requestDelete(r.id, r.name)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition hover:border-red-500/40 hover:text-red-400 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-500' : 'border-slate-200 bg-white text-slate-400'}`}>
                            <Trash2 className="h-3 w-3" />Διαγραφή
                          </button>
                          <button type="button" onClick={() => setEditingId(null)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                            <X className="h-3 w-3" />Ακύρωση
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={r.id} className={pkgCardCls}>
                    <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" style={{
                      background: r.is_custom
                        ? `${r.avatar_color}99`
                        : r.package_type === 'hourly' ? 'rgba(56,189,248,0.5)'
                        : r.package_type === 'monthly' ? 'rgba(167,139,250,0.5)'
                        : 'rgba(251,191,36,0.5)',
                    }} />

                    <div className="flex items-center gap-3 p-4 pl-5">
                      {r.is_custom
                        ? <PackageAvatar name={r.name} color={r.avatar_color} />
                        : (
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                            <TypeIcon type={r.package_type} className={`h-2.5 w-2.5 ${colors.icon}`} />
                            {typeLabel(r.package_type)}
                          </span>
                        )
                      }

                      <span className={`text-sm font-medium min-w-0 flex-1 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{r.name}</span>

                      <div className="ml-auto flex items-center gap-2">
                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>€</span>
                              <input value={r.price} onChange={e => updateRow(r.id, { price: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })}
                                inputMode="decimal" className={`w-24 ${smallInputCls}`} placeholder="0.00" autoFocus />
                              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.currency}</span>
                            </div>
                            {r.package_type === 'yearly' && (
                              <button type="button" onClick={() => toggleDateExpand(r.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${dateExpanded ? (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-600') : (isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-white text-slate-500')}`}>
                                <CalendarDays className="h-3 w-3" />
                                {hasDateRange && !dateExpanded ? `${r.starts_on} – ${r.ends_on}` : 'Διάστημα'}
                                <ChevronDown className={`h-3 w-3 transition-transform ${dateExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {r.package_type === 'yearly' && hasDateRange && (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                                <CalendarDays className="h-2.5 w-2.5" />{r.starts_on} – {r.ends_on}
                              </span>
                            )}
                            {r.package_type === 'hourly' && r.hours && (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                                <Clock className="h-2.5 w-2.5" />{r.hours} ώρες
                              </span>
                            )}
                            <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>€{r.price}</span>
                          </div>
                        )}

                        {isEditing ? (
                          <button type="button" onClick={() => setEditingId(null)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button type="button" onClick={() => setEditingId(r.id)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[color:var(--color-accent)]/40 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {r.package_type === 'yearly' && dateExpanded && isEditing && (
                      <div className={`border-t px-5 py-3 ${isDark ? 'border-slate-800/60 bg-slate-900/20' : 'border-slate-100 bg-slate-50/60'}`}>
                        <p className={`mb-2.5 text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Διάστημα ετήσιας συνδρομής</p>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Έναρξη</span>
                            <div className="w-44"><AppDatePicker value={r.starts_on} onChange={v => updateRow(r.id, { starts_on: v })} /></div>
                          </div>
                          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Λήξη</span>
                            <div className="w-44"><AppDatePicker value={r.ends_on} onChange={v => updateRow(r.id, { ends_on: v })} /></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Inline new package row ── */}
              {addOpen && (
                <div className={`relative rounded-xl border-2 border-dashed overflow-hidden ${isDark ? 'border-slate-700/80 bg-slate-900/40' : 'border-slate-300 bg-slate-50/80'}`}>
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${newAvatarColor}, ${newAvatarColor}55)` }} />
                  <div className="p-4 pt-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <PackageAvatar name={newName || 'Νέο'} color={newAvatarColor} />
                      <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Όνομα πακέτου…"
                        className={`flex-1 min-w-[160px] rounded-lg border px-3 py-1.5 text-sm font-medium outline-none transition ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/70' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/70'}`} />
                      <ColorPalette isDark={isDark} currentColor={newAvatarColor} onSelect={c => setNewAvatarColor(c)} onReset={() => setNewAvatarColor(AVATAR_COLORS[0].value)} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Τύπος</span>
                        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: isDark ? 'rgba(51,65,85,0.7)' : '#e2e8f0' }}>
                          {(['date_range', 'hours'] as const).map(t => (
                            <button key={t} type="button" onClick={() => setNewInputType(t)}
                              className={`px-3 py-1.5 text-[11px] font-medium transition ${newInputType === t ? 'text-white' : isDark ? 'bg-slate-900/60 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 hover:text-slate-700'}`}
                              style={newInputType === t ? { background: 'var(--color-accent)' } : {}}>
                              {t === 'date_range' ? 'Ημερομηνίες' : 'Ώρες'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {newInputType === 'hours' && (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ΩΡ</span>
                          <input value={newHours} onChange={e => setNewHours(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className={`w-16 ${smallInputCls}`} placeholder="10" />
                        </div>
                      )}

                      {newInputType === 'date_range' && (
                        <div className="flex items-center gap-2">
                          <div className="w-36"><AppDatePicker value={newStartsOn} onChange={setNewStartsOn} /></div>
                          <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>
                          <div className="w-36"><AppDatePicker value={newEndsOn} onChange={setNewEndsOn} /></div>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>€</span>
                        <input value={newPrice} onChange={e => setNewPrice(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))} inputMode="decimal" className={`w-24 ${smallInputCls}`} placeholder="0.00" />
                      </div>

                      <button type="button" onClick={() => setNewActive(v => !v)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${newActive ? (isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-600') : (isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-white text-slate-500')}`}>
                        {newActive ? <><CheckCircle2 className="h-3 w-3" />Ενεργό</> : <><XCircle className="h-3 w-3" />Ανενεργό</>}
                      </button>
                    </div>

                    {addError && <p className="text-xs text-red-400">{addError}</p>}

                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={cancelAdd} disabled={saving}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                        <X className="h-3 w-3" />Ακύρωση
                      </button>
                      <button type="button" onClick={addPackage} disabled={saving} className="btn-primary gap-2 px-4 py-1.5 text-xs disabled:opacity-60">
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}Προσθήκη
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(!rows || rows.length === 0) && !addOpen && (
                <div className={`flex flex-col items-center gap-3 py-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Package className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Δεν υπάρχουν πακέτα ακόμα.</p>
                  <button type="button" onClick={openAdd} className="text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>
                    Δημιούργησε το πρώτο
                  </button>
                </div>
              )}

              {rows && rows.length > 0 && (
                <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>
                  <button type="button" onClick={resetChanges} disabled={!isDirty || saving}
                    className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${!isDirty || saving ? (isDark ? 'border-slate-800/70 bg-transparent text-slate-600' : 'border-slate-200 bg-transparent text-slate-300') : (isDark ? 'border-slate-700/60 bg-slate-900/40 text-slate-200 hover:bg-slate-800/50' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')}`}>
                    Ακύρωση αλλαγών
                  </button>
                  <button type="button" onClick={saveAll} disabled={!isDirty || saving}
                    className="btn-primary gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Αποθήκευση
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Modal ── */}
      {deleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={modalCardCls} style={isDark ? { background: 'var(--color-sidebar)' } : {}}>
            <div className="h-0.5 w-full bg-rose-500/60" />
            <div className="px-6 pt-5 pb-4">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Διαγραφή πακέτου</h3>
              <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Σίγουρα θέλετε να διαγράψετε το πακέτο <span className="font-semibold text-amber-400">«{deleteTarget.name}»</span>; Η ενέργεια δεν μπορεί να αναιρεθεί.
              </p>
            </div>
            <div className={`flex justify-end gap-2.5 px-6 py-4 ${isDark ? 'border-t border-slate-800/70 bg-slate-900/20' : 'border-t border-slate-100 bg-slate-50'}`}>
              <button type="button" onClick={() => { setDeleteOpen(false); setDeleteTarget(null); }} className={cancelBtnCls} disabled={saving}>Ακύρωση</button>
              <button type="button" onClick={confirmDelete} disabled={saving}
                className="btn bg-rose-600 gap-2 px-4 py-2 font-semibold text-white hover:bg-rose-500 active:scale-[0.97] disabled:opacity-60">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Διαγραφή
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}