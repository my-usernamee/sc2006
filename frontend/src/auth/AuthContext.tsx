/**
 * Holds the logged-in user for the whole app.
 * On start-up it checks whether the saved token still works; if it does not,
 * the user is simply treated as logged out.
 */
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { authApi } from "../api";

import { Account } from "../types";

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
  logout: () => Promise<void>;
  setUser: (user: Account) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null)) // expired or invalid token
      .finally(() => setLoading(false));
  }, []);

  const login: AuthValue["login"] = async (email, password) => {
    const { user } = await authApi.login({ email, password });

    setUser(user);
  };

  const register: AuthValue["register"] = async (input) => {
    const { user } = await authApi.register(input);

    setUser(user);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    localStorage.removeItem("foundit_token");
  };
  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener("foundit:unauthorized", expired);
    return () => window.removeEventListener("foundit:unauthorized", expired);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
