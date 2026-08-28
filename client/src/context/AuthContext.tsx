import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './authContextBase';
import type { User } from './authContextBase';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('rcd_user');
    if (!storedUser) return null;
    try {
      return JSON.parse(storedUser) as User;
    } catch {
      localStorage.removeItem('rcd_user');
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize Supabase Auth Listener
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    // 1. Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const authUser = session.user;
          const meta = authUser.user_metadata || {};
          
          // Try to fetch profile from public.profiles
          let profileName = meta.full_name || meta.name || authUser.email?.split('@')[0] || 'User';
          let profileRole = meta.role || 'Collector';

          try {
            const { data: profile } = await supabase
              .from('rcd_profiles')
              .select('*')
              .eq('id', authUser.id)
              .single();
            if (profile) {
              profileName = profile.full_name || profileName;
              profileRole = profile.role || profileRole;
            }
          } catch (err) {
            console.warn('Profile fetch error:', err);
          }

          const userData: User = {
            id: authUser.id,
            email: authUser.email || '',
            name: profileName,
            role: profileRole,
          };
          setUser(userData);
          localStorage.setItem('rcd_user', JSON.stringify(userData));
        } else {
          // If no supabase session, clear if it was a supabase user
          if (user?.id) {
            setUser(null);
            localStorage.removeItem('rcd_user');
          }
        }
      } catch (error) {
        console.error('Supabase session retrieval error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // 2. Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const authUser = session.user;
        const meta = authUser.user_metadata || {};
        
        let profileName = meta.full_name || meta.name || authUser.email?.split('@')[0] || 'User';
        let profileRole = meta.role || 'Collector';

        try {
          const { data: profile } = await supabase
            .from('rcd_profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
          if (profile) {
            profileName = profile.full_name || profileName;
            profileRole = profile.role || profileRole;
          }
        } catch {
          // Ignore
        }

        const userData: User = {
          id: authUser.id,
          email: authUser.email || '',
          name: profileName,
          role: profileRole,
        };
        setUser(userData);
        localStorage.setItem('rcd_user', JSON.stringify(userData));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('rcd_user');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('rcd_user', JSON.stringify(userData));
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured()) {
      // Offline / Local Demo mode
      const mockUser: User = {
        id: 'local-demo-user',
        email,
        name: email.split('@')[0] || 'User',
        role: 'Collector',
      };
      login(mockUser);
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const meta = data.user.user_metadata || {};
        const userData: User = {
          id: data.user.id,
          email: data.user.email || email,
          name: meta.full_name || meta.name || email.split('@')[0],
          role: meta.role || 'Collector',
        };
        login(userData);
        return { success: true };
      }

      return { success: false, error: 'Sign in failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'An unexpected error occurred' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (!isSupabaseConfigured()) {
      const mockUser: User = {
        id: 'local-demo-user',
        email,
        name: fullName || email.split('@')[0],
        role: role || 'Collector',
      };
      login(mockUser);
      return { success: true, message: 'Account created in demo mode' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role || 'Collector',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // If session was returned immediately (email confirmation turned off in Supabase)
        if (data.session) {
          const userData: User = {
            id: data.user.id,
            email: data.user.email || email,
            name: fullName,
            role: role || 'Collector',
          };
          login(userData);
          return { success: true, message: 'Account created and signed in successfully!' };
        } else {
          return {
            success: true,
            message: 'Registration successful! Please check your email to confirm your account, or sign in.',
          };
        }
      }

      return { success: false, error: 'Registration failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'An unexpected error occurred during signup' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Error signing out of Supabase:', err);
      }
    }
    setUser(null);
    localStorage.removeItem('rcd_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, signIn, signUp, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
