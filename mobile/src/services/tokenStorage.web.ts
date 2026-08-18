// Il n'y a pas de coffre-fort dans un navigateur : cette version ne sert qu'aux tests E2E,
// l'application sur téléphone utilise expo-secure-store (voir tokenStorage.ts)
const TOKEN_KEY = "qrshield.access_token";

export async function loadToken(): Promise<string | null> {
  return window.localStorage.getItem(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export async function deleteToken(): Promise<void> {
  window.localStorage.removeItem(TOKEN_KEY);
}
