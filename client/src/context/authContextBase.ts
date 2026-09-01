import { createContext } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  position?: string;
}

export interface SignInResult {
  success: boolean;
  error?: string;
  isDepartmentRestricted?: boolean;
  userDepartment?: string;
  userName?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

