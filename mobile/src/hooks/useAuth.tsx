import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { login, register } from "@/services/api";
import { deleteToken, loadToken, saveToken } from "@/services/tokenStorage";

interface AuthState {
  token: string | null;
  // false tant que le token n'a pas été relu : évite d'afficher la connexion une fraction de seconde
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadToken()
      .then(setToken)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const accessToken = await login(email, password);
    await saveToken(accessToken);
    setToken(accessToken);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string) => {
      await register(email, password);
      await signIn(email, password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    await deleteToken();
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({ token, ready, signIn, signUp, signOut }),
    [token, ready, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
}
