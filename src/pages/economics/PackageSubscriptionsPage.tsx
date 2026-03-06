// src/pages/economics/PackageSubscriptionsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import { Loader2, Plus, Save, Trash2, Package, Clock, CalendarDays, Repeat, CheckCircle2, XCircle } from 'lucide-react';

type PackageType = 'hourly' | 'monthly' | 'yearly';
type PackageRow = { id: string; school_id: string; name: string; price: number; currency: string; is_active: boolean; sort_order: number; package_type: PackageType | null; hours: number | null };
type FormRow = { id: string; name: string; price: string; currency: string; is_active: boolean; sort_order: number; package_type: PackageType; hours: string };

function moneyStr(n: number | null | undefined) { if (n===null||n===undefined) return '0.00'; return Number(n).toFixed(2); }
function numStr(n: number | null | undefined) { if (n===null||n===undefined) return ''; const safe=Number(n); return Number.isFinite(safe)?String(safe):''; }
function typeLabel(t: PackageType) { if (t==='hourly') return 'Ωριαίο'; if (t==='monthly') return 'Μηνιαίο'; return 'Ετήσιο'; }

function TypeIcon({ type, className }: { type: PackageType; className?: string }) {
  if (type === 'hourly') return <Clock className={className} />;
  if (type === 'monthly') return <CalendarDays className={className} />;
  return <Repeat className={className} />;
}

const TYPE_COLORS: Record<PackageType, { badge: string; icon: string; ring: string }> = {
  hourly:  { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',   icon: 'text-sky-400',   ring: 'ring-sky-500/20' },
  monthly: { badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20', icon: 'text-violet-400', ring: 'ring-violet-500/20' },
  yearly:  { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',  icon: 'text-amber-400',  ring: 'ring-amber-500/20' },
};

const TYPE_COLORS_LIGHT: Record<PackageType, { badge: string; icon: string; ring: string }> = {
  hourly:  { badge: 'bg-sky-50 text-sky-600 border-sky-200',     icon: 'text-sky-500',    ring: 'ring-sky-100' },
  monthly: { badge: 'bg-violet-50 text-violet-600 border-violet-200', icon: 'text-violet-500', ring: 'ring-violet-100' },
  yearly:  { badge: 'bg-amber-50 text-amber-600 border-amber-200',   icon: 'text-amber-500',  ring: 'ring-amber-100' },
};

export default function PackageSubscriptionsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [initial, setInitial] = useState<FormRow[] | null>(null);
  const [rows, setRows] = useState<FormRow[] | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PackageType>('monthly');
  const [newHours, setNewHours] = useState('');
  const [newPrice, setNewPrice] = useState('0.00');
  const [newActive, setNewActive] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // ── Theme tokens ──
  const pageCardCls = isDark
    ? 'rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'rounded-2xl border border-slate-200 bg-white shadow-md';

  const pkgCardCls = isDark
    ? 'group relative rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 transition-all hover:border-slate-700/60 hover:bg-slate-900/50'
    : 'group relative rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm';

  const inputCls = isDark
    ? 'w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[color:var(--color-accent)]/70 focus:ring-1 focus:ring-[color:var(--color-accent)]/20'
    : 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[color:var(--color-accent)]/70 focus:ring-1 focus:ring-[color:var(--color-accent)]/20';

  const smallInputCls = isDark
    ? 'rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)]/70'
    : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-[color:var(--color-accent)]/70';

  const selectCls = isDark
    ? 'rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-[color:var(--color-accent)]/70'
    : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-[color:var(--color-accent)]/70';

  const labelCls = `block mb-1 text-[10px] font-semibold uppercase tracking-wider ${isDark?'text-slate-500':'text-slate-400'}`;

  const cancelBtnCls = 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-2 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50';

  const modalCardCls = isDark
    ? 'w-full max-w-lg rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden'
    : 'w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden';

  const isDirty = useMemo(() => {
    if (!initial||!rows) return false;
    if (initial.length!==rows.length) return true;
    return rows.some((r,i) => { const a=initial[i]; return a.id!==r.id||a.name!==r.name||a.price!==r.price||a.currency!==r.currency||a.is_active!==r.is_active||a.sort_order!==r.sort_order||a.package_type!==r.package_type||a.hours!==r.hours; });
  }, [initial, rows]);

  const load = async () => {
    if (!schoolId) { setLoading(false); setError('Δεν βρέθηκε school_id στο προφίλ.'); return; }
    setLoading(true); setError(null); setInfo(null);
    const { data, error } = await supabase.from('packages').select('id,school_id,name,price,currency,is_active,sort_order,package_type,hours').eq('school_id',schoolId).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
    if (error) { setError(error.message); setLoading(false); return; }
    const formRows: FormRow[] = ((data??[]) as PackageRow[]).map(r=>({ id:r.id, name:r.name??'', price:moneyStr(r.price), currency:r.currency??'EUR', is_active:!!r.is_active, sort_order:r.sort_order??0, package_type:(r.package_type??'monthly') as PackageType, hours:numStr(r.hours) }));
    setInitial(formRows); setRows(formRows); setLoading(false);
  };

  useEffect(() => { load(); }, [schoolId]);

  const updateRow = (id: string, patch: Partial<FormRow>) => { if (!rows) return; setRows(rows.map(r=>r.id===id?{...r,...patch}:r)); };

  const saveAll = async () => {
    if (!schoolId||!rows) return;
    setSaving(true); setError(null); setInfo(null);
    const payload = rows.map(r => {
      const pn=Number((r.price??'0').trim().replace(',','.').replace(/[^0-9.]/g,'')); const safePrice=Number.isFinite(pn)?Math.max(0,pn):0;
      const type=(r.package_type??'monthly') as PackageType;
      const hn=Number((r.hours??'').trim().replace(/[^0-9]/g,'')); const safeHours=type==='hourly'?(Number.isFinite(hn)?Math.max(1,Math.floor(hn)):0):null;
      return { id:r.id, school_id:schoolId, name:r.name.trim(), price:Number(safePrice.toFixed(2)), currency:r.currency||'EUR', is_active:r.is_active, sort_order:r.sort_order??0, package_type:type, hours:safeHours };
    });
    if (payload.find(p=>!p.name)) { setError('Το όνομα πακέτου είναι υποχρεωτικό.'); setSaving(false); return; }
    if (payload.find(p=>p.package_type==='hourly'&&(!p.hours||p.hours<=0))) { setError('Για ωριαίο πακέτο, οι ώρες είναι υποχρεωτικές (>= 1).'); setSaving(false); return; }
    const { error } = await supabase.from('packages').upsert(payload,{onConflict:'id'});
    if (error) { setError(error.message); setSaving(false); return; }
    setInfo('Αποθηκεύτηκε!'); await load(); setSaving(false);
  };

  const resetChanges = () => { if (!initial) return; setRows(initial); setError(null); setInfo(null); };

  const openAdd = () => { setNewName(''); setNewType('monthly'); setNewHours(''); setNewPrice('0.00'); setNewActive(true); setAddError(null); setAddOpen(true); };

  const addPackage = async () => {
    if (!schoolId) return;
    const name=newName.trim(); if (!name) { setAddError('Δώσε όνομα πακέτου.'); return; }
    const pn=Number(newPrice.trim().replace(',','.').replace(/[^0-9.]/g,'')); const safePrice=Number.isFinite(pn)?Math.max(0,pn):0;
    const type=newType;
    const hn=Number(newHours.trim().replace(/[^0-9]/g,'')); const safeHours=type==='hourly'?(Number.isFinite(hn)?Math.max(1,Math.floor(hn)):0):null;
    if (type==='hourly'&&(!safeHours||safeHours<=0)) { setAddError('Για ωριαίο πακέτο, βάλε ώρες (>= 1).'); return; }
    const nextOrder=rows&&rows.length?Math.max(...rows.map(r=>r.sort_order??0))+1:1;
    setSaving(true); setAddError(null);
    const { error } = await supabase.from('packages').insert({ school_id:schoolId, name, price:Number(safePrice.toFixed(2)), currency:'EUR', is_active:newActive, sort_order:nextOrder, package_type:type, hours:safeHours });
    if (error) { setAddError(error.message); setSaving(false); return; }
    setAddOpen(false); setInfo('Το πακέτο προστέθηκε.'); await load(); setSaving(false);
  };

  const requestDelete = (id: string, name: string) => { setError(null); setInfo(null); setDeleteTarget({id,name}); setDeleteOpen(true); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true); setError(null); setInfo(null);
    const { error } = await supabase.from('packages').delete().eq('id',deleteTarget.id);
    if (error) { setError(error.message); setSaving(false); return; }
    setDeleteOpen(false); setDeleteTarget(null); setInfo('Διαγράφηκε.'); await load(); setSaving(false);
  };

  const tc = (t: PackageType) => isDark ? TYPE_COLORS[t] : TYPE_COLORS_LIGHT[t];

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <Package className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }}/>
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark?'text-slate-50':'text-slate-800'}`}>Πακέτα Συνδρομών</h1>
            <p className={`mt-0.5 text-xs ${isDark?'text-slate-400':'text-slate-500'}`}>Δημιούργησε πακέτα (όνομα + τύπος + τιμή). Για ωριαίο δηλώνεις ώρες.</p>
          </div>
        </div>
        <button type="button" onClick={openAdd}
          className="btn-primary gap-2 rounded-xl px-4 py-2 font-semibold hover:brightness-110 active:scale-[0.97]">
          <Plus className="h-3.5 w-3.5"/>
          Νέο πακέτο
        </button>
      </div>

      {/* Feedback */}
      {(error || info) && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${error?'border-red-500/40 bg-red-950/40 text-red-200':'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'}`}>
          <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${error?'bg-red-400':'bg-emerald-400'}`}/>
          {error ?? info}
        </div>
      )}

      {/* ── Package list ── */}
      <div className={pageCardCls}>
        {/* Card header */}
        <div className={`flex items-center justify-between px-5 py-3.5 ${isDark?'border-b border-slate-800/60 bg-slate-900/30':'border-b border-slate-200 bg-slate-50'}`}>
          <span className={`text-xs font-semibold ${isDark?'text-slate-200':'text-slate-700'}`}>Πακέτα</span>
          {rows && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark?'border-slate-700/60 bg-slate-900/40 text-slate-400':'border-slate-200 bg-white text-slate-500'}`}>{rows.length}</span>}
        </div>

        <div className="p-4">
          {loading ? (
            <div className={`flex items-center gap-2.5 py-8 text-sm ${isDark?'text-slate-400':'text-slate-500'}`}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-accent)' }}/>Φόρτωση...
            </div>
          ) : !rows || rows.length === 0 ? (
            <div className={`flex flex-col items-center gap-3 py-12 text-center ${isDark?'text-slate-500':'text-slate-400'}`}>
              <Package className="h-8 w-8 opacity-30"/>
              <p className="text-sm">Δεν υπάρχουν πακέτα ακόμα.</p>
              <button type="button" onClick={openAdd} className="text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>Δημιούργησε το πρώτο</button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((r) => {
                const colors = tc(r.package_type);
                return (
                  <div key={r.id} className={pkgCardCls}>
                    {/* Type stripe */}
                    <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${isDark?'bg-slate-700':'bg-slate-200'}`} style={{ background: r.package_type === 'hourly' ? 'rgba(56,189,248,0.5)' : r.package_type === 'monthly' ? 'rgba(167,139,250,0.5)' : 'rgba(251,191,36,0.5)' }}/>

                    <div className="flex flex-col gap-3 pl-3 lg:flex-row lg:items-center lg:gap-4">
                      {/* Type badge + Name */}
                      <div className="flex items-center gap-2.5 min-w-0 lg:w-[280px]">
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                          <TypeIcon type={r.package_type} className={`h-2.5 w-2.5 ${colors.icon}`}/>
                          {typeLabel(r.package_type)}
                        </span>
                        <input value={r.name} onChange={e=>updateRow(r.id,{name:e.target.value})}
                          className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium outline-none transition ${isDark?'border-transparent bg-transparent text-slate-100 hover:border-slate-700/60 focus:border-[color:var(--color-accent)]/60 focus:bg-slate-900/40':'border-transparent bg-transparent text-slate-800 hover:border-slate-200 focus:border-[color:var(--color-accent)]/60 focus:bg-white'}`}
                          placeholder="Όνομα πακέτου"/>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Package type */}
                        <select value={r.package_type} onChange={e=>{const t=e.target.value as PackageType;updateRow(r.id,{package_type:t,hours:t==='hourly'?r.hours:''});}} className={selectCls}>
                          <option value="hourly">Ωριαίο</option>
                          <option value="monthly">Μηνιαίο</option>
                          <option value="yearly">Ετήσιο</option>
                        </select>

                        {/* Hours (only for hourly) */}
                        {r.package_type === 'hourly' && (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold ${isDark?'text-slate-500':'text-slate-400'}`}>ΩΡ</span>
                            <input value={r.hours} onChange={e=>updateRow(r.id,{hours:e.target.value.replace(/[^0-9]/g,'')})} inputMode="numeric"
                              className={`w-16 ${smallInputCls}`} placeholder="10"/>
                          </div>
                        )}

                        {/* Price */}
                        <div className="flex items-center gap-1.5">
                          <input value={r.price} onChange={e=>updateRow(r.id,{price:e.target.value.replace(',','.').replace(/[^0-9.]/g,'')})} inputMode="decimal"
                            className={`w-24 ${smallInputCls}`} placeholder="0.00"/>
                          <span className={`text-xs font-medium ${isDark?'text-slate-400':'text-slate-500'}`}>{r.currency}</span>
                        </div>

                        {/* Active toggle */}
                        <button type="button" onClick={()=>updateRow(r.id,{is_active:!r.is_active})}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${r.is_active?(isDark?'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20':'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'):(isDark?'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:bg-slate-800/40':'border-slate-200 bg-white text-slate-500 hover:bg-slate-50')}`}>
                          {r.is_active
                            ? <><CheckCircle2 className="h-3 w-3"/>Ενεργό</>
                            : <><XCircle className="h-3 w-3"/>Ανενεργό</>}
                        </button>

                        {/* Delete */}
                        <button type="button" onClick={()=>requestDelete(r.id,r.name)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300 ${isDark?'border-slate-700/60 bg-slate-900/30 text-slate-500':'border-slate-200 bg-white text-slate-400'}`}
                          title="Διαγραφή">
                          <Trash2 className="h-3.5 w-3.5"/>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Save/cancel footer */}
              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark?'border-slate-800/60':'border-slate-200'}`}>
                <button type="button" onClick={resetChanges} disabled={!isDirty||saving}
                  className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${!isDirty||saving?(isDark?'border-slate-800/70 bg-transparent text-slate-600':'border-slate-200 bg-transparent text-slate-300'):(isDark?'border-slate-700/60 bg-slate-900/40 text-slate-200 hover:bg-slate-800/50':'border-slate-300 bg-white text-slate-600 hover:bg-slate-50')}`}>
                  Ακύρωση αλλαγών
                </button>
                <button type="button" onClick={saveAll} disabled={!isDirty||saving}
                  className="btn-primary gap-2 px-4 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Save className="h-3.5 w-3.5"/>}
                  Αποθήκευση
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Modal ── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={modalCardCls} style={isDark?{background:'var(--color-sidebar)'}:{}}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }}/>
            <div className={`flex items-center justify-between px-6 pt-5 pb-4 ${!isDark?'border-b border-slate-100':''}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background:'color-mix(in srgb, var(--color-accent) 15%, transparent)', border:'1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <Package className="h-4 w-4" style={{ color:'var(--color-accent)' }}/>
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${isDark?'text-slate-50':'text-slate-800'}`}>Νέο πακέτο</h3>
                  <p className={`mt-0.5 text-[11px] ${isDark?'text-slate-400':'text-slate-500'}`}>Συμπλήρωσε τα στοιχεία του πακέτου.</p>
                </div>
              </div>
              <button type="button" onClick={()=>{setAddOpen(false);setAddError(null);}}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition text-xs ${isDark?'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:text-slate-200':'border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                ✕
              </button>
            </div>

            {addError && <div className="mx-6 mb-2 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">{addError}</div>}

            <div className="space-y-4 px-6 pb-2">
              <div>
                <label className={labelCls}>Όνομα *</label>
                <input value={newName} onChange={e=>setNewName(e.target.value)} required className={inputCls} placeholder="π.χ. Πακέτο 10 ωρών"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Τύπος *</label>
                  <select value={newType} onChange={e=>{const t=e.target.value as PackageType;setNewType(t);if(t!=='hourly')setNewHours('');}} className={`w-full ${selectCls}`}>
                    <option value="hourly">Ωριαίο</option>
                    <option value="monthly">Μηνιαίο</option>
                    <option value="yearly">Ετήσιο</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Τιμή</label>
                  <div className="flex items-center gap-1.5">
                    <input value={newPrice} onChange={e=>setNewPrice(e.target.value.replace(',','.').replace(/[^0-9.]/g,''))} inputMode="decimal" className={`flex-1 ${smallInputCls}`} placeholder="0.00"/>
                    <span className={`text-xs ${isDark?'text-slate-400':'text-slate-500'}`}>EUR</span>
                  </div>
                </div>
              </div>
              {newType === 'hourly' && (
                <div>
                  <label className={labelCls}>Ώρες *</label>
                  <input value={newHours} onChange={e=>setNewHours(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" className={inputCls} placeholder="π.χ. 10"/>
                  <p className={`mt-1 text-[11px] ${isDark?'text-slate-500':'text-slate-400'}`}>Χρησιμοποιείται στους υπολογισμούς ημερολογίου.</p>
                </div>
              )}
              <div>
                <label className={labelCls}>Κατάσταση</label>
                <select value={newActive?'active':'inactive'} onChange={e=>setNewActive(e.target.value==='active')} className={`w-full ${selectCls}`}>
                  <option value="active">Ενεργό</option>
                  <option value="inactive">Ανενεργό</option>
                </select>
              </div>
            </div>

            <div className={`flex justify-end gap-2.5 px-6 py-4 ${isDark?'mt-2 border-t border-slate-800/70 bg-slate-900/20':'border-t border-slate-100 bg-slate-50'}`}>
              <button type="button" onClick={()=>{setAddOpen(false);setAddError(null);}} className={cancelBtnCls}>Ακύρωση</button>
              <button type="button" onClick={addPackage} disabled={saving}
                className="btn-primary gap-2 px-4 py-2 font-semibold hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                {saving?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Plus className="h-3.5 w-3.5"/>}
                Προσθήκη
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={modalCardCls} style={isDark?{background:'var(--color-sidebar)'}:{}}>
            <div className="h-0.5 w-full bg-rose-500/60"/>
            <div className="px-6 pt-5 pb-4">
              <h3 className={`text-sm font-semibold ${isDark?'text-slate-50':'text-slate-800'}`}>Διαγραφή πακέτου</h3>
              <p className={`mt-2 text-xs leading-relaxed ${isDark?'text-slate-300':'text-slate-600'}`}>
                Σίγουρα θέλετε να διαγράψετε το πακέτο <span className="font-semibold text-amber-400">«{deleteTarget.name}»</span>; Η ενέργεια δεν μπορεί να αναιρεθεί.
              </p>
            </div>
            <div className={`flex justify-end gap-2.5 px-6 py-4 ${isDark?'border-t border-slate-800/70 bg-slate-900/20':'border-t border-slate-100 bg-slate-50'}`}>
              <button type="button" onClick={()=>{setDeleteOpen(false);setDeleteTarget(null);}} className={cancelBtnCls} disabled={saving}>Ακύρωση</button>
              <button type="button" onClick={confirmDelete} disabled={saving}
                className="btn bg-rose-600 gap-2 px-4 py-2 font-semibold text-white hover:bg-rose-500 active:scale-[0.97] disabled:opacity-60">
                {saving?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Trash2 className="h-3.5 w-3.5"/>}
                Διαγραφή
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}