import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

type Role = 'super_admin' | 'school_owner' | 'teacher' | 'student';

type Profile = {
  id: string;
  full_name: string | null;
  role: Role;
  school_id: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;

  authError: string | null;
  clearAuthError: () => void;

  signInWeb: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BOOT_TIMEOUT_MS = 8000;

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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = () => setAuthError(null);

  const WEB_ALLOWED_ROLES: Role[] = ['super_admin', 'school_owner', 'teacher'];
  const isWebAllowed = (p: Profile | null) => Boolean(p?.role && WEB_ALLOWED_ROLES.includes(p.role));

  const hydratingRef = useRef(false);

  const clearState = () => {
    setUser(null);
    setProfile(null);
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
      .select('id, full_name, role, school_id')
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

  useEffect(() => {
    let ignore = false;

    const boot = async () => {
      setLoading(true);

      try {
        // ✅ getSession is instant if stored; getUser can cause more network dependency.
        const { data } = await withTimeout(supabase.auth.getSession(), BOOT_TIMEOUT_MS, 'getSession');
        if (ignore) return;

        const u = data.session?.user ?? null;

        // hydrate profile with timeout so loader never hangs forever
        await withTimeout(hydrateFromUser(u), BOOT_TIMEOUT_MS, 'hydrateFromUser');
      } catch (e) {
        console.error('Auth boot failed:', e);
        // do NOT keep app stuck loading
        clearState();
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (hydratingRef.current) return;
      hydratingRef.current = true;

      try {
        setLoading(true);
        await withTimeout(hydrateFromUser(session?.user ?? null), BOOT_TIMEOUT_MS, 'hydrateFromUser');
      } catch (e) {
        console.error('Auth state change hydrate failed:', e);
        clearState();
      } finally {
        hydratingRef.current = false;
        setLoading(false);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        clearAuthError,
        signInWeb,
        signOut,
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
