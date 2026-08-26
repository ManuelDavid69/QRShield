// Il n'y a pas de coffre-fort dans un navigateur : cette version ne sert qu'aux tests E2E,
// l'application sur téléphone utilise expo-secure-store (voir tokenStorage.ts)
const TOKEN_KEY = "qrshield.access_token";
const REFRESH_KEY = "qrshield.refresh_token";

export async function loadToken(): Promise<string | null> {
  return window.localStorage.getItem(TOKEN_KEY);
}

export async function loadRefreshToken(): Promise<string | null> {
  return window.localStorage.getItem(REFRESH_KEY);
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  window.localStorage.setItem(TOKEN_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
}

export async function loadValue(key: string): Promise<string | null> {
  return window.localStorage.getItem(key);
}

export async function saveValue(key: string, value: string): Promise<void> {
  window.localStorage.setItem(key, value);
}

export async function deleteTokens(): Promise<void> {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
