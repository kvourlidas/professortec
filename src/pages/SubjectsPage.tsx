// src/pages/SubjectsPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { NotebookText, Search, Plus, ChevronLeft, ChevronRight, BookOpen, Layers, Users } from 'lucide-react';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import SubjectTutorsModal from '../components/subjects/SubjectTutorsModal';
import SubjectFormModal from '../components/subjects/SubjectFormModal';
import SubjectDeleteModal from '../components/subjects/SubjectDeleteModal';
import { useTheme } from '../context/ThemeContext';
import type { LevelRow, SubjectRow, TutorRow, ModalMode } from '../components/subjects/types';
import { normalizeText } from '../components/subjects/utils';

const PAGE_SIZE = 10;

export default function SubjectsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<SubjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tutors modal
  const [tutorsModalSubject, setTutorsModalSubject] = useState<{ id: string; name: string } | null>(null);
  const [tutorsBySubject, setTutorsBySubject] = useState<Map<string, TutorRow[]>>(new Map());
  const [reloadSubjectTutorsFlag, setReloadSubjectTutorsFlag] = useState(0);

  // Search & pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);

  // Load levels
  useEffect(() => {
    if (!schoolId) return;
    supabase.from('levels').select('*').eq('school_id', schoolId).order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error(error); setError('Αποτυχία φόρτωσης επιπέδων.'); }
        else setLevels((data ?? []) as LevelRow[]);
      });
  }, [schoolId]);

  // Load subjects
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

  // Load tutors per subject
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

  // Modal handlers
  const openCreateModal = () => { setError(null); setModalMode('create'); setEditingSubject(null); setModalOpen(true); };
  const openEditModal = (row: SubjectRow) => { setError(null); setModalMode('edit'); setEditingSubject(row); setModalOpen(true); };
  const closeModal = () => { if (saving) return; setModalOpen(false); setEditingSubject(null); setModalMode('create'); };

  const handleSubmit = async (name: string, levelId: string) => {
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    const nameTrimmed = name.trim();
    if (!nameTrimmed) return;
    if (!levelId) { setError('Παρακαλώ επιλέξτε επίπεδο.'); return; }
    setSaving(true); setError(null);
    const payload = { school_id: schoolId, name: nameTrimmed, level_id: levelId };

    if (modalMode === 'create') {
      const { data, error } = await supabase.from('subjects').insert(payload)
        .select('id, school_id, name, level_id, created_at').maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία δημιουργίας μαθήματος.'); return; }
      setSubjects((prev) => [...prev, data as SubjectRow].sort((a, b) => a.name.localeCompare(b.name, 'el')));
      closeModal();
    } else if (modalMode === 'edit' && editingSubject) {
      const { data, error } = await supabase.from('subjects')
        .update({ name: payload.name, level_id: payload.level_id })
        .eq('id', editingSubject.id).eq('school_id', schoolId)
        .select('id, school_id, name, level_id, created_at').maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία ενημέρωσης μαθήματος.'); return; }
      setSubjects((prev) => prev.map((s) => (s.id === editingSubject.id ? (data as SubjectRow) : s)));
      closeModal();
    } else { setSaving(false); }
  };

  // Delete handlers
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError(null);
    const { error } = await supabase.from('subjects').delete()
      .eq('id', deleteTarget.id).eq('school_id', schoolId ?? '');
    setDeleting(false);
    if (error) { console.error(error); setError('Αποτυχία διαγραφής μαθήματος.'); return; }
    setSubjects((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  // Filtering & pagination
  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  const filteredSubjects = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return subjects;
    return subjects.filter((subj) => {
      const levelName = subj.level_id ? (levelNameById.get(subj.level_id) ?? '') : '';
      return normalizeText([subj.name, levelName].join(' ')).includes(q);
    });
  }, [subjects, levelNameById, search]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredSubjects.length / PAGE_SIZE)), [filteredSubjects.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const pagedSubjects = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSubjects.slice(start, start + PAGE_SIZE);
  }, [filteredSubjects, page]);

  const showingFrom = filteredSubjects.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredSubjects.length);

  // ── Style classes ──
  const searchInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52';

  const tableCardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const theadRowCls = isDark
    ? 'border-b border-slate-700/60 bg-slate-900/40'
    : 'border-b border-slate-200 bg-slate-50';

  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const trHoverCls = isDark ? 'group transition-colors hover:bg-white/[0.025]' : 'group transition-colors hover:bg-slate-50';

  const paginationBarCls = isDark
    ? 'flex items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-900/20 px-5 py-3'
    : 'flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3';

  const paginationTextCls = isDark ? 'text-[11px] text-slate-500' : 'text-[11px] text-slate-400';
  const paginationHighlightCls = isDark ? 'text-slate-300' : 'text-slate-700';

  const paginationBtnCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/30 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30';

  const paginationPageCls = isDark
    ? 'rounded-lg border border-slate-700/60 bg-slate-900/20 px-3 py-1 text-[11px] text-slate-300'
    : 'rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600';

  const emptyBoxCls = isDark
    ? 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';

  const emptyTitleCls = isDark ? 'text-sm font-medium text-slate-200' : 'text-sm font-medium text-slate-700';
  const emptySubCls = isDark ? 'mt-1 text-xs text-slate-500' : 'mt-1 text-xs text-slate-400';

  const levelBadgeCls = isDark
    ? 'inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/60 px-2.5 py-0.5 text-[11px] text-slate-300'
    : 'inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600';

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
          >
            <NotebookText className="h-4.5 w-4." style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Μαθήματα
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Διαχείριση μαθημάτων και των επιπέδων τους.
            </p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <NotebookText className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  {subjects.length} σύνολο
                </span>
                {search.trim() && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}
                  >
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
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              className={searchInputCls}
              placeholder="Αναζήτηση μαθήματος..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Προσθήκη μαθήματος
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && !modalOpen && !deleteTarget && (
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
      <div className={tableCardCls}>
        {loading ? (
          <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-3 w-20 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
                <div className={`h-3 w-32 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
              </div>
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}>
              <NotebookText className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={emptyTitleCls}>Δεν υπάρχουν ακόμη μαθήματα</p>
              <p className={emptySubCls}>Πατήστε «Προσθήκη μαθήματος» για να δημιουργήσετε το πρώτο.</p>
            </div>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}>
              <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={emptyTitleCls}>Δεν βρέθηκαν μαθήματα</p>
              <p className={emptySubCls}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
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

              <tbody className={tbodyDivideCls}>
                {pagedSubjects.map((subj) => {
                  const levelName = subj.level_id ? (levelNameById.get(subj.level_id) ?? '—') : '—';
                  const tutorList = tutorsBySubject.get(subj.id) ?? [];

                  return (
                    <tr key={subj.id} className={trHoverCls}>
                      <td className="px-5 py-3.5">
                        <span className={`font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>
                          {subj.name}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {levelName !== '—'
                          ? <span className={levelBadgeCls}>{levelName}</span>
                          : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                      </td>

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
                            <span className={`text-[11px] italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                              Χωρίς καθηγητές
                            </span>
                          ) : (
                            <>
                              {tutorList.slice(0, 3).map((t) => (
                                <span key={t.id}
                                  className={`rounded-full border px-2 py-0.5 text-[11px] ${isDark ? 'border-slate-700/50 bg-slate-800/60 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                                  {t.full_name ?? 'Χωρίς όνομα'}
                                </span>
                              ))}
                              {tutorList.length > 3 && (
                                <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                  +{tutorList.length - 3} ακόμα
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

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
          <div className={paginationBarCls}>
            <p className={paginationTextCls}>
              <span className={paginationHighlightCls}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={paginationHighlightCls}>{filteredSubjects.length}</span> μαθήματα
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className={paginationBtnCls}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className={paginationPageCls}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}
                className={paginationBtnCls}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <SubjectFormModal
        open={modalOpen}
        mode={modalMode}
        editingSubject={editingSubject}
        levels={levels}
        error={error}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <SubjectDeleteModal
        deleteTarget={deleteTarget}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
      />

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
