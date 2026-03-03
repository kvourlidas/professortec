// src/pages/SubjectsPage.tsx
import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import {
  NotebookText, Search, Plus, ChevronLeft, ChevronRight,
  BookOpen, Layers, Users, X, Loader2, GraduationCap,
} from 'lucide-react';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import SubjectTutorsModal from '../components/subjects/SubjectTutorsModal';

type LevelRow = { id: string; school_id: string; name: string; created_at: string };
type SubjectRow = { id: string; school_id: string; name: string; level_id: string | null; created_at: string };
type TutorRow = { id: string; school_id: string; full_name: string | null };
type ModalMode = 'create' | 'edit';

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const inputCls = "h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30";
const selectCls = inputCls;

function FormField({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SubjectsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [subjectName, setSubjectName] = useState('');
  const [levelId, setLevelId] = useState('');
  const [search, setSearch] = useState('');

  const pageSize = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);

  const [deleteTarget, setDeleteTarget] = useState<SubjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [tutorsModalSubject, setTutorsModalSubject] = useState<{ id: string; name: string } | null>(null);
  const [tutorsBySubject, setTutorsBySubject] = useState<Map<string, TutorRow[]>>(new Map());
  const [reloadSubjectTutorsFlag, setReloadSubjectTutorsFlag] = useState(0);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  useEffect(() => {
    if (!schoolId) return;
    supabase.from('levels').select('*').eq('school_id', schoolId).order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error(error); setError('Αποτυχία φόρτωσης επιπέδων.'); }
        else setLevels((data ?? []) as LevelRow[]);
      });
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true); setError(null);
    supabase.from('subjects').select('id, school_id, name, level_id, created_at')
      .eq('school_id', schoolId).order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error(error); setError('Αποτυχία φόρτωσης μαθημάτων.'); }
        else setSubjects((data ?? []) as SubjectRow[]);
        setLoading(false);
      });
  }, [schoolId]);

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
      } catch (err) { console.error('Error loading subject tutors map', err); }
    };
    load();
  }, [schoolId, reloadSubjectTutorsFlag]);

  const resetForm = () => { setSubjectName(''); setLevelId(''); };

  const openCreateModal = () => { resetForm(); setError(null); setModalMode('create'); setEditingSubject(null); setModalOpen(true); };
  const openEditModal = (row: SubjectRow) => {
    setError(null); setModalMode('edit'); setEditingSubject(row);
    setSubjectName(row.name ?? ''); setLevelId(row.level_id ?? '');
    setModalOpen(true);
  };
  const closeModal = () => {
    if (saving) return;
    setModalOpen(false); setEditingSubject(null); setModalMode('create'); resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    const nameTrimmed = subjectName.trim();
    if (!nameTrimmed) return;
    if (!levelId) { setError('Παρακαλώ επιλέξτε επίπεδο.'); return; }
    setSaving(true); setError(null);
    const payload = { school_id: schoolId, name: nameTrimmed, level_id: levelId };

    if (modalMode === 'create') {
      const { data, error } = await supabase.from('subjects').insert(payload).select('id, school_id, name, level_id, created_at').maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία δημιουργίας μαθήματος.'); return; }
      setSubjects((prev) => [...prev, data as SubjectRow].sort((a, b) => a.name.localeCompare(b.name, 'el')));
      closeModal();
    } else if (modalMode === 'edit' && editingSubject) {
      const { data, error } = await supabase.from('subjects').update({ name: payload.name, level_id: payload.level_id })
        .eq('id', editingSubject.id).eq('school_id', schoolId).select('id, school_id, name, level_id, created_at').maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία ενημέρωσης μαθήματος.'); return; }
      setSubjects((prev) => prev.map((s) => (s.id === editingSubject.id ? (data as SubjectRow) : s)));
      closeModal();
    } else { setSaving(false); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError(null);
    const { error } = await supabase.from('subjects').delete().eq('id', deleteTarget.id).eq('school_id', schoolId ?? '');
    setDeleting(false);
    if (error) { console.error(error); setError('Αποτυχία διαγραφής μαθήματος.'); return; }
    setSubjects((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const filteredSubjects = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return subjects;
    return subjects.filter((subj) => {
      const levelName = subj.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
      return normalizeText([subj.name, levelName].join(' ')).includes(q);
    });
  }, [subjects, levelNameById, search]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredSubjects.length / pageSize)), [filteredSubjects.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const pagedSubjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSubjects.slice(start, start + pageSize);
  }, [filteredSubjects, page]);

  const showingFrom = filteredSubjects.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredSubjects.length);

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <NotebookText className="h-4.5 w-4.5 text-black" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-50">Μαθήματα</h1>
            <p className="mt-0.5 text-xs text-slate-400">Διαχείριση μαθημάτων και των επιπέδων τους.</p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/50 px-2.5 py-0.5 text-[11px] text-slate-300">
                  <NotebookText className="h-3 w-3 text-slate-400" />
                  {subjects.length} σύνολο
                </span>
                {search.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              className="h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52"
              placeholder="Αναζήτηση μαθήματος..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="button" onClick={openCreateModal}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-accent)' }}>
            <Plus className="h-3.5 w-3.5" />
            Προσθήκη μαθήματος
          </button>
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
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* ── Table card ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">
        {loading ? (
          <div className="space-y-0 divide-y divide-slate-800/60">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="h-3 w-1/4 rounded-full bg-slate-800" />
                <div className="h-3 w-20 rounded-full bg-slate-800/80" />
                <div className="h-3 w-32 rounded-full bg-slate-800/60" />
              </div>
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50">
              <NotebookText className="h-6 w-6 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Δεν υπάρχουν ακόμη μαθήματα</p>
              <p className="mt-1 text-xs text-slate-500">Πατήστε «Προσθήκη μαθήματος» για να δημιουργήσετε το πρώτο.</p>
            </div>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50">
              <Search className="h-6 w-6 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Δεν βρέθηκαν μαθήματα</p>
              <p className="mt-1 text-xs text-slate-500">Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-900/40">
                  {[
                    { icon: <BookOpen className="h-3 w-3" />, label: 'ΟΝΟΜΑ ΜΑΘΗΜΑΤΟΣ' },
                    { icon: <Layers className="h-3 w-3" />, label: 'ΕΠΙΠΕΔΟ' },
                    { icon: <Users className="h-3 w-3" />, label: 'ΚΑΘΗΓΗΤΕΣ' },
                  ].map(({ icon, label }) => (
                    <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="opacity-60">{icon}</span>{label}
                      </span>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                    ΕΝΕΡΓΕΙΕΣ
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/50">
                {pagedSubjects.map((subj) => {
                  const levelName = subj.level_id ? (levelNameById.get(subj.level_id) ?? '—') : '—';
                  const tutorList = tutorsBySubject.get(subj.id) ?? [];

                  return (
                    <tr key={subj.id} className="group transition-colors hover:bg-white/[0.025]">
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-100 group-hover:text-white transition-colors">{subj.name}</span>
                      </td>

                      {/* Level */}
                      <td className="px-5 py-3.5">
                        {levelName !== '—'
                          ? <span className="inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/60 px-2.5 py-0.5 text-[11px] text-slate-300">{levelName}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>

                      {/* Tutors */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setTutorsModalSubject({ id: subj.id, name: subj.name })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 transition hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                          >
                            <Users className="h-3 w-3" />
                            Διαχείριση
                          </button>
                          {tutorList.length === 0 ? (
                            <span className="text-[11px] italic text-slate-600">Χωρίς καθηγητές</span>
                          ) : (
                            <>
                              {tutorList.slice(0, 3).map((t) => (
                                <span key={t.id}
                                  className="rounded-full border border-slate-700/50 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
                                  {t.full_name ?? 'Χωρίς όνομα'}
                                </span>
                              ))}
                              {tutorList.length > 3 && (
                                <span className="text-[11px] text-slate-500">+{tutorList.length - 3} ακόμα</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <EditDeleteButtons
                            onEdit={() => openEditModal(subj)}
                            onDelete={() => { setError(null); setDeleteTarget(subj); }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredSubjects.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-900/20 px-5 py-3">
            <p className="text-[11px] text-slate-500">
              <span className="text-slate-300">{showingFrom}–{showingTo}</span>{' '}
              από <span className="text-slate-300">{filteredSubjects.length}</span> μαθήματα
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/30 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/20 px-3 py-1 text-[11px] text-slate-300">
                <span className="font-medium text-slate-50">{page}</span>
                <span className="mx-1 text-slate-600">/</span>
                <span className="text-slate-400">{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/30 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <BookOpen className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-50">
                    {modalMode === 'create' ? 'Νέο μάθημα' : 'Επεξεργασία μαθήματος'}
                  </h2>
                  {modalMode === 'edit' && editingSubject && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{editingSubject.name}</p>
                  )}
                </div>
              </div>
              <button type="button" onClick={closeModal}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-6 pb-2">
                <FormField label="Όνομα μαθήματος" icon={<BookOpen className="h-3 w-3" />}>
                  <input className={inputCls} placeholder="π.χ. Αγγλικά"
                    value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
                </FormField>

                <FormField label="Επίπεδο" icon={<Layers className="h-3 w-3" />}>
                  <select className={selectCls} value={levelId} onChange={(e) => setLevelId(e.target.value)} required>
                    <option value="">Επιλέξτε επίπεδο…</option>
                    {levels.map((lvl) => <option key={lvl.id} value={lvl.id}>{lvl.name}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-500">Κάθε μάθημα ανήκει σε ένα επίπεδο.</p>
                </FormField>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4">
                <button type="button" onClick={closeModal} disabled={saving}
                  className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50">
                  Ακύρωση
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                  style={{ backgroundColor: 'var(--color-accent)' }}>
                  {saving
                    ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</>
                    : modalMode === 'create' ? 'Αποθήκευση' : 'Ενημέρωση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <BookOpen className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">Διαγραφή μαθήματος</h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Σίγουρα θέλετε να διαγράψετε το μάθημα{' '}
                <span className="font-semibold text-slate-100">«{deleteTarget.name}»</span>;
                {' '}Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={() => { if (!deleting) setDeleteTarget(null); }} disabled={deleting}
                  className="rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60 disabled:opacity-50">
                  Ακύρωση
                </button>
                <button type="button" onClick={handleConfirmDelete} disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
                  {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SubjectTutors modal ── */}
      <SubjectTutorsModal
        open={!!tutorsModalSubject}
        onClose={() => setTutorsModalSubject(null)}
        subjectId={tutorsModalSubject?.id ?? null}
        subjectName={tutorsModalSubject?.name ?? ''}
        onChanged={() => setReloadSubjectTutorsFlag((x) => x + 1)}
      />
    </div>
  );
}