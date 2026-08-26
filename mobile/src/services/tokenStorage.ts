import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "qrshield.access_token";
const REFRESH_KEY = "qrshield.refresh_token";

// SecureStore s'appuie sur le Keystore Android et le Keychain iOS. AsyncStorage
// stockerait le token en clair, lisible sur un téléphone rooté ou dans une sauvegarde.
export function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export function loadValue(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export function saveValue(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value);
}

export async function deleteTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
