// src/components/school-info/SchoolYearsSection.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { CalendarRange, Plus, Pencil, Trash2, X, Star, Loader2, Save, CopyPlus, Sun, History } from 'lucide-react';
import AppDatePicker from '../ui/AppDatePicker';
import { isSchoolYearCurrent, todayISODate } from './types';

type SchoolYearRow = {
  id: string; name: string; start_date: string; end_date: string; is_summer: boolean;
};

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
function formatRange(start: string, end: string) { return `${isoToDisplay(start)} – ${isoToDisplay(end)}`; }

export default function SchoolYearsSection() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;
  const { showToast } = useToast();

  const [rows, setRows] = useState<SchoolYearRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newSummer, setNewSummer] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editSummer, setEditSummer] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const [cloneTarget, setCloneTarget] = useState<{ target: SchoolYearRow; source: SchoolYearRow } | null>(null);
  const [cloning, setCloning] = useState(false);
  const [cloneNote, setCloneNote] = useState<string | null>(null);

  const load = async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from('school_years')
      .select('id,name,start_date,end_date,is_summer')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false });
    if (error) { setError(error.message); setLoading(false); return; }
    setRows((data ?? []) as SchoolYearRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [schoolId]);

  const rowCls = isDark
    ? 'group relative transition-colors hover:bg-[color:var(--color-accent)]/[0.12]'
    : 'group relative transition-colors hover:bg-[color:var(--color-accent)]/10';

  // A finished year is history — kept forever, but tucked behind the toggle below
  // instead of cluttering the list with every year the school has ever had.
  const isPastYear = (r: SchoolYearRow) => !isSchoolYearCurrent(r) && r.end_date < todayISODate();
  const currentAndUpcomingRows = (rows ?? []).filter((r) => !isPastYear(r));
  const pastRows = (rows ?? []).filter(isPastYear);

  const openAdd = () => {
    setNewName(''); setNewStart(''); setNewEnd('');
    setNewSummer(false);
    setAddError(null); setAddOpen(true);
  };
  const cancelAdd = () => { setAddOpen(false); setAddError(null); };

  // Two school years are never allowed to share a date — otherwise "which
  // year is this date in" (used to decide when the school is open) would be
  // ambiguous. Excludes `excludeId` so editing a year doesn't collide with itself.
  const findOverlappingYear = (startIso: string, endIso: string, excludeId?: string): SchoolYearRow | null => {
    return (rows ?? []).find((r) => r.id !== excludeId && startIso <= r.end_date && r.start_date <= endIso) ?? null;
  };

  const addYear = async () => {
    if (!schoolId) return;
    const name = newName.trim();
    const startIso = displayToIso(newStart);
    const endIso = displayToIso(newEnd);
    if (!name) { setAddError('Δώσε ένα όνομα.'); return; }
    if (!startIso || !endIso) { setAddError('Συμπλήρωσε ημερομηνία έναρξης και λήξης.'); return; }
    if (endIso < startIso) { setAddError('Η λήξη δεν μπορεί να είναι πριν την έναρξη.'); return; }
    const overlap = findOverlappingYear(startIso, endIso);
    if (overlap) { setAddError(`Οι ημερομηνίες επικαλύπτονται με το «${overlap.name}» (${formatRange(overlap.start_date, overlap.end_date)}).`); return; }

    setSaving(true); setAddError(null);
    try {
      const { error } = await supabase.from('school_years').insert({
        school_id: schoolId, name, start_date: startIso, end_date: endIso, is_summer: newSummer,
      });
      if (error) throw error;
      setAddOpen(false); showToast('Το έτος προστέθηκε.');
      await load();
    } catch (err: any) {
      setAddError(err?.message ?? 'Αποτυχία προσθήκης.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r: SchoolYearRow) => {
    setEditingId(r.id); setEditName(r.name);
    setEditStart(isoToDisplay(r.start_date)); setEditEnd(isoToDisplay(r.end_date));
    setEditSummer(r.is_summer); setEditError(null);
  };
  const cancelEdit = () => { setEditingId(null); setEditError(null); };

  const saveEdit = async () => {
    if (!schoolId || !editingId) return;
    const name = editName.trim();
    const startIso = displayToIso(editStart);
    const endIso = displayToIso(editEnd);
    if (!name) { setEditError('Δώσε ένα όνομα.'); return; }
    if (!startIso || !endIso) { setEditError('Συμπλήρωσε ημερομηνία έναρξης και λήξης.'); return; }
    if (endIso < startIso) { setEditError('Η λήξη δεν μπορεί να είναι πριν την έναρξη.'); return; }
    const overlap = findOverlappingYear(startIso, endIso, editingId);
    if (overlap) { setEditError(`Οι ημερομηνίες επικαλύπτονται με το «${overlap.name}» (${formatRange(overlap.start_date, overlap.end_date)}).`); return; }

    setSaving(true); setEditError(null);
    try {
      const { error } = await supabase.from('school_years')
        .update({ name, start_date: startIso, end_date: endIso, is_summer: editSummer })
        .eq('id', editingId);
      if (error) throw error;
      setEditingId(null); showToast('Αποθηκεύτηκε.');
      await load();
    } catch (err: any) {
      setEditError(err?.message ?? 'Αποτυχία αποθήκευσης.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('school_years').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      setDeleteTarget(null); showToast('Διαγράφηκε.');
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία διαγραφής.');
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const askClone = (target: SchoolYearRow) => {
    const source = (rows ?? []).find((r) => isSchoolYearCurrent(r) && r.id !== target.id) ?? null;
    if (!source) return;
    setCloneNote(null); setError(null);
    setCloneTarget({ target, source });
  };

  const confirmClone = async () => {
    if (!schoolId || !cloneTarget) return;
    const { target, source } = cloneTarget;
    const isIdiaiterou = profile?.account_type === 'idiaiterou';
    setCloning(true); setError(null);
    try {
      const { data: classRows } = await supabase.from('classes').select('id,is_active').eq('school_id', schoolId);
      const activeClassIds = new Set((classRows ?? []).filter((c) => c.is_active).map((c) => c.id));

      const { data: programRows } = await supabase.from('programs').select('id').eq('school_id', schoolId).order('created_at', { ascending: true }).limit(1);
      const programId = (programRows?.[0] as { id: string } | undefined)?.id ?? null;

      let clonedSlots = 0;
      if (programId) {
        const { data: itemRows } = await supabase.from('program_items').select('*').eq('program_id', programId);
        const overlapping = ((itemRows ?? []) as any[]).filter((it) => {
          const relevant = isIdiaiterou ? !!it.student_id : (it.class_id && activeClassIds.has(it.class_id));
          if (!relevant) return false;
          const s = it.start_date ?? '0001-01-01';
          const e = it.end_date ?? '9999-12-31';
          return s <= source.end_date && e >= source.start_date;
        });
        if (overlapping.length > 0) {
          // Rows sharing a group_id (a multi-student lesson) must keep sharing a
          // group_id after cloning — but a fresh one, not the source year's, so
          // editing a cloned lesson never touches the source year's rows.
          const newGroupIdByOld = new Map<string, string>();
          const payload = overlapping.map((it) => ({
            program_id: programId,
            class_id: it.class_id,
            group_id: it.group_id
              ? (newGroupIdByOld.get(it.group_id) ?? (() => { const id = crypto.randomUUID(); newGroupIdByOld.set(it.group_id, id); return id; })())
              : null,
            subject_id: it.subject_id,
            tutor_id: it.tutor_id,
            student_id: it.student_id,
            day_of_week: it.day_of_week,
            position: it.position,
            start_time: it.start_time,
            end_time: it.end_time,
            start_date: target.start_date,
            end_date: target.end_date,
            room: it.room,
            charge_per_session: it.charge_per_session,
          }));
          const { error: insErr } = await supabase.from('program_items').insert(payload);
          if (insErr) throw insErr;
          clonedSlots = payload.length;
        }
      }

      let clonedPackages = 0;
      if (!isIdiaiterou) {
        const { data: pkgRows } = await supabase.from('packages').select('*')
          .eq('school_id', schoolId).eq('school_year_id', source.id).eq('package_type', 'yearly');
        const pkgs = (pkgRows ?? []) as any[];
        if (pkgs.length > 0) {
          const payload = pkgs.map((p) => ({
            school_id: schoolId,
            name: p.name,
            price: p.price,
            currency: p.currency,
            is_active: p.is_active,
            sort_order: p.sort_order,
            package_type: 'yearly',
            period: 'yearly',
            school_year_id: target.id,
            starts_on: target.start_date,
            ends_on: target.end_date,
            avatar_color: p.avatar_color,
            is_custom: p.is_custom,
          }));
          const { error: pkgErr } = await supabase.from('packages').insert(payload);
          if (pkgErr) throw pkgErr;
          clonedPackages = payload.length;
        }
      }

      setCloneNote(isIdiaiterou
        ? `Αντιγράφηκαν ${clonedSlots} ώρες προγράμματος στο «${target.name}».`
        : `Αντιγράφηκαν ${clonedSlots} ώρες προγράμματος και ${clonedPackages} ετήσια πακέτα στο «${target.name}».`);
      setCloneTarget(null);
      showToast('Η αντιγραφή ολοκληρώθηκε.');
    } catch (err: any) {
      setError(err?.message ?? 'Αποτυχία αντιγραφής.');
    } finally {
      setCloning(false);
    }
  };

  const renderYearRow = (r: SchoolYearRow) => {
    const isEditing = editingId === r.id;

    if (isEditing) {
      return (
        <div key={r.id} className={`relative rounded-xl border-2 border-dashed overflow-hidden my-1.5 ${isDark ? 'border-slate-700/80 bg-slate-900/40' : 'border-slate-300 bg-slate-50/80'}`}>
          <div className="p-4 space-y-3">
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
              placeholder="π.χ. 2025-2026 ή Καλοκαίρι 2026"
              className={`w-full rounded-lg border px-3 py-1.5 text-sm font-medium outline-none transition ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/70' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/70'}`} />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-36"><AppDatePicker value={editStart} onChange={setEditStart} /></div>
                <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>
                <div className="w-36"><AppDatePicker value={editEnd} onChange={setEditEnd} /></div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setEditSummer(false)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${!editSummer ? (isDark ? 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]' : 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]') : (isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-white text-slate-500')}`}>
                  Κανονικό
                </button>
                <button type="button" onClick={() => setEditSummer(true)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${editSummer ? (isDark ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-sky-300 bg-sky-50 text-sky-600') : (isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-white text-slate-500')}`}>
                  <Sun className="h-3 w-3" />Καλοκαιρινό
                </button>
              </div>
            </div>
            {editError && <p className="text-xs text-red-400">{editError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={cancelEdit} disabled={saving}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                <X className="h-3 w-3" />Ακύρωση
              </button>
              <button type="button" onClick={saveEdit} disabled={saving} className="btn-primary gap-2 px-4 py-1.5 text-xs disabled:opacity-60">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Αποθήκευση
              </button>
            </div>
          </div>
        </div>
      );
    }

    const isCurrent = isSchoolYearCurrent(r);
    return (
      <div key={r.id} className={rowCls}>
        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: isCurrent ? '#f59e0b' : 'transparent' }} />
        <div className="flex items-center gap-3 py-3 pl-4 pr-1">
          {isCurrent && (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-600'}`}>
              <Star className="h-2.5 w-2.5 fill-current" />Τρέχον
            </span>
          )}
          {r.is_summer && (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? 'border-sky-500/20 bg-sky-500/10 text-sky-300' : 'border-sky-200 bg-sky-50 text-sky-600'}`}>
              <Sun className="h-2.5 w-2.5" />Καλοκαίρι
            </span>
          )}
          <span className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{r.name}</span>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatRange(r.start_date, r.end_date)}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {!isCurrent && (rows ?? []).some((y) => isSchoolYearCurrent(y) && y.id !== r.id) && (
              <button type="button" onClick={() => askClone(r)} title="Αντιγραφή τμημάτων & ετήσιων πακέτων από το τρέχον έτος"
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[color:var(--color-accent)]/40 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'}`}>
                <CopyPlus className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={() => openEdit(r)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-[color:var(--color-accent)]/40 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setDeleteTarget({ id: r.id, name: r.name })}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-red-500/40 hover:text-red-400 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-white text-slate-400'}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>Σχολικά έτη</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Ορίστε τις περιόδους λειτουργίας (σχολικό έτος, καλοκαιρινό τμήμα κ.λπ.) — όνομα και διάστημα δικής σας επιλογής. Το τρέχον έτος υπολογίζεται αυτόματα από τις ημερομηνίες.
          </p>
        </div>
        {!addOpen && (
          <button type="button" onClick={openAdd} className="btn-ghost flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />Νέο έτος
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {error}
        </div>
      )}

      {cloneNote && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${isDark ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          {cloneNote}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentAndUpcomingRows.length > 0 && (
            <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
              {currentAndUpcomingRows.map((r) => renderYearRow(r))}
            </div>
          )}

          {pastRows.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}
            >
              <History className="h-3 w-3" />
              {`Ιστορικό ετών (${pastRows.length})`}
            </button>
          )}

          {addOpen && (
            <div className={`relative rounded-xl border-2 border-dashed overflow-hidden ${isDark ? 'border-slate-700/80 bg-slate-900/40' : 'border-slate-300 bg-slate-50/80'}`}>
              <div className="p-4 space-y-3">
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="π.χ. 2025-2026 ή Καλοκαίρι 2026"
                  className={`w-full rounded-lg border px-3 py-1.5 text-sm font-medium outline-none transition ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500 focus:border-[color:var(--color-accent)]/70' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:border-[color:var(--color-accent)]/70'}`} />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-36"><AppDatePicker value={newStart} onChange={setNewStart} placeholder="Έναρξη" /></div>
                    <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>
                    <div className="w-36"><AppDatePicker value={newEnd} onChange={setNewEnd} placeholder="Λήξη" /></div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setNewSummer(false)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${!newSummer ? (isDark ? 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]' : 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]') : (isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-white text-slate-500')}`}>
                      Κανονικό
                    </button>
                    <button type="button" onClick={() => setNewSummer(true)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${newSummer ? (isDark ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-sky-300 bg-sky-50 text-sky-600') : (isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-white text-slate-500')}`}>
                      <Sun className="h-3 w-3" />Καλοκαιρινό
                    </button>
                  </div>
                </div>
                {addError && <p className="text-xs text-red-400">{addError}</p>}
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={cancelAdd} disabled={saving}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'}`}>
                    <X className="h-3 w-3" />Ακύρωση
                  </button>
                  <button type="button" onClick={addYear} disabled={saving} className="btn-primary gap-2 px-4 py-1.5 text-xs disabled:opacity-60">
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}Προσθήκη
                  </button>
                </div>
              </div>
            </div>
          )}

          {(!rows || rows.length === 0) && !addOpen && (
            <div className={`flex flex-col items-center gap-3 py-10 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <CalendarRange className="h-8 w-8 opacity-30" />
              <p className="text-sm">Δεν έχετε ορίσει ακόμα σχολικά έτη.</p>
              <button type="button" onClick={openAdd} className="text-xs font-semibold underline underline-offset-2" style={{ color: 'var(--color-accent)' }}>
                Δημιούργησε το πρώτο
              </button>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`} style={{ background: 'var(--color-sidebar)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <CalendarRange className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Διαγραφή έτους</h3>
            </div>
            <div className="px-6 pt-5 pb-4">
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Σίγουρα θέλετε να διαγράψετε το «{deleteTarget.name}»; Πακέτα και συνδρομές που το χρησιμοποιούν θα αποσυνδεθούν από αυτό, δεν θα διαγραφούν.
              </p>
            </div>
            <div className={`flex justify-end gap-2.5 px-6 py-4 ${isDark ? 'border-t border-slate-800/70 bg-slate-900/20' : 'border-t border-slate-100 bg-slate-50'}`}>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={saving}
                className={isDark ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-2 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50' : 'btn border border-slate-300 bg-white px-4 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50'}>
                Ακύρωση
              </button>
              <button type="button" onClick={confirmDelete} disabled={saving}
                className="btn bg-rose-600 gap-2 px-4 py-2 font-semibold text-white hover:bg-rose-500 active:scale-[0.97] disabled:opacity-60">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Διαγραφή
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`} style={{ background: 'var(--color-sidebar)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Ιστορικό ετών</h3>
              </div>
              <button type="button" onClick={() => setShowHistory(false)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${isDark ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className={`max-h-[60vh] overflow-y-auto ss-thin divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
              {pastRows.map((r) => renderYearRow(r))}
            </div>
          </div>
        </div>
      )}

      {cloneTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`} style={{ background: 'var(--color-sidebar)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
                <CopyPlus className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Αντιγραφή σε νέο έτος</h3>
            </div>
            <div className="px-6 pt-5 pb-4">
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Θα αντιγραφούν οι ενεργές ώρες προγράμματος (για ενεργά τμήματα) και τα ετήσια πακέτα από το «{cloneTarget.source.name}» στο «{cloneTarget.target.name}», με τις ημερομηνίες προσαρμοσμένες στο νέο διάστημα ({formatRange(cloneTarget.target.start_date, cloneTarget.target.end_date)}). Η ενέργεια δημιουργεί νέες εγγραφές — αν την εκτελέσετε ξανά θα δημιουργηθούν διπλές.
              </p>
            </div>
            <div className={`flex justify-end gap-2.5 px-6 py-4 ${isDark ? 'border-t border-slate-800/70 bg-slate-900/20' : 'border-t border-slate-100 bg-slate-50'}`}>
              <button type="button" onClick={() => setCloneTarget(null)} disabled={cloning}
                className={isDark ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-2 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50' : 'btn border border-slate-300 bg-white px-4 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50'}>
                Ακύρωση
              </button>
              <button type="button" onClick={confirmClone} disabled={cloning} className="btn-primary gap-2 px-4 py-2 disabled:opacity-60">
                {cloning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CopyPlus className="h-3.5 w-3.5" />}Αντιγραφή
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
