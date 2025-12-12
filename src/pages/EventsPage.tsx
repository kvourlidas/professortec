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

type SchoolEventRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  date: string;        // "YYYY-MM-DD"
  start_time: string;  // "HH:MM:SS"
  end_time: string;    // "HH:MM:SS"
  created_at: string | null;
};

type ModalMode = 'create' | 'edit';

// normalize greek/latin text (remove accents, toLowerCase)
function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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
  const location = useLocation(); // debug helper

  const [events, setEvents] = useState<SchoolEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingEvent, setEditingEvent] =
    useState<SchoolEventForEdit | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ✅ Pagination
  const pageSize = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // Load events
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      setEvents([]);
      return;
    }

    const loadEvents = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('school_events')
        .select('*')
        .eq('school_id', schoolId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error(error);
        setError('Αποτυχία φόρτωσης εκδήλωσης.');
        setEvents([]);
      } else {
        setEvents((data ?? []) as SchoolEventRow[]);
      }

      setLoading(false);
    };

    loadEvents();
  }, [schoolId]);

  const openCreateModal = () => {
    setError(null);
    setModalMode('create');
    setEditingEvent(null);
    setModalOpen(true);
  };

  const openEditModal = (row: SchoolEventRow) => {
    setError(null);
    setModalMode('edit');
    setEditingEvent({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      date: row.date,
      start_time: row.start_time,
      end_time: row.end_time,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEvent(null);
    setSaving(false);
  };

  const handleSaveEvent = async (form: EventFormState) => {
    setError(null);

    if (!schoolId) {
      setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id).');
      return;
    }

    if (!form.name.trim()) {
      setError('Το όνομα του event είναι υποχρεωτικό.');
      return;
    }
    if (!form.date) {
      setError('Η ημερομηνία είναι υποχρεωτική.');
      return;
    }
    if (!form.startTime || !form.endTime) {
      setError('Η ώρα έναρξης και λήξης είναι υποχρεωτικές.');
      return;
    }

    const payload = {
      school_id: schoolId,
      name: form.name.trim(),
      description: form.description?.trim() || null,
      date: form.date,
      start_time: `${form.startTime}:00`,
      end_time: `${form.endTime}:00`,
    };

    setSaving(true);

    if (modalMode === 'create') {
      const { data, error } = await supabase
        .from('school_events')
        .insert(payload)
        .select('*')
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία δημιουργίας event.');
        return;
      }

      setEvents((prev) => [data as SchoolEventRow, ...prev]);
      closeModal();
    } else {
      if (!editingEvent) {
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from('school_events')
        .update({
          name: payload.name,
          description: payload.description,
          date: payload.date,
          start_time: payload.start_time,
          end_time: payload.end_time,
        })
        .eq('id', editingEvent.id)
        .select('*')
        .maybeSingle();

      setSaving(false);

      if (error || !data) {
        console.error(error);
        setError('Αποτυχία ενημέρωσης event.');
        return;
      }

      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingEvent.id ? (data as SchoolEventRow) : ev,
        ),
      );
      closeModal();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setError(null);
    setDeleting(true);

    const { error } = await supabase
      .from('school_events')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('school_id', schoolId ?? '');

    setDeleting(false);

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής εκδήλωσης.');
      return;
    }

    setEvents((prev) => prev.filter((ev) => ev.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const filteredEvents = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return events;

    return events.filter((ev) => {
      const composite = [
        ev.name,
        ev.description,
        formatDate(ev.date),
        formatTimeRange(ev.start_time, ev.end_time),
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(composite).includes(q);
    });
  }, [events, search]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  }, [filteredEvents.length]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, page]);

  const showingFrom =
    filteredEvents.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredEvents.length);

  return (
    <div className="space-y-4">
      {/* Tiny debug helper so you SEE the path */}
      <p className="text-[10px] text-slate-500">
        Τρέχουσα διαδρομή:{' '}
        <span className="font-mono">{location.pathname}</span>
      </p>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-50">ΕΚΔΗΛΩΣΕΙΣ</h1>
          <p className="text-xs text-slate-300">
            Μοναδικές εκδηλώσεις σχολείου που εμφανίζονται και στο ημερολόγιο του Dashboard.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Σύνολο events:{' '}
            <span className="font-medium text-slate-100">{events.length}</span>
            {search.trim() && (
              <>
                {' · '}
                <span className="text-slate-300">Εμφανίζονται: {filteredEvents.length}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <input
            className="form-input w-full sm:w-56"
            style={{
              background: 'var(--color-input-bg)',
              color: 'var(--color-text-main)',
            }}
            placeholder="Αναζήτηση..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary text-black"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Προσθήκη Εκδήλωσης
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

      {/* ✅ TABLE (same card + zebra rows + pagination) */}
      <div className="rounded-xl border border-slate-400/60 bg-slate-950/7 backdrop-blur-md shadow-lg overflow-hidden ring-1 ring-inset ring-slate-300/15">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-200">Φόρτωση events…</div>
          ) : events.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-200">
              Δεν υπάρχουν ακόμη events. Πατήστε «Προσθήκη Event» για να δημιουργήσετε το πρώτο.
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-200">
              Δεν βρέθηκαν events με αυτά τα κριτήρια.
            </div>
          ) : (
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr
                  className="text-[11px] uppercase tracking-wide"
                  style={{
                    color: 'var(--color-text-main)',
                    fontFamily:
                      '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΟΝΟΜΑ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΗΜΕΡΟΜΗΝΙΑ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΩΡΑ</th>
                  <th className="border-b border-slate-600 px-4 py-2 text-left">ΠΕΡΙΓΡΑΦΗ</th>
                  <th className="border-b border-slate-600 px-4 py-2 th-right text-right">
                    ΕΝΕΡΓΕΙΕΣ
                  </th>
                </tr>
              </thead>

              <tbody>
                {pagedEvents.map((ev, idx) => {
                  const absoluteIndex = (page - 1) * pageSize + idx;
                  const rowBg =
                    absoluteIndex % 2 === 0 ? 'bg-slate-950/45' : 'bg-slate-900/25';

                  return (
                    <tr
                      key={ev.id}
                      className={`${rowBg} backdrop-blur-sm hover:bg-slate-800/40 transition-colors`}
                    >
                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <span
                          className="text-xs font-medium text-slate-50"
                          style={{ color: 'var(--color-text-td)' }}
                        >
                          {ev.name}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <span className="text-xs text-slate-100" style={{ color: 'var(--color-text-td)' }}>
                          {formatDate(ev.date)}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <span className="text-xs text-slate-100" style={{ color: 'var(--color-text-td)' }}>
                          {formatTimeRange(ev.start_time, ev.end_time)}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <span
                          className="text-xs text-slate-100 whitespace-pre-wrap"
                          style={{ color: 'var(--color-text-td)' }}
                        >
                          {ev.description || '—'}
                        </span>
                      </td>

                      <td className="border-b border-slate-700 px-4 py-2 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <EditDeleteButtons
                            onEdit={() => openEditModal(ev)}
                            onDelete={() => setDeleteTarget({ id: ev.id, name: ev.name })}
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

        {/* ✅ Pagination footer */}
        {!loading && filteredEvents.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800/70 px-4 py-3">
            <div className="text-[11px] text-slate-300">
              Εμφάνιση <span className="text-slate-100">{showingFrom}</span>-
              <span className="text-slate-100">{showingTo}</span> από{' '}
              <span className="text-slate-100">{filteredEvents.length}</span>
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

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 px-5 py-4 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-50">
              Διαγραφή εκδήλωσης
            </h3>
            <p className="mb-4 text-xs text-slate-200">
              Σίγουρα θέλετε να διαγράψετε την εκδήλωση{' '}
              <span className="font-semibold text-[color:var(--color-accent)]">
                «{deleteTarget.name}»
              </span>
              ; Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleCancelDelete()}
                className="btn-ghost px-3 py-1"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
                disabled={deleting}
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-md px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: '#dc2626' }}
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
