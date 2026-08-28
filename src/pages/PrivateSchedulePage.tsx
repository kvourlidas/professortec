import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import { Loader2, CalendarRange } from 'lucide-react';
import type {
  AddSlotForm, DeleteSlotTarget, EditSlotForm, PrivateLessonGroup,
  PrivateProgramItemRow, StudentRow, SubjectRow,
} from '../components/private-program/types';
import { emptyAddSlotForm } from '../components/private-program/types';
import { DAY_OPTIONS } from '../components/program/constants';
import { formatDateDisplay, parseDateDisplayToISO, timeToMinutes, todayISO } from '../components/program/utils';
import PrivateProgramAddSlotModal from '../components/private-program/PrivateProgramAddSlotModal';
import PrivateProgramEditSlotModal from '../components/private-program/PrivateProgramEditSlotModal';
import PrivateProgramDeleteSlotModal from '../components/private-program/PrivateProgramDeleteSlotModal';
import PrivateProgramStudentsPanel from '../components/private-program/PrivateProgramStudentsPanel';
import PrivateProgramScheduleGrid from '../components/private-program/PrivateProgramScheduleGrid';
import StyledSelect from '../components/ui/StyledSelect';
import { isSchoolYearCurrent } from '../components/school-info/types';
import { normalizeText } from '../components/attendance/utils';

type SchoolYearOption = { id: string; name: string; start_date: string; end_date: string; is_summer: boolean };

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

export default function PrivateSchedulePage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [programId, setProgramId] = useState<string | null>(null);
  const [programItems, setProgramItems] = useState<PrivateProgramItemRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragStudentId, setDragStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [schoolYears, setSchoolYears] = useState<SchoolYearOption[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddSlotForm>(emptyAddSlotForm);
  const [savingSlot, setSavingSlot] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditSlotForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteSlotTarget | null>(null);
  const [deletingSlot, setDeletingSlot] = useState(false);

  const studentById = useMemo(() => { const m = new Map<string, StudentRow>(); students.forEach((s) => m.set(s.id, s)); return m; }, [students]);
  const subjectById = useMemo(() => { const m = new Map<string, SubjectRow>(); subjects.forEach((s) => m.set(s.id, s)); return m; }, [subjects]);

  const filteredStudents = useMemo(() => {
    const q = normalizeText(studentSearch.trim());
    if (!q) return students;
    return students.filter((s) => normalizeText(s.full_name).includes(q));
  }, [students, studentSearch]);

  const selectedYear = useMemo(() => schoolYears.find((y) => y.id === selectedYearId) ?? null, [schoolYears, selectedYearId]);

  const mainYearForAdd = useMemo(() => {
    return schoolYears.find((y) => isSchoolYearCurrent(y) && !y.is_summer)
      ?? schoolYears.find((y) => !y.is_summer)
      ?? schoolYears[0]
      ?? null;
  }, [schoolYears]);

  const yearFilteredItems = useMemo(() => {
    if (!selectedYear) return programItems;
    return programItems.filter((item) => {
      const itemStart = item.start_date ?? '0001-01-01';
      const itemEnd = item.end_date ?? '9999-12-31';
      return itemStart <= selectedYear.end_date && itemEnd >= selectedYear.start_date;
    });
  }, [programItems, selectedYear]);

  const lessonGroups = useMemo<PrivateLessonGroup[]>(() => {
    const byKey = new Map<string, PrivateProgramItemRow[]>();
    yearFilteredItems.forEach((item) => {
      const key = item.group_id ?? item.id;
      const list = byKey.get(key) ?? [];
      list.push(item);
      byKey.set(key, list);
    });
    return Array.from(byKey.entries()).map(([groupKey, items]) => ({
      groupKey,
      items,
      day_of_week: items[0].day_of_week,
      start_time: items[0].start_time,
      end_time: items[0].end_time,
      room: items[0].room,
      subject_id: items[0].subject_id,
    }));
  }, [yearFilteredItems]);

  const groupsByDay = useMemo(() => {
    const map: Record<string, PrivateLessonGroup[]> = {};
    DAY_OPTIONS.forEach((d) => { map[d.value] = []; });
    lessonGroups.forEach((g) => {
      if (!map[g.day_of_week]) map[g.day_of_week] = [];
      map[g.day_of_week].push(g);
    });
    Object.keys(map).forEach((day) => {
      map[day].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    });
    return map;
  }, [lessonGroups]);

  const reloadProgramItems = async () => {
    if (!programId) return;
    const { data } = await supabase.from('program_items').select('*')
      .eq('program_id', programId).not('student_id', 'is', null).order('day_of_week', { ascending: true }).order('position', { ascending: true });
    setProgramItems((data ?? []) as PrivateProgramItemRow[]);
  };

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const { data: programRows, error: programErr } = await supabase.from('programs').select('id').eq('school_id', schoolId).order('created_at', { ascending: true });
        if (programErr) throw programErr;
        let activeProgramId: string | null = (programRows?.[0] as { id: string } | undefined)?.id ?? null;
        if (!activeProgramId) {
          const { data: created, error: createErr } = await supabase.from('programs').insert({ school_id: schoolId, name: 'Πρόγραμμα' }).select('id').maybeSingle();
          if (createErr || !created) throw createErr ?? new Error('Failed to create default program');
          activeProgramId = created.id as string;
        }
        setProgramId(activeProgramId);

        const [
          { data: studentData, error: studentErr },
          { data: subjData, error: subjErr },
          { data: itemData, error: itemErr },
          { data: syData },
        ] = await Promise.all([
          supabase.from('students').select('id, full_name, level_id').eq('school_id', schoolId).is('deleted_at', null).order('full_name', { ascending: true }),
          supabase.from('subjects').select('id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('program_items').select('*').eq('program_id', activeProgramId).not('student_id', 'is', null).order('day_of_week', { ascending: true }).order('position', { ascending: true }),
          supabase.from('school_years').select('id,name,start_date,end_date,is_summer').eq('school_id', schoolId).order('start_date', { ascending: false }),
        ]);

        if (studentErr) throw studentErr; if (subjErr) throw subjErr; if (itemErr) throw itemErr;

        setStudents((studentData ?? []) as StudentRow[]);
        setSubjects((subjData ?? []) as SubjectRow[]);
        setProgramItems((itemData ?? []) as PrivateProgramItemRow[]);
        const years = (syData ?? []) as SchoolYearOption[];
        setSchoolYears(years);
        setSelectedYearId((prev) => prev || years.find((y) => isSchoolYearCurrent(y))?.id || years[0]?.id || '');
      } catch (err: unknown) {
        console.error('PrivateSchedulePage load error', err);
        setError('Αποτυχία φόρτωσης προγράμματος.');
      } finally { setLoading(false); }
    };
    load();
  }, [schoolId]);

  // ── Add slot ──────────────────────────────────────────────────────────────
  const openAddSlotModal = (studentId: string, day: string) => {
    const displayToday = formatDateDisplay(todayISO());
    const yearForNewSlot = selectedYear ?? mainYearForAdd;
    const startDate = yearForNewSlot ? formatDateDisplay(yearForNewSlot.start_date) : displayToday;
    const endDate = yearForNewSlot ? formatDateDisplay(yearForNewSlot.end_date) : displayToday;
    setError(null);
    setAddForm({ day, subjectId: null, startTime: '', endTime: '', startDate, endDate, roster: [{ studentId, charge: '' }] });
    setAddModalOpen(true);
  };

  const closeAddSlotModal = () => { setAddModalOpen(false); setAddForm(emptyAddSlotForm); setSavingSlot(false); };

  const handleAddFieldChange = (field: 'subjectId') => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setAddForm((prev) => (field === 'subjectId' ? { ...prev, subjectId: value || null } : prev));
  };

  const handleAddDateChange = (field: 'startDate' | 'endDate') => (v: string) =>
    setAddForm((prev) => ({ ...prev, [field]: v }));

  const handleConfirmAddSlot = async () => {
    if (!addForm.day) { setError('Επιλέξτε ημέρα.'); return; }
    if (addForm.roster.length === 0) { setError('Προσθέστε τουλάχιστον έναν μαθητή.'); return; }
    if (!addForm.startTime || !addForm.endTime) { setError('Συμπληρώστε τις ώρες έναρξης και λήξης.'); return; }
    if (!addForm.startDate || !addForm.endDate) { setError('Συμπληρώστε ημερομηνία έναρξης και λήξης.'); return; }
    const startDateISO = parseDateDisplayToISO(addForm.startDate);
    const endDateISO = parseDateDisplayToISO(addForm.endDate);
    if (!startDateISO || !endDateISO) { setError('Συμπληρώστε σωστά τις ημερομηνίες (π.χ. 12/05/2025).'); return; }

    setSavingSlot(true); setError(null);
    try {
      const data = await callEdgeFunction('private-lesson-create', {
        subject_id: addForm.subjectId,
        day_of_week: addForm.day,
        start_time: addForm.startTime,
        end_time: addForm.endTime,
        start_date: startDateISO,
        end_date: endDateISO,
        students: addForm.roster.map((r) => ({ student_id: r.studentId, charge_per_session: r.charge.trim() ? Number(r.charge) : null })),
      });
      setProgramItems((prev) => [...prev, ...(data.items as PrivateProgramItemRow[])]);
      closeAddSlotModal();
    } catch (err) {
      console.error(err);
      setError('Αποτυχία προσθήκης στο πρόγραμμα.');
    } finally {
      setSavingSlot(false);
    }
  };

  // ── Edit slot ─────────────────────────────────────────────────────────────
  const openEditSlotModal = (group: PrivateLessonGroup) => {
    setError(null);
    setEditForm({
      programItemId: group.items[0].id,
      day: group.day_of_week,
      subjectId: group.subject_id,
      startTime: group.start_time?.slice(0, 5) ?? '',
      endTime: group.end_time?.slice(0, 5) ?? '',
      startDate: group.items[0].start_date ? formatDateDisplay(group.items[0].start_date) : '',
      endDate: group.items[0].end_date ? formatDateDisplay(group.items[0].end_date) : '',
      roster: group.items.map((it) => ({ studentId: it.student_id, charge: it.charge_per_session != null ? String(it.charge_per_session) : '' })),
    });
    setEditModalOpen(true);
  };

  const closeEditSlotModal = () => { if (savingEdit) return; setEditModalOpen(false); setEditForm(null); };

  const handleEditFieldChange = (field: 'day' | 'subjectId') => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setEditForm((prev) => {
      if (!prev) return prev;
      if (field === 'subjectId') return { ...prev, subjectId: value || null };
      return { ...prev, day: value };
    });
  };

  const handleEditDateChange = (field: 'startDate' | 'endDate') => (v: string) =>
    setEditForm((prev) => prev ? { ...prev, [field]: v } : prev);

  const handleConfirmEditSlot = async () => {
    if (!editForm) return;
    if (!editForm.day) { setError('Επιλέξτε ημέρα.'); return; }
    if (editForm.roster.length === 0) { setError('Προσθέστε τουλάχιστον έναν μαθητή.'); return; }
    if (!editForm.startTime || !editForm.endTime) { setError('Συμπληρώστε τις ώρες έναρξης και λήξης.'); return; }
    const startDateISO = parseDateDisplayToISO(editForm.startDate);
    const endDateISO = parseDateDisplayToISO(editForm.endDate);
    if (!startDateISO || !endDateISO) { setError('Συμπληρώστε σωστά τις ημερομηνίες.'); return; }

    setSavingEdit(true); setError(null);
    try {
      await callEdgeFunction('private-lesson-update', {
        program_item_id: editForm.programItemId,
        subject_id: editForm.subjectId,
        day_of_week: editForm.day,
        start_time: editForm.startTime,
        end_time: editForm.endTime,
        start_date: startDateISO,
        end_date: endDateISO,
        students: editForm.roster.map((r) => ({ student_id: r.studentId, charge_per_session: r.charge.trim() ? Number(r.charge) : null })),
      });
      await reloadProgramItems();
      closeEditSlotModal();
    } catch (err) {
      console.error(err);
      setError('Αποτυχία ενημέρωσης στο πρόγραμμα.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Roster editing (add form) ────────────────────────────────────────────
  const addStudentToAddForm = (studentId: string) =>
    setAddForm((prev) => ({ ...prev, roster: [...prev.roster, { studentId, charge: '' }] }));
  const removeStudentFromAddForm = (studentId: string) =>
    setAddForm((prev) => ({ ...prev, roster: prev.roster.filter((r) => r.studentId !== studentId) }));
  const changeChargeInAddForm = (studentId: string, value: string) =>
    setAddForm((prev) => ({ ...prev, roster: prev.roster.map((r) => (r.studentId === studentId ? { ...r, charge: value } : r)) }));

  // ── Roster editing (edit form) ───────────────────────────────────────────
  const addStudentToEditForm = (studentId: string) =>
    setEditForm((prev) => prev && { ...prev, roster: [...prev.roster, { studentId, charge: '' }] });
  const removeStudentFromEditForm = (studentId: string) =>
    setEditForm((prev) => prev && { ...prev, roster: prev.roster.filter((r) => r.studentId !== studentId) });
  const changeChargeInEditForm = (studentId: string, value: string) =>
    setEditForm((prev) => prev && { ...prev, roster: prev.roster.map((r) => (r.studentId === studentId ? { ...r, charge: value } : r)) });

  // ── Delete slot ───────────────────────────────────────────────────────────
  const handleConfirmDeleteSlot = async () => {
    if (!deleteTarget) return;
    setDeletingSlot(true); setError(null);
    try {
      const data = await callEdgeFunction('private-lesson-delete', { program_item_id: deleteTarget.programItemId });
      const deletedIds = new Set((data.deleted as string[]) ?? []);
      setProgramItems((prev) => prev.filter((i) => !deletedIds.has(i.id)));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής από το πρόγραμμα.');
    } finally {
      setDeletingSlot(false);
    }
  };

  const handleDropOnDay = (day: string) => {
    if (!dragStudentId) return;
    openAddSlotModal(dragStudentId, day);
    setDragStudentId(null);
  };

  const addFormAvailableStudents = useMemo(() => {
    const taken = new Set(addForm.roster.map((r) => r.studentId));
    return students.filter((s) => !taken.has(s.id));
  }, [students, addForm.roster]);

  const editFormAvailableStudents = useMemo(() => {
    const taken = new Set((editForm?.roster ?? []).map((r) => r.studentId));
    return students.filter((s) => !taken.has(s.id));
  }, [students, editForm?.roster]);

  return (
    <div className="space-y-6 px-1">

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
        <div className="flex flex-col gap-4">
          {schoolYears.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <CalendarRange className={`h-3.5 w-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <StyledSelect
                isDark={isDark} showChevron
                value={selectedYearId}
                onChange={setSelectedYearId}
                className={`h-8 w-44 rounded-lg border pl-2 pr-7 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                options={schoolYears.map((y) => ({ value: y.id, label: y.name }))}
              />
            </div>
          )}

          <PrivateProgramStudentsPanel
            students={students}
            filteredStudents={filteredStudents}
            studentSearch={studentSearch}
            onSearchChange={setStudentSearch}
            isDark={isDark}
            dragStudentId={dragStudentId}
            onDragStart={setDragStudentId}
            onDragEnd={(id) => setDragStudentId((prev) => (prev === id ? null : prev))}
            onAddSlot={openAddSlotModal}
          />

          <PrivateProgramScheduleGrid
            groupsByDay={groupsByDay}
            studentById={studentById}
            subjectById={subjectById}
            dragStudentId={dragStudentId}
            isDark={isDark}
            onEditGroup={openEditSlotModal}
            onDeleteGroup={setDeleteTarget}
            onDragOver={() => { }}
            onDrop={handleDropOnDay}
          />
        </div>
      )}

      <PrivateProgramAddSlotModal
        open={addModalOpen}
        form={addForm}
        saving={savingSlot}
        error={error}
        studentById={studentById}
        availableStudents={addFormAvailableStudents}
        subjOptions={subjects}
        isDark={isDark}
        onClose={closeAddSlotModal}
        onSubmit={handleConfirmAddSlot}
        onFieldChange={handleAddFieldChange}
        onStartTimeChange={(t) => setAddForm((p) => ({ ...p, startTime: t }))}
        onEndTimeChange={(t) => setAddForm((p) => ({ ...p, endTime: t }))}
        onDateChange={handleAddDateChange}
        onAddStudent={addStudentToAddForm}
        onRemoveStudent={removeStudentFromAddForm}
        onChargeChange={changeChargeInAddForm}
      />

      <PrivateProgramEditSlotModal
        open={editModalOpen}
        form={editForm}
        saving={savingEdit}
        error={error}
        studentById={studentById}
        availableStudents={editFormAvailableStudents}
        subjOptions={subjects}
        isDark={isDark}
        onClose={closeEditSlotModal}
        onSubmit={handleConfirmEditSlot}
        onFieldChange={handleEditFieldChange}
        onStartTimeChange={(t) => setEditForm((p) => p ? { ...p, startTime: t } : p)}
        onEndTimeChange={(t) => setEditForm((p) => p ? { ...p, endTime: t } : p)}
        onDateChange={handleEditDateChange}
        onAddStudent={addStudentToEditForm}
        onRemoveStudent={removeStudentFromEditForm}
        onChargeChange={changeChargeInEditForm}
      />

      <PrivateProgramDeleteSlotModal
        target={deleteTarget}
        deleting={deletingSlot}
        isDark={isDark}
        onCancel={() => { if (!deletingSlot) setDeleteTarget(null); }}
        onConfirm={handleConfirmDeleteSlot}
      />
    </div>
  );
}
