// src/pages/EventsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

import EventFormModal, {
  type EventFormState,
  type SchoolEventForEdit,
} from '../components/events/EventFormModal';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import {
  CalendarDays, Search, Plus, ChevronLeft, ChevronRight,
  Clock, FileText, Calendar,
} from 'lucide-react';

type SchoolEventRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  created_at: string | null;
};

type ModalMode = 'create' | 'edit';

function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const s = start ? start.slice(0, 5) : '';
  const e = end ? end.slice(0, 5) : '';
  if (s && e) return `${s} – ${e}`;
  return s || e || '—';
}

export default function EventsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;
  const location = useLocation();

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

  const pageSize = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);

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

  const handleSaveEvent = async (form: EventFormState) => {
    setError(null);
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    if (!form.name.trim()) { setError('Το όνομα είναι υποχρεωτικό.'); return; }
    if (!form.date) { setError('Η ημερομηνία είναι υποχρεωτική.'); return; }
    if (!form.startTime || !form.endTime) { setError('Η ώρα έναρξης και λήξης είναι υποχρεωτικές.'); return; }

    const payload = {
      school_id: schoolId, name: form.name.trim(),
      description: form.description?.trim() || null,
      date: form.date, start_time: `${form.startTime}:00`, end_time: `${form.endTime}:00`,
    };
    setSaving(true);

    if (modalMode === 'create') {
      const { data, error } = await supabase.from('school_events').insert(payload).select('*').maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία δημιουργίας event.'); return; }
      setEvents((prev) => [data as SchoolEventRow, ...prev]); closeModal();
    } else {
      if (!editingEvent) { setSaving(false); return; }
      const { data, error } = await supabase.from('school_events')
        .update({ name: payload.name, description: payload.description, date: payload.date, start_time: payload.start_time, end_time: payload.end_time })
        .eq('id', editingEvent.id).select('*').maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία ενημέρωσης event.'); return; }
      setEvents((prev) => prev.map((ev) => ev.id === editingEvent.id ? (data as SchoolEventRow) : ev));
      closeModal();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null); setDeleting(true);
    const { error } = await supabase.from('school_events').delete().eq('id', deleteTarget.id).eq('school_id', schoolId ?? '');
    setDeleting(false);
    if (error) { console.error(error); setError('Αποτυχία διαγραφής εκδήλωσης.'); return; }
    setEvents((prev) => prev.filter((ev) => ev.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const filteredEvents = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return events;
    return events.filter((ev) => {
      const composite = [ev.name, ev.description, formatDate(ev.date), formatTimeRange(ev.start_time, ev.end_time)].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [events, search]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredEvents.length / pageSize)), [filteredEvents.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);

  const pagedEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, page]);

  const showingFrom = filteredEvents.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredEvents.length);

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
          >
            <CalendarDays className="h-4 w-4 text-black" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-50">Εκδηλώσεις</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Μοναδικές εκδηλώσεις σχολείου που εμφανίζονται στο ημερολόγιο του Dashboard.
            </p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/50 px-2.5 py-0.5 text-[11px] text-slate-300">
                  <CalendarDays className="h-3 w-3 text-slate-400" />
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              className="h-9 w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30 sm:w-52"
              placeholder="Αναζήτηση εκδήλωσης..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-semibold text-black shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Προσθήκη Εκδήλωσης
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
      {!schoolId && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 backdrop-blur">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* ── Table card ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/40 shadow-2xl backdrop-blur-md ring-1 ring-inset ring-white/[0.04]">

        {loading ? (
          <div className="divide-y divide-slate-800/60">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="h-3 w-1/4 rounded-full bg-slate-800" />
                <div className="h-3 w-16 rounded-full bg-slate-800/80" />
                <div className="h-3 w-20 rounded-full bg-slate-800/60" />
                <div className="h-3 w-32 rounded-full bg-slate-800/50" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50">
              <CalendarDays className="h-6 w-6 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Δεν υπάρχουν ακόμη εκδηλώσεις</p>
              <p className="mt-1 text-xs text-slate-500">Πατήστε «Προσθήκη Εκδήλωσης» για να δημιουργήσετε την πρώτη.</p>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-800/50">
              <Search className="h-6 w-6 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Δεν βρέθηκαν εκδηλώσεις</p>
              <p className="mt-1 text-xs text-slate-500">Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-900/40">
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
              <tbody className="divide-y divide-slate-800/50">
                {pagedEvents.map((ev) => (
                  <tr key={ev.id} className="group transition-colors hover:bg-white/[0.025]">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-100 group-hover:text-white transition-colors">{ev.name}</span>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-slate-400">
                      {formatDate(ev.date)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">
                      <span className="inline-flex items-center rounded-full border border-slate-600/50 bg-slate-800/60 px-2.5 py-0.5 text-[11px] text-slate-300">
                        {formatTimeRange(ev.start_time, ev.end_time)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {ev.description?.trim()
                        ? <span className="truncate block text-slate-400 text-[11px]">{ev.description}</span>
                        : <span className="text-slate-600">—</span>}
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
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 bg-slate-900/20 px-5 py-3">
            <p className="text-[11px] text-slate-500">
              <span className="text-slate-300">{showingFrom}–{showingTo}</span>{' '}
              από <span className="text-slate-300">{filteredEvents.length}</span> εκδηλώσεις
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

      {/* Create/Edit modal — passed through to EventFormModal */}
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
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl" style={{ background: 'var(--color-sidebar)' }}>
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <CalendarDays className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">Διαγραφή εκδήλωσης</h3>
              <p className="text-xs leading-relaxed text-slate-400">
                Σίγουρα θέλετε να διαγράψετε την εκδήλωση{' '}
                <span className="font-semibold text-slate-100">«{deleteTarget.name}»</span>;{' '}
                Η ενέργεια αυτή δεν μπορεί να αναιρεθεί.
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
    </div>
  );
}