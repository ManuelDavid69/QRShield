import { useEffect, useState } from "react";
import * as Location from "expo-location";

import BarList from "@/components/BarList";
import type { UserStats } from "@/services/api";

interface PlaceListProps {
  places: UserStats["places"];
}

export default function PlaceList({ places }: PlaceListProps) {
  const [names, setNames] = useState<Record<number, string>>({});

  // Le nom du lieu est résolu sur le téléphone, le serveur n'a pas besoin de le connaître
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      const resolved: Record<number, string> = {};
      for (const [index, place] of places.entries()) {
        try {
          const [address] = await Location.reverseGeocodeAsync({
            latitude: place.latitude,
            longitude: place.longitude,
          });
          const name = address?.city ?? address?.district ?? address?.subregion ?? null;
          if (name !== null && name.length > 0) resolved[index] = name;
        } catch {
          // En cas d'échec le repli « Lieu n » suffit
        }
      }
      if (!cancelled) setNames(resolved);
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [places]);

  if (places.length === 0) return null;

  const rows = places.map((place, index) => ({
    key: String(index),
    label: names[index] ?? `Lieu ${index + 1}`,
    count: place.count,
  }));

  return <BarList title="Lieux où vous scannez le plus" rows={rows} />;
}
