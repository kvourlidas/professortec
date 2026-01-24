// src/auth.tsx
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

  // Web-only sign in (blocks students BEFORE UI gets a user)
  signInWeb: (email: string, password: string) => Promise<boolean>;

  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = () => setAuthError(null);

  const WEB_ALLOWED_ROLES: Role[] = ['super_admin', 'school_owner', 'teacher'];
  const isWebAllowed = (p: Profile | null) => Boolean(p?.role && WEB_ALLOWED_ROLES.includes(p.role));

  // Prevent overlapping hydrations from causing flicker
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

  /**
   * Validates the session user against profiles role
   * and only THEN commits user/profile into state.
   */
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
      // treat as not allowed on web
      await hardSignOut();
      return false;
    }

    const p = pData as Profile | null;

    if (!isWebAllowed(p)) {
      // Student or missing profile => never allow web session
      await hardSignOut();
      return false;
    }

    // ✅ Only now we commit state (no "split second" student login)
    setUser(u);
    setProfile(p);
    return true;
  };

  // ✅ Web-only sign in
  const signInWeb = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setAuthError('Λάθος στοιχεία σύνδεσης.');
      return false;
    }

    const ok = await hydrateFromUser(data.user);
    if (!ok) {
      // show generic error (student is treated as wrong credentials)
      setAuthError('Λάθος στοιχεία σύνδεσης.');
      return false;
    }

    return true;
  };

  // First load: validate existing session WITHOUT briefly setting user
  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);

      const {
        data: { user: u },
      } = await supabase.auth.getUser();

      if (ignore) return;

      // IMPORTANT: do NOT setUser(u) here before validation
      await hydrateFromUser(u ?? null);

      if (!ignore) setLoading(false);
    };

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Avoid parallel hydrations causing UI flicker
      if (hydratingRef.current) return;
      hydratingRef.current = true;

      try {
        // IMPORTANT: do NOT setUser(session.user) before validation
        await hydrateFromUser(session?.user ?? null);
      } finally {
        hydratingRef.current = false;
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
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
