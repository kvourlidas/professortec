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
            return attachedSubjects.sort((a, b) =>
                a.name.localeCompare(b.name, 'el-GR'),
            );
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

        const { time: startTime, period: startPeriod } = convert24To12(
            t.start_time,
        );
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

        setTests((prev) =>
            prev.map((t) => (t.id === editForm.id ? (data as TestRow) : t)),
        );
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
                ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(
                    t.end_time,
                )}`
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

        const { error: deleteErr } = await supabase
            .from('tests')
            .delete()
            .eq('id', deleteTarget.id);

        setDeleting(false);

        if (deleteErr) {
            console.error('delete test error', deleteErr);
            setError('Αποτυχία διαγραφής διαγωνίσματος.');
            return;
        }

        setTests((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        setDeleteTarget(null);
    };

    const testsWithDisplay = tests.map((t) => {
        const cls = classById.get(t.class_id);
        const subj = subjectById.get(t.subject_id);
        const timeRange =
            t.start_time && t.end_time
                ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(
                    t.end_time,
                )}`
                : '';
        return {
            ...t,
            classTitle: cls?.title ?? '—',
            subjectName: subj?.name ?? '—',
            dateDisplay: formatDateDisplay(t.test_date),
            timeRange,
        };
    });

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-base font-semibold text-slate-50">
                        Διαγωνίσματα
                    </h1>
                    <p className="text-xs text-slate-300">
                        Καταχώρησε διαγωνίσματα ανά τμήμα και μάθημα, ώστε να εμφανίζονται
                        στο ημερολόγιο.
                    </p>
                    {schoolId && (
                        <p className="mt-1 text-[11px] text-slate-400">
                            Σύνολο διαγωνισμάτων:{' '}
                            <span className="font-medium text-slate-100">
                                {tests.length}
                            </span>
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={openModal}
                    className="btn-primary"
                    style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
                >
                    Προσθήκη διαγωνίσματος
                </button>
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
                <div className="py-4 text-xs text-slate-300">
                    Φόρτωση διαγωνισμάτων…
                </div>
            ) : tests.length === 0 ? (
                <div className="py-4 text-xs text-slate-300">
                    Δεν υπάρχουν ακόμη διαγωνίσματα. Πατήστε «Προσθήκη διαγωνίσματος» για
                    να δημιουργήσετε το πρώτο.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-xs">
                        <thead>
                            <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                                <th className="border-b border-slate-600 px-4 py-2 text-left">
                                    Ημερομηνία
                                </th>
                                <th className="border-b border-slate-600 px-4 py-2 text-left">
                                    Ώρα
                                </th>
                                <th className="border-b border-slate-600 px-4 py-2 text-left">
                                    Τμήμα
                                </th>
                                <th className="border-b border-slate-600 px-4 py-2 text-left">
                                    Μάθημα
                                </th>
                                <th className="border-b border-slate-600 px-4 py-2 text-left">
                                    Τίτλος
                                </th>
                                <th className="border-b border-slate-600 px-4 py-2 text-right">
                                    Ενέργειες
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {testsWithDisplay.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-800/40">
                                    <td className="border-b border-slate-700 px-4 py-2">
                                        <span
                                            className="text-xs"
                                            style={{ color: 'var(--color-text-td)' }}
                                        >
                                            {t.dateDisplay}
                                        </span>
                                    </td>
                                    <td className="border-b border-slate-700 px-4 py-2">
                                        <span
                                            className="text-xs"
                                            style={{ color: 'var(--color-text-td)' }}
                                        >
                                            {t.timeRange || '—'}
                                        </span>
                                    </td>
                                    <td className="border-b border-slate-700 px-4 py-2">
                                        <span
                                            className="text-xs"
                                            style={{ color: 'var(--color-text-td)' }}
                                        >
                                            {t.classTitle}
                                        </span>
                                    </td>
                                    <td className="border-b border-slate-700 px-4 py-2">
                                        <span
                                            className="text-xs"
                                            style={{ color: 'var(--color-text-td)' }}
                                        >
                                            {t.subjectName}
                                        </span>
                                    </td>
                                    <td className="border-b border-slate-700 px-4 py-2">
                                        <span
                                            className="text-xs"
                                            style={{ color: 'var(--color-text-td)' }}
                                        >
                                            {t.title ?? '—'}
                                        </span>
                                    </td>
                                    <td className="border-b border-slate-700 px-4 py-2">
                                        <div className="flex justify-end">
                                            <EditDeleteButtons
                                                onEdit={() => openEditModal(t.id)}
                                                onDelete={() => openDeleteModal(t.id)}
                                            />
                                        </div>
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal: add test */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div
                        className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
                        style={{ background: 'var(--color-sidebar)' }}
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-slate-50">
                                Νέο διαγώνισμα
                            </h2>
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
                                <label className="form-label text-slate-100">
                                    Μάθημα για το τμήμα *
                                </label>
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
                                <label className="form-label text-slate-100">
                                    Ημερομηνία διαγωνίσματος *
                                </label>
                                <AppDatePicker
                                    value={form.date}
                                    onChange={(newValue) =>
                                        setForm((prev) => ({ ...prev, date: newValue }))
                                    }
                                    placeholder="π.χ. 12/05/2025"
                                />
                            </div>

                            {/* Ώρες έναρξης / λήξης – ίδιο UI με ProgramPage */}
                            <div className="grid gap-3 md:grid-cols-2">
                                {/* Ώρα έναρξης */}
                                <div>
                                    <label className="form-label text-slate-100">
                                        Ώρα έναρξης *
                                    </label>
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

                                {/* Ώρα λήξης */}
                                <div>
                                    <label className="form-label text-slate-100">
                                        Ώρα λήξης *
                                    </label>
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
                                <label className="form-label text-slate-100">
                                    Τίτλος (προαιρετικό)
                                </label>
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
                            <h2 className="text-sm font-semibold text-slate-50">
                                Επεξεργασία διαγωνίσματος
                            </h2>
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
                                <label className="form-label text-slate-100">
                                    Μάθημα για το τμήμα *
                                </label>
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
                                <label className="form-label text-slate-100">
                                    Ημερομηνία διαγωνίσματος *
                                </label>
                                <AppDatePicker
                                    value={editForm.date}
                                    onChange={(newValue) =>
                                        setEditForm((prev) =>
                                            prev ? { ...prev, date: newValue } : prev,
                                        )
                                    }
                                    placeholder="π.χ. 12/05/2025"
                                />
                            </div>

                            {/* Ώρες έναρξης / λήξης */}
                            <div className="grid gap-3 md:grid-cols-2">
                                {/* Ώρα έναρξης */}
                                <div>
                                    <label className="form-label text-slate-100">
                                        Ώρα έναρξης *
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
                                        Ώρα λήξης *
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

                            <div>
                                <label className="form-label text-slate-100">
                                    Τίτλος (προαιρετικό)
                                </label>
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
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={savingEdit}
                                >
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
                        <h3 className="mb-2 text-sm font-semibold text-slate-50">
                            Διαγραφή διαγωνίσματος
                        </h3>
                        <p className="mb-4 text-xs text-slate-200">
                            Είσαι σίγουρος ότι θέλεις να διαγράψεις το διαγώνισμα{' '}
                            <span className="font-semibold text-[color:var(--color-accent)]">
                                {deleteTarget.subjectName}
                            </span>{' '}
                            για το τμήμα{' '}
                            <span className="font-semibold text-slate-100">
                                {deleteTarget.classTitle}
                            </span>{' '}
                            στις{' '}
                            <span className="font-semibold text-slate-100">
                                {deleteTarget.dateDisplay}
                            </span>
                            {deleteTarget.timeRange && (
                                <>
                                    {' '}
                                    ({' '}
                                    <span className="font-semibold text-slate-100">
                                        {deleteTarget.timeRange}
                                    </span>{' '}
                                    )
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
        </div>
    );
}
