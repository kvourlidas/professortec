import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { CalendarDays, Loader2 } from 'lucide-react';
import type { ClassRow, SubjectRow, LevelRow, TutorRow, ProgramRow, ProgramItemRow, ClassSubjectRow, SubjectTutorRow, AddSlotForm, EditSlotForm, DeleteSlotTarget } from '../components/program/types';
import { DAY_OPTIONS, emptyAddSlotForm } from '../components/program/constants';
import { convert12To24, convert24To12, formatTimeInput, formatDateDisplay, parseDateDisplayToISO, timeToMinutes, todayISO, normalizeText } from '../components/program/utils';
import ProgramAddSlotModal from '../components/program/ProgramAddSlotModal';
import ProgramEditSlotModal from '../components/program/ProgramEditSlotModal';
import ProgramDeleteSlotModal from '../components/program/ProgramDeleteSlotModal';
import ProgramClassesPanel from '../components/program/ProgramClassesPanel';
import ProgramScheduleGrid from '../components/program/ProgramScheduleGrid';

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

export default function ProgramPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [subjectTutors, setSubjectTutors] = useState<SubjectTutorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragClassId, setDragClassId] = useState<string | null>(null);
  const [classSearch, setClassSearch] = useState('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddSlotForm>(emptyAddSlotForm);
  const [savingSlot, setSavingSlot] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditSlotForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteSlotTarget, setDeleteSlotTarget] = useState<DeleteSlotTarget | null>(null);
  const [deletingSlot, setDeletingSlot] = useState(false);

  // ── Maps ──
  const levelNameById = useMemo(() => { const m = new Map<string, string>(); levels.forEach((lvl) => m.set(lvl.id, lvl.name)); return m; }, [levels]);
  const tutorNameById = useMemo(() => { const m = new Map<string, string>(); tutors.forEach((t) => m.set(t.id, t.full_name)); return m; }, [tutors]);
  const subjectById = useMemo(() => { const m = new Map<string, SubjectRow>(); subjects.forEach((s) => m.set(s.id, s)); return m; }, [subjects]);

  const filteredClasses = useMemo(() => {
    const q = normalizeText(classSearch.trim());
    if (!q) return classes;
    return classes.filter((cls) => {
      const subj = cls.subject_id ? subjectById.get(cls.subject_id) : null;
      const levelName = subj?.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
      const tutorName = cls.tutor_id ? (tutorNameById.get(cls.tutor_id) ?? '') : '';
      return normalizeText([cls.title, cls.subject, levelName, tutorName].filter(Boolean).join(' ')).includes(q);
    });
  }, [classes, classSearch, subjectById, levelNameById, tutorNameById]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, ProgramItemRow[]> = {};
    DAY_OPTIONS.forEach((d) => { map[d.value] = []; });
    programItems.forEach((item) => {
      if (!map[item.day_of_week]) map[item.day_of_week] = [];
      map[item.day_of_week].push(item);
    });
    Object.keys(map).forEach((day) => {
      map[day].sort((a, b) => {
        const ta = timeToMinutes(a.start_time); const tb = timeToMinutes(b.start_time);
        if (ta !== tb) return ta - tb;
        return (a.position ?? 0) - (b.position ?? 0);
      });
    });
    return map;
  }, [programItems]);

  // ── Load ──
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const { data: programRows, error: programErr } = await supabase.from('programs').select('*').eq('school_id', schoolId).order('created_at', { ascending: true });
        if (programErr) throw programErr;
        let activeProgram: ProgramRow | null = (programRows?.[0] as ProgramRow) ?? null;
        if (!activeProgram) {
          const { data: created, error: createErr } = await supabase.from('programs').insert({ school_id: schoolId, name: 'Βασικό πρόγραμμα', description: null }).select('*').maybeSingle();
          if (createErr || !created) throw createErr ?? new Error('Failed to create default program');
          activeProgram = created as ProgramRow;
        }
        setProgram(activeProgram);

        const [
          { data: classData, error: classErr },
          { data: subjData, error: subjErr },
          { data: levelData, error: lvlErr },
          { data: tutorData, error: tutorErr },
          { data: itemData, error: itemErr },
        ] = await Promise.all([
          supabase.from('classes').select('id, school_id, title, subject, subject_id, tutor_id').eq('school_id', schoolId).order('title', { ascending: true }),
          supabase.from('subjects').select('id, school_id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('levels').select('id, school_id, name').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('tutors').select('id, school_id, full_name').eq('school_id', schoolId).order('full_name', { ascending: true }),
          supabase.from('program_items').select('*').eq('program_id', activeProgram.id).order('day_of_week', { ascending: true }).order('position', { ascending: true }),
        ]);

        if (classErr) throw classErr; if (subjErr) throw subjErr; if (lvlErr) throw lvlErr; if (tutorErr) throw tutorErr; if (itemErr) throw itemErr;

        setClasses((classData ?? []) as ClassRow[]);
        setSubjects((subjData ?? []) as SubjectRow[]);
        setLevels((levelData ?? []) as LevelRow[]);
        setTutors((tutorData ?? []) as TutorRow[]);
        setProgramItems((itemData ?? []) as ProgramItemRow[]);

        try {
          const { data: csData, error: csErr } = await supabase.from('class_subjects').select('class_id, subject_id');
          setClassSubjects(csErr ? [] : (csData ?? []) as ClassSubjectRow[]);
        } catch { setClassSubjects([]); }

        try {
          const { data: stData, error: stErr } = await supabase.from('subject_tutors').select('subject_id, tutor_id').eq('school_id', schoolId);
          setSubjectTutors(stErr ? [] : (stData ?? []) as SubjectTutorRow[]);
        } catch { setSubjectTutors([]); }

      } catch (err: unknown) {
        console.error('ProgramPage load error', err);
        setError('Αποτυχία φόρτωσης προγράμματος.');
      } finally { setLoading(false); }
    };
    load();
  }, [schoolId]);

  // ── Subject / tutor helpers ───────────────────────────────────────────────
  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];
    const cls = classes.find((c) => c.id === classId) ?? null;
    const attachedIds = new Set<string>();
    classSubjects.filter((cs) => cs.class_id === classId && cs.subject_id).forEach((cs) => attachedIds.add(cs.subject_id));
    if (cls?.subject_id) attachedIds.add(cls.subject_id);
    const attachedSubjects: SubjectRow[] = [];
    attachedIds.forEach((id) => { const subj = subjectById.get(id); if (subj) attachedSubjects.push(subj); });
    if (attachedSubjects.length >= 2) return attachedSubjects.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    let levelId: string | null = null;
    if (cls?.subject_id) { const mainSubj = subjectById.get(cls.subject_id); levelId = mainSubj?.level_id ?? null; }
    const extraSubjects: SubjectRow[] = levelId ? subjects.filter((s) => s.level_id === levelId) : subjects;
    const merged = new Map<string, SubjectRow>();
    extraSubjects.forEach((s) => merged.set(s.id, s));
    attachedSubjects.forEach((s) => merged.set(s.id, s));
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
  };

  const getTutorsForSubject = (subjectId: string | null): TutorRow[] => {
    if (!subjectId) return [];
    const tutorIds = Array.from(new Set(subjectTutors.filter((st) => st.subject_id === subjectId).map((st) => st.tutor_id)));
    const result: TutorRow[] = [];
    tutorIds.forEach((id) => { const tutor = tutors.find((t) => t.id === id); if (tutor) result.push(tutor); });
    return result;
  };

  // ── Add slot ──────────────────────────────────────────────────────────────
  const openAddSlotModal = (classId: string, day: string) => {
    const displayToday = formatDateDisplay(todayISO());
    setError(null);
    setAddForm({ classId, subjectId: null, tutorId: null, day, startTime: '', startPeriod: 'PM', endTime: '', endPeriod: 'PM', startDate: displayToday, endDate: displayToday });
    setAddModalOpen(true);
  };

  const closeAddSlotModal = () => { setAddModalOpen(false); setAddForm(emptyAddSlotForm); setSavingSlot(false); };

  const handleAddTimeChange = (field: 'startTime' | 'endTime') => (e: ChangeEvent<HTMLInputElement>) =>
    setAddForm((prev) => ({ ...prev, [field]: formatTimeInput(e.target.value) }));

  const handleAddFieldChange = (field: keyof AddSlotForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setAddForm((prev) => {
      if (field === 'subjectId') return { ...prev, subjectId: value || null, tutorId: null };
      if (field === 'tutorId') return { ...prev, tutorId: value || null };
      return { ...prev, [field]: value as never };
    });
  };

  const handleAddDateChange = (field: 'startDate' | 'endDate') => (v: string) =>
    setAddForm((prev) => ({ ...prev, [field]: v }));

  // ── Confirm add slot via edge function ────────────────────────────────────
  const handleConfirmAddSlot = async () => {
    if (!program) return;
    if (!addForm.classId || !addForm.day) { setError('Επιλέξτε τμήμα και ημέρα.'); return; }
    const subjectsForClass = getSubjectsForClass(addForm.classId);
    if (subjectsForClass.length === 0) { setError('Το τμήμα δεν έχει συνδεδεμένα μαθήματα. Ρυθμίστε τα στη σελίδα «Τμήματα».'); return; }
    if (!addForm.subjectId) { setError('Επιλέξτε μάθημα για το τμήμα.'); return; }
    const start24 = convert12To24(addForm.startTime, addForm.startPeriod);
    const end24 = convert12To24(addForm.endTime, addForm.endPeriod);
    if (!start24 || !end24) { setError('Συμπληρώστε σωστά τις ώρες (π.χ. 08:00).'); return; }
    if (!addForm.startDate || !addForm.endDate) { setError('Συμπληρώστε ημερομηνία έναρξης και λήξης.'); return; }
    const startDateISO = parseDateDisplayToISO(addForm.startDate);
    const endDateISO = parseDateDisplayToISO(addForm.endDate);
    if (!startDateISO || !endDateISO) { setError('Συμπληρώστε σωστά τις ημερομηνίες (π.χ. 12/05/2025).'); return; }
    const itemsForDay = programItems.filter((i) => i.day_of_week === addForm.day && i.program_id === program.id);
    const maxPos = itemsForDay.reduce((max, i) => Math.max(max, i.position ?? 0), 0);

    setSavingSlot(true); setError(null);
    try {
      const data = await callEdgeFunction('program-create', {
        program_id: program.id,
        class_id: addForm.classId,
        subject_id: addForm.subjectId,
        tutor_id: addForm.tutorId,
        day_of_week: addForm.day,
        position: maxPos + 1,
        start_time: start24,
        end_time: end24,
        start_date: startDateISO,
        end_date: endDateISO,
      });
      setProgramItems((prev) => [...prev, data.item as ProgramItemRow]);
      closeAddSlotModal();
    } catch (err) {
      console.error(err);
      setError('Αποτυχία προσθήκης τμήματος στο πρόγραμμα.');
    } finally {
      setSavingSlot(false);
    }
  };

  // ── Edit slot ─────────────────────────────────────────────────────────────
  const openEditSlotModal = (item: ProgramItemRow) => {
    const { time: startTime, period: startPeriod } = convert24To12(item.start_time);
    const { time: endTime, period: endPeriod } = convert24To12(item.end_time);
    setError(null);
    setEditForm({ id: item.id, classId: item.class_id, subjectId: item.subject_id ?? null, tutorId: item.tutor_id ?? null, day: item.day_of_week, startTime, startPeriod, endTime, endPeriod, startDate: item.start_date ? formatDateDisplay(item.start_date) : '', endDate: item.end_date ? formatDateDisplay(item.end_date) : '' });
    setEditModalOpen(true);
  };

  const closeEditSlotModal = () => { if (savingEdit) return; setEditModalOpen(false); setEditForm(null); };

  const handleEditTimeChange = (field: 'startTime' | 'endTime') => (e: ChangeEvent<HTMLInputElement>) =>
    setEditForm((prev) => prev ? { ...prev, [field]: formatTimeInput(e.target.value) } : prev);

  const handleEditFieldChange = (field: keyof EditSlotForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setEditForm((prev) => {
      if (!prev) return prev;
      if (field === 'subjectId') return { ...prev, subjectId: value || null, tutorId: null };
      if (field === 'tutorId') return { ...prev, tutorId: value || null };
      return { ...prev, [field]: value as never };
    });
  };

  const handleEditDateChange = (field: 'startDate' | 'endDate') => (v: string) =>
    setEditForm((prev) => prev ? { ...prev, [field]: v } : prev);

  // ── Confirm edit slot via edge function ───────────────────────────────────
  const handleConfirmEditSlot = async () => {
    if (!program || !editForm) return;
    if (!editForm.classId || !editForm.day) { setError('Επιλέξτε τμήμα και ημέρα.'); return; }
    const subjectsForClass = getSubjectsForClass(editForm.classId);
    if (subjectsForClass.length > 0 && !editForm.subjectId) { setError('Επιλέξτε μάθημα για το τμήμα.'); return; }
    const start24 = convert12To24(editForm.startTime, editForm.startPeriod);
    const end24 = convert12To24(editForm.endTime, editForm.endPeriod);
    if (!start24 || !end24) { setError('Συμπληρώστε σωστά τις ώρες.'); return; }
    const startDateISO = parseDateDisplayToISO(editForm.startDate);
    const endDateISO = parseDateDisplayToISO(editForm.endDate);
    if (!startDateISO || !endDateISO) { setError('Συμπληρώστε σωστά τις ημερομηνίες.'); return; }

    setSavingEdit(true); setError(null);
    try {
      const data = await callEdgeFunction('program-update', {
        program_item_id: editForm.id,
        class_id: editForm.classId,
        subject_id: editForm.subjectId,
        tutor_id: editForm.tutorId,
        day_of_week: editForm.day,
        start_time: start24,
        end_time: end24,
        start_date: startDateISO,
        end_date: endDateISO,
      });
      setProgramItems((prev) => prev.map((i) => (i.id === editForm.id ? (data.item as ProgramItemRow) : i)));
      closeEditSlotModal();
    } catch (err) {
      console.error(err);
      setError('Αποτυχία ενημέρωσης τμήματος στο πρόγραμμα.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Confirm delete slot via edge function ─────────────────────────────────
  const handleConfirmDeleteSlot = async () => {
    if (!deleteSlotTarget) return;
    const id = deleteSlotTarget.id;
    const previous = programItems;
    setDeletingSlot(true); setError(null);
    setProgramItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await callEdgeFunction('program-delete', { program_item_id: id });
      setDeleteSlotTarget(null);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής από το πρόγραμμα.');
      setProgramItems(previous);
    } finally {
      setDeletingSlot(false);
    }
  };

  const handleDropOnDay = (day: string) => {
    if (!dragClassId) return;
    openAddSlotModal(dragClassId, day);
    setDragClassId(null);
  };

  // ── Computed options for open modals ──────────────────────────────────────
  const addSubjOptions = useMemo(() => getSubjectsForClass(addForm.classId), [addForm.classId, classSubjects, subjectById, subjects]);
  const addTutorOptions = useMemo(() => getTutorsForSubject(addForm.subjectId), [addForm.subjectId, subjectTutors, tutors]);
  const editSubjOptions = useMemo(() => getSubjectsForClass(editForm?.classId ?? null), [editForm?.classId, classSubjects, subjectById, subjects]);
  const editTutorOptions = useMemo(() => getTutorsForSubject(editForm?.subjectId ?? null), [editForm?.subjectId, subjectTutors, tutors]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
          <CalendarDays className="h-4.5 w-4.5" style={{ color: 'var(--color-input-bg)' }} />
        </div>
        <div>
          <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
            Πρόγραμμα Τμημάτων
          </h1>
          <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Δημιούργησε ένα εβδομαδιαίο πρόγραμμα, προσθέτοντας τμήματα σε κάθε μέρα.
          </p>
          {program && (
            <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
              <CalendarDays className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              {program.name}
            </span>
          )}
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className={`h-7 w-7 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Φόρτωση προγράμματος…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <ProgramClassesPanel
            classes={classes}
            filteredClasses={filteredClasses}
            classSearch={classSearch}
            onSearchChange={setClassSearch}
            subjectById={subjectById}
            levelNameById={levelNameById}
            tutorNameById={tutorNameById}
            isDark={isDark}
            dragClassId={dragClassId}
            onDragStart={setDragClassId}
            onDragEnd={(id) => setDragClassId((prev) => (prev === id ? null : prev))}
            onAddSlot={openAddSlotModal}
          />

          <ProgramScheduleGrid
            itemsByDay={itemsByDay}
            classes={classes}
            subjectById={subjectById}
            tutorNameById={tutorNameById}
            dragClassId={dragClassId}
            isDark={isDark}
            onEditSlot={openEditSlotModal}
            onDeleteSlot={setDeleteSlotTarget}
            onDragOver={() => { }}
            onDrop={handleDropOnDay}
          />
        </div>
      )}

      {/* ── Modals ── */}
      <ProgramAddSlotModal
        open={addModalOpen}
        form={addForm}
        saving={savingSlot}
        error={error}
        classes={classes}
        subjOptions={addSubjOptions}
        tutorOptions={addTutorOptions}
        isDark={isDark}
        onClose={closeAddSlotModal}
        onSubmit={handleConfirmAddSlot}
        onFieldChange={handleAddFieldChange}
        onTimeChange={handleAddTimeChange}
        onDateChange={handleAddDateChange}
      />

      <ProgramEditSlotModal
        open={editModalOpen}
        form={editForm}
        saving={savingEdit}
        error={error}
        classes={classes}
        subjOptions={editSubjOptions}
        tutorOptions={editTutorOptions}
        isDark={isDark}
        onClose={closeEditSlotModal}
        onSubmit={handleConfirmEditSlot}
        onFieldChange={handleEditFieldChange}
        onTimeChange={handleEditTimeChange}
        onDateChange={handleEditDateChange}
      />

      <ProgramDeleteSlotModal
        target={deleteSlotTarget}
        deleting={deletingSlot}
        isDark={isDark}
        onCancel={() => { if (!deletingSlot) setDeleteSlotTarget(null); }}
        onConfirm={handleConfirmDeleteSlot}
      />
    </div>
  );
}