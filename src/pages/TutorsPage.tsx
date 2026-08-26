// src/pages/TutorsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import TutorFormModal from '../components/tutors/TutorFormModal';
import TutorDeleteModal from '../components/tutors/TutorDeleteModal';
import SpecialtiesCatalogModal from '../components/tutors/SpecialtiesCatalogModal';
import TutorSortDropdown, {
  DEFAULT_TUTOR_SORT,
  type TutorSortState,
} from '../components/tutors/TutorSortDropdown';
import TutorColumnFilterDropdown, {
  ALL_TUTOR_COLUMNS,
  DEFAULT_TUTOR_VISIBLE,
  type TutorColumnKey,
  type TutorColumnDef,
} from '../components/tutors/TutorColumnFilterDropdown';
import PageSizeDropdown, {
  type PageSizeOption,
} from '../components/students/PageSizeDropdown';
import type { ModalMode, SpecialtyRow, TutorFormState, TutorRow } from '../components/tutors/types';
import { TUTOR_SELECT } from '../components/tutors/types';
import { formatDateToGreek, normalizeText, displayToIso } from '../components/tutors/utils';
import {
  Users, Search, UserPlus, ChevronLeft, ChevronRight,
  Copy, Check, Tags,
} from 'lucide-react';

// ── Storage keys ─────────────────────────────────────────────────────────────
const COLUMNS_KEY   = 'pt_tutors_visible_columns_v3';
const SORT_KEY      = 'pt_tutors_sort_v1';
const PAGE_SIZE_KEY = 'pt_tutors_page_size_v1';

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

// Strips Greek accent marks so CSS uppercase doesn't produce e.g. ΟΝΟΜΑΤΕΠΏΝΥΜΟ
function stripGreekAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function loadSavedColumns(): Set<TutorColumnKey> {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    if (!raw) return new Set(DEFAULT_TUTOR_VISIBLE);
    const parsed = JSON.parse(raw) as TutorColumnKey[];
    if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
  } catch { /* ignore */ }
  return new Set(DEFAULT_TUTOR_VISIBLE);
}
function loadSavedSort(): TutorSortState {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TutorSortState;
      if (parsed?.field && parsed?.dir) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_TUTOR_SORT;
}
function loadSavedPageSize(): PageSizeOption {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_KEY);
    if (raw) {
      const n = parseInt(raw, 10) as PageSizeOption;
      if ([10, 25, 50, 100].includes(n)) return n;
    }
  } catch { /* ignore */ }
  return 10;
}

// ── Sort comparator ──────────────────────────────────────────────────────────
function sortTutors(list: TutorRow[], sort: TutorSortState): TutorRow[] {
  const { field, dir } = sort;
  const mul = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const va: string | null = (a as any)[field] ?? null;
    const vb: string | null = (b as any)[field] ?? null;
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return mul * va.localeCompare(vb, 'el', { sensitivity: 'base' });
  });
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function TutorsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;
  const location = useLocation();
  const navigate = useNavigate();

  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingTutor, setEditingTutor] = useState<TutorRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<TutorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Specialties catalog + per-tutor links
  const [specialties, setSpecialties] = useState<SpecialtyRow[]>([]);
  const [tutorSpecialtyMap, setTutorSpecialtyMap] = useState<Map<string, SpecialtyRow[]>>(new Map());
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Search & pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);

  // Persisted preferences
  const [visibleColumns, setVisibleColumns] = useState<Set<TutorColumnKey>>(loadSavedColumns);
  const [sort, setSort] = useState<TutorSortState>(loadSavedSort);
  const [pageSize, setPageSize] = useState<PageSizeOption>(loadSavedPageSize);

  const handleColumnsChange = (next: Set<TutorColumnKey>) => {
    setVisibleColumns(next);
    try { localStorage.setItem(COLUMNS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  };
  const handleSortChange = (next: TutorSortState) => {
    setSort(next);
    try { localStorage.setItem(SORT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const handlePageSizeChange = (next: PageSizeOption) => {
    setPageSize(next);
    setPage(1);
    try { localStorage.setItem(PAGE_SIZE_KEY, String(next)); } catch { /* ignore */ }
  };

  // Load tutors + specialties catalog + tutor↔specialty links
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      const [tutorsRes, specialtiesRes, linksRes] = await Promise.all([
        supabase.from('tutors').select(TUTOR_SELECT).eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true }),
        supabase.from('specialties').select('*').eq('school_id', schoolId).order('name', { ascending: true }),
        supabase.from('tutor_specialties').select('tutor_id, specialties(*)').eq('school_id', schoolId),
      ]);
      if (tutorsRes.error) { console.error(tutorsRes.error); setError('Αποτυχία φόρτωσης καθηγητών.'); }
      else { setTutors((tutorsRes.data ?? []) as TutorRow[]); }

      if (!specialtiesRes.error) setSpecialties((specialtiesRes.data ?? []) as SpecialtyRow[]);
      if (!linksRes.error) {
        const map = new Map<string, SpecialtyRow[]>();
        (linksRes.data ?? []).forEach((row: any) => {
          if (!row.specialties) return;
          const arr = map.get(row.tutor_id) ?? [];
          arr.push(row.specialties as SpecialtyRow);
          map.set(row.tutor_id, arr);
        });
        setTutorSpecialtyMap(map);
      }
      setLoading(false);
    };
    load();
  }, [schoolId]);

  // Modal handlers
  const openCreateModal = () => { setError(null); setModalMode('create'); setEditingTutor(null); setModalOpen(true); };
  const openEditModal = (row: TutorRow) => { setError(null); setModalMode('edit'); setEditingTutor(row); setModalOpen(true); };
  const closeModal = () => { if (saving) return; setModalOpen(false); setEditingTutor(null); setModalMode('create'); };

  useEffect(() => {
    if ((location.state as { openCreate?: boolean } | null)?.openCreate) {
      openCreateModal();
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname, navigate]);

  // ── Sync a tutor's specialty links to match the selected set ──────────────
  const syncTutorSpecialties = async (tutorId: string, specialtyIds: string[]) => {
    if (!schoolId) return;
    const current = tutorSpecialtyMap.get(tutorId) ?? [];
    const currentIds = new Set(current.map((s) => s.id));
    const nextIds = new Set(specialtyIds);
    const toAdd = specialtyIds.filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

    if (toAdd.length > 0) {
      const { error: addErr } = await supabase.from('tutor_specialties')
        .upsert(toAdd.map((specialtyId) => ({ school_id: schoolId, tutor_id: tutorId, specialty_id: specialtyId })),
          { onConflict: 'tutor_id,specialty_id' });
      if (addErr) throw addErr;
    }
    if (toRemove.length > 0) {
      const { error: delErr } = await supabase.from('tutor_specialties')
        .delete().eq('tutor_id', tutorId).in('specialty_id', toRemove);
      if (delErr) throw delErr;
    }

    setTutorSpecialtyMap((prev) => {
      const next = new Map(prev);
      next.set(tutorId, specialties.filter((s) => nextIds.has(s.id)));
      return next;
    });
  };

  // ── Create / Update via edge functions ───────────────────────────────────
  const handleSubmit = async (form: TutorFormState, specialtyIds: string[]) => {
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    const fullNameTrimmed = form.fullName.trim();
    if (!fullNameTrimmed) return;
    setSaving(true); setError(null);

    try {
      if (modalMode === 'create') {
        const data = await callEdgeFunction('tutors-create', {
          full_name: fullNameTrimmed,
          date_of_birth: displayToIso(form.dateOfBirth) || null,
          hire_date: displayToIso(form.hireDate) || null,
          afm: form.afm.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          iban: form.iban.trim() || null,
          notes: form.notes.trim() || null,
        });
        const newTutor = data.item as TutorRow;
        setTutors((prev) => [...prev, newTutor]);
        if (specialtyIds.length > 0) await syncTutorSpecialties(newTutor.id, specialtyIds);
        closeModal();
      } else if (modalMode === 'edit' && editingTutor) {
        const data = await callEdgeFunction('tutors-update', {
          tutor_id: editingTutor.id,
          full_name: fullNameTrimmed,
          date_of_birth: displayToIso(form.dateOfBirth) || null,
          hire_date: displayToIso(form.hireDate) || null,
          afm: form.afm.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          iban: form.iban.trim() || null,
          notes: form.notes.trim() || null,
        });
        setTutors((prev) => prev.map((t) => (t.id === editingTutor.id ? (data.item as TutorRow) : t)));
        await syncTutorSpecialties(editingTutor.id, specialtyIds);
        closeModal();
      }
    } catch (err) {
      console.error(err);
      setError(
        modalMode === 'create'
          ? 'Αποτυχία δημιουργίας καθηγητή.'
          : 'Αποτυχία ενημέρωσης καθηγητή.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Delete via edge function ─────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError(null);

    try {
      await callEdgeFunction('tutors-delete', { tutor_id: deleteTarget.id });
      setTutors((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής καθηγητή.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Specialties catalog handlers ──────────────────────────────────────────
  const handleSpecialtyCreated = (row: SpecialtyRow) => setSpecialties((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name, 'el')));
  const handleSpecialtyDeleted = (id: string) => {
    setSpecialties((prev) => prev.filter((s) => s.id !== id));
    setTutorSpecialtyMap((prev) => {
      const next = new Map<string, SpecialtyRow[]>();
      prev.forEach((list, tutorId) => next.set(tutorId, list.filter((s) => s.id !== id)));
      return next;
    });
  };

  // ── Pipeline: filter → sort → paginate ──────────────────────────────────
  const filteredTutors = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return tutors;
    return tutors.filter((t) => {
      const composite = [
        t.full_name, t.afm, t.phone, t.email, t.iban, t.notes,
        t.date_of_birth, t.date_of_birth ? formatDateToGreek(t.date_of_birth) : '',
        t.hire_date, t.hire_date ? formatDateToGreek(t.hire_date) : '',
        ...(tutorSpecialtyMap.get(t.id) ?? []).map((s) => s.name),
      ].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [tutors, search, tutorSpecialtyMap]);

  const sortedTutors = useMemo(() => sortTutors(filteredTutors, sort), [filteredTutors, sort]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(sortedTutors.length / pageSize)), [sortedTutors.length, pageSize]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const pagedTutors = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedTutors.slice(start, start + pageSize);
  }, [sortedTutors, page, pageSize]);

  const showingFrom = sortedTutors.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, sortedTutors.length);

  const visibleColumnDefs = useMemo(
    () => ALL_TUTOR_COLUMNS.filter((c: TutorColumnDef) => visibleColumns.has(c.key)),
    [visibleColumns],
  );

  // ── Copy button ──────────────────────────────────────────────────────────
  const CopyBtn = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    return (
      <button type="button" title="Αντιγραφή"
        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
        className={`ml-1.5 shrink-0 rounded p-0.5 transition-colors ${isDark ? 'text-slate-600 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      </button>
    );
  };

  // ── Cell renderer ────────────────────────────────────────────────────────
  const renderCell = (key: TutorColumnKey, t: TutorRow) => {
    const empty = <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>;
    switch (key) {
      case 'full_name':
        return <span className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>{t.full_name}</span>;
      case 'date_of_birth':
        return t.date_of_birth
          ? <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDateToGreek(t.date_of_birth)}</span>
          : empty;
      case 'hire_date':
        return t.hire_date
          ? <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDateToGreek(t.hire_date)}</span>
          : empty;
      case 'afm':
        return t.afm
          ? <span className={`tabular-nums font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t.afm}</span>
          : empty;
      case 'phone':
        return t.phone ? <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t.phone}</span> : empty;
      case 'email':
        return t.email
          ? <span className="inline-flex items-center"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{t.email}</span><CopyBtn text={t.email} /></span>
          : empty;
      case 'iban':
        return t.iban
          ? <span className="inline-flex items-center"><span className={`font-mono text-[11px] tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.iban}</span><CopyBtn text={t.iban} /></span>
          : empty;
      case 'notes':
        return t.notes
          ? <span className={`max-w-xs truncate block ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={t.notes}>{t.notes}</span>
          : empty;
      case 'specialties': {
        const list = tutorSpecialtyMap.get(t.id) ?? [];
        return list.length > 0
          ? <span className="max-w-xs truncate block font-medium" style={{ color: 'var(--color-accent)' }} title={list.map((s) => s.name).join(', ')}>
              {list.map((s) => s.name).join(', ')}
            </span>
          : empty;
      }
      default: return empty;
    }
  };

  // ── Style helpers — minimal: no cell/card borders at all, just one accent rule under the header ──
  const searchInputCls = `h-9 w-full rounded-lg border pl-9 pr-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] sm:w-52 ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400'}`;
  const tableCardCls = '';
  const theadRowCls = '';
  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200';
  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';
  const trHoverCls = isDark ? 'transition-colors hover:bg-slate-900/40' : 'transition-colors hover:bg-slate-50/80';
  const paginationBarCls = 'flex items-center justify-between gap-3 pt-4';
  const paginationBtnCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30';
  const paginationPageCls = isDark ? 'px-2 text-[11px] text-slate-300' : 'px-2 text-[11px] text-slate-600';

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Badges + controls row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
            <Users className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            {tutors.length} σύνολο
          </span>
          {search.trim() && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
              style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
              <Search className="h-3 w-3" />
              {sortedTutors.length} αποτελέσματα
            </span>
          )}

          <span className={`h-3.5 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />

          <TutorSortDropdown sort={sort} onChange={handleSortChange} isDark={isDark} />
          <TutorColumnFilterDropdown visible={visibleColumns} onChange={handleColumnsChange} isDark={isDark} />
          <PageSizeDropdown value={pageSize} onChange={handlePageSizeChange} isDark={isDark} />
        </div>

        {/* Right: search + add */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={searchInputCls} placeholder="Αναζήτηση καθηγητή..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" onClick={() => setCatalogOpen(true)}
            className={`btn h-9 gap-2 border px-4 font-semibold transition active:scale-[0.98] ${
              isDark ? 'border-slate-700/70 bg-slate-800/60 text-slate-300 hover:border-slate-600' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}>
            <Tags className="h-3.5 w-3.5" />
            Ειδικότητες
          </button>
          <button type="button" onClick={openCreateModal}
            className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]">
            <UserPlus className="h-3.5 w-3.5" />
            Προσθήκη καθηγητή
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && !modalOpen && !deleteTarget && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.
        </div>
      )}

      {/* ── Table card ── */}
      <div className={tableCardCls}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-3 w-20 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
                <div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
                <div className={`h-3 w-28 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} />
              </div>
            ))}
          </div>
        ) : tutors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
              <Users className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη καθηγητές</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη καθηγητή» για να δημιουργήσετε τον πρώτο.</p>
            </div>
          </div>
        ) : sortedTutors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
              <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν καθηγητές</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls} style={{ borderBottom: '2px solid var(--color-accent)' }}>
                  <th style={{ width: '1%' }} className={`whitespace-nowrap px-5 pb-3 text-left text-xs font-bold uppercase tracking-wide ${visibleColumnDefs.length > 0 ? colDivider : ''} ${isDark ? 'text-white' : 'text-black'}`}>#</th>
                  {visibleColumnDefs.map((col: TutorColumnDef) => (
                    <th key={col.key} className={`px-5 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>
                      {stripGreekAccents(col.label)}
                    </th>
                  ))}
                  <th className={`px-5 pb-3 text-right text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>
              <tbody className={tbodyDivideCls}>
                {pagedTutors.map((t, i) => (
                  <tr key={t.id} className={trHoverCls}>
                    <td className={`whitespace-nowrap px-5 py-3.5 tabular-nums ${visibleColumnDefs.length > 0 ? colDivider : ''} ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{(page - 1) * pageSize + i + 1}</td>
                    {visibleColumnDefs.map((col: TutorColumnDef) => (
                      <td key={col.key} className={`px-5 py-3.5 ${colDivider}`}>
                        {renderCell(col.key, t)}
                      </td>
                    ))}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <EditDeleteButtons onEdit={() => openEditModal(t)} onDelete={() => { setError(null); setDeleteTarget(t); }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination footer ── */}
        {!loading && sortedTutors.length > 0 && (
          <div className={paginationBarCls}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{sortedTutors.length}</span> καθηγητές
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className={paginationPageCls}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <TutorFormModal
        open={modalOpen}
        mode={modalMode}
        editingTutor={editingTutor}
        allSpecialties={specialties}
        initialSpecialtyIds={editingTutor ? (tutorSpecialtyMap.get(editingTutor.id) ?? []).map((s) => s.id) : []}
        error={error}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <TutorDeleteModal
        deleteTarget={deleteTarget}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
      />

      <SpecialtiesCatalogModal
        open={catalogOpen}
        schoolId={schoolId}
        specialties={specialties}
        isDark={isDark}
        onClose={() => setCatalogOpen(false)}
        onCreated={handleSpecialtyCreated}
        onDeleted={handleSpecialtyDeleted}
      />
    </div>
  );
}