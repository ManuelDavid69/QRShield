import * as Location from "expo-location";

import type { ScanPosition } from "@/services/api";
import { coarsenCoordinate } from "@/utils/position";

const MAX_AGE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 2500;

async function currentPosition(): Promise<Location.LocationObject | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    timeout,
  ]);
}

// La position est facultative : un refus ou un GPS lent ne doit jamais bloquer l'analyse
export async function getScanPosition({ ask = true } = {}): Promise<ScanPosition | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    const granted =
      permission.granted ||
      (ask && permission.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
    if (!granted) return null;

    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })) ?? (await currentPosition());
    if (position === null) return null;

    return {
      latitude: coarsenCoordinate(position.coords.latitude),
      longitude: coarsenCoordinate(position.coords.longitude),
    };
  } catch {
    return null;
  }
}
