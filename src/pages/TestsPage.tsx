// src/pages/TestsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import TestFormModal from '../components/tests/TestFormModal';
import TestDeleteModal from '../components/tests/TestDeleteModal';
import TestResultsModal from '../components/tests/TestResultsModal';
import type {
  AddTestForm, ClassRow, ClassSubjectRow, DeleteTarget,
  EditTestForm, SubjectRow, TestResultsModalState, TestRow,
} from '../components/tests/types';
import { emptyForm } from '../components/tests/types';
import {
  formatDateDisplay, formatTimeDisplay, parseDateDisplayToISO,
} from '../components/tests/utils';
import {
  Search, ClipboardList, Users, Percent, Clock, Calendar, BookOpen, Tag,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 10;

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

export default function TestsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditTestForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Results modal
  const [resultsModal, setResultsModal] = useState<TestResultsModalState | null>(null);

  // Search & pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [searchTerm]);

  // Load data
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const [
          { data: classData, error: classErr },
          { data: subjData, error: subjErr },
          { data: classSubjectData, error: classSubjErr },
          { data: testsData, error: testsErr },
        ] = await Promise.all([
          supabase.from('classes').select('id, school_id, title, subject_id').eq('school_id', schoolId).order('title', { ascending: true }),
          supabase.from('subjects').select('id, school_id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('class_subjects').select('class_id, subject_id, school_id').eq('school_id', schoolId),
          supabase.from('tests').select('id, school_id, class_id, subject_id, test_date, start_time, end_time, title, description').eq('school_id', schoolId).order('test_date', { ascending: true }).order('start_time', { ascending: true }),
        ]);
        if (classErr) throw classErr; if (subjErr) throw subjErr; if (classSubjErr) throw classSubjErr; if (testsErr) throw testsErr;
        setClasses((classData ?? []) as ClassRow[]);
        setSubjects((subjData ?? []) as SubjectRow[]);
        setClassSubjects((classSubjectData ?? []) as ClassSubjectRow[]);
        setTests((testsData ?? []) as TestRow[]);
      } catch (err) { console.error(err); setError('Αποτυχία φόρτωσης διαγωνισμάτων.'); }
      finally { setLoading(false); }
    };
    load();
  }, [schoolId]);

  const subjectById = useMemo(() => { const m = new Map<string, SubjectRow>(); subjects.forEach((s) => m.set(s.id, s)); return m; }, [subjects]);
  const classById = useMemo(() => { const m = new Map<string, ClassRow>(); classes.forEach((c) => m.set(c.id, c)); return m; }, [classes]);

  const testsWithDisplay = useMemo(() => tests.map((t) => {
    const cls = classById.get(t.class_id); const subj = subjectById.get(t.subject_id);
    const timeRange = t.start_time && t.end_time ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(t.end_time)}` : '';
    return { ...t, classTitle: cls?.title ?? '—', subjectName: subj?.name ?? '—', dateDisplay: formatDateDisplay(t.test_date), timeRange };
  }), [tests, classById, subjectById]);

  const filteredTests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase(); if (!q) return testsWithDisplay;
    return testsWithDisplay.filter((t) => [t.dateDisplay, t.timeRange, t.classTitle, t.subjectName, t.title ?? ''].some((v) => v.toLowerCase().includes(q)));
  }, [testsWithDisplay, searchTerm]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredTests.length / PAGE_SIZE)), [filteredTests.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const pagedTests = useMemo(() => { const start = (page - 1) * PAGE_SIZE; return filteredTests.slice(start, start + PAGE_SIZE); }, [filteredTests, page]);
  const showingFrom = filteredTests.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredTests.length);

  // Add handlers
  const openModal = () => { setError(null); setModalOpen(true); };
  const closeModal = () => { if (saving) return; setModalOpen(false); };

  // ── Create via edge function ──────────────────────────────────────────────
  const handleSubmit = async (form: AddTestForm) => {
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    if (!form.classId) { setError('Επιλέξτε τμήμα.'); return; }
    if (!form.date) { setError('Επιλέξτε ημερομηνία.'); return; }
    const testDateISO = parseDateDisplayToISO(form.date);
    if (!testDateISO) { setError('Μη έγκυρη ημερομηνία.'); return; }
    if (!form.startTime || !form.endTime) { setError('Συμπληρώστε ώρες.'); return; }
    setSaving(true); setError(null);
    try {
      const data = await callEdgeFunction('tests-create', {
        class_id: form.classId,
        subject_id: form.subjectId,
        test_date: testDateISO,
        start_time: form.startTime,
        end_time: form.endTime,
        title: form.title || null,
        description: null,
      });
      setTests((prev) => [...prev, data.item as TestRow]);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία δημιουργίας διαγωνίσματος.');
    } finally {
      setSaving(false);
    }
  };

  // Edit handlers
  const openEditModal = (testId: string) => {
    const t = tests.find((tt) => tt.id === testId); if (!t) return;
    setError(null);
    setEditForm({ id: t.id, classId: t.class_id, subjectId: t.subject_id ?? null, date: formatDateDisplay(t.test_date), startTime: t.start_time?.slice(0, 5) ?? '', endTime: t.end_time?.slice(0, 5) ?? '', title: t.title ?? '' });
    setEditModalOpen(true);
  };
  const closeEditModal = () => { if (savingEdit) return; setEditModalOpen(false); setEditForm(null); };

  // ── Update via edge function ──────────────────────────────────────────────
  const handleEditSubmit = async (form: AddTestForm) => {
    if (!schoolId || !editForm) return;
    if (!form.classId) { setError('Επιλέξτε τμήμα.'); return; }
    const testDateISO = parseDateDisplayToISO(form.date);
    if (!testDateISO) { setError('Μη έγκυρη ημερομηνία.'); return; }
    if (!form.startTime || !form.endTime) { setError('Συμπληρώστε ώρες.'); return; }
    setSavingEdit(true); setError(null);
    try {
      const data = await callEdgeFunction('tests-update', {
        test_id: editForm.id,
        class_id: form.classId,
        subject_id: form.subjectId,
        test_date: testDateISO,
        start_time: form.startTime,
        end_time: form.endTime,
        title: form.title || null,
      });
      setTests((prev) => prev.map((t) => (t.id === editForm.id ? (data.item as TestRow) : t)));
      closeEditModal();
    } catch (err) {
      console.error(err);
      setError('Αποτυχία ενημέρωσης.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete handlers
  const openDeleteModal = (testId: string) => {
    const t = tests.find((tt) => tt.id === testId); if (!t) return;
    const cls = classById.get(t.class_id); const subj = subjectById.get(t.subject_id);
    setDeleteTarget({ id: t.id, dateDisplay: formatDateDisplay(t.test_date), timeRange: t.start_time && t.end_time ? `${formatTimeDisplay(t.start_time)} – ${formatTimeDisplay(t.end_time)}` : '', classTitle: cls?.title ?? '—', subjectName: subj?.name ?? '—' });
  };

  // ── Delete via edge function ──────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setError(null);
    try {
      await callEdgeFunction('tests-delete', { test_id: deleteTarget.id });
      setTests((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής.');
    } finally {
      setDeleting(false);
    }
  };

  // Results modal
  const openResultsModal = (testId: string) => {
    const tDisplay = testsWithDisplay.find((tt) => tt.id === testId); if (!tDisplay) return;
    setResultsModal({ testId, testTitle: tDisplay.title ?? null, dateDisplay: tDisplay.dateDisplay, timeRange: tDisplay.timeRange, classTitle: tDisplay.classTitle, subjectName: tDisplay.subjectName });
  };

  // ── Style classes ──
  const tableCardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';
  const theadRowCls = isDark ? 'border-b border-slate-700/60 bg-slate-900/40' : 'border-b border-slate-200 bg-slate-50';
  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const trHoverCls = isDark ? 'group transition-colors hover:bg-white/[0.025]' : 'group transition-colors hover:bg-slate-50';
  const timeBadgeCls = isDark
    ? 'inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/60 px-2.5 py-0.5 text-[11px] text-slate-300'
    : 'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600';
  const paginationBarCls = isDark
    ? 'flex items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-900/20 px-5 py-3'
    : 'flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3';
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
  const searchInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52';

  return (
    <div className="space-y-6 px-1">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <ClipboardList className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Διαγωνίσματα</h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Καταχώρησε διαγωνίσματα ανά τμήμα και μάθημα.</p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <ClipboardList className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />{tests.length} σύνολο
                </span>
                {searchTerm.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                    <Search className="h-3 w-3" />{filteredTests.length} αποτελέσματα
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={searchInputCls} placeholder="Αναζήτηση..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button type="button" onClick={openModal} className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]">
            <ClipboardList className="h-3.5 w-3.5" />Προσθήκη διαγωνίσματος
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && !modalOpen && !editModalOpen && !deleteTarget && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.
        </div>
      )}

      {/* Table card */}
      <div className={tableCardCls}>
        {loading ? (
          <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-16 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-3 w-20 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
                <div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
                <div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} />
              </div>
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}><ClipboardList className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} /></div>
            <div><p className={emptyTitleCls}>Δεν υπάρχουν ακόμη διαγωνίσματα</p><p className={emptySubCls}>Πατήστε «Προσθήκη διαγωνίσματος».</p></div>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}><Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} /></div>
            <div><p className={emptyTitleCls}>Δεν βρέθηκαν διαγωνίσματα</p><p className={emptySubCls}>Δοκιμάστε διαφορετικά κριτήρια.</p></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
                  {[
                    { icon: <Calendar className="h-3 w-3" />, label: 'ΗΜΕΡΟΜΗΝΙΑ' },
                    { icon: <Clock className="h-3 w-3" />, label: 'ΩΡΑ' },
                    { icon: <BookOpen className="h-3 w-3" />, label: 'ΤΜΗΜΑ' },
                    { icon: <Tag className="h-3 w-3" />, label: 'ΜΑΘΗΜΑ' },
                    { icon: <ClipboardList className="h-3 w-3" />, label: 'ΤΙΤΛΟΣ' },
                  ].map(({ icon, label }) => (
                    <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                      <span className="inline-flex items-center gap-1.5"><span className="opacity-60">{icon}</span>{label}</span>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>
              <tbody className={tbodyDivideCls}>
                {pagedTests.map((t) => (
                  <tr key={t.id} className={trHoverCls}>
                    <td className={`px-5 py-3.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.dateDisplay}</td>
                    <td className="px-5 py-3.5">
                      {t.timeRange ? <span className={timeBadgeCls}>{t.timeRange}</span> : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                    </td>
                    <td className={`px-5 py-3.5 font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{t.classTitle}</td>
                    <td className={`px-5 py-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.subjectName}</td>
                    <td className={`px-5 py-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.title ?? <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => openResultsModal(t.id)}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-400 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-300"
                          title="Μαθητές & βαθμοί">
                          <Users className="h-3.5 w-3.5" /><Percent className="h-3 w-3" />
                        </button>
                        <EditDeleteButtons onEdit={() => openEditModal(t.id)} onDelete={() => openDeleteModal(t.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredTests.length > 0 && (
          <div className={paginationBarCls}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{filteredTests.length}</span> διαγωνίσματα
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}><ChevronLeft className="h-3.5 w-3.5" /></button>
              <div className={paginationPageCls}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <TestFormModal
        open={modalOpen}
        mode="add"
        editTestData={null}
        classes={classes}
        subjects={subjects}
        classSubjects={classSubjects}
        error={error}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <TestFormModal
        open={editModalOpen}
        mode="edit"
        editTestData={editForm}
        classes={classes}
        subjects={subjects}
        classSubjects={classSubjects}
        error={error}
        saving={savingEdit}
        onClose={closeEditModal}
        onSubmit={handleEditSubmit}
      />

      <TestDeleteModal
        deleteTarget={deleteTarget}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
      />

      <TestResultsModal
        resultsModal={resultsModal}
        schoolId={schoolId}
        onClose={() => setResultsModal(null)}
      />
    </div>
  );
}