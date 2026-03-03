// src/pages/StudentsPage.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import DatePickerField from '../components/ui/AppDatePicker';

type LevelRow = {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
};

type StudentRow = {
  id: string;
  school_id: string;
  full_name: string;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  special_notes: string | null;
  level_id: string | null;

  father_name: string | null;
  father_date_of_birth: string | null;
  father_phone: string | null;
  father_email: string | null;

  mother_name: string | null;
  mother_date_of_birth: string | null;
  mother_phone: string | null;
  mother_email: string | null;

  created_at: string;
};

const STUDENT_SELECT = `
  id, school_id, full_name, date_of_birth, phone, email, special_notes, level_id,
  father_name, father_date_of_birth, father_phone, father_email,
  mother_name, mother_date_of_birth, mother_phone, mother_email,
  created_at
`;

// helper: convert "yyyy-mm-dd" -> "dd/mm/yyyy"
function formatDateToGreek(dateStr: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// AppDatePicker helpers (dd/mm/yyyy) <-> ISO (yyyy-mm-dd)
function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  if (!display) return '';
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// helper: normalize greek/latin text (remove accents, toLowerCase)
function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

type ModalMode = 'create' | 'edit';
type TabKey = 'student' | 'parents';

const FETCH_TIMEOUT_MS = 8000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function StudentsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const studentsCacheKey = schoolId ? `pt_students_cache_v1_${schoolId}` : '';
  const levelsCacheKey = schoolId ? `pt_levels_cache_v1_${schoolId}` : '';

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true); // initial load ONLY (when no cache)
  const [refreshing, setRefreshing] = useState(false); // mention in UI but do not block table
  const [error, setError] = useState<string | null>(null);

  // create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState<TabKey>('student');

  // info modal (parents only)
  const [infoStudent, setInfoStudent] = useState<StudentRow | null>(null);

  // delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Student fields
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(''); // dd/mm/yyyy
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [levelId, setLevelId] = useState('');

  // Father
  const [fatherName, setFatherName] = useState('');
  const [fatherDob, setFatherDob] = useState(''); // dd/mm/yyyy
  const [fatherPhone, setFatherPhone] = useState('');
  const [fatherEmail, setFatherEmail] = useState('');

  // Mother
  const [motherName, setMotherName] = useState('');
  const [motherDob, setMotherDob] = useState(''); // dd/mm/yyyy
  const [motherPhone, setMotherPhone] = useState('');
  const [motherEmail, setMotherEmail] = useState('');

  const [search, setSearch] = useState('');

  // Pagination (10 per page)
  const pageSize = 10;
  const [page, setPage] = useState(1);

  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Prevent stale requests overwriting state
  const studentsReqRef = useRef(0);
  const levelsReqRef = useRef(0);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  // ✅ HYDRATE FROM CACHE IMMEDIATELY ON MOUNT / SCHOOL CHANGE (THIS FIXES YOUR TAB SWITCH ISSUE)
  useEffect(() => {
    setError(null);

    if (!schoolId) {
      setStudents([]);
      setLevels([]);
      setLoading(false);
      return;
    }

    hintHydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const hintHydrate = () => {
    if (!schoolId) return;

    const cachedStudents = safeParseJSON<StudentRow[]>(sessionStorage.getItem(studentsCacheKey));
    const cachedLevels = safeParseJSON<LevelRow[]>(sessionStorage.getItem(levelsCacheKey));

    if (cachedStudents && Array.isArray(cachedStudents) && cachedStudents.length > 0) {
      setStudents(cachedStudents);
      setLoading(false); // ✅ show table immediately (no stuck loading on return)
    } else {
      setLoading(true); // no cache -> allow initial loading state
    }

    if (cachedLevels && Array.isArray(cachedLevels)) {
      setLevels(cachedLevels);
    }
  };

  const loadLevels = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!schoolId) return;

      const reqId = ++levelsReqRef.current;
      const silent = Boolean(opts?.silent);

      if (silent) setRefreshing(true);
      setError(null);

      try {
        const res = await withTimeout(
          supabase
            .from('levels')
            .select('id, school_id, name, created_at')
            .eq('school_id', schoolId)
            .order('name', { ascending: true }),
          FETCH_TIMEOUT_MS
        );

        if (reqId !== levelsReqRef.current) return;

        const dbError = (res as any).error as unknown;
        const data = (res as any).data as LevelRow[] | null;

        if (dbError) {
          console.error(dbError);
          setError('Αποτυχία φόρτωσης επιπέδων.');
          return;
        }

        const next = (data ?? []) as LevelRow[];
        setLevels(next);
        sessionStorage.setItem(levelsCacheKey, JSON.stringify(next));
      } catch (e) {
        console.error(e);
        if (reqId !== levelsReqRef.current) return;
        setError('Αποτυχία φόρτωσης επιπέδων.');
      } finally {
        if (reqId === levelsReqRef.current && silent) {
          setRefreshing(false);
        }
      }
    },
    [schoolId, levelsCacheKey]
  );

  const loadStudents = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!schoolId) {
        setLoading(false);
        return;
      }

      const reqId = ++studentsReqRef.current;
      const silent = Boolean(opts?.silent);

      // ✅ on silent refresh do NOT hide table
      if (silent) setRefreshing(true);
      else setLoading(students.length === 0); // only show big loading if nothing cached

      setError(null);

      try {
        const res = await withTimeout(
          supabase
            .from('students')
            .select(STUDENT_SELECT)
            .eq('school_id', schoolId)
            .order('full_name', { ascending: true }),
          FETCH_TIMEOUT_MS
        );

        if (reqId !== studentsReqRef.current) return;

        const dbError = (res as any).error as unknown;
        const data = (res as any).data as StudentRow[] | null;

        if (dbError) {
          console.error(dbError);
          setError('Αποτυχία φόρτωσης μαθητών.');
          return; // keep previous list
        }

        const next = (data ?? []) as StudentRow[];
        setStudents(next);
        sessionStorage.setItem(studentsCacheKey, JSON.stringify(next));
      } catch (e) {
        console.error(e);
        if (reqId !== studentsReqRef.current) return;
        setError('Αποτυχία φόρτωσης μαθητών.');
      } finally {
        if (reqId === studentsReqRef.current) {
          if (silent) setRefreshing(false);
          setLoading(false);
        }
      }
    },
    [schoolId, studentsCacheKey, students.length]
  );

  // initial fetch (after hydrate) + anytime school changes
  useEffect(() => {
    if (!schoolId) return;
    loadLevels({ silent: true });
    loadStudents({ silent: true });
  }, [schoolId, loadLevels, loadStudents]);

  // ✅ refetch when you return to the tab/page WITHOUT blanking UI
  useEffect(() => {
    if (!schoolId) return;

    const refetch = () => {
      // show cached rows immediately, then refresh silently
      hintHydrate();
      loadStudents({ silent: true });
      loadLevels({ silent: true });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch();
    };

    window.addEventListener('focus', refetch);
    window.addEventListener('online', refetch);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', refetch);
      window.removeEventListener('online', refetch);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, loadStudents, loadLevels]);

  const resetForm = () => {
    setFullName('');
    setDateOfBirth('');
    setPhone('');
    setEmail('');
    setSpecialNotes('');
    setLevelId('');

    setFatherName('');
    setFatherDob('');
    setFatherPhone('');
    setFatherEmail('');

    setMotherName('');
    setMotherDob('');
    setMotherPhone('');
    setMotherEmail('');
  };

  const openCreateModal = () => {
    resetForm();
    setError(null);
    setModalMode('create');
    setEditingStudent(null);
    setModalTab('student');
    setModalOpen(true);
    setPassword('');
    setNewPassword('');
  };

  const openEditModal = (student: StudentRow) => {
    setError(null);
    setModalMode('edit');
    setEditingStudent(student);
    setModalTab('student');

    setFullName(student.full_name ?? '');
    setDateOfBirth(student.date_of_birth ? isoToDisplay(student.date_of_birth) : '');
    setPhone(student.phone ?? '');
    setEmail(student.email ?? '');
    setSpecialNotes(student.special_notes ?? '');
    setLevelId(student.level_id ?? '');

    setFatherName(student.father_name ?? '');
    setFatherDob(student.father_date_of_birth ? isoToDisplay(student.father_date_of_birth) : '');
    setFatherPhone(student.father_phone ?? '');
    setFatherEmail(student.father_email ?? '');

    setMotherName(student.mother_name ?? '');
    setMotherDob(student.mother_date_of_birth ? isoToDisplay(student.mother_date_of_birth) : '');
    setMotherPhone(student.mother_phone ?? '');
    setMotherEmail(student.mother_email ?? '');
    setNewPassword('');

    setModalOpen(true);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setModalOpen(false);
    setEditingStudent(null);
    setModalMode('create');
    setModalTab('student');
    resetForm();
    setPassword('');
    setNewPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) {
      setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.');
      return;
    }

    const nameTrimmed = fullName.trim();
    if (!nameTrimmed) return;

    setSaving(true);
    setError(null);

    const payload = {
      school_id: schoolId,
      full_name: nameTrimmed,
      date_of_birth: displayToIso(dateOfBirth) || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      special_notes: specialNotes.trim() || null,
      level_id: levelId || null,

      father_name: fatherName.trim() || null,
      father_date_of_birth: displayToIso(fatherDob) || null,
      father_phone: fatherPhone.trim() || null,
      father_email: fatherEmail.trim() || null,

      mother_name: motherName.trim() || null,
      mother_date_of_birth: displayToIso(motherDob) || null,
      mother_phone: motherPhone.trim() || null,
      mother_email: motherEmail.trim() || null,
    };

    try {
      if (modalMode === 'create') {
        if (password.trim().length < 6) {
          setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.');
          return;
        }
        if (!payload.email && !payload.phone) {
          setError('Βάλε Email ή Τηλέφωνο για να μπορεί να κάνει login στο mobile app.');
          return;
        }

        const res = await supabase.from('students').insert(payload).select(STUDENT_SELECT);
        const dbError = (res as any).error as unknown;
        const data = (res as any).data as StudentRow[] | null;

        if (dbError || !data || data.length === 0) {
          console.error(dbError);
          setError('Αποτυχία δημιουργίας μαθητή.');
          return;
        }

        const createdStudent = data[0] as StudentRow;
        const pwd = password;

        const nextList = [...students, createdStudent].sort((a, b) =>
          (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el')
        );
        setStudents(nextList);
        sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));

        closeModal(true);

        const { error: fnErr } = await supabase.functions.invoke('create-student-user', {
          body: {
            school_id: schoolId,
            student_id: createdStudent.id,
            email: payload.email,
            phone: payload.phone,
            password: pwd,
          },
        });

        if (fnErr) console.error('create-student-user error:', fnErr);
      } else if (modalMode === 'edit' && editingStudent) {
        const res = await supabase
          .from('students')
          .update({
            full_name: payload.full_name,
            date_of_birth: payload.date_of_birth,
            phone: payload.phone,
            email: payload.email,
            special_notes: payload.special_notes,
            level_id: payload.level_id,

            father_name: payload.father_name,
            father_date_of_birth: payload.father_date_of_birth,
            father_phone: payload.father_phone,
            father_email: payload.father_email,

            mother_name: payload.mother_name,
            mother_date_of_birth: payload.mother_date_of_birth,
            mother_phone: payload.mother_phone,
            mother_email: payload.mother_email,
          })
          .eq('id', editingStudent.id)
          .eq('school_id', schoolId)
          .select(STUDENT_SELECT);

        const dbError = (res as any).error as unknown;
        const data = (res as any).data as StudentRow[] | null;

        if (dbError || !data || data.length === 0) {
          console.error(dbError);
          setError('Αποτυχία ενημέρωσης μαθητή.');
          return;
        }

        const updated = data[0] as StudentRow;
        const nextList = students.map((s) => (s.id === editingStudent.id ? updated : s));
        setStudents(nextList);
        sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));

        const np = newPassword.trim();
        if (np) {
          if (np.length < 6) {
            setError('Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.');
          } else {
            const { error: pwErr } = await supabase.functions.invoke('set-student-password', {
              body: {
                school_id: schoolId,
                student_id: editingStudent.id,
                new_password: np,
              },
            });
            if (pwErr) console.error('set-student-password error:', pwErr);
          }
        }

        closeModal(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const askDeleteStudent = (student: StudentRow) => {
    setError(null);
    setDeleteTarget(student);
  };

  const cancelDeleteStudent = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDeleteStudent = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    const { error: dbError } = await supabase
      .from('students')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('school_id', schoolId ?? '');

    setDeleting(false);

    if (dbError) {
      console.error(dbError);
      setError('Αποτυχία διαγραφής μαθητή.');
      return;
    }

    const nextList = students.filter((s) => s.id !== deleteTarget.id);
    setStudents(nextList);
    sessionStorage.setItem(studentsCacheKey, JSON.stringify(nextList));
    setDeleteTarget(null);
  };

  const filteredStudents = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return students;

    return students.filter((s) => {
      const levelName =
        s.level_id && levelNameById.get(s.level_id) ? levelNameById.get(s.level_id)! : '';

      const composite = [
        s.full_name,
        levelName,
        s.phone,
        s.email,
        s.special_notes,
        s.date_of_birth,
        s.date_of_birth ? formatDateToGreek(s.date_of_birth) : '',

        s.father_name,
        s.father_phone,
        s.father_email,
        s.father_date_of_birth,
        s.father_date_of_birth ? formatDateToGreek(s.father_date_of_birth) : '',

        s.mother_name,
        s.mother_phone,
        s.mother_email,
        s.mother_date_of_birth,
        s.mother_date_of_birth ? formatDateToGreek(s.mother_date_of_birth) : '',
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(composite).includes(q);
    });
  }, [students, levelNameById, search]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredStudents.length / pageSize)),
    [filteredStudents.length]
  );

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, page]);

  const showingFrom = filteredStudents.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredStudents.length);

  const openInfoModal = (student: StudentRow) => setInfoStudent(student);
  const closeInfoModal = () => setInfoStudent(null);

  const InfoField = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="rounded-md border border-slate-700/70 bg-slate-900/25 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-300">{label}</div>
      <div className="mt-0.5 text-xs text-slate-100">{value && value.trim() ? value : '—'}</div>
    </div>
  );

  const InfoDateField = ({ label, iso }: { label: string; iso: string | null }) => (
    <InfoField label={label} value={iso ? formatDateToGreek(iso) : '—'} />
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-slate-50">
            <Users className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            Μαθητές
          </h1>
          <p className="text-xs text-slate-300">Διαχείριση μαθητών του σχολείου σας.</p>

          {schoolId && (
            <p className="mt-1 text-[11px] text-slate-400">
              Σύνολο μαθητών: <span className="font-medium text-slate-100">{students.length}</span>
              {search.trim() && (
                <>
                  {' · '}
                  <span className="text-slate-300">Εμφανίζονται: {filteredStudents.length}</span>
                </>
              )}
              {refreshing && <span className="ml-2 text-slate-500">· ενημέρωση…</span>}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            className="form-input w-full sm:w-56"
            style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
            placeholder="Αναζήτηση..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary"
            style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
          >
            Προσθήκη μαθητή
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

      {/* Students table */}
      <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15">
        <div className="overflow-x-auto">
          {loading && students.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">Φόρτωση μαθητών…</div>
          ) : students.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν υπάρχουν ακόμη μαθητές. Πατήστε «Προσθήκη μαθητή» για να δημιουργήσετε τον πρώτο.
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="px-4 py-4 text-xs text-slate-300">
              Δεν βρέθηκαν μαθητές με αυτά τα κριτήρια αναζήτησης.
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Ονοματεπώνυμο</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Επίπεδο</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">
                    Ημερομηνία γέννησης
                  </th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Τηλέφωνο</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Email</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-left">Ειδικές σημειώσεις</th>
                  <th className="border-b border-slate-700 px-4 py-2 text-right">Ενέργειες</th>
                </tr>
              </thead>

              <tbody>
                {pagedStudents.map((s, idx) => {
                  const levelName =
                    s.level_id && levelNameById.get(s.level_id)
                      ? levelNameById.get(s.level_id)
                      : '—';

                  const absoluteIndex = (page - 1) * pageSize + idx;
                  const rowBg = absoluteIndex % 2 === 0 ? 'bg-slate-950/45' : 'bg-slate-900/25';

                  return (
                    <tr
                      key={s.id}
                      className={`${rowBg} backdrop-blur-sm hover:bg-slate-800/40 transition-colors`}
                    >
                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs font-medium" style={{ color: 'var(--color-text-td)' }}>
                          {s.full_name}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {levelName}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.date_of_birth ? formatDateToGreek(s.date_of_birth) : '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.phone || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.email || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2 text-left">
                        <span className="text-xs" style={{ color: 'var(--color-text-td)' }}>
                          {s.special_notes && s.special_notes.trim() ? s.special_notes : '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-800/70 px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openInfoModal(s)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-500/70 bg-slate-900/20 text-slate-200 transition-colors hover:bg-slate-800/40 hover:text-slate-50"
                            title="Πληροφορίες γονέων"
                            aria-label="Πληροφορίες γονέων"
                          >
                            <span className="text-[13px] font-semibold leading-none">i</span>
                          </button>

                          <EditDeleteButtons
                            onEdit={() => openEditModal(s)}
                            onDelete={() => askDeleteStudent(s)}
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

        {!loading && filteredStudents.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3">
            <div className="text-[11px] text-slate-300">
              Εμφάνιση <span className="text-slate-100">{showingFrom}</span>-
              <span className="text-slate-100">{showingTo}</span> από{' '}
              <span className="text-slate-100">{filteredStudents.length}</span>
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

      {/* Parents Info modal */}
      {infoStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">Πληροφορίες γονέων</h2>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  Μαθητής:{' '}
                  <span className="text-slate-100 font-medium">{infoStudent.full_name}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={closeInfoModal}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/20 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-100">Πατέρας</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <InfoField label="Ονοματεπώνυμο" value={infoStudent.father_name} />
                  <InfoDateField label="Ημ. γέννησης" iso={infoStudent.father_date_of_birth} />
                  <InfoField label="Τηλέφωνο" value={infoStudent.father_phone} />
                  <InfoField label="Email" value={infoStudent.father_email} />
                </div>
              </div>

              <div className="rounded-lg border border-slate-700/70 bg-slate-900/20 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-100">Μητέρα</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <InfoField label="Ονοματεπώνυμο" value={infoStudent.mother_name} />
                  <InfoDateField label="Ημ. γέννησης" iso={infoStudent.mother_date_of_birth} />
                  <InfoField label="Τηλέφωνο" value={infoStudent.mother_phone} />
                  <InfoField label="Email" value={infoStudent.mother_email} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                {modalMode === 'create' ? 'Νέος μαθητής' : 'Επεξεργασία μαθητή'}
              </h2>
              <button
                type="button"
                onClick={() => closeModal()}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            <div className="mb-4 flex gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setModalTab('student')}
                className={`px-3 py-1 rounded-full border text-xs ${
                  modalTab === 'student'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-200'
                }`}
              >
                Μαθητής
              </button>
              <button
                type="button"
                onClick={() => setModalTab('parents')}
                className={`px-3 py-1 rounded-full border text-xs ${
                  modalTab === 'parents'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-200'
                }`}
              >
                Γονείς
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {modalTab === 'student' ? (
                <>
                  <div>
                    <label className="form-label text-slate-100">Ονοματεπώνυμο *</label>
                    <input
                      className="form-input"
                      style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                      placeholder="π.χ. Γιάννης Παπαδόπουλος"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label text-slate-100">Επίπεδο</label>
                    <select
                      className="form-input select-accent"
                      value={levelId}
                      onChange={(e) => setLevelId(e.target.value)}
                    >
                      <option value="">Χωρίς επίπεδο</option>
                      {levels.map((lvl) => (
                        <option key={lvl.id} value={lvl.id}>
                          {lvl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <DatePickerField
                    label="Ημερομηνία γέννησης"
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    placeholder="π.χ. 24/12/2010"
                    id="student-dob"
                  />

                  <div>
                    <label className="form-label text-slate-100">Τηλέφωνο</label>
                    <input
                      className="form-input"
                      style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                      placeholder="π.χ. 6900000000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label text-slate-100">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                      placeholder="π.χ. student@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label text-slate-100">Ειδικές σημειώσεις</label>
                    <input
                      className="form-input"
                      style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                      placeholder="π.χ. αλλεργίες / παρατηρήσεις / ειδικές ανάγκες"
                      value={specialNotes}
                      onChange={(e) => setSpecialNotes(e.target.value)}
                    />
                  </div>

                  {modalMode === 'create' && (
                    <div>
                      <label className="form-label text-slate-100">Κωδικός *</label>
                      <input
                        type="password"
                        className="form-input"
                        style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        placeholder="Τουλάχιστον 6 χαρακτήρες"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Θα δημιουργηθεί λογαριασμός για login στο mobile app.
                      </p>
                    </div>
                  )}

                  {modalMode === 'edit' && (
                    <div>
                      <label className="form-label text-slate-100">Νέος κωδικός (προαιρετικό)</label>
                      <input
                        type="password"
                        className="form-input"
                        style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        placeholder="Άφησέ το κενό αν δεν θες αλλαγή"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={6}
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Δεν μπορείς να δεις τον τρέχοντα κωδικό. Μόνο να ορίσεις νέο.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/20 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-100">Πατέρας</div>

                    <div>
                      <label className="form-label text-slate-100">Ονοματεπώνυμο</label>
                      <input
                        className="form-input"
                        style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        placeholder="π.χ. Δημήτρης Παπαδόπουλος"
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                      />
                    </div>

                    <div className="mt-3">
                      <DatePickerField
                        label="Ημερομηνία γέννησης"
                        value={fatherDob}
                        onChange={setFatherDob}
                        placeholder="π.χ. 24/12/1980"
                        id="father-dob"
                      />
                    </div>

                    <div className="mt-3">
                      <label className="form-label text-slate-100">Τηλέφωνο</label>
                      <input
                        className="form-input"
                        style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        placeholder="π.χ. 6900000000"
                        value={fatherPhone}
                        onChange={(e) => setFatherPhone(e.target.value)}
                      />
                    </div>

                    <div className="mt-3">
                      <label className="form-label text-slate-100">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        placeholder="π.χ. father@example.com"
                        value={fatherEmail}
                        onChange={(e) => setFatherEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/20 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-100">Μητέρα</div>

                    <div>
                      <label className="form-label text-slate-100">Ονοματεπώνυμο</label>
                      <input
                        className="form-input"
                        style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        placeholder="π.χ. Μαρία Παπαδοπούλου"
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                      />
                    </div>

                    <div className="mt-3">
                      <DatePickerField
                        label="Ημερομηνία γέννησης"
                        value={motherDob}
                        onChange={setMotherDob}
                        placeholder="π.χ. 10/03/1983"
                        id="mother-dob"
                      />
                    </div>

                    <div className="mt-3">
                      <label className="form-label text-slate-100">Τηλέφωνο</label>
                      <input
                        className="form-input"
                        style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        placeholder="π.χ. 6900000000"
                        value={motherPhone}
                        onChange={(e) => setMotherPhone(e.target.value)}
                      />
                    </div>

                    <div className="mt-3">
                      <label className="form-label text-slate-100">Email</label>
                      <input
                        type="email"
                        className="form-input"
                        style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                        placeholder="π.χ. mother@example.com"
                        value={motherEmail}
                        onChange={(e) => setMotherEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="btn-ghost"
                  style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                  disabled={saving}
                >
                  Ακύρωση
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Αποθήκευση...' : modalMode === 'create' ? 'Αποθήκευση' : 'Ενημέρωση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <h2 className="text-sm font-semibold text-slate-50">Διαγραφή μαθητή</h2>
            <p className="mt-3 text-xs text-slate-200">
              Σίγουρα θέλετε να διαγράψετε τον μαθητή{' '}
              <span className="font-semibold text-[var(--color-accent)]">«{deleteTarget.full_name}»</span>
              ; Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.
            </p>

            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={cancelDeleteStudent}
                className="btn-ghost"
                style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-main)' }}
                disabled={deleting}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={confirmDeleteStudent}
                className="btn-primary"
                style={{ backgroundColor: '#dc2626', color: '#fff' }}
                disabled={deleting}
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
