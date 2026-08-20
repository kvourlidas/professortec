// src/pages/LevelsPage.tsx
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { Layers, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { LevelRow } from '../components/levels/types';
import { normalizeText } from '../components/levels/utils';
import LevelFormModal from '../components/levels/LevelFormModal';
import LevelDeleteModal from '../components/levels/LevelDeleteModal';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';

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

export default function LevelsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<LevelRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search & pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search]);

  // Load levels
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
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
    load();
  }, [schoolId]);

  // Modal handlers
  const openCreateModal = () => { setEditingId(null); setError(null); setModalOpen(true); };
  const openEditModal = (id: string) => { setEditingId(id); setError(null); setModalOpen(true); };
  const closeModal = () => { if (saving) return; setModalOpen(false); setEditingId(null); setSaving(false); };

  // ── Create / Update via edge functions ───────────────────────────────────
  const handleSubmit = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    setSaving(true);
    setError(null);
    try {
      if (editingId == null) {
        const data = await callEdgeFunction('levels-create', { name: trimmed });
        setLevels((prev) => [...prev, data.item as LevelRow]);
        closeModal();
      } else {
        const data = await callEdgeFunction('levels-update', { level_id: editingId, name: trimmed });
        setLevels((prev) => prev.map((lvl) => (lvl.id === editingId ? (data.item as LevelRow) : lvl)));
        closeModal();
      }
    } catch (err) {
      console.error(err);
      setError(editingId == null ? 'Αποτυχία δημιουργίας επιπέδου.' : 'Αποτυχία ενημέρωσης επιπέδου.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete via edge function ─────────────────────────────────────────────
  const askDeleteLevel = (row: LevelRow) => { setError(null); setDeleteTarget(row); };
  const handleCancelDelete = () => { if (deleting) return; setDeleteTarget(null); };
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await callEdgeFunction('levels-delete', { level_id: deleteTarget.id });
      setLevels((prev) => prev.filter((lvl) => lvl.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής επιπέδου.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtering & pagination
  const filteredLevels = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return levels;
    return levels.filter((lvl) => normalizeText(lvl.name).includes(q));
  }, [levels, search]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredLevels.length / PAGE_SIZE)), [filteredLevels.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const pagedLevels = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLevels.slice(start, start + PAGE_SIZE);
  }, [filteredLevels, page]);

  const showingFrom = filteredLevels.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredLevels.length);

  const initialName = editingId ? (levels.find((l) => l.id === editingId)?.name ?? '') : '';

  // ── Style classes ──
  const searchInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52';

  const tableCardCls = '';
  const theadRowCls = '';
  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200';
  const colDivider = isDark ? 'border-r border-slate-800/60' : 'border-r border-slate-200';
  const trHoverCls = isDark ? 'transition-colors hover:bg-slate-900/40' : 'transition-colors hover:bg-slate-50/80';

  const paginationBarCls = 'flex items-center justify-between gap-3 pt-4';

  const paginationBtnCls = isDark
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30';

  const paginationPageCls = isDark ? 'px-2 text-[11px] text-slate-300' : 'px-2 text-[11px] text-slate-600';

  const emptyBoxCls = isDark
    ? 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50'
    : 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100';

  const emptyTitleCls = isDark ? 'text-sm font-medium text-slate-200' : 'text-sm font-medium text-slate-700';
  const emptySubCls = isDark ? 'mt-1 text-xs text-slate-500' : 'mt-1 text-xs text-slate-400';

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-accent)' }}
          >
            <Layers className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Επίπεδα
            </h1>
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
      {error && !modalOpen && !deleteTarget && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {error}
        </div>
      )}

      {/* ── Table card ── */}
      <div className={tableCardCls}>
        {loading ? (
          <div className="space-y-3">
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
                <tr className={theadRowCls} style={{ borderBottom: '2px solid var(--color-accent)' }}>
                  <th style={{ width: '1%' }} className={`whitespace-nowrap px-5 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>#</th>
                  <th className={`px-5 pb-3 text-left text-xs font-bold uppercase tracking-wide ${colDivider} ${isDark ? 'text-white' : 'text-black'}`}>ΕΠΙΠΕΔΟ</th>
                  <th className={`px-5 pb-3 text-right text-xs font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>
              <tbody className={tbodyDivideCls}>
                {pagedLevels.map((lvl, i) => (
                  <tr key={lvl.id} className={trHoverCls}>
                    <td className={`whitespace-nowrap px-5 py-3.5 tabular-nums ${colDivider} ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className={`px-5 py-3.5 ${colDivider}`}>
                      <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{lvl.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <EditDeleteButtons onEdit={() => openEditModal(lvl.id)} onDelete={() => askDeleteLevel(lvl)} />
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
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{filteredLevels.length}</span> επίπεδα
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

      {/* ── Modals ── */}
      <LevelFormModal
        open={modalOpen}
        editingId={editingId}
        initialName={initialName}
        error={error}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <LevelDeleteModal
        deleteTarget={deleteTarget}
        deleting={deleting}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}