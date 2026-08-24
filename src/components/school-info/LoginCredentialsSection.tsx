import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth';
import { useToast } from '../../context/ToastContext';
import { KeyRound, Mail, Loader2, Pencil, X, Eye, EyeOff } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;

export default function LoginCredentialsSection() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Seeded from the persisted profiles.plaintext_password (set at signup, or by a
  // previous change below), then kept in sync locally after a successful change.
  // RLS restricts that column to the row owner, so only this account can ever see it.
  const [lastSetPassword, setLastSetPassword] = useState<string | null>(profile?.plaintext_password ?? null);
  const [revealLastPw, setRevealLastPw] = useState(false);

  const resetForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPw(false);
    setError(null);
  };

  const handleCancel = () => {
    resetForm();
    setEditing(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Ο κωδικός πρέπει να έχει τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Οι κωδικοί δεν ταιριάζουν.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      if (user) {
        await supabase.from('profiles').update({ plaintext_password: newPassword }).eq('id', user.id);
      }
      showToast('Ο κωδικός άλλαξε με επιτυχία.');
      setLastSetPassword(newPassword);
      setRevealLastPw(false);
      resetForm();
      setEditing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message === 'New password should be different from the old password.'
        ? 'Ο νέος κωδικός πρέπει να διαφέρει από τον παλιό.'
        : 'Αποτυχία αλλαγής κωδικού. Δοκιμάστε ξανά.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>Στοιχεία Σύνδεσης</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>Email σύνδεσης και κωδικός πρόσβασης</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Αλλαγή Κωδικού
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email — always read-only, this is the login identifier */}
        <div>
          <label className="form-label">
            <Mail className="mr-1.5 inline-block h-3.5 w-3.5 opacity-60" />
            Email Σύνδεσης
          </label>
          <p className="text-sm" style={{ color: 'var(--color-text-main)' }}>{user?.email ?? '—'}</p>
        </div>

        {/* Password — persisted on profiles.plaintext_password, readable only by this account (RLS) */}
        {!editing && lastSetPassword && (
          <div>
            <label className="form-label">
              <KeyRound className="mr-1.5 inline-block h-3.5 w-3.5 opacity-60" />
              Κωδικός
            </label>
            <div className="flex items-center gap-2">
              <p className="text-sm tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                {revealLastPw ? lastSetPassword : '•'.repeat(lastSetPassword.length)}
              </p>
              <button
                type="button"
                onClick={() => setRevealLastPw((v) => !v)}
                className="opacity-60 transition hover:opacity-100"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={revealLastPw ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
              >
                {revealLastPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
              Ορατός μόνο σε εσάς.
            </p>
          </div>
        )}

        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">
                <KeyRound className="mr-1.5 inline-block h-3.5 w-3.5 opacity-60" />
                Νέος Κωδικός
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Τουλάχιστον 6 χαρακτήρες"
                  className="form-input pr-10"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-60 transition hover:opacity-100"
                  style={{ color: 'var(--color-text-muted)' }}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">
                <KeyRound className="mr-1.5 inline-block h-3.5 w-3.5 opacity-60" />
                Επιβεβαίωση Κωδικού
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Επανάληψη κωδικού"
                className="form-input"
                required
              />
            </div>
          </div>
        )}

        {editing && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="btn-ghost flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Αποθήκευση...</>
              ) : (
                <><Pencil className="h-3.5 w-3.5" />Αλλαγή Κωδικού</>
              )}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
