import { createContext } from 'react';

export interface User {
  id?: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
