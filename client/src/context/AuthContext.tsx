import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './authContextBase';
import type { User, SignInResult } from './authContextBase';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

/**
 * Validates if a user's assigned department belongs to the Municipal Treasurer Office.
 * Matches official titles and variations (e.g. "Municipal Treasurer Office", "Treasury Office", "MTO").
 */
export const isMunicipalTreasurerDepartment = (department?: string | null): boolean => {
  if (!department) return false;
  const normalized = department.toLowerCase().trim();

  // Exact or common department names / codes
  if (
    normalized === 'municipal treasurer office' ||
    normalized === 'office of the municipal treasurer' ||
    normalized === "municipal treasurer's office" ||
    normalized === 'treasury office' ||
    normalized === 'treasury' ||
    normalized === 'mto' ||
    normalized === 'treasurer'
  ) {
    return true;
  }

  // Keywords check (while excluding other offices like Accounting, Budget, Assessor, etc.)
  if (
    (normalized.includes('treasurer') || normalized.includes('treasury')) &&
    !normalized.includes('accounting') &&
    !normalized.includes('budget') &&
    !normalized.includes('assessor')
  ) {
    return true;
  }

  return false;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('rcd_user');
    if (!storedUser) return null;
    try {
      const parsed = JSON.parse(storedUser) as User;
      if (!isMunicipalTreasurerDepartment(parsed.department)) {
        localStorage.removeItem('rcd_user');
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem('rcd_user');
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate and refresh user session against public.users table on load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const stored = localStorage.getItem('rcd_user');
        if (stored) {
          const parsedUser = JSON.parse(stored) as User;
          if (!isMunicipalTreasurerDepartment(parsedUser.department)) {
            setUser(null);
            localStorage.removeItem('rcd_user');
          } else if (isSupabaseConfigured() && parsedUser?.id) {
            const { data, error } = await supabase
              .from('users')
              .select('*')
              .eq('userid', parsedUser.id)
              .single();

            if (!error && data) {
              if (data.status && data.status.toLowerCase() === 'inactive') {
                setUser(null);
                localStorage.removeItem('rcd_user');
              } else if (!isMunicipalTreasurerDepartment(data.department)) {
                console.warn(`Access restricted: User ${data.email} belongs to ${data.department || 'an unauthorized department'}.`);
                setUser(null);
                localStorage.removeItem('rcd_user');
              } else {
                const refreshed: User = {
                  id: data.userid,
                  email: data.email,
                  name: `${data.firstname || ''} ${data.lastname || ''}`.trim() || data.email,
                  role: data.role || 'user',
                  department: data.department || undefined,
                  position: data.position || undefined,
                };
                setUser(refreshed);
                localStorage.setItem('rcd_user', JSON.stringify(refreshed));
              }
            }
          }
        }
      } catch (err) {
        console.warn('Session verification note:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('rcd_user', JSON.stringify(userData));
  };

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .ilike('email', cleanEmail)
          .single();

        if (error || !data) {
          // Check local fallback
          const localStored = localStorage.getItem('rcd_managed_users');
          if (localStored) {
            try {
              const localUsers: any[] = JSON.parse(localStored);
              const found = localUsers.find(u => u.email?.toLowerCase() === cleanEmail);
              if (found) {
                if (found.password !== cleanPassword) {
                  return { success: false, error: 'Invalid password. Please try again.' };
                }
                if (found.status === 'Inactive') {
                  return { success: false, error: 'Your account is deactivated. Please contact your system administrator.' };
                }
                if (!isMunicipalTreasurerDepartment(found.department)) {
                  return {
                    success: false,
                    isDepartmentRestricted: true,
                    userDepartment: found.department || 'Unassigned Department',
                    userName: found.fullName || found.email,
                    error: 'Access restricted: Only personnel from the Municipal Treasurer Office are permitted to sign in.'
                  };
                }
                const sessionUser: User = {
                  id: found.id || found.userid,
                  email: found.email,
                  name: found.fullName || `${found.firstName || ''} ${found.lastName || ''}`.trim() || found.email,
                  role: found.role || 'user',
                  department: found.department,
                  position: found.position,
                };
                login(sessionUser);
                return { success: true };
              }
            } catch {}
          }
          return { success: false, error: 'Account not found. Please verify your email address.' };
        }

        if (data.status && data.status.toLowerCase() === 'inactive') {
          return { success: false, error: 'Your account is deactivated. Please contact your system administrator.' };
        }

        if (data.password !== cleanPassword) {
          return { success: false, error: 'Invalid password. Please try again.' };
        }

        // Enforce department restriction: Only allow Municipal Treasurer Office
        if (!isMunicipalTreasurerDepartment(data.department)) {
          const userFullName = `${data.firstname || ''} ${data.lastname || ''}`.trim() || data.email;
          return {
            success: false,
            isDepartmentRestricted: true,
            userDepartment: data.department || 'Unassigned Department',
            userName: userFullName,
            error: 'Access restricted: Only personnel from the Municipal Treasurer Office are permitted to sign in.'
          };
        }

        // Update last login timestamp in public.users
        try {
          await supabase
            .from('users')
            .update({ lastlogin: new Date().toISOString() })
            .eq('userid', data.userid);
        } catch (updateErr) {
          console.warn('Last login update note:', updateErr);
        }

        const fullName = `${data.firstname || ''} ${data.lastname || ''}`.trim() || data.email;
        const sessionUser: User = {
          id: data.userid,
          email: data.email,
          name: fullName,
          role: data.role || 'user',
          department: data.department || undefined,
          position: data.position || undefined,
        };

        login(sessionUser);
        return { success: true };
      } catch (err: any) {
        console.error('Sign in error:', err);
        return { success: false, error: err.message || 'An unexpected error occurred during sign in.' };
      }
    }

    // Offline / Demo mode
    const defaultAccounts = [
      { id: 'usr-1', email: 'admin@rcd.gov.ph', password: 'admin', name: 'System Administrator', role: 'admin', department: 'Municipal Treasurer Office' },
      { id: 'usr-2', email: 'collector@rcd.gov.ph', password: 'user', name: 'Menard A. Herrera', role: 'user', department: 'Municipal Treasurer Office' },
    ];
    const match = defaultAccounts.find(a => a.email.toLowerCase() === cleanEmail && a.password === cleanPassword);
    if (match) {
      if (!isMunicipalTreasurerDepartment(match.department)) {
        return {
          success: false,
          isDepartmentRestricted: true,
          userDepartment: match.department || 'Unassigned Department',
          userName: match.name,
          error: 'Access restricted: Only personnel from the Municipal Treasurer Office are permitted to sign in.'
        };
      }
      const sessionUser: User = {
        id: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        department: match.department,
      };
      login(sessionUser);
      return { success: true };
    }

    return { success: false, error: 'Invalid email or password.' };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const parts = fullName.trim().split(' ');
    const firstName = parts[0] || 'User';
    const lastName = parts.slice(1).join(' ') || '';
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'usr_' + Date.now();

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert({
            userid: newId,
            firstname: firstName,
            lastname: lastName,
            password: password.trim(),
            role: role.toLowerCase(),
            email: cleanEmail,
            status: 'Active',
            datecreated: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        const sessionUser: User = {
          id: data.userid,
          email: data.email,
          name: `${data.firstname} ${data.lastname}`.trim(),
          role: data.role || 'user',
        };
        login(sessionUser);
        return { success: true, message: 'Account created and signed in successfully!' };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to create user account.' };
      }
    }

    const sessionUser: User = {
      id: newId,
      email: cleanEmail,
      name: fullName,
      role: role || 'user',
    };
    login(sessionUser);
    return { success: true, message: 'Account created in demo mode.' };
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .ilike('email', cleanEmail)
          .single();

        if (error || !data) {
          return { success: false, error: 'No account found with this email address.' };
        }

        return {
          success: true,
          message: 'Account verified. Please contact your system administrator to reset or update your password.'
        };
      } catch (err: any) {
        return { success: false, error: err.message || 'Error processing request.' };
      }
    }
    return { success: true, message: 'Account verified.' };
  };

  const updatePassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'No active session.' };
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ password: password.trim() })
          .eq('userid', user.id);

        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to update password.' };
      }
    }
    return { success: true };
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('rcd_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, signIn, signUp, resetPassword, updatePassword, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
