// src/pages/ProgramPage.tsx
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

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
  start_time: string | null; // "HH:MM"
  end_time: string | null;   // "HH:MM"
  start_date: string | null; // "YYYY-MM-DD"
  end_date: string | null;   // "YYYY-MM-DD"
};

type AddSlotForm = {
  classId: string | null;
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

export default function ProgramPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [programItems, setProgramItems] = useState<ProgramItemRow[]>([]);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [tutors, setTutors] = useState<TutorRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dragClassId, setDragClassId] = useState<string | null>(null);

  // modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddSlotForm>(emptyAddSlotForm);
  const [savingSlot, setSavingSlot] = useState(false);

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

        // 2. load classes + lookups + program_items
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
      } catch (err: any) {
        console.error('ProgramPage load error', err);
        setError('Αποτυχία φόρτωσης προγράμματος.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [schoolId]);

  const getClassLabel = (cls: ClassRow): string => {
    const subj = cls.subject_id ? subjectById.get(cls.subject_id) : null;
    const levelName =
      subj?.level_id ? levelNameById.get(subj.level_id) ?? '' : '';
    const tutorName = cls.tutor_id
      ? tutorNameById.get(cls.tutor_id) ?? ''
      : '';

    const parts = [cls.title];
    if (cls.subject) parts.push(cls.subject);
    if (levelName) parts.push(levelName);
    if (tutorName) parts.push(`(${tutorName})`);

    return parts.join(' · ');
  };

  // ---- add slot modal helpers ----
  const openAddSlotModal = (classId: string, day: string) => {
    const isoToday = todayISO();
    setError(null);
    setAddForm({
      classId,
      day,
      startTime: '',
      startPeriod: 'PM',
      endTime: '',
      endPeriod: 'PM',
      startDate: isoToday,
      endDate: isoToday,
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
      setAddForm((prev) => ({ ...prev, [field]: value as any }));
    };

  const handleConfirmAddSlot = async () => {
    if (!program) return;
    if (!addForm.classId || !addForm.day) {
      setError('Επιλέξτε τμήμα και ημέρα.');
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
      day_of_week: addForm.day,
      position: newPos,
      start_time: start24,
      end_time: end24,
      start_date: addForm.startDate,
      end_date: addForm.endDate,
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

  const handleRemoveProgramItem = async (id: string) => {
    setError(null);

    const previous = programItems;
    setProgramItems((prev) => prev.filter((i) => i.id !== id));

    const { error } = await supabase
      .from('program_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete program_item', error);
      setError('Αποτυχία διαγραφής από το πρόγραμμα.');
      setProgramItems(previous);
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
                    <div className="flex-1 space-y-2 p-2 text-[11px] programs-card"
                    >
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

                          const rangeParts: string[] = [];
                          if (item.start_time && item.end_time) {
                            rangeParts.push(
                              `${item.start_time} – ${item.end_time}`,
                            );
                          }
                          if (item.start_date && item.end_date) {
                            if (item.start_date === item.end_date) {
                              rangeParts.push(
                                `από ${item.start_date} έως ${item.end_date}`,
                              );
                            } else {
                              rangeParts.push(
                                `από ${item.start_date} έως ${item.end_date}`,
                              );
                            }
                          }

                          return (
                            <div
                              key={item.id}
                              className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-2 text-[11px] text-slate-100 flex flex-col gap-1"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-semibold leading-snug">
                                  {getClassLabel(cls)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProgramItem(item.id)}
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
                  <input
                    type="date"
                    value={addForm.startDate}
                    onChange={handleAddFieldChange('startDate')}
                    className="form-input"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
                  />
                </div>
                <div>
                  <label className="form-label text-slate-100">
                    Ημερομηνία λήξης
                  </label>
                  <input
                    type="date"
                    value={addForm.endDate}
                    onChange={handleAddFieldChange('endDate')}
                    className="form-input"
                    style={{
                      background: 'var(--color-input-bg)',
                      color: 'var(--color-text-main)',
                    }}
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
    </div>
  );
}
