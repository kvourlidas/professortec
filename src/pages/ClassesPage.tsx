import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import ClassFormModal from '../components/classes/ClassFormModal';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import { Plus, School, Search, Users, BookOpen, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import ClassStudentsModal from '../components/classes/ClassStudentsModal';

type ClassRow = {
  id: string; school_id: string; title: string;
  subject: string | null; subject_id: string | null; tutor_id: string | null;
};
type SubjectRow = { id: string; school_id: string; name: string; level_id: string | null };
type LevelRow = { id: string; school_id: string; name: string };
type ModalMode = 'create' | 'edit';
type ClassFormState = { title: string; levelId: string; subjectIds: string[] };

function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function ClassesPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const pageSize = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [studentsModalClass, setStudentsModalClass] = useState<{ id: string; title: string } | null>(null);

  const levelNameById = useMemo(() => {
    const m = new Map<string, string>();
    levels.forEach((lvl) => m.set(lvl.id, lvl.name));
    return m;
  }, [levels]);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const loadClasses = async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase.from('classes').select('id, school_id, title, subject, subject_id, tutor_id').eq('school_id', schoolId).order('title', { ascending: true });
      if (error) { console.error(error); setError('Αποτυχία φόρτωσης τμημάτων.'); } else { setClasses((data ?? []) as ClassRow[]); }
      setLoading(false);
    };
    const loadLookups = async () => {
      try {
        const [{ data: subjData, error: subjErr }, { data: levelData, error: lvlErr }] = await Promise.all([
          supabase.from('subjects').select('id, school_id, name, level_id').eq('school_id', schoolId).order('name', { ascending: true }),
          supabase.from('levels').select('id, school_id, name').eq('school_id', schoolId).order('name', { ascending: true }),
        ]);
        if (subjErr) console.error(subjErr);
        if (lvlErr) console.error(lvlErr);
        if (subjData) setSubjects(subjData as SubjectRow[]);
        if (levelData) setLevels(levelData as LevelRow[]);
      } catch (err) { console.error('Lookup load error', err); }
    };
    loadClasses(); loadLookups();
  }, [schoolId]);

  const openCreateModal = () => { setError(null); setModalMode('create'); setEditingClass(null); setModalOpen(true); };
  const openEditModal = (row: ClassRow) => { setError(null); setModalMode('edit'); setEditingClass(row); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingClass(null); setSaving(false); };

  const handleSaveClass = async (form: ClassFormState) => {
    setError(null);
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id).'); return; }
    if (!form.title.trim()) { setError('Το όνομα του τμήματος είναι υποχρεωτικό.'); return; }
    if (!form.levelId) { setError('Πρέπει να επιλέξετε επίπεδο.'); return; }
    if (!form.subjectIds || form.subjectIds.length === 0) { setError('Πρέπει να επιλέξετε τουλάχιστον ένα μάθημα για το τμήμα.'); return; }
    const invalidSubject = form.subjectIds.some((id) => { const subj = subjects.find((s) => s.id === id); return !subj || subj.level_id !== form.levelId; });
    if (invalidSubject) { setError('Όλα τα μαθήματα πρέπει να ανήκουν στο ίδιο επίπεδο.'); return; }
    const selectedSubjectRows = subjects.filter((s) => form.subjectIds.includes(s.id));
    const subjectText = selectedSubjectRows.map((s) => s.name).join(', ') || null;
    const primarySubjectId = form.subjectIds[0] ?? null;
    const payload = { school_id: schoolId, title: form.title.trim(), subject: subjectText, subject_id: primarySubjectId };
    setSaving(true);
    if (modalMode === 'create') {
      const { data, error } = await supabase.from('classes').insert(payload).select('*').maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία δημιουργίας τμήματος.'); return; }
      setClasses((prev) => [data as ClassRow, ...prev]); closeModal();
    } else {
      if (!editingClass) { setSaving(false); return; }
      const { data, error } = await supabase.from('classes').update({ title: payload.title, subject: payload.subject, subject_id: payload.subject_id }).eq('id', editingClass.id).select('*').maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία ενημέρωσης τμήματος.'); return; }
      setClasses((prev) => prev.map((c) => (c.id === editingClass.id ? (data as ClassRow) : c))); closeModal();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null); setDeleting(true);
    const { error } = await supabase.from('classes').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { console.error(error); setError('Αποτυχία διαγραφής τμήματος.'); return; }
    setClasses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const filteredClasses = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return classes;
    return classes.filter((c) => {
      let levelName = '';
      if (c.subject_id) { const subjRow = subjects.find((s) => s.id === c.subject_id); if (subjRow?.level_id) levelName = levelNameById.get(subjRow.level_id) ?? ''; }
      const composite = [c.title, c.subject, levelName].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [classes, search, subjects, levelNameById]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredClasses.length / pageSize)), [filteredClasses.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const pagedClasses = useMemo(() => { const start = (page - 1) * pageSize; return filteredClasses.slice(start, start + pageSize); }, [filteredClasses, page]);
  const showingFrom = filteredClasses.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredClasses.length);

  // ── Shared style helpers ──
  const cardCls = `overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${isDark ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]' : 'border-slate-200 bg-white/80 ring-black/[0.02]'}`;
  const inputCls = `h-9 w-full rounded-lg border pl-9 pr-3 text-xs outline-none ring-0 backdrop-blur transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400'}`;
  const theadRowCls = `border-b ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`;
  const tbodyDivideCls = `divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`;
  const trHoverCls = `group transition-colors ${isDark ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-50'}`;
  const cancelBtnCls = `btn border px-4 py-1.5 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;
  const paginationBtnCls = `inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;
  const paginationFooterCls = `flex items-center justify-between gap-3 border-t px-5 py-3 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;

  return (
    <div className="space-y-6 px-1">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <GraduationCap className="h-4.5 w-4.5" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Τμήματα</h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Διαχείριση τμημάτων με μάθημα και επίπεδο.</p>
            <div className="mt-2 flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                <School className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                {classes.length} σύνολο
              </span>
              {search.trim() && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                  style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                  <Search className="h-3 w-3" />
                  {filteredClasses.length} αποτελέσματα
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={`${inputCls} sm:w-52`} placeholder="Αναζήτηση τμήματος..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" onClick={openCreateModal}
            className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]">
            <Plus className="h-3.5 w-3.5" />
            Προσθήκη Τμήματος
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* ── Table card ── */}
      <div className={cardCls}>
        {loading ? (
          <div className={`space-y-0 divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-3 w-1/5 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
                <div className={`h-3 w-16 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
              </div>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
              <School className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη τμήματα</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη Τμήματος» για να δημιουργήσετε το πρώτο.</p>
            </div>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
              <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν τμήματα</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
                  {[
                    { icon: <School className="h-3 w-3" />, label: 'ΟΝΟΜΑ ΤΜΗΜΑΤΟΣ' },
                    { icon: <BookOpen className="h-3 w-3" />, label: 'ΜΑΘΗΜΑ' },
                    { icon: <GraduationCap className="h-3 w-3" />, label: 'ΕΠΙΠΕΔΟ' },
                    { icon: <Users className="h-3 w-3" />, label: 'ΜΑΘΗΤΕΣ' },
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
                {pagedClasses.map((c) => {
                  let levelName = '—';
                  if (c.subject_id) { const subjRow = subjects.find((s) => s.id === c.subject_id); if (subjRow?.level_id) levelName = levelNameById.get(subjRow.level_id) ?? '—'; }
                  return (
                    <tr key={c.id} className={trHoverCls}>
                      <td className="px-5 py-3.5">
                        <span className={`font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>
                          {c.title}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.subject ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                            style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                            {c.subject}
                          </span>
                        ) : (
                          <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {levelName !== '—' ? (
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-600/50 bg-slate-800/60 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                            {levelName}
                          </span>
                        ) : (
                          <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <button type="button" onClick={() => setStudentsModalClass({ id: c.id, title: c.title })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500 transition hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-600">
                          <Users className="h-3 w-3" />
                          Προβολή
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <EditDeleteButtons onEdit={() => openEditModal(c)} onDelete={() => setDeleteTarget({ id: c.id, title: c.title })} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination footer ── */}
        {!loading && filteredClasses.length > 0 && (
          <div className={paginationFooterCls}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{filteredClasses.length}</span> τμήματα
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className={`rounded-lg border px-3 py-1 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-900/20 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <ClassFormModal open={modalOpen} mode={modalMode} editingClass={editingClass} subjects={subjects} levels={levels} error={error} saving={saving} onClose={closeModal} onSubmit={handleSaveClass} />
      <ClassStudentsModal open={!!studentsModalClass} onClose={() => setStudentsModalClass(null)} classId={studentsModalClass?.id ?? null} classTitle={studentsModalClass?.title} />

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white'}`}>
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <School className="h-5 w-5 text-red-400" />
              </div>
              <h3 className={`mb-1 text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Διαγραφή τμήματος</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Σίγουρα θέλεις να διαγράψεις το τμήμα{' '}
                <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>«{deleteTarget.title}»</span>;
                {' '}Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={() => setDeleteTarget(null)} className={cancelBtnCls}>Ακύρωση</button>
                <button type="button" onClick={handleConfirmDelete} disabled={deleting}
                  className="btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
                  {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}