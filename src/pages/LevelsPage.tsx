// src/pages/LevelsPage.tsx
import { useEffect, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

type LevelRow = {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
};

// helper: normalize greek/latin text (remove accents, toLowerCase)
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
  const schoolId = profile?.school_id ?? null;

  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  // 🔹 Φόρτωση επιπέδων από Supabase
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const loadLevels = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
        setError('Αποτυχία φόρτωσης επιπέδων.');
      } else {
        setLevels((data ?? []) as LevelRow[]);
      }

      setLoading(false);
    };

    loadLevels();
  }, [schoolId]);

  const openCreateModal = () => {
    setName('');
    setEditingId(null);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (id: string) => {
    const lvl = levels.find((l) => l.id === id);
    if (!lvl) return;
    setName(lvl.name);
    setEditingId(id);
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setName('');
    setEditingId(null);
    setSaving(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!schoolId) {
      setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingId == null) {
        // 🔹 CREATE
        const { data, error } = await supabase
          .from('levels')
          .insert({
            school_id: schoolId,
            name: trimmed,
          })
          .select('*')
          .maybeSingle();

        if (error || !data) {
          console.error(error);
          setError('Αποτυχία δημιουργίας επιπέδου.');
        } else {
          setLevels((prev) => [...prev, data as LevelRow]);
          closeModal();
        }
      } else {
        // 🔹 UPDATE
        const { data, error } = await supabase
          .from('levels')
          .update({ name: trimmed })
          .eq('id', editingId)
          .select('*')
          .maybeSingle();

        if (error || !data) {
          console.error(error);
          setError('Αποτυχία ενημέρωσης επιπέδου.');
        } else {
          setLevels((prev) =>
            prev.map((lvl) =>
              lvl.id === editingId ? (data as LevelRow) : lvl,
            ),
          );
          closeModal();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteLevel = async (id: string) => {
    const ok = window.confirm(
      'Σίγουρα θέλετε να διαγράψετε αυτό το επίπεδο;',
    );
    if (!ok) return;

    const { error } = await supabase.from('levels').delete().eq('id', id);

    if (error) {
      console.error(error);
      setError('Αποτυχία διαγραφής επιπέδου.');
      return;
    }

    setLevels((prev) => prev.filter((lvl) => lvl.id !== id));
  };

  // 🔍 Filter levels by name
  const filteredLevels = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return levels;
    return levels.filter((lvl) => normalizeText(lvl.name).includes(q));
  }, [levels, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-50">
            Επίπεδα
          </h1>
          <p className="text-xs text-slate-300">
            Προσθέστε επίπεδα όπως A1, A2, B1, B2 κτλ. για το σχολείο σας.
          </p>
          {schoolId == null && (
            <p className="mt-1 text-[11px] text-amber-300">
              Δεν έχει οριστεί school_id στο προφίλ. Δεν θα γίνει αποθήκευση
              σε βάση.
            </p>
          )}

          <p className="mt-1 text-[11px] text-slate-400">
            Σύνολο επιπέδων:{' '}
            <span className="font-medium text-slate-100">
              {levels.length}
            </span>
            {search.trim() && (
              <>
                {' · '}
                <span className="text-slate-300">
                  Εμφανίζονται: {filteredLevels.length}
                </span>
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
            className="btn-primary"
            style={{ backgroundColor: 'var(--color-accent)', color: '#000' }}
          >
            Προσθήκη επιπέδου
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-500 bg-red-900/40 px-4 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

      {/* Levels table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-4 text-xs text-slate-300">
            Φόρτωση επιπέδων…
          </div>
        ) : levels.length === 0 ? (
          <div className="py-4 text-xs text-slate-300">
            Δεν υπάρχουν ακόμη επίπεδα. Πατήστε «Προσθήκη επιπέδου» για να
            δημιουργήσετε το πρώτο.
          </div>
        ) : filteredLevels.length === 0 ? (
          <div className="py-4 text-xs text-slate-300">
            Δεν βρέθηκαν επίπεδα με αυτά τα κριτήρια αναζήτησης.
          </div>
        ) : (
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-200">
                <th className="border-b border-slate-600 px-4 py-2 text-left">
                  Επίπεδο
                </th>
                <th className="border-b border-slate-600 px-4 py-2 text-right">
                  Ενέργειες
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLevels.map((lvl) => (
                <tr key={lvl.id} className="hover:bg-slate-800/40">
                  <td className="border-b border-slate-700 px-4 py-2 text-left">
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-td)' }}
                    >
                      {lvl.name}
                    </span>
                  </td>
                  <td className="border-b border-slate-700 px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(lvl.id)}
                        className="btn-ghost px-2 py-1 text-[11px]"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        Επεξεργασία
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLevel(lvl.id)}
                        className="btn-primary bg-red-600 px-2 py-1 text-[11px] hover:bg-red-700"
                      >
                        Διαγραφή
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: add / edit level */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 p-5 shadow-xl"
            style={{ background: 'var(--color-sidebar)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-50">
                {editingId == null
                  ? 'Νέο επίπεδο'
                  : 'Επεξεργασία επιπέδου'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-xs text-slate-300 hover:text-slate-100"
              >
                Κλείσιμο
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded bg-red-900/60 px-3 py-2 text-xs text-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="form-label text-slate-100">
                  Όνομα επιπέδου *
                </label>
                <input
                  className="form-input"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                  placeholder="π.χ. B2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-ghost"
                  style={{
                    background: 'var(--color-input-bg)',
                    color: 'var(--color-text-main)',
                  }}
                >
                  Ακύρωση
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
