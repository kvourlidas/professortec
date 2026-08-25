// src/pages/economics/PackageSubscriptionsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import {
  Loader2, Plus, Save, Trash2, Package,
  CalendarDays, Repeat, CheckCircle2, XCircle, X, Pencil,
} from 'lucide-react';
import StyledSelect from '../../components/ui/StyledSelect';

type PackageType = 'monthly' | 'yearly';
type SchoolYearOption = { id: string; name: string; start_date: string; end_date: string; is_current: boolean };
type PackageRow = {
  id: string; school_id: string; name: string; price: number; currency: string;
  is_active: boolean; sort_order: number; package_type: PackageType | null;
  school_year_id: string | null; starts_on: string | null; ends_on: string | null;
  avatar_color?: string | null; is_custom?: boolean | null;
};
type FormRow = {
  id: string; name: string; price: string; currency: string; is_active: boolean;
  sort_order: number; package_type: PackageType;
  school_year_id: string | null; starts_on: string; ends_on: string;
  avatar_color: string; is_custom: boolean;
};

function moneyStr(n: number | null | undefined) { if (n === null || n === undefined) return '0.00'; return Number(n).toFixed(2); }
function typeLabel(t: PackageType) { if (t === 'monthly') return 'Μηνιαίο'; return 'Ετήσιο'; }

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
  if (type === 'monthly') return <CalendarDays className={className} />;
  return <Repeat className={className} />;
}

const TYPE_COLORS: Record<PackageType, { badge: string; icon: string }> = {
  monthly: { badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: 'text-violet-400' },
  yearly:  { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',    icon: 'text-amber-400' },
};
const TYPE_COLORS_LIGHT: Record<PackageType, { badge: string; icon: string }> = {
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
  const { showToast } = useToast();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [initial,  setInitial]  = useState<FormRow[] | null>(null);
  const [rows,     setRows]     = useState<FormRow[] | null>(null);
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);

  const [addOpen,        setAddOpen]        = useState(false);
  const [newName,        setNewName]        = useState('');
  const [newPrice,       setNewPrice]       = useState('');
  const [newActive,      setNewActive]      = useState(true);
  const [newSchoolYearId, setNewSchoolYearId] = useState<string>('');
  const [newAvatarColor, setNewAvatarColor] = useState(AVATAR_COLORS[0].value);
  const [addError,       setAddError]       = useState<string | null>(null);
  const [editingId,      setEditingId]      = useState<string | null>(null);

  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const pkgRowCls = isDark
    ? 'group relative transition-colors hover:bg-[color:var(--color-accent)]/[0.12]'
    : 'group relative transition-colors hover:bg-[color:var(--color-accent)]/10';

  const smallInputCls = isDark
    ? 'rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)]/70'
    : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-[color:var(--color-accent)]/70';

  const cancelBtnCls = isDark
    ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-2 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50'
    : 'btn border border-slate-300 bg-white px-4 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50';

  const modalCardCls = isDark
    ? 'w-full max-w-sm rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden'
    : 'w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl overflow-hidden';

  const isDirty = useMemo(() => {
    if (!initial || !rows) return false;
    if (initial.length !== rows.length) return true;
    return rows.some((r, i) => {
      const a = initial[i];
      return a.id !== r.id || a.name !== r.name || a.price !== r.price ||
        a.currency !== r.currency || a.is_active !== r.is_active ||
        a.sort_order !== r.sort_order || a.package_type !== r.package_type ||
        a.school_year_id !== r.school_year_id ||
        a.avatar_color !== r.avatar_color;
    });
  }, [initial, rows]);

  const load = async () => {
    if (!schoolId) { setLoading(false); setError('Δεν βρέθηκε school_id στο προφίλ.'); return; }
    setLoading(true); setError(null);
    const [{ data, error }, { data: syData }] = await Promise.all([
      supabase
        .from('packages')
        .select('id,school_id,name,price,currency,is_active,sort_order,package_type,school_year_id,starts_on,ends_on,avatar_color,is_custom')
        .eq('school_id', schoolId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('school_years')
        .select('id,name,start_date,end_date,is_current')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),
    ]);
    if (error) { setError(error.message); setLoading(false); return; }
    setSchoolYears((syData ?? []) as SchoolYearOption[]);
    const formRows: FormRow[] = ((data ?? []) as PackageRow[]).map(r => ({
      id: r.id, name: r.name ?? '', price: moneyStr(r.price),
      currency: r.currency ?? 'EUR', is_active: !!r.is_active,
      sort_order: r.sort_order ?? 0,
      package_type: (r.package_type ?? 'monthly') as PackageType,
      school_year_id: r.school_year_id ?? null,
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

  const yearById = (id: string | null) => schoolYears.find(y => y.id === id) ?? null;

  const setRowSchoolYear = (id: string, yearId: string) => {
    const y = yearById(yearId);
    updateRow(id, {
      school_year_id: yearId || null,
      starts_on: y ? isoToDisplay(y.start_date) : '',
      ends_on: y ? isoToDisplay(y.end_date) : '',
    });
  };

  const saveAll = async () => {
    if (!schoolId || !rows) return;
    setSaving(true); setError(null);

    const packages = rows.map(r => {
      const pn = Number((r.price ?? '0').trim().replace(',', '.').replace(/[^0-9.]/g, ''));
      const safePrice = Number.isFinite(pn) ? Math.max(0, pn) : 0;
      const type = (r.package_type ?? 'monthly') as PackageType;
      return {
        id: r.id, name: r.name.trim(),
        price: Number(safePrice.toFixed(2)), currency: r.currency || 'EUR',
        is_active: r.is_active, sort_order: r.sort_order ?? 0,
        package_type: type, hours: null,
        school_year_id: type === 'yearly' ? r.school_year_id : null,
        starts_on: type === 'yearly' ? (displayToIso(r.starts_on) ?? null) : null,
        ends_on:   type === 'yearly' ? (displayToIso(r.ends_on)   ?? null) : null,
        avatar_color: r.avatar_color ?? AVATAR_COLORS[0].value,
        is_custom: r.is_custom ?? false,
      };
    });

    if (packages.find(p => !p.name)) { setError('Το όνομα πακέτου είναι υποχρεωτικό.'); setSaving(false); return; }

    try {
      await callEdgeFunction('packagesubscriptions-update', { packages });
      showToast('Αποθηκεύτηκε!');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => { if (!initial) return; setRows(initial); setError(null); };

  const openAdd = () => {
    setNewName(''); setNewPrice(''); setNewActive(true);
    setNewSchoolYearId(schoolYears.find(y => y.is_current)?.id ?? schoolYears[0]?.id ?? '');
    setNewAvatarColor(AVATAR_COLORS[0].value);
    setAddError(null); setAddOpen(true);
  };

  const cancelAdd = () => { setAddOpen(false); setAddError(null); };

  const addPackage = async () => {
    if (!schoolId) return;
    const name = newName.trim();
    if (!name) { setAddError('Δώσε όνομα πακέτου.'); return; }
    if (!newSchoolYearId) { setAddError('Επίλεξε σχολικό έτος.'); return; }
    const pn = Number(newPrice.trim().replace(',', '.').replace(/[^0-9.]/g, ''));
    const safePrice = Number.isFinite(pn) ? Math.max(0, pn) : 0;
    const nextOrder = rows && rows.length ? Math.max(...rows.map(r => r.sort_order ?? 0)) + 1 : 1;
    const newYear = yearById(newSchoolYearId);

    setSaving(true); setAddError(null);
    try {
      await callEdgeFunction('packagesubscriptions-create', {
        name,
        price: Number(safePrice.toFixed(2)),
        currency: 'EUR',
        is_active: newActive,
        sort_order: nextOrder,
        package_type: 'yearly',
        hours: null,
        school_year_id: newSchoolYearId,
        starts_on: newYear?.start_date ?? null,
        ends_on:   newYear?.end_date ?? null,
        avatar_color: newAvatarColor,
        is_custom: true,
      });
      setAddOpen(false); showToast('Το πακέτο προστέθηκε.');
      await load();
    } catch (err: any) {
      setAddError(err?.message ?? 'Αποτυχία προσθήκης πακέτου.');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (id: string, name: string) => {
    setError(null); setDeleteTarget({ id, name }); setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true); setError(null);
    try {
      await callEdgeFunction('packagesubscriptions-delete', { package_id: deleteTarget.id });
      setDeleteOpen(false); setDeleteTarget(null); showToast('Διαγράφηκε.');
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-end">
        <button type="button" onClick={openAdd} className="btn-primary gap-2 px-4 py-2">
          <Plus className="h-3.5 w-3.5" />Νέο πακέτο
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border px-4 py-3 text-xs border-red-500/40 bg-red-950/40 text-red-200">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {error}
        </div>
      )}

      {/* ── Package list ── */}
      <div>
        {/* Header — accent underline, no card chrome */}
        <div className="flex shrink-0 items-center justify-between pb-3" style={{ borderBottom: '2px solid var(--color-accent)' }}>
          <div className="flex items-center gap-2.5">
            <Package className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
            <span className={`text-sm font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>Πακέτα</span>
          </div>
          {rows && (
            <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {rows.length}
            </span>
          )}
        </div>

        <div className="pt-4">
          {loading ? (
            <div className={`flex items-center gap-2.5 py-8 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-accent)' }} />Φόρτωση...
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows && rows.length > 0 && (
              <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
              {rows.map(r => {
                const colors = tc(r.package_type);
                const rowYear = yearById(r.school_year_id);
                const isEditing = editingId === r.id;

                if (r.is_custom && isEditing) {
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
                            <CalendarDays className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            <StyledSelect
                              isDark={isDark} showChevron
                              value={r.school_year_id ?? ''}
                              onChange={(v) => setRowSchoolYear(r.id, v)}
                              className={`h-9 w-40 rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                              options={[{ value: '', label: 'Επιλέξτε έτος' }, ...schoolYears.map(y => ({ value: y.id, label: y.name }))]}
                            />
                          </div>

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
                  <div key={r.id} className={pkgRowCls}>
                    <div className="absolute inset-y-0 left-0 w-[3px]" style={{
                      background: r.is_custom
                        ? r.avatar_color
                        : r.package_type === 'monthly' ? '#a78bfa'
                        : '#fbbf24',
                    }} />

                    <div className="flex items-center gap-3 py-3 pl-4 pr-1">
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
                              <StyledSelect
                                isDark={isDark} showChevron
                                value={r.school_year_id ?? ''}
                                onChange={(v) => setRowSchoolYear(r.id, v)}
                                className={`h-8 w-36 rounded-lg border pl-2 pr-7 text-[11px] outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}
                                options={[{ value: '', label: 'Επιλέξτε έτος' }, ...schoolYears.map(y => ({ value: y.id, label: y.name }))]}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {r.package_type === 'yearly' && rowYear && (
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${isDark ? 'border-slate-700/60 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                                <CalendarDays className="h-2.5 w-2.5" />{rowYear.name}
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
                  </div>
                );
              })}
              </div>
              )}

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
                        <CalendarDays className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                        <StyledSelect
                          isDark={isDark} showChevron
                          value={newSchoolYearId}
                          onChange={setNewSchoolYearId}
                          className={`h-9 w-40 rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                          options={schoolYears.length > 0
                            ? [{ value: '', label: 'Επιλέξτε έτος' }, ...schoolYears.map(y => ({ value: y.id, label: y.name }))]
                            : [{ value: '', label: 'Χωρίς σχολικά έτη' }]}
                        />
                      </div>

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
          <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <Package className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Διαγραφή πακέτου</h3>
            </div>
            <div className="px-6 pt-5 pb-4">
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Σίγουρα θέλετε να διαγράψετε το πακέτο <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>«{deleteTarget.name}»</span>; Η ενέργεια δεν μπορεί να αναιρεθεί.
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
