import { createContext, useContext, useEffect, useState } from 'react';
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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session & profile on first load
  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (ignore) return;

      setUser(user ?? null);

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, school_id')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading profile', error);
          setProfile(null);
        } else {
          setProfile(data as Profile | null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    loadUser();

    // Listen to auth changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (!session?.user) {
        setProfile(null);
      } else {
        // Reload profile when needed
        supabase
          .from('profiles')
          .select('id, full_name, role, school_id')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error('Error loading profile', error);
              setProfile(null);
            } else {
              setProfile(data as Profile | null);
            }
          });
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
