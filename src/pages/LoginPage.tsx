import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // If already logged in, go to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });

    setPending(false);

    if (error) {
      console.error('Login error', error);
      setError(error.message || 'Failed to login');
      return;
    }

    if (data.user) {
      navigate('/dashboard', { replace: true });
    }
  };

     return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        // diagonal gradient: light (top-left) → dark (bottom-right)
        background:
          'linear-gradient(135deg, #4b5c70 0%, #253649 45%, #020617 100%)',
      }}
    >
      {/* outer gradient border */}
      <div className="login-card w-full max-w-md">
        {/* inner transparent card */}
        <div className="login-card-inner">
          <h1 className="text-xl font-semibold text-center text-slate-50">
            Tutor Admin
          </h1>
          <p className="mt-2 mb-6 text-center text-xs text-slate-300">
            Σύνδεση διαχειριστή φροντιστηρίου
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/60 bg-red-900/70 px-3 py-2 text-xs text-red-100">
              {error}
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
                className="form-input"
                style={{
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-main)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full mt-2"
            >
              {pending ? 'Σύνδεση…' : 'Σύνδεση'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
