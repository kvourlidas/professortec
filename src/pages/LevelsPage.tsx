// src/pages/LevelsPage.tsx
import { useEffect, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { Pencil, Trash2, Layers, Search, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

type LevelRow = {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
};

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function LevelsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<LevelRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 10;
  const [page, setPage] = useState(1);

  // ── Dynamic classes ──
  const inputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

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
    ? 'inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-200 group-hover:text-white transition-colors'
    : 'inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors';

  // Modal classes
  const modalOverlayCls = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';

  const modalCardCls = isDark
    ? 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const modalHeaderCls = isDark
    ? 'flex items-center justify-between px-6 pt-5 pb-4'
    : 'flex items-center justify-between px-6 pt-5 pb-4';

  const modalTitleCls = isDark ? 'text-sm font-semibold text-slate-50' : 'text-sm font-semibold text-slate-800';

  const modalCloseBtnCls = isDark
    ? 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/50 text-slate-400 transition hover:border-slate-600 hover:text-slate-200'
    : 'flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition hover:border-slate-300 hover:text-slate-700';

  const modalFooterCls = isDark
    ? 'flex justify-end gap-2.5 border-t border-slate-800/70 bg-slate-900/20 px-6 py-4 mt-4'
    : 'flex justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4 mt-4';

  const cancelBtnCls = isDark
    ? 'btn border border-slate-600/60 bg-slate-800/50 px-4 py-1.5 text-slate-200 hover:bg-slate-700/60 disabled:opacity-50'
    : 'btn border border-slate-300 bg-white px-4 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-50';

  const formLabelCls = isDark
    ? 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400'
    : 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

  useEffect(() => { setPage(1); }, [search]);

  // Load levels
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }

    const loadLevels = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (error) { console.error(error); setError('Αποτυχία φόρτωσης επιπέδων.'); }
      else { setLevels((data ?? []) as LevelRow[]); }
      setLoading(false);
    };

    loadLevels();
  }, [schoolId]);

  const openCreateModal = () => {
    setName(''); setEditingId(null); setError(null); setModalOpen(true);
  };

  const openEditModal = (id: string) => {
    const lvl = levels.find((l) => l.id === id);
    if (!lvl) return;
    setName(lvl.name); setEditingId(id); setError(null); setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false); setName(''); setEditingId(null); setSaving(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }

    setSaving(true);
    setError(null);

    try {
      if (editingId == null) {
        const { data, error } = await supabase
          .from('levels')
          .insert({ school_id: schoolId, name: trimmed })
          .select('*')
          .maybeSingle();

        if (error || !data) { console.error(error); setError('Αποτυχία δημιουργίας επιπέδου.'); }
        else { setLevels((prev) => [...prev, data as LevelRow]); closeModal(); }
      } else {
        const { data, error } = await supabase
          .from('levels')
          .update({ name: trimmed })
          .eq('id', editingId)
          .select('*')
          .maybeSingle();

        if (error || !data) { console.error(error); setError('Αποτυχία ενημέρωσης επιπέδου.'); }
        else {
          setLevels((prev) => prev.map((lvl) => (lvl.id === editingId ? (data as LevelRow) : lvl)));
          closeModal();
        }
      }
    } finally { setSaving(false); }
  };

  const askDeleteLevel = (row: LevelRow) => { setError(null); setDeleteTarget(row); };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    const { error } = await supabase.from('levels').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { console.error(error); setError('Αποτυχία διαγραφής επιπέδου.'); return; }
    setLevels((prev) => prev.filter((lvl) => lvl.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleCancelDelete = () => { if (deleting) return; setDeleteTarget(null); };

  const filteredLevels = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return levels;
    return levels.filter((lvl) => normalizeText(lvl.name).includes(q));
  }, [levels, search]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredLevels.length / pageSize)), [filteredLevels.length]);

  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const pagedLevels = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLevels.slice(start, start + pageSize);
  }, [filteredLevels, page]);

  const showingFrom = filteredLevels.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredLevels.length);

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
          >
            <Layers className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Επίπεδα
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Προσθέστε επίπεδα όπως A1, A2, B1, B2 κτλ. για το σχολείο σας.
            </p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <Layers className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  {levels.length} σύνολο
                </span>
                {search.trim() && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                      background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    <Search className="h-3 w-3" />
                    {filteredLevels.length} αποτελέσματα
                  </span>
                )}
              </div>
            )}
            {schoolId == null && (
              <p className="mt-2 text-[11px] text-amber-500">
                Δεν έχει οριστεί school_id στο προφίλ.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              className={searchInputCls}
              placeholder="Αναζήτηση επιπέδου..."
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
            Προσθήκη επιπέδου
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {error}
        </div>
      )}

      {/* ── Table card ── */}
      <div className={tableCardCls}>

        {loading ? (
          <div className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-1/3 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`ml-auto h-3 w-16 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
              </div>
            ))}
          </div>
        ) : levels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}>
              <Layers className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={emptyTitleCls}>Δεν υπάρχουν ακόμη επίπεδα</p>
              <p className={emptySubCls}>Πατήστε «Προσθήκη επιπέδου» για να δημιουργήσετε το πρώτο.</p>
            </div>
          </div>
        ) : filteredLevels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}>
              <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={emptyTitleCls}>Δεν βρέθηκαν επίπεδα</p>
              <p className={emptySubCls}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
                  <th
                    className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="opacity-60"><Layers className="h-3 w-3" /></span>
                      ΕΠΙΠΕΔΟ
                    </span>
                  </th>
                  <th
                    className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}
                  >
                    ΕΝΕΡΓΕΙΕΣ
                  </th>
                </tr>
              </thead>

              <tbody className={tbodyDivideCls}>
                {pagedLevels.map((lvl) => (
                  <tr key={lvl.id} className={trHoverCls}>
                    <td className="px-5 py-3.5">
                      <span className={levelBadgeCls}>{lvl.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => openEditModal(lvl.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-400 transition hover:border-blue-400/60 hover:bg-blue-500/20 hover:text-blue-300"
                          title="Επεξεργασία"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => askDeleteLevel(lvl)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-300"
                          title="Διαγραφή"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredLevels.length > 0 && (
          <div className={paginationBarCls}>
            <p className={paginationTextCls}>
              <span className={paginationHighlightCls}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={paginationHighlightCls}>{filteredLevels.length}</span> επίπεδα
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={paginationBtnCls}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className={paginationPageCls}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className={paginationBtnCls}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit modal ── */}
      {modalOpen && (
        <div className={modalOverlayCls}>
          <div
            className={modalCardCls}
            style={{ background: 'var(--color-sidebar)' }}
          >
            {/* Accent top stripe */}
            <div
              className="h-0.5 w-full"
              style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }}
            />

            {/* Modal header */}
            <div className={modalHeaderCls}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{
                    background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                  }}
                >
                  <Layers className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <h2 className={modalTitleCls}>
                  {editingId == null ? 'Νέο επίπεδο' : 'Επεξεργασία επιπέδου'}
                </h2>
              </div>
              <button type="button" onClick={closeModal} className={modalCloseBtnCls}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mx-6 mb-3 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="px-6 pb-2">
                <div className="space-y-1.5">
                  <label className={formLabelCls}>
                    <span className="opacity-70"><Layers className="h-3 w-3" /></span>
                    Όνομα επιπέδου *
                  </label>
                  <input
                    className={inputCls}
                    placeholder="π.χ. B2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Footer */}
              <div className={modalFooterCls}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className={cancelBtnCls}
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
                >
                  {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className={modalOverlayCls}>
          <div
            className={modalCardCls}
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <Layers className="h-5 w-5 text-red-400" />
              </div>
              <h3 className={`mb-1 text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                Διαγραφή επιπέδου
              </h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Σίγουρα θέλετε να διαγράψετε το επίπεδο{' '}
                <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  «{deleteTarget.name}»
                </span>;{' '}
                Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  disabled={deleting}
                  className={cancelBtnCls}
                >
                  Ακύρωση
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60"
                >
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