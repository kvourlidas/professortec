// src/pages/EventsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import EventFormModal, {
  type EventFormState,
  type SchoolEventForEdit,
} from '../components/events/EventFormModal';
import EventDeleteModal from '../components/events/EventDeleteModal';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import type { SchoolEventRow, ModalMode } from '../components/events/types';
import { normalizeText, formatDate, formatTimeRange } from '../components/events/utils';
import {
  CalendarDays, Search, Plus, ChevronLeft, ChevronRight,
  Clock, FileText, Calendar,
} from 'lucide-react';

const PAGE_SIZE = 10;

// ── Date helper: DD-MM-YYYY or DD/MM/YYYY → YYYY-MM-DD ───────────────────────
// function toISODate(display: string): string | null {
//   const parts = display.split(/[-/]/);
//   if (parts.length !== 3) return null;
//   const [dd, mm, yyyy] = parts;
//   if (!dd || !mm || !yyyy) return null;
//   return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
// }

// ── Date helper: ensures date is always YYYY-MM-DD for PostgreSQL ────────────
function normalizeEventDate(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const [, year, second, third] = match;
  // If the middle part > 12 it must be the day, so format is YYYY-DD-MM → swap
  if (parseInt(second, 10) > 12) return `${year}-${third}-${second}`;
  // Otherwise already YYYY-MM-DD
  return date;
}

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

export default function EventsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;
  const [events, setEvents] = useState<SchoolEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingEvent, setEditingEvent] = useState<SchoolEventForEdit | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);

  // ── Dynamic classes ──
  const tableCardCls = isDark
    ? 'overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]'
    : 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md';

  const theadRowCls = isDark
    ? 'border-b border-slate-700/60 bg-slate-900/40'
    : 'border-b border-slate-200 bg-slate-50';

  const tbodyDivideCls = isDark ? 'divide-y divide-slate-800/50' : 'divide-y divide-slate-100';
  const trHoverCls = isDark ? 'group transition-colors hover:bg-white/[0.025]' : 'group transition-colors hover:bg-slate-50';

  const timeBadgeCls = isDark
    ? 'inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/60 px-2.5 py-0.5 text-[11px] text-slate-300'
    : 'inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600';

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

  const searchInputCls = isDark
    ? 'h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52'
    : 'h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52';

  // ── Load ──
  useEffect(() => {
    if (!schoolId) { setLoading(false); setEvents([]); return; }
    const loadEvents = async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from('school_events').select('*').eq('school_id', schoolId)
        .order('date', { ascending: true }).order('start_time', { ascending: true });
      if (error) { console.error(error); setError('Αποτυχία φόρτωσης εκδήλωσης.'); setEvents([]); }
      else { setEvents((data ?? []) as SchoolEventRow[]); }
      setLoading(false);
    };
    loadEvents();
  }, [schoolId]);

  const openCreateModal = () => { setError(null); setModalMode('create'); setEditingEvent(null); setModalOpen(true); };
  const openEditModal = (row: SchoolEventRow) => {
    setError(null); setModalMode('edit');
    setEditingEvent({ id: row.id, name: row.name, description: row.description ?? '', date: row.date, start_time: row.start_time, end_time: row.end_time });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditingEvent(null); setSaving(false); };

  // ── Create / Update via edge functions ────────────────────────────────────
  const handleSaveEvent = async (form: EventFormState) => {
    setError(null);
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    if (!form.name.trim()) { setError('Το όνομα είναι υποχρεωτικό.'); return; }
    if (!form.date) { setError('Η ημερομηνία είναι υποχρεωτική.'); return; }
    if (!form.startTime || !form.endTime) { setError('Η ώρα έναρξης και λήξης είναι υποχρεωτικές.'); return; }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const isoDate = normalizeEventDate(form.date);
        const data = await callEdgeFunction('events-create', {
          name: form.name.trim(),
          description: form.description?.trim() || null,
          date: isoDate,
          start_time: `${form.startTime}:00`,
          end_time: `${form.endTime}:00`,
        });
        setEvents((prev) => [data.item as SchoolEventRow, ...prev]);
        closeModal();
      } else {
        if (!editingEvent) { setSaving(false); return; }
        const isoDate = normalizeEventDate(form.date);
        const data = await callEdgeFunction('events-update', {
          event_id: editingEvent.id,
          name: form.name.trim(),
          description: form.description?.trim() || null,
          date: isoDate,
          start_time: `${form.startTime}:00`,
          end_time: `${form.endTime}:00`,
        });
        setEvents((prev) => prev.map((ev) => ev.id === editingEvent.id ? (data.item as SchoolEventRow) : ev));
        closeModal();
      }
    } catch (err) {
      console.error(err);
      setError(modalMode === 'create' ? 'Αποτυχία δημιουργίας event.' : 'Αποτυχία ενημέρωσης event.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete via edge function ──────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null); setDeleting(true);
    try {
      await callEdgeFunction('events-delete', { event_id: deleteTarget.id });
      setEvents((prev) => prev.filter((ev) => ev.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής εκδήλωσης.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredEvents = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return events;
    return events.filter((ev) => {
      const composite = [ev.name, ev.description, formatDate(ev.date), formatTimeRange(ev.start_time, ev.end_time)].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [events, search]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE)), [filteredEvents.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const pagedEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEvents.slice(start, start + PAGE_SIZE);
  }, [filteredEvents, page]);

  const showingFrom = filteredEvents.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredEvents.length);

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
          >
            <CalendarDays className="h-4 w-4" style={{ color: 'var(--color-input-bg)' }}/>
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
              Εκδηλώσεις
            </h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Μοναδικές εκδηλώσεις σχολείου που εμφανίζονται στο ημερολόγιο του Dashboard.
            </p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <CalendarDays className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  {events.length} σύνολο
                </span>
                {search.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                    <Search className="h-3 w-3" />
                    {filteredEvents.length} αποτελέσματα
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
              placeholder="Αναζήτηση εκδήλωσης..."
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
            Προσθήκη Εκδήλωσης
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
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-3 w-16 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
                <div className={`h-3 w-20 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
                <div className={`h-3 w-32 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}>
              <CalendarDays className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={emptyTitleCls}>Δεν υπάρχουν ακόμη εκδηλώσεις</p>
              <p className={emptySubCls}>Πατήστε «Προσθήκη Εκδήλωσης» για να δημιουργήσετε την πρώτη.</p>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={emptyBoxCls}>
              <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={emptyTitleCls}>Δεν βρέθηκαν εκδηλώσεις</p>
              <p className={emptySubCls}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
                  {[
                    { icon: <CalendarDays className="h-3 w-3" />, label: 'ΟΝΟΜΑ' },
                    { icon: <Calendar className="h-3 w-3" />, label: 'ΗΜΕΡΟΜΗΝΙΑ' },
                    { icon: <Clock className="h-3 w-3" />, label: 'ΩΡΑ' },
                    { icon: <FileText className="h-3 w-3" />, label: 'ΠΕΡΙΓΡΑΦΗ' },
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
                {pagedEvents.map((ev) => (
                  <tr key={ev.id} className={trHoverCls}>
                    <td className="px-5 py-3.5">
                      <span className={`font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>
                        {ev.name}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatDate(ev.date)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">
                      <span className={timeBadgeCls}>
                        {formatTimeRange(ev.start_time, ev.end_time)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {ev.description?.trim()
                        ? <span className={`truncate block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ev.description}</span>
                        : <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <EditDeleteButtons
                          onEdit={() => openEditModal(ev)}
                          onDelete={() => { setError(null); setDeleteTarget({ id: ev.id, name: ev.name }); }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredEvents.length > 0 && (
          <div className={paginationBarCls}>
            <p className={paginationTextCls}>
              <span className={paginationHighlightCls}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={paginationHighlightCls}>{filteredEvents.length}</span> εκδηλώσεις
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

      {/* Create/Edit modal */}
      <EventFormModal
        open={modalOpen}
        mode={modalMode}
        editingEvent={editingEvent}
        error={error}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSaveEvent}
      />

      {/* ── Delete confirmation modal ── */}
      <EventDeleteModal
        deleteTarget={deleteTarget}
        deleting={deleting}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}