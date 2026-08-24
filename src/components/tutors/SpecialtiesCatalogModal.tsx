import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Tags, X, Plus, Trash2, Loader2 } from 'lucide-react';
import type { SpecialtyRow } from './types';

type SpecialtiesCatalogModalProps = {
  open: boolean;
  schoolId: string | null;
  specialties: SpecialtyRow[];
  isDark: boolean;
  onClose: () => void;
  onCreated: (row: SpecialtyRow) => void;
  onDeleted: (id: string) => void;
};

export default function SpecialtiesCatalogModal({
  open, schoolId, specialties, isDark, onClose, onCreated, onDeleted,
}: SpecialtiesCatalogModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const modalCardCls = isDark
    ? 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl'
    : 'relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 shadow-2xl';

  const inputCls = isDark
    ? 'h-10 flex-1 rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30'
    : 'h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[color:var(--color-accent)] focus:ring-1 focus:ring-[color:var(--color-accent)]/30';

  const rowCls = isDark
    ? 'flex items-center justify-between gap-2 rounded-xl border border-slate-800/70 bg-slate-900/30 px-3 py-2'
    : 'flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2';

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !schoolId) return;
    if (specialties.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Η ειδικότητα υπάρχει ήδη.');
      return;
    }
    setSaving(true); setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from('specialties').insert({ school_id: schoolId, name: trimmed }).select('*').maybeSingle();
      if (insErr || !data) throw insErr ?? new Error('Insert failed');
      onCreated(data as SpecialtyRow);
      setName('');
    } catch (err) {
      console.error(err);
      setError('Αποτυχία προσθήκης ειδικότητας.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id); setError(null);
    try {
      const { error: delErr } = await supabase.from('specialties').delete().eq('id', id);
      if (delErr) throw delErr;
      onDeleted(id);
    } catch (err) {
      console.error(err);
      setError('Αποτυχία διαγραφής ειδικότητας.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={modalCardCls} style={{ background: 'var(--color-sidebar)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <Tags className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Ειδικότητες</h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ch-text-muted)' }}>Λίστα ειδικοτήτων σχολείου</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
          </div>
        )}

        <div className="px-6 py-4">
          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. Μαθηματικά, IB, Φυσική"
              className={inputCls}
              autoFocus
            />
            <button type="submit" disabled={saving || !name.trim()}
              className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center p-0 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
            {specialties.length === 0 ? (
              <p className={`py-6 text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Δεν υπάρχουν ακόμη ειδικότητες.
              </p>
            ) : (
              specialties.map((s) => (
                <div key={s.id} className={rowCls}>
                  <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.name}</span>
                  <button type="button" onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-lg transition disabled:opacity-50 ${
                      isDark ? 'text-slate-500 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                    }`}>
                    {deletingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
