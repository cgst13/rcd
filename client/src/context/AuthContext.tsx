import React, { useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../services/googleSheets';
import { AuthContext } from './authContextBase';

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
  const isLoading = false;

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('rcd_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('rcd_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
