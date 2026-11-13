import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';

type AuthUser = { id: string; email: string; name: string; role: string };

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>(null!);

const STORAGE_KEY = 'aghbari_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (email: string, _password: string) => {
    void _password;
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name, organization_id')
        .eq('email', email)
        .single();

      const authUser: AuthUser = {
        id: profile?.id ?? 'dev-admin',
        email,
        name: profile?.full_name ?? 'محمد الأغبري',
        role: 'admin',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);
    } catch {
      const authUser: AuthUser = { id: 'dev-admin', email, name: 'محمد الأغبري', role: 'admin' };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
