import type { BarcodeScanningResult } from "expo-camera";

// Sur Android, ML Kit met dans `data` une version "lisible" du QR code : pour un Wi-Fi
// c'est juste "ssid\nmot de passe", sans le préfixe WIFI:. Le type n'était donc plus
// détecté et le mot de passe s'affichait en clair. `raw` contient le vrai contenu.
// Sur iOS, `raw` n'existe pas et `data` est déjà le contenu brut.
export function getQrPayload(result: Pick<BarcodeScanningResult, "data" | "raw">): string {
  return result.raw ?? result.data;
}
