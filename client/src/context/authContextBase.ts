import { createContext } from 'react';

export interface AuthContextType {
  user: { email: string; name: string; role: string } | null;
  login: (user: { email: string; name: string; role: string }) => void;
  logout: () => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
