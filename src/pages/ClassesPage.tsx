import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient.ts';
import { useAuth } from '../auth.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import ClassFormModal from '../components/classes/ClassFormModal.tsx';
import ClassStudentsModal from '../components/classes/ClassStudentsModal.tsx';
import ClassDeleteModal from '../components/classes/ClassDeleteModal.tsx';
import ClassesTable from '../components/classes/ClassesTable.tsx';
import { Plus, School, Search, GraduationCap } from 'lucide-react';
import type { ClassRow, SubjectRow, LevelRow, ModalMode, ClassFormState } from '../components/classes/types.ts';
import { normalizeText } from '../components/classes/utils.ts';

export default function ClassesPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const pageSize = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [studentsModalClass, setStudentsModalClass] = useState<{ id: string; title: string } | null>(null);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const loadClasses = async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase.from('classes').select('id, school_id, title, subject, subject_id, tutor_id').eq('school_id', schoolId).order('title', { ascending: true });
      if (error) { console.error(error); setError('Αποτυχία φόρτωσης τμημάτων.'); } else { setClasses((data ?? []) as ClassRow[]); }
      setLoading(false);
    };
    const loadLookups = async () => {
      try {
        const [{ data: subjData, error: subjErr }, { data: levelData, error: lvlErr }] = await Promise.all([
          supabase.from('subjects').select('id, school_id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('levels').select('id, school_id, name').eq('school_id', schoolId).order('name', { ascending: true }),
        ]);
        if (subjErr) console.error(subjErr);
        if (lvlErr) console.error(lvlErr);
        if (subjData) setSubjects(subjData as SubjectRow[]);
        if (levelData) setLevels(levelData as LevelRow[]);
      } catch (err) { console.error('Lookup load error', err); }
    };
    loadClasses(); loadLookups();
  }, [schoolId]);

  const openCreateModal = () => { setError(null); setModalMode('create'); setEditingClass(null); setModalOpen(true); };
  const openEditModal = (row: ClassRow) => { setError(null); setModalMode('edit'); setEditingClass(row); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingClass(null); setSaving(false); };

  const handleSaveClass = async (form: ClassFormState) => {
    setError(null);
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id).'); return; }
    if (!form.title.trim()) { setError('Το όνομα του τμήματος είναι υποχρεωτικό.'); return; }
    if (!form.levelId) { setError('Πρέπει να επιλέξετε επίπεδο.'); return; }
    if (!form.subjectIds || form.subjectIds.length === 0) { setError('Πρέπει να επιλέξετε τουλάχιστον ένα μάθημα για το τμήμα.'); return; }
    const invalidSubject = form.subjectIds.some((id) => { const subj = subjects.find((s) => s.id === id); return !subj || subj.level_id !== form.levelId; });
    if (invalidSubject) { setError('Όλα τα μαθήματα πρέπει να ανήκουν στο ίδιο επίπεδο.'); return; }
    const selectedSubjectRows = subjects.filter((s) => form.subjectIds.includes(s.id));
    const subjectText = selectedSubjectRows.map((s) => s.name).join(', ') || null;
    const primarySubjectId = form.subjectIds[0] ?? null;
    const payload = { school_id: schoolId, title: form.title.trim(), subject: subjectText, subject_id: primarySubjectId };
    setSaving(true);
    if (modalMode === 'create') {
      const { data, error } = await supabase.functions.invoke('classes-create', {
        body: {
          title: payload.title,
          subject: payload.subject,
          subject_id: payload.subject_id,
        },
      });
      setSaving(false);
      if (error || !data?.item) {
        console.error(error ?? data);
        setError('Αποτυχία δημιουργίας τμήματος.');
        return;
      }

      setClasses((prev) => [data.item as ClassRow, ...prev]);
      closeModal();
    } else {
      if (!editingClass) { setSaving(false); return; }
      const { data, error } = await supabase.functions.invoke('classes-update', {
        body: {
          class_id: editingClass.id,
          title: payload.title,
          subject: payload.subject,
          subject_id: payload.subject_id,
        },
      });
      setSaving(false);
      if (error || !data?.item) {
        console.error(error ?? data);
        setError('Αποτυχία ενημέρωσης τμήματος.');
        return;
      }

      setClasses((prev) =>
        prev.map((c) => (c.id === editingClass.id ? (data.item as ClassRow) : c))
      );
      closeModal();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null); setDeleting(true);
    const { error } = await supabase.functions.invoke('classes-delete', {
      body: {
        class_id: deleteTarget.id,
      },
    });
    setDeleting(false);
    if (error) { console.error(error); setError('Αποτυχία διαγραφής τμήματος.'); return; }
    setClasses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const filteredClasses = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return classes;
    return classes.filter((c) => {
      let levelName = '';
      if (c.subject_id) { const subjRow = subjects.find((s) => s.id === c.subject_id); if (subjRow?.level_id) levelName = levelNameById.get(subjRow.level_id) ?? ''; }
      const composite = [c.title, c.subject, levelName].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [classes, search, subjects, levelNameById]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredClasses.length / pageSize)), [filteredClasses.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const pagedClasses = useMemo(() => { const start = (page - 1) * pageSize; return filteredClasses.slice(start, start + pageSize); }, [filteredClasses, page]);
  const showingFrom = filteredClasses.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredClasses.length);

  const cardCls = `overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${isDark ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]' : 'border-slate-200 bg-white/80 ring-black/[0.02]'}`;
  const inputCls = `h-9 w-full rounded-lg border pl-9 pr-3 text-xs outline-none ring-0 backdrop-blur transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400'}`;

  return (
    <div className="space-y-6 px-1">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <GraduationCap className="h-4.5 w-4.5" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Τμήματα</h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Διαχείριση τμημάτων με μάθημα και επίπεδο.</p>
            <div className="mt-2 flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                <School className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                {classes.length} σύνολο
              </span>
              {search.trim() && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                  style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                  <Search className="h-3 w-3" />
                  {filteredClasses.length} αποτελέσματα
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={`${inputCls} sm:w-52`} placeholder="Αναζήτηση τμήματος..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" onClick={openCreateModal}
            className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]">
            <Plus className="h-3.5 w-3.5" />
            Προσθήκη Τμήματος
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* ── Table card ── */}
      <div className={cardCls}>
        <ClassesTable
          loading={loading}
          classes={classes}
          filteredClasses={filteredClasses}
          pagedClasses={pagedClasses}
          subjects={subjects}
          levelNameById={levelNameById}
          isDark={isDark}
          page={page}
          pageCount={pageCount}
          showingFrom={showingFrom}
          showingTo={showingTo}
          onSetPage={setPage}
          onEditClass={openEditModal}
          onDeleteClass={setDeleteTarget}
          onViewStudents={setStudentsModalClass}
        />
      </div>

      {/* ── Modals ── */}
      <ClassFormModal open={modalOpen} mode={modalMode} editingClass={editingClass} subjects={subjects} levels={levels} error={error} saving={saving} onClose={closeModal} onSubmit={handleSaveClass} />
      <ClassStudentsModal open={!!studentsModalClass} onClose={() => setStudentsModalClass(null)} classId={studentsModalClass?.id ?? null} classTitle={studentsModalClass?.title} />
      <ClassDeleteModal deleteTarget={deleteTarget} deleting={deleting} isDark={isDark} onCancel={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete} />
    </div>
  );
}
