// src/pages/TestsPage.tsx
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import AppDatePicker from '../components/ui/AppDatePicker';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import { ArrowRight, ArrowLeft, Loader2, Search } from 'lucide-react';
import { Users, Percent } from 'lucide-react';

type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject_id: string | null;
};

type SubjectRow = {
  id: string;
  school_id: string;
  name: string;
  level_id: string | null;
};

type LevelRow = {
  id: string;
  school_id: string;
  name: string;
};

type ClassSubjectRow = {
  class_id: string;
  subject_id: string;
  school_id?: string | null;
};

type TestRow = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  test_date: string; // ISO date "YYYY-MM-DD"
  start_time: string | null; // "HH:MM" or "HH:MM:SS"
  end_time: string | null; // "HH:MM" or "HH:MM:SS"
  title: string | null;
  description: string | null;
};

type AddTestForm = {
  classId: string | null;
  subjectId: string | null;
  date: string; // dd/mm/yyyy (for AppDatePicker)
  startTime: string;
  startPeriod: 'AM' | 'PM';
  endTime: string;
  endPeriod: 'AM' | 'PM';
  title: string;
};

type EditTestForm = {
  id: string;
  classId: string | null;
  subjectId: string | null;
  date: string; // dd/mm/yyyy
  startTime: string;
  startPeriod: 'AM' | 'PM';
  endTime: string;
  endPeriod: 'AM' | 'PM';
  title: string;
};

type StudentRow = {
  id: string;
  school_id: string;
  full_name: string | null;
};

type TestResultRow = {
  id: string;
  test_id: string;
  student_id: string;
  grade: number | null;
};

type TestResultsModalState = {
  testId: string;
  testTitle: string | null;
  dateDisplay: string;
  timeRange: string;
  classTitle: string;
  subjectName: string;
};

type GradeInfo = {
  grade: string;
  existingResultId?: string;
};

const emptyForm: AddTestForm = {
  classId: null,
  subjectId: null,
  date: '',
  startTime: '',
  startPeriod: 'PM',
  endTime: '',
  endPeriod: 'PM',
  title: '',
};

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** 12h "HH:MM" + AM/PM -> 24h "HH:MM" */
function convert12To24(time: string, period: 'AM' | 'PM'): string | null {
  const t = time.trim();
  if (!t) return null;

  const [hStr, mStr = '00'] = t.split(':');
  let h = Number(hStr);
  let m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  h = h % 12;
  if (period === 'PM') {
    h += 12;
  } else if (period === 'AM' && h === 12) {
    h = 0;
  }

  return `${pad2(h)}:${pad2(m)}`;
}

/** 24h "HH:MM[:SS]" -> 12h + AM/PM (same logic as ProgramPage) */
function convert24To12(
  time: string | null,
): { time: string; period: 'AM' | 'PM' } {
  if (!time) return { time: '', period: 'AM' };
  const [hStr, mStr = '00'] = time.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return { time: '', period: 'AM' };
  }
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { time: `${pad2(h)}:${pad2(m)}`, period };
}

/** keeps only digits and inserts ":" after HH (same as ProgramPage) */
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** "YYYY-MM-DD" -> "dd/mm/yyyy" */
function formatDateDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "dd/mm/yyyy" -> "YYYY-MM-DD" */
function parseDateDisplayToISO(display: string): string | null {
  const v = display.trim();
  if (!v) return null;
  const parts = v.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [dStr, mStr, yStr] = parts;
  const day = Number(dStr);
  const month = Number(mStr);
  const year = Number(yStr);
  if (!day || !month || !year) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** "HH:MM[:SS]" -> "HH:MM" */
function formatTimeDisplay(t: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

export default function TestsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<AddTestForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // edit state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditTestForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    dateDisplay: string;
    timeRange: string;
    classTitle: string;
    subjectName: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // search
  const [searchTerm, setSearchTerm] = useState('');

  // ✅ Pagination (same look/behavior as LevelsPage)
  const pageSize = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  // results (students & grades) modal state
  const [resultsModal, setResultsModal] = useState<TestResultsModalState | null>(
    null,
  );
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsSaving, setResultsSaving] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const [resultsAllStudents, setResultsAllStudents] = useState<StudentRow[]>([]);
  const [resultsAssignedIds, setResultsAssignedIds] = useState<Set<string>>(
    new Set(),
  );
  const [resultsInitialAssignedIds, setResultsInitialAssignedIds] =
    useState<Set<string>>(new Set());
  const [resultsGradeByStudent, setResultsGradeByStudent] = useState<
    Record<string, GradeInfo>
  >({});
  const [resultsSearchLeft, setResultsSearchLeft] = useState('');
  const [resultsSearchRight, setResultsSearchRight] = useState('');

  // maps for display
  const subjectById = useMemo(() => {
    const m = new Map<string, SubjectRow>();
    subjects.forEach((s) => m.set(s.id, s));
    return m;
  }, [subjects]);

  const classById = useMemo(() => {
    const m = new Map<string, ClassRow>();
    classes.forEach((c) => m.set(c.id, c));
    return m;
  }, [classes]);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          { data: classData, error: classErr },
          { data: subjData, error: subjErr },
          { data: levelData, error: lvlErr },
          { data: classSubjectData, error: classSubjErr },
          { data: testsData, error: testsErr },
        ] = await Promise.all([
          supabase
            .from('classes')
            .select('id, school_id, title, subject_id')
            .eq('school_id', schoolId)
            .order('title', { ascending: true }),
          supabase
            .from('subjects')
            .select('id, school_id, name, level_id')
            .eq('school_id', schoolId)
            .order('name', { ascending: true }),
          supabase
            .from('levels')
            .select('id, school_id, name')
            .eq('school_id', schoolId)
            .order('name', { ascending: true }),
          supabase
            .from('class_subjects')
            .select('class_id, subject_id, school_id')
            .eq('school_id', schoolId),
          supabase
            .from('tests')
            .select(
              'id, school_id, class_id, subject_id, test_date, start_time, end_time, title, description',
            )
            .eq('school_id', schoolId)
            .order('test_date', { ascending: true })
            .order('start_time', { ascending: true }),
        ]);

        if (classErr) throw classErr;
        if (subjErr) throw subjErr;
        if (lvlErr) throw lvlErr;
        if (classSubjErr) throw classSubjErr;
        if (testsErr) throw testsErr;

        setClasses((classData ?? []) as ClassRow[]);
        setSubjects((subjData ?? []) as SubjectRow[]);
        setLevels((levelData ?? []) as LevelRow[]);
        setClassSubjects((classSubjectData ?? []) as ClassSubjectRow[]);
        setTests((testsData ?? []) as TestRow[]);
      } catch (err) {
        console.error('TestsPage load error', err);
        setError('Αποτυχία φόρτωσης διαγωνισμάτων.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [schoolId]);

  // ✅ SAME getSubjectsForClass logic as ProgramPage
  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];

    const cls = classes.find((c) => c.id === classId) ?? null;

    const attachedIds = new Set<string>();

    classSubjects
      .filter((cs) => cs.class_id === classId && cs.subject_id)
      .forEach((cs) => attachedIds.add(cs.subject_id));

    if (cls?.subject_id) {
      attachedIds.add(cls.subject_id);
    }

    const attachedSubjects: SubjectRow[] = [];
    attachedIds.forEach((id) => {
      const subj = subjectById.get(id);
      if (subj) attachedSubjects.push(subj);
    });

    if (attachedSubjects.length >= 2) {
      return attachedSubjects.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    }

    // fallback
    let levelId: string | null = null;
    if (cls?.subject_id) {
      const mainSubj = subjectById.get(cls.subject_id);
      levelId = mainSubj?.level_id ?? null;
    }

    let extraSubjects: SubjectRow[];
    if (levelId) {
      extraSubjects = subjects.filter((s) => s.level_id === levelId);
    } else {
      extraSubjects = subjects;
    }

    const merged = new Map<string, SubjectRow>();
    extraSubjects.forEach((s) => merged.set(s.id, s));
    attachedSubjects.forEach((s) => merged.set(s.id, s));

    const result = Array.from(merged.values());
    result.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    return result;
  };

  // derived tests with display fields
  const testsWithDisplay = useMemo(
    () =>
      tests.map((t) => {
        const cls = classById.get(t.class_id);
        const subj = subjectById.get(t.subject_id);
        const timeRange =
          t.start_time && t.end_time
            ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(t.end_time)}`
            : '';
        return {
          ...t,
          classTitle: cls?.title ?? '—',
          subjectName: subj?.name ?? '—',
          dateDisplay: formatDateDisplay(t.test_date),
          timeRange,
        };
      }),
    [tests, classById, subjectById],
  );

  const filteredTests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return testsWithDisplay;

    return testsWithDisplay.filter((t) => {
      const date = (t.dateDisplay ?? '').toLowerCase();
      const time = (t.timeRange ?? '').toLowerCase();
      const classTitle = (t.classTitle ?? '').toLowerCase();
      const subjectName = (t.subjectName ?? '').toLowerCase();
      const title = (t.title ?? '').toLowerCase();
      return (
        date.includes(q) ||
        time.includes(q) ||
        classTitle.includes(q) ||
        subjectName.includes(q) ||
        title.includes(q)
      );
    });
  }, [testsWithDisplay, searchTerm]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTests.length / pageSize));
  }, [filteredTests.length]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedTests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTests.slice(start, start + pageSize);
  }, [filteredTests, page]);

  const showingFrom = filteredTests.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredTests.length);

  const openModal = () => {
    setError(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleFieldChange =
    (field: keyof AddTestForm) =>
    (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        if (field === 'classId') {
          return { ...prev, classId: value || null, subjectId: null };
        }
        if (field === 'subjectId') {
          return { ...prev, subjectId: value || null };
        }
        return { ...prev, [field]: value as any };
      });
    };

  const handleTimeChange =
    (field: 'startTime' | 'endTime') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const formatted = formatTimeInput(e.target.value);
      setForm((prev) => ({ ...prev, [field]: formatted }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) {
      setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.');
      return;
    }

    if (!form.classId) {
      setError('Επιλέξτε τμήμα.');
      return;
    }

    const subjectOptions = getSubjectsForClass(form.classId);
    if (subjectOptions.length > 0 && !form.subjectId) {
      setError('Επιλέξτε μάθημα για το τμήμα.');
      return;
    }

    if (!form.date) {
      setError('Επιλέξτε ημερομηνία διαγωνίσματος.');
      return;
    }

    const testDateISO = parseDateDisplayToISO(form.date);
    if (!testDateISO) {
      setError('Μη έγκυρη ημερομηνία (χρησιμοποιήστε μορφή ηη/μμ/εεεε).');
      return;
    }

    if (!form.startTime || !form.endTime) {
      setError('Συμπληρώστε ώρα έναρξης και λήξης διαγωνίσματος.');
      return;
    }

    const start24 = convert12To24(form.startTime, form.startPeriod);
    const end24 = convert12To24(form.endTime, form.endPeriod);

    if (!start24 || !end24) {
      setError('Συμπληρώστε σωστά τις ώρες (π.χ. 08:00).');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      school_id: schoolId,
      class_id: form.classId,
      subject_id: form.subjectId ?? subjectOptions[0]?.id,
      test_date: testDateISO,
      start_time: start24,
      end_time: end24,
      title: form.title || null,
      description: null,
    };

    const { data, error: insertErr } = await supabase
      .from('tests')
      .insert(payload)
      .select('*')
      .maybeSingle();

    setSaving(false);

    if (insertErr || !data) {
      console.error('insert test error', insertErr);
      setError('Αποτυχία δημιουργίας διαγωνίσματος.');
      return;
    }

    setTests((prev) => [...prev, data as TestRow]);
    setModalOpen(false);
  };

  // ---- EDIT helpers ----
  const openEditModal = (testId: string) => {
    const t = tests.find((tt) => tt.id === testId);
    if (!t) return;

    const { time: startTime, period: startPeriod } = convert24To12(t.start_time);
    const { time: endTime, period: endPeriod } = convert24To12(t.end_time);

    setError(null);
    setEditForm({
      id: t.id,
      classId: t.class_id,
      subjectId: t.subject_id ?? null,
      date: formatDateDisplay(t.test_date),
      startTime,
      startPeriod,
      endTime,
      endPeriod,
      title: t.title ?? '',
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditModalOpen(false);
    setEditForm(null);
  };

  const handleEditFieldChange =
    (field: keyof EditTestForm) =>
    (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      const value = e.target.value;
      setEditForm((prev) => {
        if (!prev) return prev;
        if (field === 'classId') {
          return { ...prev, classId: value || null, subjectId: null };
        }
        if (field === 'subjectId') {
          return { ...prev, subjectId: value || null };
        }
        return { ...prev, [field]: value as any };
      });
    };

  const handleEditTimeChange =
    (field: 'startTime' | 'endTime') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const formatted = formatTimeInput(e.target.value);
      setEditForm((prev) => (prev ? { ...prev, [field]: formatted } : prev));
    };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId || !editForm) return;

    if (!editForm.classId) {
      setError('Επιλέξτε τμήμα.');
      return;
    }

    const subjectOptions = getSubjectsForClass(editForm.classId);
    if (subjectOptions.length > 0 && !editForm.subjectId) {
      setError('Επιλέξτε μάθημα για το τμήμα.');
      return;
    }

    if (!editForm.date) {
      setError('Επιλέξτε ημερομηνία διαγωνίσματος.');
      return;
    }

    const testDateISO = parseDateDisplayToISO(editForm.date);
    if (!testDateISO) {
      setError('Μη έγκυρη ημερομηνία (χρησιμοποιήστε μορφή ηη/μμ/εεεε).');
      return;
    }

    if (!editForm.startTime || !editForm.endTime) {
      setError('Συμπληρώστε ώρα έναρξης και λήξης διαγωνίσματος.');
      return;
    }

    const start24 = convert12To24(editForm.startTime, editForm.startPeriod);
    const end24 = convert12To24(editForm.endTime, editForm.endPeriod);

    if (!start24 || !end24) {
      setError('Συμπληρώστε σωστά τις ώρες (π.χ. 08:00).');
      return;
    }

    setSavingEdit(true);
    setError(null);

    const payload = {
      class_id: editForm.classId,
      subject_id: editForm.subjectId ?? subjectOptions[0]?.id,
      test_date: testDateISO,
      start_time: start24,
      end_time: end24,
      title: editForm.title || null,
    };

    const { data, error: updateErr } = await supabase
      .from('tests')
      .update(payload)
      .eq('id', editForm.id)
      .select('*')
      .maybeSingle();

    setSavingEdit(false);

    if (updateErr || !data) {
      console.error('update test error', updateErr);
      setError('Αποτυχία ενημέρωσης διαγωνίσματος.');
      return;
    }

    setTests((prev) => prev.map((t) => (t.id === editForm.id ? (data as TestRow) : t)));
    closeEditModal();
  };

  // ---- DELETE helpers ----
  const openDeleteModal = (testId: string) => {
    const t = tests.find((tt) => tt.id === testId);
    if (!t) return;

    const cls = classById.get(t.class_id);
    const subj = subjectById.get(t.subject_id);
    const dateDisplay = formatDateDisplay(t.test_date);
    const timeRange =
      t.start_time && t.end_time
        ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(t.end_time)}`
        : '';

    setDeleteTarget({
      id: t.id,
      dateDisplay,
      timeRange,
      classTitle: cls?.title ?? '—',
      subjectName: subj?.name ?? '—',
    });
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    const { error: deleteErr } = await supabase.from('tests').delete().eq('id', deleteTarget.id);

    setDeleting(false);

    if (deleteErr) {
      console.error('delete test error', deleteErr);
      setError('Αποτυχία διαγραφής διαγωνίσματος.');
      return;
    }

    setTests((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  // ---- RESULTS (students & grades) helpers ----
  const availableStudents = useMemo(
    () =>
      resultsAllStudents.filter(
        (s) =>
          !resultsAssignedIds.has(s.id) &&
          (s.full_name ?? '').toLowerCase().includes(resultsSearchLeft.toLowerCase()),
      ),
    [resultsAllStudents, resultsAssignedIds, resultsSearchLeft],
  );

  const assignedStudents = useMemo(
    () =>
      resultsAllStudents
        .filter((s) => resultsAssignedIds.has(s.id))
        .filter((s) =>
          (s.full_name ?? '').toLowerCase().includes(resultsSearchRight.toLowerCase()),
        ),
    [resultsAllStudents, resultsAssignedIds, resultsSearchRight],
  );

  const openResultsModal = async (testId: string) => {
    if (!schoolId) return;

    const tDisplay = testsWithDisplay.find((tt) => tt.id === testId);
    if (!tDisplay) return;

    setResultsError(null);
    setResultsModal({
      testId,
      testTitle: tDisplay.title ?? null,
      dateDisplay: tDisplay.dateDisplay,
      timeRange: tDisplay.timeRange,
      classTitle: tDisplay.classTitle,
      subjectName: tDisplay.subjectName,
    });

    setResultsLoading(true);

    try {
      // 1) Όλοι οι μαθητές του σχολείου
      const { data: studentsData, error: studentsErr } = await supabase
        .from('students')
        .select('id, school_id, full_name')
        .eq('school_id', schoolId)
        .order('full_name', { ascending: true });

      if (studentsErr) throw studentsErr;
      const students = (studentsData ?? []) as StudentRow[];
      setResultsAllStudents(students);

      // 2) Υπάρχοντα αποτελέσματα για αυτό το test
      const { data: resultsData, error: resultsErr } = await supabase
        .from('test_results')
        .select('id, test_id, student_id, grade')
        .eq('test_id', testId);

      if (resultsErr) throw resultsErr;

      const assignedIds = new Set<string>();
      const gradeMap: Record<string, GradeInfo> = {};

      (resultsData ?? []).forEach((raw) => {
        const r = raw as TestResultRow;
        assignedIds.add(r.student_id);
        gradeMap[r.student_id] = {
          grade: r.grade !== null && r.grade !== undefined ? String(r.grade) : '',
          existingResultId: r.id,
        };
      });

      // Ensure every student has an entry in gradeMap
      students.forEach((s) => {
        if (!gradeMap[s.id]) {
          gradeMap[s.id] = { grade: '', existingResultId: undefined };
        }
      });

      setResultsAssignedIds(assignedIds);
      setResultsInitialAssignedIds(new Set(assignedIds));
      setResultsGradeByStudent(gradeMap);
      setResultsSearchLeft('');
      setResultsSearchRight('');
    } catch (err) {
      console.error('load test results error', err);
      setResultsError('Αποτυχία φόρτωσης μαθητών / βαθμών για το διαγώνισμα.');
      setResultsAllStudents([]);
      setResultsAssignedIds(new Set());
      setResultsInitialAssignedIds(new Set());
      setResultsGradeByStudent({});
    } finally {
      setResultsLoading(false);
    }
  };

  const closeResultsModal = () => {
    if (resultsSaving) return;
    setResultsModal(null);
    setResultsError(null);
    setResultsLoading(false);
    setResultsAllStudents([]);
    setResultsAssignedIds(new Set());
    setResultsInitialAssignedIds(new Set());
    setResultsGradeByStudent({});
    setResultsSearchLeft('');
    setResultsSearchRight('');
  };

  const handleAddStudentToTest = (studentId: string) => {
    if (resultsSaving) return;
    setResultsAssignedIds((prev) => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
  };

  const handleRemoveStudentFromTest = (studentId: string) => {
    if (resultsSaving) return;
    setResultsAssignedIds((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  };

  const handleResultGradeChange = (studentId: string, value: string) => {
    setResultsGradeByStudent((prev) => ({
      ...prev,
      [studentId]: {
        grade: value,
        existingResultId: prev[studentId]?.existingResultId,
      },
    }));
  };

  const handleSaveResults = async () => {
    if (!resultsModal) return;

    // validation: για όλους τους επιλεγμένους μαθητές πρέπει να υπάρχει valid grade
    for (const studentId of resultsAssignedIds) {
      const info = resultsGradeByStudent[studentId];
      const gradeTrim = (info?.grade ?? '').trim();
      if (!gradeTrim) {
        const st = resultsAllStudents.find((s) => s.id === studentId);
        setResultsError(`Συμπληρώστε βαθμό για τον μαθητή "${st?.full_name ?? 'Άγνωστος'}".`);
        return;
      }
      const num = Number(gradeTrim.replace(',', '.'));
      if (Number.isNaN(num)) {
        const st = resultsAllStudents.find((s) => s.id === studentId);
        setResultsError(`Μη έγκυρος βαθμός για τον μαθητή "${st?.full_name ?? 'Άγνωστος'}".`);
        return;
      }
    }

    setResultsSaving(true);
    setResultsError(null);

    try {
      const inserts: { test_id: string; student_id: string; grade: number }[] = [];
      const updates: { id: string; grade: number }[] = [];
      const deleteIds: string[] = [];

      // Για όλους τους που είναι τώρα επιλεγμένοι
      for (const studentId of resultsAssignedIds) {
        const info = resultsGradeByStudent[studentId];
        const gradeTrim = (info?.grade ?? '').trim();
        const gradeNum = Number(gradeTrim.replace(',', '.'));

        if (resultsInitialAssignedIds.has(studentId)) {
          // υπήρχε ήδη αποτέλεσμα -> update
          if (info?.existingResultId) {
            updates.push({ id: info.existingResultId, grade: gradeNum });
          }
        } else {
          // νέος μαθητής στο test -> insert
          inserts.push({
            test_id: resultsModal.testId,
            student_id: studentId,
            grade: gradeNum,
          });
        }
      }

      // Μαθητές που ήταν αρχικά αλλά τώρα δεν είναι -> delete
      for (const studentId of resultsInitialAssignedIds) {
        if (!resultsAssignedIds.has(studentId)) {
          const info = resultsGradeByStudent[studentId];
          if (info?.existingResultId) {
            deleteIds.push(info.existingResultId);
          }
        }
      }

      if (inserts.length > 0) {
        const { error: insertErr } = await supabase.from('test_results').insert(inserts);
        if (insertErr) throw insertErr;
      }

      for (const upd of updates) {
        const { error: updateErr } = await supabase
          .from('test_results')
          .update({ grade: upd.grade })
          .eq('id', upd.id);
        if (updateErr) throw updateErr;
      }

      if (deleteIds.length > 0) {
        const { error: delErr } = await supabase.from('test_results').delete().in('id', deleteIds);
        if (delErr) throw delErr;
      }

      closeResultsModal();
    } catch (err) {
      console.error('save test results error', err);
      setResultsError('Αποτυχία αποθήκευσης βαθμών.');
    } finally {
      setResultsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-50">Διαγωνίσματα</h1>
          <p className="text-xs text-slate-300">
            Καταχώρησε διαγωνίσματα ανά τμήμα και μάθημα, ώστε να εμφανίζονται στο ημερολόγιο.
          </p>
          {schoolId && (
            <p className="mt-1 text-[11px] text-slate-400">
              Σύνολο διαγωνισμάτων:{' '}
              <span className="font-medium text-slate-100">{tests.length}</span>
              {searchTerm.trim() && (
                <>
                  {' · '}
                  <span className="text-slate-300">Εμφανίζονται: {filteredTests.length}</span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            className="form-input w-full sm:w-56"
            style={{
              background: 'var(--color-input-bg)',
              color: 'var(--color-text-main)',
            }}
            placeholder="Αναζήτηση..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <button
            type="button"
            onClick={openModal}
            className="btn-primary"
            style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
          >
            Προσθήκη διαγωνίσματος
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-500 bg-red-900/40 px-4 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {!schoolId && (
        <div className="rounded border border-amber-500 bg-amber-900/40 px-4 py-2 text-xs text-amber-100">
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* ✅ SAME “card table” styling as LevelsPage */}
      <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-4 text-xs text-slate-300">Φόρτωση διαγωνισμάτων…</div>
          ) : tests.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν υπάρχουν ακόμη διαγωνίσματα. Πατήστε «Προσθήκη διαγωνίσματος» για να δημιουργήσετε
              το πρώτο.
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν βρέθηκαν διαγωνίσματα με αυτά τα κριτήρια αναζήτησης.
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Ημερομηνία</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Ώρα</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Τμήμα</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Μάθημα</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">Τίτλος</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-right">Ενέργειες</th>
                </tr>
              </thead>

              <tbody>
                {pagedTests.map((t, idx) => {
                  const absoluteIndex = (page - 1) * pageSize + idx;
                  const rowBg = absoluteIndex % 2 === 0 ? 'bg-slate-950/45' : 'bg-slate-900/25';

                  return (
                    <tr
                      key={t.id}
                      className={`${rowBg} backdrop-blur-sm hover:bg-slate-800/40 transition-colors`}
                    >
                      <td className="border-b border-slate-700 px-4 py-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.dateDisplay}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.timeRange || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.classTitle}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.subjectName}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {t.title ?? '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openResultsModal(t.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/70 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20"
                            title="Μαθητές & βαθμοί"
                          >
                            <Users className="h-3.5 w-3.5" />
                            <Percent className="h-3 w-3" />
                          </button>

                          <EditDeleteButtons
                            onEdit={() => openEditModal(t.id)}
                            onDelete={() => openDeleteModal(t.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ✅ Pagination footer (same as LevelsPage) */}
        {!loading && filteredTests.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3">
            <div className="text-[11px] text-slate-300">
              Εμφάνιση <span className="text-slate-100">{showingFrom}</span>-
              <span className="text-slate-100">{showingTo}</span> από{' '}
              <span className="text-slate-100">{filteredTests.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Προηγ.
              </button>

              <div className="rounded-md border border-slate-700 bg-slate-900/20 px-3 py-1.5 text-[11px] text-slate-200">
                Σελίδα <span className="text-slate-50">{page}</span> /{' '}
                <span className="text-slate-50">{pageCount}</span>
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Επόμ.
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: add test */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">Νέο διαγώνισμα</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="form-label text-slate-100">Τμήμα *</label>
                <select
                  className="form-input select-accent"
                  value={form.classId ?? ''}
                  onChange={handleFieldChange('classId')}
                  required
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="">Επιλέξτε τμήμα</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-slate-100">Μάθημα για το τμήμα *</label>
                {(() => {
                  const options = getSubjectsForClass(form.classId);
                  return (
                    <>
                      <select
                        className="form-input select-accent"
                        value={form.subjectId ?? ''}
                        onChange={handleFieldChange('subjectId')}
                        disabled={options.length === 0 || !form.classId}
                        style={{
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="">
                          {options.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}
                        </option>
                        {options.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {options.length === 0 && form.classId && (
                        <p className="mt-1 text-[10px] text-amber-300">
                          Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="form-label text-slate-100">Ημερομηνία διαγωνίσματος *</label>
                <AppDatePicker
                  value={form.date}
                  onChange={(newValue) => setForm((prev) => ({ ...prev, date: newValue }))}
                  placeholder="π.χ. 12/05/2025"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">Ώρα έναρξης *</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 08:00"
                      value={form.startTime}
                      onChange={handleTimeChange('startTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={form.startPeriod}
                      onChange={handleFieldChange('startPeriod')}
                      className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label text-slate-100">Ώρα λήξης *</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 09:30"
                      value={form.endTime}
                      onChange={handleTimeChange('endTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={form.endPeriod}
                      onChange={handleFieldChange('endPeriod')}
                      className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label text-slate-100">Τίτλος (προαιρετικό)</label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. Διαγώνισμα Κεφαλαίου 3"
                  value={form.title}
                  onChange={handleFieldChange('title')}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-ghost"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  disabled={saving}
                >
                  Ακύρωση
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: edit test */}
      {editModalOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">Επεξεργασία διαγωνίσματος</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="form-label text-slate-100">Τμήμα *</label>
                <select
                  className="form-input select-accent"
                  value={editForm.classId ?? ''}
                  onChange={handleEditFieldChange('classId')}
                  required
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  <option value="">Επιλέξτε τμήμα</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-slate-100">Μάθημα για το τμήμα *</label>
                {(() => {
                  const options = getSubjectsForClass(editForm.classId);
                  return (
                    <>
                      <select
                        className="form-input select-accent"
                        value={editForm.subjectId ?? ''}
                        onChange={handleEditFieldChange('subjectId')}
                        disabled={options.length === 0 || !editForm.classId}
                        style={{
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="">
                          {options.length === 0 ? 'Δεν έχουν οριστεί μαθήματα' : 'Επιλέξτε μάθημα'}
                        </option>
                        {options.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {options.length === 0 && editForm.classId && (
                        <p className="mt-1 text-[10px] text-amber-300">
                          Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="form-label text-slate-100">Ημερομηνία διαγωνίσματος *</label>
                <AppDatePicker
                  value={editForm.date}
                  onChange={(newValue) =>
                    setEditForm((prev) => (prev ? { ...prev, date: newValue } : prev))
                  }
                  placeholder="π.χ. 12/05/2025"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">Ώρα έναρξης *</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 08:00"
                      value={editForm.startTime}
                      onChange={handleEditTimeChange('startTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={editForm.startPeriod}
                      onChange={handleEditFieldChange('startPeriod')}
                      className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label text-slate-100">Ώρα λήξης *</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 09:30"
                      value={editForm.endTime}
                      onChange={handleEditTimeChange('endTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={editForm.endPeriod}
                      onChange={handleEditFieldChange('endPeriod')}
                      className="absolute inset-y-1 right-1 rounded-md border border-slate-500 px-2 text-[10px] leading-tight"
                      style={{
                        backgroundColor: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label text-slate-100">Τίτλος (προαιρετικό)</label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. Διαγώνισμα Κεφαλαίου 3"
                  value={editForm.title}
                  onChange={handleEditFieldChange('title')}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="btn-ghost"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  disabled={savingEdit}
                >
                  Ακύρωση
                </button>
                <button type="submit" className="btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-50">Διαγραφή διαγωνίσματος</h3>
            <p className="mb-4 text-xs text-slate-200">
              Είσαι σίγουρος ότι θέλεις να διαγράψεις το διαγώνισμα{' '}
              <span className="font-semibold text-[color:var(--color-accent)]">
                {deleteTarget.subjectName}
              </span>{' '}
              για το τμήμα <span className="font-semibold text-slate-100">{deleteTarget.classTitle}</span>{' '}
              στις <span className="font-semibold text-slate-100">{deleteTarget.dateDisplay}</span>
              {deleteTarget.timeRange && (
                <>
                  {' '}
                  ({' '}
                  <span className="font-semibold text-slate-100">{deleteTarget.timeRange}</span> )
                </>
              )}
              ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
            </p>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="btn-ghost px-3 py-1"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
                disabled={deleting}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-md px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: '#dc2626' }}
              >
                {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results modal: students & grades (unchanged) */}
      {resultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-4xl rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">Μαθητές &amp; βαθμοί</h2>
                <p className="mt-1 text-[11px] text-slate-300">
                  {resultsModal.subjectName} · {resultsModal.classTitle}
                  {resultsModal.dateDisplay && <> · {resultsModal.dateDisplay}</>}
                  {resultsModal.timeRange && <> · {resultsModal.timeRange}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={closeResultsModal}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            {resultsError && (
              <div className="mb-3 rounded-lg bg-amber-900/60 px-3 py-2 text-xs text-amber-100">
                {resultsError}
              </div>
            )}

            {resultsLoading ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-200">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Φόρτωση μαθητών και βαθμών...
              </div>
            ) : resultsAllStudents.length === 0 ? (
              <div className="py-4 text-xs text-slate-300">
                Δεν βρέθηκαν μαθητές στο σχολείο. Προσθέστε μαθητές στη σελίδα «Μαθητές».
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-slate-700 bg-slate-950/40">
                  <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                    <h3 className="text-xs font-semibold text-slate-100">Όλοι οι μαθητές</h3>
                    <div className="flex items-center rounded border border-slate-600 bg-slate-900 px-2">
                      <Search className="mr-1 h-3 w-3 text-slate-400" />
                      <input
                        className="w-28 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-500"
                        placeholder="Αναζήτηση..."
                        value={resultsSearchLeft}
                        onChange={(e) => setResultsSearchLeft(e.target.value)}
                        disabled={resultsSaving}
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {availableStudents.length === 0 ? (
                      <p className="px-3 py-3 text-[11px] text-slate-500">Δεν υπάρχουν διαθέσιμοι μαθητές.</p>
                    ) : (
                      <ul className="divide-y divide-slate-800">
                        {availableStudents.map((s) => (
                          <li key={s.id} className="flex items-center justify-between px-3 py-2">
                            <span className="text-xs text-slate-100">{s.full_name ?? 'Χωρίς όνομα'}</span>
                            <button
                              type="button"
                              onClick={() => handleAddStudentToTest(s.id)}
                              disabled={resultsSaving}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-60"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-slate-700 bg-slate-950/40">
                  <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                    <h3 className="text-xs font-semibold text-slate-100">Μαθητές που έγραψαν</h3>
                    <div className="flex items-center rounded border border-slate-600 bg-slate-900 px-2">
                      <Search className="mr-1 h-3 w-3 text-slate-400" />
                      <input
                        className="w-28 bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-500"
                        placeholder="Αναζήτηση..."
                        value={resultsSearchRight}
                        onChange={(e) => setResultsSearchRight(e.target.value)}
                        disabled={resultsSaving}
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {assignedStudents.length === 0 ? (
                      <p className="px-3 py-3 text-[11px] text-slate-500">
                        Δεν έχουν επιλεγεί μαθητές για το διαγώνισμα.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-800">
                        {assignedStudents.map((s) => {
                          const info = resultsGradeByStudent[s.id] ?? { grade: '' };
                          return (
                            <li key={s.id} className="flex items-center px-3 py-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveStudentFromTest(s.id)}
                                disabled={resultsSaving}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-500 text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                              >
                                <ArrowLeft size={14} />
                              </button>
                              <span className="ml-2 flex-1 text-xs text-slate-100">
                                {s.full_name ?? 'Χωρίς όνομα'}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="π.χ. 18.5"
                                value={info.grade}
                                onChange={(e) => handleResultGradeChange(s.id, e.target.value)}
                                className="form-input ml-3 w-20 text-xs"
                                style={{
                                  background: 'var(--color-input-bg)',
                                  color: 'var(--color-text-main)',
                                }}
                                disabled={resultsSaving}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeResultsModal}
                disabled={resultsSaving}
                className="btn-ghost"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleSaveResults}
                disabled={resultsSaving || resultsLoading}
                className="btn-primary"
              >
                {resultsSaving ? (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Αποθήκευση...
                  </span>
                ) : (
                  'Αποθήκευση'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
