// src/pages/ProgramPage.tsx
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import AppDatePicker from '../components/ui/AppDatePicker';

type ClassRow = {
  id: string;
  school_id: string;
  title: string;
  subject: string | null;
  subject_id: string | null;
  tutor_id: string | null;
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

type TutorRow = {
  id: string;
  school_id: string;
  full_name: string;
};

type ProgramRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
};

type ProgramItemRow = {
  id: string;
  program_id: string;
  class_id: string;
  day_of_week: string;
  position: number | null;
  start_time: string | null; // "HH:MM" or "HH:MM:SS"
  end_time: string | null; // "HH:MM" or "HH:MM:SS"
  start_date: string | null; // "YYYY-MM-DD"
  end_date: string | null; // "YYYY-MM-DD"
  subject_id: string | null;
  tutor_id: string | null;
};

type ClassSubjectRow = {
  class_id: string;
  subject_id: string;
};

type SubjectTutorRow = {
  subject_id: string;
  tutor_id: string;
};

type AddSlotForm = {
  classId: string | null;
  subjectId: string | null;
  tutorId: string | null;
  day: string;
  startTime: string;
  startPeriod: 'AM' | 'PM';
  endTime: string;
  endPeriod: 'AM' | 'PM';
  startDate: string; // displayed as dd/mm/yyyy
  endDate: string; // displayed as dd/mm/yyyy
};

type EditSlotForm = {
  id: string;
  classId: string | null;
  subjectId: string | null;
  tutorId: string | null;
  day: string;
  startTime: string;
  startPeriod: 'AM' | 'PM';
  endTime: string;
  endPeriod: 'AM' | 'PM';
  startDate: string;
  endDate: string;
};

const emptyAddSlotForm: AddSlotForm = {
  classId: null,
  subjectId: null,
  tutorId: null,
  day: '',
  startTime: '',
  startPeriod: 'PM',
  endTime: '',
  endPeriod: 'PM',
  startDate: '',
  endDate: '',
};

const DAY_OPTIONS = [
  { value: 'monday', label: 'ΔΕΥΤΕΡΑ' },
  { value: 'tuesday', label: 'ΤΡΙΤΗ' },
  { value: 'wednesday', label: 'ΤΕΤΑΡΤΗ' },
  { value: 'thursday', label: 'ΠΕΜΠΤΗ' },
  { value: 'friday', label: 'ΠΑΡΑΣΚΕΥΗ' },
  { value: 'saturday', label: 'ΣΑΒΒΑΤΟ' },
  { value: 'sunday', label: 'ΚΥΡΙΑΚΗ' },
];

const DAY_LABEL_BY_VALUE: Record<string, string> = DAY_OPTIONS.reduce(
  (acc, d) => {
    acc[d.value] = d.label;
    return acc;
  },
  {} as Record<string, string>,
);

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

/** 24h "HH:MM[:SS]" -> 12h + AM/PM */
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

/** keeps only digits and inserts ":" after HH */
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [hStr, mStr = '00'] = t.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" -> "dd/mm/yyyy" for display */
function formatDateDisplay(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "dd/mm/yyyy" -> "YYYY-MM-DD" for saving */
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

/** "HH:MM[:SS]" -> "HH:MM" for display */
function formatTimeDisplay(t: string | null): string {
  if (!t) return '—';
  return t.slice(0, 5);
}

export default function ProgramPage() {
  const { profile } = useAuth();
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

  // add-slot modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddSlotForm>(emptyAddSlotForm);
  const [savingSlot, setSavingSlot] = useState(false);

  // edit-slot modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditSlotForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // delete-slot modal
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<{
    id: string;
    classLabel: string;
    dayLabel: string;
    timeRange: string;
  } | null>(null);
  const [deletingSlot, setDeletingSlot] = useState(false);

  // maps for display
  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  const tutorNameById = useMemo(() => {
    const m = new Map<string, string>();
    tutors.forEach((t) => m.set(t.id, t.full_name));
    return m;
  }, [tutors]);

  const subjectById = useMemo(() => {
    const m = new Map<string, SubjectRow>();
    subjects.forEach((s) => m.set(s.id, s));
    return m;
  }, [subjects]);

  const currentEditClass = useMemo(() => {
    if (!editForm) return null;
    return classes.find((c) => c.id === editForm.classId) ?? null;
  }, [editForm, classes]);

  // group items ανά μέρα, sort by start_time
  const itemsByDay = useMemo(() => {
    const map: Record<string, ProgramItemRow[]> = {};
    DAY_OPTIONS.forEach((d) => {
      map[d.value] = [];
    });

    programItems.forEach((item) => {
      if (!map[item.day_of_week]) {
        map[item.day_of_week] = [];
      }
      map[item.day_of_week].push(item);
    });

    Object.keys(map).forEach((day) => {
      map[day].sort((a, b) => {
        const ta = timeToMinutes(a.start_time);
        const tb = timeToMinutes(b.start_time);
        if (ta !== tb) return ta - tb;
        const pa = a.position ?? 0;
        const pb = b.position ?? 0;
        return pa - pb;
      });
    });

    return map;
  }, [programItems]);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Find or create default program
        const { data: programRows, error: programErr } = await supabase
          .from('programs')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: true });

        if (programErr) throw programErr;

        let activeProgram: ProgramRow | null =
          (programRows?.[0] as ProgramRow) ?? null;

        if (!activeProgram) {
          const { data: created, error: createErr } = await supabase
            .from('programs')
            .insert({
              school_id: schoolId,
              name: 'Βασικό πρόγραμμα',
              description: null,
            })
            .select('*')
            .maybeSingle();

          if (createErr || !created) {
            throw createErr ?? new Error('Failed to create default program');
          }
          activeProgram = created as ProgramRow;
        }

        setProgram(activeProgram);

        // 2. load classes + lookups + program_items (βασικά)
        const [
          { data: classData, error: classErr },
          { data: subjData, error: subjErr },
          { data: levelData, error: lvlErr },
          { data: tutorData, error: tutorErr },
          { data: itemData, error: itemErr },
        ] = await Promise.all([
          supabase
            .from('classes')
            .select('id, school_id, title, subject, subject_id, tutor_id')
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
            .from('tutors')
            .select('id, school_id, full_name')
            .eq('school_id', schoolId)
            .order('full_name', { ascending: true }),
          supabase
            .from('program_items')
            .select('*')
            .eq('program_id', activeProgram.id)
            .order('day_of_week', { ascending: true })
            .order('position', { ascending: true }),
        ]);

        if (classErr) throw classErr;
        if (subjErr) throw subjErr;
        if (lvlErr) throw lvlErr;
        if (tutorErr) throw tutorErr;
        if (itemErr) throw itemErr;

        setClasses((classData ?? []) as ClassRow[]);
        setSubjects((subjData ?? []) as SubjectRow[]);
        setLevels((levelData ?? []) as LevelRow[]);
        setTutors((tutorData ?? []) as TutorRow[]);
        setProgramItems((itemData ?? []) as ProgramItemRow[]);

        // 3. Προαιρετικά relations: class_subjects
        try {
          const { data: classSubjectData, error: classSubjErr } = await supabase
            .from('class_subjects')
            .select('class_id, subject_id')
            .eq('school_id', schoolId);

          if (classSubjErr) {
            console.warn('class_subjects load error', classSubjErr);
            setClassSubjects([]);
          } else {
            setClassSubjects(
              (classSubjectData ?? []) as ClassSubjectRow[],
            );
          }
        } catch (e) {
          console.warn('class_subjects not available', e);
          setClassSubjects([]);
        }

        // 4. Προαιρετικά relations: subject_tutors
        try {
          const { data: subjectTutorData, error: subjTutorErr } = await supabase
            .from('subject_tutors')
            .select('subject_id, tutor_id')
            .eq('school_id', schoolId);

          if (subjTutorErr) {
            console.warn('subject_tutors load error', subjTutorErr);
            setSubjectTutors([]);
          } else {
            setSubjectTutors(
              (subjectTutorData ?? []) as SubjectTutorRow[],
            );
          }
        } catch (e) {
          console.warn('subject_tutors not available', e);
          setSubjectTutors([]);
        }
      } catch (err: any) {
        console.error('ProgramPage load error', err);
        setError('Αποτυχία φόρτωσης προγράμματος.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [schoolId]);

  // Helpers για options
  const getSubjectsForClass = (classId: string | null): SubjectRow[] => {
    if (!classId) return [];

    const ids = new Set<string>();

    // 1) βασικό μάθημα του τμήματος (classes.subject_id)
    const cls = classes.find((c) => c.id === classId);
    if (cls?.subject_id) {
      ids.add(cls.subject_id);
    }

    // 2) όλα τα μαθήματα που έχεις συνδέσει στο ClassesPage (class_subjects)
    classSubjects
      .filter((cs) => cs.class_id === classId && cs.subject_id)
      .forEach((cs) => ids.add(cs.subject_id));

    const result: SubjectRow[] = [];
    ids.forEach((id) => {
      const subj = subjectById.get(id);
      if (subj) result.push(subj);
    });

    // ταξινόμηση με βάση όνομα
    result.sort((a, b) => a.name.localeCompare(b.name, 'el-GR'));
    return result;
  };

  const getTutorsForSubject = (subjectId: string | null): TutorRow[] => {
    if (!subjectId) return [];
    const tutorIds = subjectTutors
      .filter((st) => st.subject_id === subjectId)
      .map((st) => st.tutor_id);
    const uniqueIds = Array.from(new Set(tutorIds));
    const result: TutorRow[] = [];
    uniqueIds.forEach((id) => {
      const tutor = tutors.find((t) => t.id === id);
      if (tutor) result.push(tutor);
    });
    return result;
  };

  // ---- add slot modal helpers ----
  const openAddSlotModal = (classId: string, day: string) => {
    const isoToday = todayISO();
    const displayToday = formatDateDisplay(isoToday); // dd/mm/yyyy
    setError(null);
    setAddForm({
      classId,
      subjectId: null,
      tutorId: null,
      day,
      startTime: '',
      startPeriod: 'PM',
      endTime: '',
      endPeriod: 'PM',
      startDate: displayToday,
      endDate: displayToday,
    });
    setAddModalOpen(true);
  };

  const closeAddSlotModal = () => {
    setAddModalOpen(false);
    setAddForm(emptyAddSlotForm);
    setSavingSlot(false);
  };

  const handleAddTimeChange =
    (field: 'startTime' | 'endTime') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const formatted = formatTimeInput(e.target.value);
      setAddForm((prev) => ({ ...prev, [field]: formatted }));
    };

  const handleAddFieldChange =
    (field: keyof AddSlotForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setAddForm((prev) => {
        if (field === 'subjectId') {
          return { ...prev, subjectId: value || null, tutorId: null };
        }
        if (field === 'tutorId') {
          return { ...prev, tutorId: value || null };
        }
        return { ...prev, [field]: value as any };
      });
    };

  const handleConfirmAddSlot = async () => {
    if (!program) return;
    if (!addForm.classId || !addForm.day) {
      setError('Επιλέξτε τμήμα και ημέρα.');
      return;
    }

    const subjectsForClass = getSubjectsForClass(addForm.classId);
    if (subjectsForClass.length === 0) {
      setError(
        'Το τμήμα δεν έχει συνδεδεμένα μαθήματα. Ρυθμίστε τα στη σελίδα «Τμήματα».',
      );
      return;
    }

    if (!addForm.subjectId) {
      setError('Επιλέξτε μάθημα για το τμήμα.');
      return;
    }

    const start24 = convert12To24(addForm.startTime, addForm.startPeriod);
    const end24 = convert12To24(addForm.endTime, addForm.endPeriod);

    if (!start24 || !end24) {
      setError('Συμπληρώστε σωστά τις ώρες (π.χ. 08:00).');
      return;
    }

    if (!addForm.startDate || !addForm.endDate) {
      setError('Συμπληρώστε ημερομηνία έναρξης και λήξης.');
      return;
    }

    const startDateISO = parseDateDisplayToISO(addForm.startDate);
    const endDateISO = parseDateDisplayToISO(addForm.endDate);

    if (!startDateISO || !endDateISO) {
      setError('Συμπληρώστε σωστά τις ημερομηνίες (π.χ. 12/05/2025).');
      return;
    }

    // position = max + 1 for this day
    const itemsForDay = programItems.filter(
      (i) => i.day_of_week === addForm.day && i.program_id === program.id,
    );
    const maxPos = itemsForDay.reduce(
      (max, i) => Math.max(max, i.position ?? 0),
      0,
    );
    const newPos = maxPos + 1;

    setSavingSlot(true);
    setError(null);

    const payload = {
      program_id: program.id,
      class_id: addForm.classId,
      subject_id: addForm.subjectId,
      tutor_id: addForm.tutorId,
      day_of_week: addForm.day,
      position: newPos,
      start_time: start24,
      end_time: end24,
      start_date: startDateISO,
      end_date: endDateISO,
    };

    const { data, error } = await supabase
      .from('program_items')
      .insert(payload)
      .select('*')
      .maybeSingle();

    setSavingSlot(false);

    if (error || !data) {
      console.error('Failed to insert program_item', error);
      setError('Αποτυχία προσθήκης τμήματος στο πρόγραμμα.');
      return;
    }

    setProgramItems((prev) => [...prev, data as ProgramItemRow]);
    closeAddSlotModal();
  };

  // ---- edit slot modal helpers ----
  const openEditSlotModal = (item: ProgramItemRow) => {
    const { time: startTime, period: startPeriod } = convert24To12(
      item.start_time,
    );
    const { time: endTime, period: endPeriod } = convert24To12(item.end_time);

    setError(null);
    setEditForm({
      id: item.id,
      classId: item.class_id,
      subjectId: item.subject_id ?? null,
      tutorId: item.tutor_id ?? null,
      day: item.day_of_week,
      startTime,
      startPeriod,
      endTime,
      endPeriod,
      startDate: item.start_date ? formatDateDisplay(item.start_date) : '',
      endDate: item.end_date ? formatDateDisplay(item.end_date) : '',
    });
    setEditModalOpen(true);
  };

  const closeEditSlotModal = () => {
    if (savingEdit) return;
    setEditModalOpen(false);
    setEditForm(null);
  };

  const handleEditTimeChange =
    (field: 'startTime' | 'endTime') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const formatted = formatTimeInput(e.target.value);
      setEditForm((prev) =>
        prev ? { ...prev, [field]: formatted } : prev,
      );
    };

  const handleEditFieldChange =
    (field: keyof EditSlotForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setEditForm((prev) => {
        if (!prev) return prev;
        if (field === 'subjectId') {
          return { ...prev, subjectId: value || null, tutorId: null };
        }
        if (field === 'tutorId') {
          return { ...prev, tutorId: value || null };
        }
        return { ...prev, [field]: value as any };
      });
    };

  const handleConfirmEditSlot = async () => {
    if (!program || !editForm) return;

    if (!editForm.classId || !editForm.day) {
      setError('Επιλέξτε τμήμα και ημέρα.');
      return;
    }

    const subjectsForClass = getSubjectsForClass(editForm.classId);
    if (subjectsForClass.length > 0 && !editForm.subjectId) {
      setError('Επιλέξτε μάθημα για το τμήμα.');
      return;
    }

    const start24 = convert12To24(editForm.startTime, editForm.startPeriod);
    const end24 = convert12To24(editForm.endTime, editForm.endPeriod);

    if (!start24 || !end24) {
      setError('Συμπληρώστε σωστά τις ώρες (π.χ. 08:00).');
      return;
    }

    if (!editForm.startDate || !editForm.endDate) {
      setError('Συμπληρώστε ημερομηνία έναρξης και λήξης.');
      return;
    }

    const startDateISO = parseDateDisplayToISO(editForm.startDate);
    const endDateISO = parseDateDisplayToISO(editForm.endDate);

    if (!startDateISO || !endDateISO) {
      setError('Συμπληρώστε σωστά τις ημερομηνίες (π.χ. 12/05/2025).');
      return;
    }

    setSavingEdit(true);
    setError(null);

    const payload = {
      class_id: editForm.classId,
      subject_id: editForm.subjectId,
      tutor_id: editForm.tutorId,
      day_of_week: editForm.day,
      start_time: start24,
      end_time: end24,
      start_date: startDateISO,
      end_date: endDateISO,
    };

    const { data, error } = await supabase
      .from('program_items')
      .update(payload)
      .eq('id', editForm.id)
      .select('*')
      .maybeSingle();

    setSavingEdit(false);

    if (error || !data) {
      console.error('Failed to update program_item', error);
      setError('Αποτυχία ενημέρωσης τμήματος στο πρόγραμμα.');
      return;
    }

    setProgramItems((prev) =>
      prev.map((i) => (i.id === editForm.id ? (data as ProgramItemRow) : i)),
    );
    closeEditSlotModal();
  };

  // ---- delete slot helpers (with modal) ----
  const handleConfirmDeleteSlot = async () => {
    if (!deleteSlotTarget) return;

    const id = deleteSlotTarget.id;
    const previous = programItems;

    try {
      setDeletingSlot(true);
      setError(null);

      // optimistic update
      setProgramItems((prev) => prev.filter((i) => i.id !== id));

      const { error } = await supabase
        .from('program_items')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete program_item', error);
        setError('Αποτυχία διαγραφής από το πρόγραμμα.');
        setProgramItems(previous); // rollback
        return;
      }

      setDeleteSlotTarget(null);
    } finally {
      setDeletingSlot(false);
    }
  };

  const handleDropOnDay = (day: string) => {
    if (!dragClassId) return;
    openAddSlotModal(dragClassId, day);
    setDragClassId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-50">
            ΠΡΟΓΡΑΜΜΑ ΤΜΗΜΑΤΩΝ
          </h1>
          <p className="text-xs text-slate-300">
            Δημιούργησε ένα εβδομαδιαίο πρόγραμμα, προσθέτοντας τμήματα σε κάθε
            μέρα.
          </p>
          {program && (
            <p className="mt-1 text-[11px] text-slate-400">
              Ενεργό πρόγραμμα:{' '}
              <span className="font-medium text-slate-100">
                {program.name}
              </span>
            </p>
          )}
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

      {loading ? (
        <div className="py-6 text-sm text-slate-200">Φόρτωση προγράμματος…</div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* Left: διαθέσιμα τμήματα */}
          <section className="rounded-lg border border-slate-700 bg-[color:var(--color-sidebar)] p-3 lg:w-[360px]">
            <h2 className="mb-2 text-xs font-semibold text-slate-50">
              Διαθέσιμα τμήματα
            </h2>
            <p className="mb-2 text-[11px] text-slate-400">
              Σύρετε ένα τμήμα σε μια μέρα ή επιλέξτε μέρα από το dropdown για
              να το προσθέσετε.
            </p>

            {classes.length === 0 ? (
              <p className="text-[11px] text-slate-300">
                Δεν υπάρχουν ακόμη τμήματα. Δημιουργήστε πρώτα τμήματα στη
                σελίδα «Τμήματα».
              </p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-600 bg-slate-900/60 px-2 py-2 text-[11px] text-slate-100"
                    draggable
                    onDragStart={() => setDragClassId(cls.id)}
                    onDragEnd={() =>
                      setDragClassId((prev) => (prev === cls.id ? null : prev))
                    }
                  >
                    <div className="flex-1">
                      <div className="font-semibold">
                        {cls.title || 'Τμήμα'}
                      </div>
                      <div className="text-[10px] text-slate-300">
                        {(() => {
                          const subj = cls.subject_id
                            ? subjectById.get(cls.subject_id)
                            : null;
                          const levelName =
                            subj?.level_id
                              ? levelNameById.get(subj.level_id) ?? ''
                              : '';
                          const tutorName = cls.tutor_id
                            ? tutorNameById.get(cls.tutor_id) ?? ''
                            : '';

                          const parts: string[] = [];
                          if (cls.subject) parts.push(cls.subject);
                          if (levelName) parts.push(levelName);
                          if (tutorName) parts.push(tutorName);
                          return parts.join(' · ');
                        })()}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <select
                        className="form-input !py-0.5 !px-1 text-[10px] w-28"
                        style={{
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text-main)',
                        }}
                        defaultValue=""
                        onChange={(e) => {
                          const day = e.target.value;
                          if (!day) return;
                          openAddSlotModal(cls.id, day);
                          e.target.value = '';
                        }}
                      >
                        <option value="">+ Μέρα</option>
                        {DAY_OPTIONS.map((d) => (
                          <option
                            key={d.value}
                            value={d.value}
                            className="bg-[var(--color-sidebar)] text-[var(--color-text-main)]"
                          >
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-[9px] text-slate-500">
                        ή σύρετε στο πλάνο
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Right: εβδομαδιαίο schema */}
          <section className="flex-1 rounded-lg border border-slate-700 bg-[color:var(--color-sidebar)] p-3">
            <div className="overflow-x-auto">
              <div className="min-w-[720px] grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                {DAY_OPTIONS.map((day) => (
                  <div
                    key={day.value}
                    className="flex flex-col rounded-md border border-slate-600 bg-slate-900/40"
                    onDragOver={(e) => {
                      if (dragClassId) e.preventDefault();
                    }}
                    onDrop={() => handleDropOnDay(day.value)}
                  >
                    <div className="border-b border-slate-600 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                      {day.label}
                    </div>
                    <div className="flex-1 space-y-2 p-2 text-[11px] programs-card">
                      {itemsByDay[day.value]?.length === 0 ? (
                        <div className="rounded border border-dashed border-slate-600 px-2 py-6 text-[10px] text-center text-[#ffc947]">
                          Σύρετε τμήμα εδώ ή προσθέστε από αριστερά.
                        </div>
                      ) : (
                        itemsByDay[day.value].map((item) => {
                          const cls = classes.find(
                            (c) => c.id === item.class_id,
                          );
                          if (!cls) return null;

                          const subjForItem =
                            item.subject_id
                              ? subjectById.get(item.subject_id)
                              : cls.subject_id
                                ? subjectById.get(cls.subject_id)
                                : null;
                          const subjName =
                            subjForItem?.name ?? cls.subject ?? '';
                          const levelNameForItem =
                            subjForItem?.level_id
                              ? levelNameById.get(subjForItem.level_id) ?? ''
                              : '';
                          const tutorNameForItem =
                            item.tutor_id
                              ? tutorNameById.get(item.tutor_id) ?? ''
                              : cls.tutor_id
                                ? tutorNameById.get(cls.tutor_id) ?? ''
                                : '';

                          const infoParts: string[] = [];
                          if (subjName) infoParts.push(subjName);
                          if (levelNameForItem) infoParts.push(levelNameForItem);
                          if (tutorNameForItem) infoParts.push(tutorNameForItem);

                          const classTitle = cls.title || 'Τμήμα';
                          const classLabel =
                            infoParts.length > 0
                              ? `${classTitle} · ${infoParts.join(' · ')}`
                              : classTitle;

                          const rangeParts: string[] = [];
                          if (item.start_time && item.end_time) {
                            rangeParts.push(
                              `${formatTimeDisplay(item.start_time)} – ${formatTimeDisplay(item.end_time)}`,
                            );
                          }
                          if (item.start_date && item.end_date) {
                            const from = formatDateDisplay(item.start_date);
                            const to = formatDateDisplay(item.end_date);
                            rangeParts.push(`από ${from} έως ${to}`);
                          }

                          const timeRange =
                            item.start_time && item.end_time
                              ? `${formatTimeDisplay(
                                  item.start_time,
                                )} – ${formatTimeDisplay(item.end_time)}`
                              : '';

                          return (
                            <div
                              key={item.id}
                              className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-2 text-[11px] text-slate-100 flex flex-col gap-1 cursor-pointer hover:border-[var(--color-accent)]/80"
                              onClick={() => openEditSlotModal(item)}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <span className="font-semibold leading-snug">
                                    {classTitle}
                                  </span>
                                  {infoParts.length > 0 && (
                                    <div className="text-[10px] text-slate-300">
                                      {infoParts.join(' · ')}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteSlotTarget({
                                      id: item.id,
                                      classLabel,
                                      dayLabel:
                                        DAY_LABEL_BY_VALUE[
                                          item.day_of_week
                                        ] ?? '',
                                      timeRange,
                                    });
                                  }}
                                  className="ml-1 text-[10px] text-red-300 hover:text-red-200"
                                >
                                  ✕
                                </button>
                              </div>
                              {rangeParts.length > 0 && (
                                <div className="text-[10px] text-slate-300">
                                  {rangeParts.join(' · ')}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Add-slot modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                Προσθήκη στο πρόγραμμα
              </h2>
              <button
                type="button"
                onClick={closeAddSlotModal}
                className="text-xs text-slate-200 hover:text-white"
              >
                Κλείσιμο
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Τμήμα */}
              <div>
                <label className="form-label text-slate-100">Τμήμα</label>
                <input
                  disabled
                  value={
                    addForm.classId
                      ? classes.find((c) => c.id === addForm.classId)?.title ??
                        ''
                      : ''
                  }
                  className="form-input disabled:opacity-80"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>

              <div>
                <label className="form-label text-slate-100">Ημέρα</label>
                <input
                  disabled
                  value={DAY_LABEL_BY_VALUE[addForm.day] || ''}
                  className="form-input disabled:opacity-80"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>

              {/* Μάθημα & Καθηγητής */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">
                    Μάθημα για το τμήμα
                  </label>
                  {(() => {
                    const options = getSubjectsForClass(addForm.classId);
                    return (
                      <>
                        <select
                          className="form-input select-accent"
                          value={addForm.subjectId ?? ''}
                          onChange={handleAddFieldChange('subjectId')}
                          disabled={options.length === 0}
                          style={{
                            background: 'var(--color-input-bg)',
                            color: 'var(--color-text-main)',
                          }}
                        >
                          <option value="">
                            {options.length === 0
                              ? 'Δεν έχουν οριστεί μαθήματα'
                              : 'Επιλέξτε μάθημα'}
                          </option>
                          {options.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        {options.length === 0 && (
                          <p className="mt-1 text-[10px] text-amber-300">
                            Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="form-label text-slate-100">
                    Καθηγητής μαθήματος
                  </label>
                  {(() => {
                    const options = getTutorsForSubject(addForm.subjectId);
                    return (
                      <select
                        className="form-input select-accent"
                        value={addForm.tutorId ?? ''}
                        onChange={handleAddFieldChange('tutorId')}
                        disabled={
                          !addForm.subjectId || options.length === 0
                        }
                        style={{
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="">
                          {options.length === 0
                            ? 'Δεν έχουν οριστεί καθηγητές'
                            : 'Επιλέξτε καθηγητή (προαιρετικό)'}
                        </option>
                        {options.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {/* Ώρα έναρξης */}
                <div>
                  <label className="form-label text-slate-100">
                    Ώρα έναρξης
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 08:00"
                      value={addForm.startTime}
                      onChange={handleAddTimeChange('startTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={addForm.startPeriod}
                      onChange={handleAddFieldChange('startPeriod')}
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

                {/* Ώρα λήξης */}
                <div>
                  <label className="form-label text-slate-100">
                    Ώρα λήξης
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="π.χ. 09:30"
                      value={addForm.endTime}
                      onChange={handleAddTimeChange('endTime')}
                      className="form-input pr-12"
                      style={{
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text-main)',
                      }}
                    />
                    <select
                      value={addForm.endPeriod}
                      onChange={handleAddFieldChange('endPeriod')}
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

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">
                    Ημερομηνία έναρξης
                  </label>
                  <AppDatePicker
                    value={addForm.startDate}
                    onChange={(newValue) =>
                      setAddForm((prev) => ({ ...prev, startDate: newValue }))
                    }
                    placeholder="π.χ. 12/05/2025"
                  />
                </div>
                <div>
                  <label className="form-label text-slate-100">
                    Ημερομηνία λήξης
                  </label>
                  <AppDatePicker
                    value={addForm.endDate}
                    onChange={(newValue) =>
                      setAddForm((prev) => ({ ...prev, endDate: newValue }))
                    }
                    placeholder="π.χ. 12/05/2025"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAddSlotModal}
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
                  onClick={handleConfirmAddSlot}
                  disabled={savingSlot}
                  className="btn-primary"
                >
                  {savingSlot ? 'Προσθήκη…' : 'Προσθήκη'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit-slot modal */}
      {editModalOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                Επεξεργασία στο πρόγραμμα
              </h2>
              <button
                type="button"
                onClick={closeEditSlotModal}
                className="text-xs text-slate-200 hover:text-white"
              >
                Κλείσιμο
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="form-label text-slate-100">Τμήμα</label>
                <input
                  disabled
                  value={currentEditClass?.title ?? ''}
                  className="form-input disabled:opacity-80"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                />
              </div>

              <div>
                <label className="form-label text-slate-100">Ημέρα</label>
                <select
                  value={editForm.day}
                  onChange={handleEditFieldChange('day')}
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Μάθημα & Καθηγητής */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">
                    Μάθημα για το τμήμα
                  </label>
                  {(() => {
                    const options = getSubjectsForClass(editForm.classId);
                    return (
                      <>
                        <select
                          className="form-input select-accent"
                          value={editForm.subjectId ?? ''}
                          onChange={handleEditFieldChange('subjectId')}
                          disabled={options.length === 0}
                          style={{
                            background: 'var(--color-input-bg)',
                            color: 'var(--color-text-main)',
                          }}
                        >
                          <option value="">
                            {options.length === 0
                              ? 'Δεν έχουν οριστεί μαθήματα'
                              : 'Επιλέξτε μάθημα'}
                          </option>
                          {options.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        {options.length === 0 && (
                          <p className="mt-1 text-[10px] text-amber-300">
                            Ρυθμίστε τα μαθήματα στη σελίδα «Τμήματα».
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="form-label text-slate-100">
                    Καθηγητής μαθήματος
                  </label>
                  {(() => {
                    const options = getTutorsForSubject(editForm.subjectId);
                    return (
                      <select
                        className="form-input select-accent"
                        value={editForm.tutorId ?? ''}
                        onChange={handleEditFieldChange('tutorId')}
                        disabled={
                          !editForm.subjectId || options.length === 0
                        }
                        style={{
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        <option value="">
                          {options.length === 0
                            ? 'Δεν έχουν οριστεί καθηγητές'
                            : 'Επιλέξτε καθηγητή (προαιρετικό)'}
                        </option>
                        {options.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {/* Ώρα έναρξης */}
                <div>
                  <label className="form-label text-slate-100">
                    Ώρα έναρξης
                  </label>
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

                {/* Ώρα λήξης */}
                <div>
                  <label className="form-label text-slate-100">
                    Ώρα λήξης
                  </label>
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

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="form-label text-slate-100">
                    Ημερομηνία έναρξης
                  </label>
                  <AppDatePicker
                    value={editForm.startDate}
                    onChange={(newValue) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, startDate: newValue } : prev,
                      )
                    }
                    placeholder="π.χ. 12/05/2025"
                  />
                </div>
                <div>
                  <label className="form-label text-slate-100">
                    Ημερομηνία λήξης
                  </label>
                  <AppDatePicker
                    value={editForm.endDate}
                    onChange={(newValue) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, endDate: newValue } : prev,
                      )
                    }
                    placeholder="π.χ. 12/05/2025"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditSlotModal}
                  className="btn-ghost"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  disabled={savingEdit}
                >
                  Ακύρωση
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEditSlot}
                  disabled={savingEdit}
                  className="btn-primary"
                >
                  {savingEdit ? 'Ενημέρωση…' : 'Ενημέρωση'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete-slot confirmation modal */}
      {deleteSlotTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-50">
              Διαγραφή από το πρόγραμμα
            </h3>
            <p className="mb-4 text-xs text-slate-200">
              Είσαι σίγουρος ότι θέλεις να αφαιρέσεις το τμήμα{' '}
              <span className="font-semibold text-[color:var(--color-accent)]">
                «{deleteSlotTarget.classLabel}»
              </span>{' '}
              από την ημέρα{' '}
              <span className="font-semibold text-slate-100">
                {deleteSlotTarget.dayLabel}
              </span>
              {deleteSlotTarget.timeRange && (
                <>
                  {' '}
                  στις{' '}
                  <span className="font-semibold text-slate-100">
                    {deleteSlotTarget.timeRange}
                  </span>
                </>
              )}
              ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
            </p>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (deletingSlot) return;
                  setDeleteSlotTarget(null);
                }}
                className="btn-ghost px-3 py-1"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
                disabled={deletingSlot}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSlot}
                disabled={deletingSlot}
                className="rounded-md px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: '#dc2626' }}
              >
                {deletingSlot ? 'Διαγραφή…' : 'Διαγραφή'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
