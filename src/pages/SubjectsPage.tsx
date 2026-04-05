// src/pages/SubjectsPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { NotebookText, Search, Plus } from 'lucide-react';
import SubjectsGrid from '../components/subjects/SubjectsGrid';
import SubjectFormModal from '../components/subjects/SubjectFormModal';
import SubjectDeleteModal from '../components/subjects/SubjectDeleteModal';
import { useTheme } from '../context/ThemeContext';
import type { LevelRow, SubjectRow, TutorRow, ModalMode } from '../components/subjects/types';
import { normalizeText } from '../components/subjects/utils';

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

export default function SubjectsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [allTutors, setAllTutors] = useState<TutorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<SubjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tutor assignments map
  const [tutorsBySubject, setTutorsBySubject] = useState<Map<string, TutorRow[]>>(new Map());
  const [reloadTutorsFlag, setReloadTutorsFlag] = useState(0);

  // Search
  const [search, setSearch] = useState('');

  // ── Load levels ──
  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from('levels')
      .select('*')
      .eq('school_id', schoolId)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error(error); setError('Αποτυχία φόρτωσης επιπέδων.'); }
        else setLevels((data ?? []) as LevelRow[]);
      });
  }, [schoolId]);

  // ── Load subjects ──
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true); setError(null);
    supabase
      .from('subjects')
      .select('id, school_id, name, level_id, created_at')
      .eq('school_id', schoolId)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error(error); setError('Αποτυχία φόρτωσης μαθημάτων.'); }
        else setSubjects((data ?? []) as SubjectRow[]);
        setLoading(false);
      });
  }, [schoolId]);

  // ── Load tutors + subject_tutors map ──
  useEffect(() => {
    if (!schoolId) return;
    const load = async () => {
      try {
        const [{ data: tutorsData, error: tutorsErr }, { data: linksData, error: linksErr }] = await Promise.all([
          supabase.from('tutors').select('id, school_id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true }),
          supabase.from('subject_tutors').select('subject_id, tutor_id').eq('school_id', schoolId),
        ]);
        if (tutorsErr) throw tutorsErr;
        if (linksErr) throw linksErr;

        const tutors = (tutorsData ?? []) as TutorRow[];
        setAllTutors(tutors);

        type LinkRow = { subject_id: string; tutor_id: string };
        const links = (linksData ?? []) as LinkRow[];
        const map = new Map<string, TutorRow[]>();
        links.forEach((link) => {
          const tutor = tutors.find((t) => t.id === link.tutor_id);
          if (!tutor) return;
          const list = map.get(link.subject_id) ?? [];
          list.push(tutor);
          map.set(link.subject_id, list);
        });
        setTutorsBySubject(map);
      } catch (err) {
        console.error('Error loading tutors', err);
      }
    };
    load();
  }, [schoolId, reloadTutorsFlag]);

  // ── Modal handlers ──
  const openCreateModal = () => { setError(null); setModalMode('create'); setEditingSubject(null); setModalOpen(true); };
  const openEditModal = (row: SubjectRow) => { setError(null); setModalMode('edit'); setEditingSubject(row); setModalOpen(true); };
  const closeModal = () => { if (saving) return; setModalOpen(false); setEditingSubject(null); setModalMode('create'); };

  // ── Create / Update ──
  const handleSubmit = async (name: string, levelId: string) => {
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    const nameTrimmed = name.trim();
    if (!nameTrimmed) return;
    if (!levelId) { setError('Παρακαλώ επιλέξτε επίπεδο.'); return; }
    setSaving(true); setError(null);
    try {
      if (modalMode === 'create') {
        const data = await callEdgeFunction('subjects-create', { name: nameTrimmed, level_id: levelId });
        setSubjects((prev) => [...prev, data.item as SubjectRow].sort((a, b) => a.name.localeCompare(b.name, 'el')));
        closeModal();
      } else if (modalMode === 'edit' && editingSubject) {
        const data = await callEdgeFunction('subjects-update', { subject_id: editingSubject.id, name: nameTrimmed, level_id: levelId });
        setSubjects((prev) => prev.map((s) => (s.id === editingSubject.id ? (data.item as SubjectRow) : s)));
        closeModal();
      }
    } catch (err) {
      console.error(err);
      setError(modalMode === 'create' ? 'Αποτυχία δημιουργίας μαθήματος.' : 'Αποτυχία ενημέρωσης μαθήματος.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError(null);
    try {
      await callEdgeFunction('subjects-delete', { subject_id: deleteTarget.id });
      setSubjects((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής μαθήματος.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtering ──
  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  const filteredSubjects = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return subjects;
    return subjects.filter((subj) => {
      const levelName = subj.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
      return normalizeText([subj.name, levelName].join(' ')).includes(q);
    });
  }, [subjects, levelNameById, search]);

  // ── Style classes ──
  const searchInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52';

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
          >
            <NotebookText className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Μαθήματα
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Διαχείριση μαθημάτων και των επιπέδων τους.
            </p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <NotebookText className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  {subjects.length} σύνολο
                </span>
                {search.trim() && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}
                  >
                    <Search className="h-3 w-3" />
                    {filteredSubjects.length} αποτελέσματα
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              className={searchInputCls}
              placeholder="Αναζήτηση μαθήματος..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Προσθήκη μαθήματος
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && !modalOpen && !deleteTarget && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* ── Cards grid ── */}
      <SubjectsGrid
        loading={loading}
        levels={levels}
        subjects={subjects}
        filteredSubjects={filteredSubjects}
        tutorsBySubject={tutorsBySubject}
        allTutors={allTutors}
        isDark={isDark}
        onEditSubject={openEditModal}
        onDeleteSubject={(s) => { setError(null); setDeleteTarget(s); }}
        onTutorsChanged={() => setReloadTutorsFlag((x) => x + 1)}
      />

      {/* ── Modals ── */}
      <SubjectFormModal
        open={modalOpen}
        mode={modalMode}
        editingSubject={editingSubject}
        levels={levels}
        error={error}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <SubjectDeleteModal
        deleteTarget={deleteTarget}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}