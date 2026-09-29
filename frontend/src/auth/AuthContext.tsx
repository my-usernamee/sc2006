/**
 * Holds the logged-in user for the whole app.
 * On start-up it checks whether the saved token still works; if it does not,
 * the user is simply treated as logged out.
 */
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { authApi } from '../api';
import { getToken, setToken } from '../api/client';
import { Account } from '../types';

interface AuthValue {
  user: Account | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    telegramUsername: string;
  }) => Promise<void>;
  logout: () => void;
  setUser: (user: Account) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => setToken(null)) // expired or invalid token
      .finally(() => setLoading(false));
  }, []);

  const login: AuthValue['login'] = async (email, password) => {
    const { token, user } = await authApi.login({ email, password });
    setToken(token);
    setUser(user);
  };

  const register: AuthValue['register'] = async (input) => {
    const { token, user } = await authApi.register(input);
    setToken(token);
    setUser(user);
  };

  // REQ-8: logging out just discards the token.
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
