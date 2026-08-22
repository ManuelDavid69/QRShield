import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "qrshield.access_token";

// SecureStore s'appuie sur le Keystore Android et le Keychain iOS. AsyncStorage
// stockerait le token en clair, lisible sur un téléphone rooté ou dans une sauvegarde.
export function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function saveToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function loadValue(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export function saveValue(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value);
}

export function deleteToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
