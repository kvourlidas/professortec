import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

type Role = 'super_admin' | 'school_owner' | 'teacher' | 'student';
export type AccountType = 'frontistirio' | 'idiaiterou';

export type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  school_id: string | null;
  account_type: AccountType;
  plaintext_password: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;

  authError: string | null;
  clearAuthError: () => void;

  signInWeb: (email: string, password: string) => Promise<boolean>;
  signUpWeb: (email: string, password: string, fullName: string, accountType: AccountType) => Promise<'ok' | 'confirm_email' | 'error'>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BOOT_TIMEOUT_MS = 8000;

// Last known-good profile, cached per user so a reload can render immediately
// from disk while the network revalidation happens in the background.
const PROFILE_CACHE_KEY = 'pt_web_profile_v1';

function readCachedProfile(): { userId: string; profile: Profile } | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; profile?: Profile };
    if (!parsed?.userId || !parsed?.profile) return null;
    return { userId: parsed.userId, profile: parsed.profile };
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, profile: Profile | null) {
  try {
    if (!profile) localStorage.removeItem(PROFILE_CACHE_KEY);
    else localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ userId, profile }));
  } catch {
    /* ignore */
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Optimistically seed from the cached profile so a reload with a still-valid
  // local session paints the real UI right away instead of a full-screen spinner.
  const cached = readCachedProfile();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(cached?.profile ?? null);
  const [loading, setLoading] = useState(!cached);

  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = () => setAuthError(null);

  const WEB_ALLOWED_ROLES: Role[] = ['super_admin', 'school_owner', 'teacher'];
  const isWebAllowed = (p: Profile | null) => Boolean(p?.role && WEB_ALLOWED_ROLES.includes(p.role));

  const hydratingRef = useRef(false);

  const clearState = () => {
    setUser(null);
    setProfile(null);
    writeCachedProfile('', null);
  };

  const hardSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      clearState();
    }
  };

  const hydrateFromUser = async (u: User | null): Promise<boolean> => {
    if (!u) {
      clearState();
      return false;
    }

    const { data: pData, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, role, school_id, account_type, plaintext_password')
      .eq('id', u.id)
      .maybeSingle();

    if (pErr) {
      console.error('Error loading profile', pErr);
      await hardSignOut();
      return false;
    }

    const p = pData as Profile | null;

    if (!isWebAllowed(p)) {
      await hardSignOut();
      return false;
    }

    setUser(u);
    setProfile(p);
    writeCachedProfile(u.id, p);
    return true;
  };

  const signInWeb = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setAuthError('Λάθος στοιχεία σύνδεσης.');
      return false;
    }

    try {
      const ok = await withTimeout(hydrateFromUser(data.user), BOOT_TIMEOUT_MS, 'hydrateFromUser');
      if (!ok) {
        setAuthError('Λάθος στοιχεία σύνδεσης.');
        return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      setAuthError('Πρόβλημα σύνδεσης. Δοκίμασε ξανά.');
      await hardSignOut();
      return false;
    }
  };

  const signUpWeb = async (
    email: string,
    password: string,
    fullName: string,
    accountType: AccountType,
  ): Promise<'ok' | 'confirm_email' | 'error'> => {
    setAuthError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, account_type: accountType } },
    });

    if (error || !data.user) {
      setAuthError(error?.message ?? 'Πρόβλημα εγγραφής. Δοκίμασε ξανά.');
      return 'error';
    }

    // No session means email confirmation is required
    if (!data.session) return 'confirm_email';

    // Best-effort: let the user see the password they just chose on their own
    // info page later. RLS restricts this column to the row owner only.
    try {
      await supabase.from('profiles').update({ plaintext_password: password }).eq('id', data.user.id);
    } catch (e) {
      console.error('Failed to store plaintext_password on signup', e);
    }

    try {
      const ok = await withTimeout(hydrateFromUser(data.user), BOOT_TIMEOUT_MS, 'hydrateFromUser');
      if (!ok) {
        setAuthError('Πρόβλημα εγγραφής. Δοκίμασε ξανά.');
        return 'error';
      }
      return 'ok';
    } catch (e) {
      console.error(e);
      setAuthError('Πρόβλημα σύνδεσης. Δοκίμασε ξανά.');
      await hardSignOut();
      return 'error';
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setAuthError('Πρόβλημα σύνδεσης με Google. Δοκίμασε ξανά.');
  };

  useEffect(() => {
    let ignore = false;
    let firstEvent = true;

    // onAuthStateChange fires INITIAL_SESSION immediately on registration with the
    // locally cached session — no extra getSession() call needed. This prevents the
    // double profile query (and potential double token refresh) that occurred when
    // getSession() and onAuthStateChange both triggered hydrateFromUser concurrently.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (ignore) return;

      // Token refresh only rotates the JWT — profile is unchanged, just update the user object silently
      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) setUser(session.user);
        return;
      }

      if (hydratingRef.current) return;
      hydratingRef.current = true;

      // On the very first event after a reload, if we already have a cached
      // profile for this same user we can revalidate silently — the UI is
      // already usable and shouldn't flash a spinner. Any other case (sign in,
      // sign out, different user, no cache) blocks with the loading screen.
      const silent =
        firstEvent &&
        !!cached &&
        !!session?.user &&
        session.user.id === cached.userId;
      firstEvent = false;

      try {
        if (silent && session?.user) {
          // Keep the app usable (and offline-tolerant) while revalidating.
          setUser(session.user);
        } else {
          setLoading(true);
        }
        await withTimeout(hydrateFromUser(session?.user ?? null), BOOT_TIMEOUT_MS, 'hydrateFromUser');
      } catch (e) {
        console.error('Auth state change hydrate failed:', e);
        if (!silent) clearState();
      } finally {
        hydratingRef.current = false;
        if (!ignore) setLoading(false);
      }
    });

    return () => {
      ignore = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await hardSignOut();
  };

  // Deliberately does NOT use the `user` state captured in this closure: a caller
  // that started running before `user` was set (e.g. the signup form's submit
  // handler, invoked while `user` was still null) would otherwise be stuck with
  // a permanently-stale closure whose `if (!user) return;` guard always no-ops,
  // even though the user has since signed in. Fetching the session fresh here
  // makes refreshProfile correct regardless of when it's called.
  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    await hydrateFromUser(currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        clearAuthError,
        signInWeb,
        signUpWeb,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
