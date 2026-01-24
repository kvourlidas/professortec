// src/pages/LoginPage.tsx
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function LoginPage() {
  const navigate = useNavigate();

  // ✅ use the new web-only sign in + shared authError
  const { user, signInWeb, authError, clearAuthError } = useAuth();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pending, setPending] = useState(false);

  // If already logged in, go to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // clear the auth error when user edits fields
  useEffect(() => {
    if (authError) clearAuthError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, pw]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearAuthError();
    setPending(true);

    const ok = await signInWeb(email.trim(), pw);

    setPending(false);

    // if student (or wrong creds), signInWeb returns false and sets authError
    if (!ok) return;

    navigate('/dashboard', { replace: true });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'linear-gradient(135deg, #4b5c70 0%, #253649 45%, #020617 100%)',
      }}
    >
      <div className="login-card w-full max-w-md">
        <div className="login-card-inner">
          <h1 className="text-xl font-semibold text-center text-slate-50">Tutor Admin</h1>
          <p className="mt-2 mb-6 text-center text-xs text-slate-300">
            Σύνδεση διαχειριστή φροντιστηρίου
          </p>

          {authError && (
            <div className="mb-4 rounded-lg border border-red-500/60 bg-red-900/70 px-3 py-2 text-xs text-red-100">
              {authError}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="form-label text-slate-100">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="form-input"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              />
            </div>

            <div>
              <label className="form-label text-slate-100">Κωδικός</label>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                autoComplete="current-password"
                className="form-input"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              />
            </div>

            <button type="submit" disabled={pending} className="btn-primary w-full mt-2">
              {pending ? 'Σύνδεση…' : 'Σύνδεση'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
