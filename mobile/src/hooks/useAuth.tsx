import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { login, logout, onSessionRefreshed, register } from "@/services/api";
import { deleteTokens, loadRefreshToken, loadToken, saveTokens } from "@/services/tokenStorage";

interface AuthState {
  token: string | null;
  // false tant que le token n'a pas été relu : évite d'afficher la connexion une fraction de seconde
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Code de secours à montrer une seule fois, juste après sa création
  recoveryCode: string | null;
  showRecoveryCode: (code: string) => void;
  dismissRecoveryCode: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    onSessionRefreshed(setToken);
    loadToken()
      .then(setToken)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const tokens = await login(email, password);
    await saveTokens(tokens.access_token, tokens.refresh_token);
    setToken(tokens.access_token);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string) => {
      const { recovery_code: code } = await register(email, password);
      await signIn(email, password);
      setRecoveryCode(code);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await loadRefreshToken();
    await deleteTokens();
    setToken(null);
    // Coupe aussi la session côté serveur ; sans réseau, le jeton expirera tout seul
    if (refreshToken !== null) void logout(refreshToken).catch(() => undefined);
  }, []);

  const dismissRecoveryCode = useCallback(() => setRecoveryCode(null), []);

  const value = useMemo(
    () => ({
      token,
      ready,
      signIn,
      signUp,
      signOut,
      recoveryCode,
      showRecoveryCode: setRecoveryCode,
      dismissRecoveryCode,
    }),
    [token, ready, signIn, signUp, signOut, recoveryCode, dismissRecoveryCode],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
}
