import { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.ts';
import { useAuth } from '../auth.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import ClassFormModal from '../components/classes/ClassFormModal.tsx';
import ClassStudentsModal from '../components/classes/ClassStudentsModal.tsx';
import ClassDeleteModal from '../components/classes/ClassDeleteModal.tsx';
import ClassesCloneModal from '../components/classes/ClassesCloneModal.tsx';
import ClassesGrid from '../components/classes/ClassesGrid.tsx';
import type { StudentRow } from '../components/classes/ClassesGrid.tsx';
import { Plus, School, Search, Loader2, CopyPlus, CalendarRange } from 'lucide-react';
import { FaFileExcel, FaFilePdf } from 'react-icons/fa6';
import StyledSelect from '../components/ui/StyledSelect.tsx';
import type { ClassRow, SubjectRow, LevelRow, ModalMode, ClassFormState } from '../components/classes/types.ts';
import { normalizeText } from '../components/classes/utils.ts';
import { exportClassesToExcel, exportClassesToPdf } from '../components/classes/exportClasses.ts';
import { isSchoolYearCurrent } from '../components/school-info/types.ts';

type SchoolYearRow = { id: string; name: string; start_date: string; end_date: string };

export default function ClassesPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;
  const location = useLocation();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, StudentRow[]>>({});
  const [activeSubIds, setActiveSubIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [studentsModalClass, setStudentsModalClass] = useState<{ id: string; title: string } | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [exportError, setExportError] = useState<'excel' | 'pdf' | null>(null);

  const [schoolYears, setSchoolYears] = useState<SchoolYearRow[]>([]);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('');
  const yearFilterInitialized = useRef(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  /* ── Load students for all classes ── */
  const loadStudentsByClass = async (classIds: string[]) => {
    if (classIds.length === 0) { setStudentsByClass({}); return; }
    const { data, error: err } = await supabase
      .from('class_students')
      .select('class_id, student:students(id, full_name)')
      .eq('school_id', schoolId)
      .in('class_id', classIds);
    if (err) { console.error('Failed to load students by class', err); return; }
    const map: Record<string, StudentRow[]> = {};
    (data ?? []).forEach((row: any) => {
      const cid: string = row.class_id;
      const st: StudentRow = row.student;
      if (!st) return;
      if (!map[cid]) map[cid] = [];
      map[cid].push(st);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el')));
    setStudentsByClass(map);
  };

  /* ── Load which students currently have an active subscription ── */
  const loadActiveSubIds = async () => {
    if (!schoolId) return;
    await supabase.rpc('run_subscription_expiry', { p_school_id: schoolId });
    const { data, error: err } = await supabase
      .from('student_subscriptions_with_totals')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('status', 'active');
    if (err) { console.error('Failed to load active subscriptions', err); return; }
    setActiveSubIds(new Set((data ?? []).map((r: any) => r.student_id)));
  };

  /* ── Load school years, then default the filter to the current one ── */
  useEffect(() => {
    if (!schoolId) { setYearsLoading(false); return; }
    yearFilterInitialized.current = false;

    const loadYears = async () => {
      setYearsLoading(true);
      const { data, error: yearsErr } = await supabase
        .from('school_years').select('id,name,start_date,end_date').eq('school_id', schoolId).order('start_date', { ascending: false });
      if (yearsErr) { console.error(yearsErr); setYearsLoading(false); return; }
      const years = (data ?? []) as SchoolYearRow[];
      setSchoolYears(years);
      if (!yearFilterInitialized.current) {
        const defaultYear = years.find((y) => isSchoolYearCurrent(y)) ?? years[0] ?? null;
        setYearFilter(defaultYear?.id ?? '');
        yearFilterInitialized.current = true;
      }
      setYearsLoading(false);
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

    loadYears(); loadLookups(); loadActiveSubIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  /* ── Load this year's classes (and their enrolled students) whenever the year filter changes ── */
  useEffect(() => {
    if (!schoolId || !yearFilter) { setClasses([]); setStudentsByClass({}); if (!yearsLoading) setLoading(false); return; }

    const loadClasses = async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from('classes')
        .select('id, school_id, title, subject, subject_id, tutor_id, school_year_id')
        .eq('school_id', schoolId)
        .eq('school_year_id', yearFilter)
        .order('title', { ascending: true });
      if (error) { console.error(error); setError('Αποτυχία φόρτωσης τμημάτων.'); setLoading(false); return; }
      const loaded = (data ?? []) as ClassRow[];
      setClasses(loaded);
      await loadStudentsByClass(loaded.map((c) => c.id));
      setLoading(false);
    };

    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, yearFilter]);

  /* ── Refresh students for a single class after modal saves ── */
  const refreshClassStudents = async (classId: string) => {
    const { data, error: err } = await supabase
      .from('class_students')
      .select('class_id, student:students(id, full_name)')
      .eq('school_id', schoolId)
      .eq('class_id', classId);
    if (err) { console.error(err); return; }
    const students: StudentRow[] = (data ?? []).map((row: any) => row.student).filter(Boolean)
      .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el'));
    setStudentsByClass((prev) => ({ ...prev, [classId]: students }));
  };

  const openCreateModal = () => { setError(null); setModalMode('create'); setEditingClass(null); setModalOpen(true); };
  const openEditModal = (row: ClassRow) => { setError(null); setModalMode('edit'); setEditingClass(row); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingClass(null); setSaving(false); };

  useEffect(() => {
    if ((location.state as { openCreate?: boolean } | null)?.openCreate) {
      openCreateModal();
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname, navigate]);

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
        body: { title: payload.title, subject: payload.subject, subject_id: payload.subject_id, school_year_id: yearFilter },
      });
      setSaving(false);
      if (error || !data?.item) { console.error(error ?? data); setError('Αποτυχία δημιουργίας τμήματος.'); return; }
      const newClass = data.item as ClassRow;
      setClasses((prev) => [newClass, ...prev]);
      setStudentsByClass((prev) => ({ ...prev, [newClass.id]: [] }));
      closeModal();
    } else {
      if (!editingClass) { setSaving(false); return; }
      const { data, error } = await supabase.functions.invoke('classes-update', {
        body: { class_id: editingClass.id, title: payload.title, subject: payload.subject, subject_id: payload.subject_id },
      });
      setSaving(false);
      if (error || !data?.item) { console.error(error ?? data); setError('Αποτυχία ενημέρωσης τμήματος.'); return; }
      setClasses((prev) => prev.map((c) => (c.id === editingClass.id ? (data.item as ClassRow) : c)));
      closeModal();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null); setDeleting(true);
    const { error } = await supabase.functions.invoke('classes-delete', { body: { class_id: deleteTarget.id } });
    setDeleting(false);
    if (error) { console.error(error); setError('Αποτυχία διαγραφής τμήματος.'); return; }
    setClasses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setStudentsByClass((prev) => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    setDeleteTarget(null);
  };

  /* ── Close students modal and refresh that class's students ── */
  const handleStudentsModalClose = () => {
    if (studentsModalClass) refreshClassStudents(studentsModalClass.id);
    loadActiveSubIds();
    setStudentsModalClass(null);
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

  const handleCloned = (created: ClassRow[]) => {
    setClasses((prev) => [...created, ...prev]);
    setStudentsByClass((prev) => {
      const next = { ...prev };
      created.forEach((c) => { next[c.id] = []; });
      return next;
    });
  };

  const handleExportExcel = async () => {
    setExcelBusy(true); setExportError(null);
    try { await exportClassesToExcel(filteredClasses, subjects, levelNameById, studentsByClass); }
    catch (err) { console.error('Export Excel error', err); setExportError('excel'); }
    finally { setExcelBusy(false); }
  };

  const handleExportPdf = async () => {
    setPdfBusy(true); setExportError(null);
    try { await exportClassesToPdf(filteredClasses, subjects, levelNameById, studentsByClass); }
    catch (err) { console.error('Export PDF error', err); setExportError('pdf'); }
    finally { setPdfBusy(false); }
  };

  const inputCls = `h-9 w-full rounded-lg border pl-9 pr-3 text-xs outline-none ring-0 backdrop-blur transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400'}`;
  return (
    <div className="space-y-6 px-1">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <StyledSelect
            isDark={isDark} showChevron value={yearFilter} onChange={setYearFilter}
            disabled={schoolYears.length === 0}
            className={`h-9 w-full rounded-lg border pl-3 pr-8 text-xs outline-none ring-0 backdrop-blur transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] sm:w-44 ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100' : 'border-slate-200 bg-white text-slate-800'}`}
            options={schoolYears.map((y) => ({ value: y.id, label: y.name }))}
          />
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={`${inputCls} sm:w-52`} placeholder="Αναζήτηση τμήματος..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" onClick={() => setCloneModalOpen(true)} disabled={!yearFilter}
            className={`btn h-9 gap-2 border px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}>
            <CopyPlus className="h-3.5 w-3.5" />
            Αντιγραφή από έτος
          </button>
          <button type="button" onClick={openCreateModal} disabled={!yearFilter}
            className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" />
            Προσθήκη Τμήματος
          </button>
        </div>
      </div>

      {/* ── Export buttons ── */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={excelBusy || filteredClasses.length === 0}
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold transition hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}
          >
            {excelBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FaFileExcel className="h-3 w-3" />}
            {excelBusy ? 'Δημιουργία…' : 'Λήψη Excel'}
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={pdfBusy || filteredClasses.length === 0}
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold transition hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-600 hover:text-rose-700'}`}
          >
            {pdfBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FaFilePdf className="h-3 w-3" />}
            {pdfBusy ? 'Δημιουργία PDF…' : 'Λήψη PDF'}
          </button>
        </div>
        {exportError && (
          <p className="text-[11px] text-red-500">Αποτυχία δημιουργίας {exportError === 'pdf' ? 'PDF' : 'Excel'}.</p>
        )}
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
      {schoolId && !yearsLoading && schoolYears.length === 0 && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Δεν έχετε ορίσει σχολικά έτη ακόμα. Ορίστε ένα σχολικό έτος στα στοιχεία σχολείου για να μπορείτε να δημιουργήσετε τμήματα.
        </div>
      )}

      {/* ── Card grid ── */}
      <ClassesGrid
        loading={loading || yearsLoading}
        classes={classes}
        filteredClasses={filteredClasses}
        subjects={subjects}
        levelNameById={levelNameById}
        studentsByClass={studentsByClass}
        activeSubIds={activeSubIds}
        isDark={isDark}
        onEditClass={openEditModal}
        onDeleteClass={setDeleteTarget}
        onViewStudents={setStudentsModalClass}
      />

      {/* ── Modals ── */}
      <ClassFormModal open={modalOpen} mode={modalMode} editingClass={editingClass} subjects={subjects} levels={levels} error={error} saving={saving} onClose={closeModal} onSubmit={handleSaveClass} />
      <ClassStudentsModal
        open={!!studentsModalClass}
        onClose={handleStudentsModalClose}
        classId={studentsModalClass?.id ?? null}
        classTitle={studentsModalClass?.title}
      />
      <ClassDeleteModal deleteTarget={deleteTarget} deleting={deleting} isDark={isDark} onCancel={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete} />
      <ClassesCloneModal
        open={cloneModalOpen}
        schoolId={schoolId}
        schoolYears={schoolYears}
        targetYearId={yearFilter}
        existingClasses={classes}
        isDark={isDark}
        onClose={() => setCloneModalOpen(false)}
        onCloned={handleCloned}
      />
    </div>
  );
}