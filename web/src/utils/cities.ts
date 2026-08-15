export interface City {
  name: string;
  latitude: number;
  longitude: number;
}

export const CITIES: City[] = [
  { name: "Paris", latitude: 48.8566, longitude: 2.3522 },
  { name: "Marseille", latitude: 43.2965, longitude: 5.3698 },
  { name: "Lyon", latitude: 45.764, longitude: 4.8357 },
  { name: "Toulouse", latitude: 43.6047, longitude: 1.4442 },
  { name: "Nice", latitude: 43.7102, longitude: 7.262 },
  { name: "Nantes", latitude: 47.2184, longitude: -1.5536 },
  { name: "Montpellier", latitude: 43.6108, longitude: 3.8767 },
  { name: "Strasbourg", latitude: 48.5734, longitude: 7.7521 },
  { name: "Bordeaux", latitude: 44.8378, longitude: -0.5792 },
  { name: "Lille", latitude: 50.6292, longitude: 3.0573 },
  { name: "Rennes", latitude: 48.1173, longitude: -1.6778 },
  { name: "Reims", latitude: 49.2583, longitude: 4.0317 },
  { name: "Toulon", latitude: 43.1242, longitude: 5.928 },
  { name: "Saint-Étienne", latitude: 45.4397, longitude: 4.3872 },
  { name: "Le Havre", latitude: 49.4944, longitude: 0.1079 },
  { name: "Grenoble", latitude: 45.1885, longitude: 5.7245 },
  { name: "Dijon", latitude: 47.322, longitude: 5.0415 },
  { name: "Angers", latitude: 47.4784, longitude: -0.5632 },
  { name: "Nîmes", latitude: 43.8367, longitude: 4.3601 },
  { name: "Villeurbanne", latitude: 45.7719, longitude: 4.8902 },
  { name: "Clermont-Ferrand", latitude: 45.7772, longitude: 3.087 },
  { name: "Le Mans", latitude: 48.0061, longitude: 0.1996 },
  { name: "Aix-en-Provence", latitude: 43.5297, longitude: 5.4474 },
  { name: "Brest", latitude: 48.3904, longitude: -4.4861 },
  { name: "Tours", latitude: 47.3941, longitude: 0.6848 },
  { name: "Amiens", latitude: 49.8941, longitude: 2.2958 },
  { name: "Limoges", latitude: 45.8336, longitude: 1.2611 },
  { name: "Annecy", latitude: 45.8992, longitude: 6.1294 },
  { name: "Perpignan", latitude: 42.6887, longitude: 2.8948 },
  { name: "Boulogne-Billancourt", latitude: 48.8352, longitude: 2.2409 },
  { name: "Metz", latitude: 49.1193, longitude: 6.1757 },
  { name: "Besançon", latitude: 47.2378, longitude: 6.0241 },
  { name: "Orléans", latitude: 47.9029, longitude: 1.9093 },
  { name: "Rouen", latitude: 49.4432, longitude: 1.0999 },
  { name: "Mulhouse", latitude: 47.7508, longitude: 7.3359 },
  { name: "Caen", latitude: 49.1829, longitude: -0.3707 },
  { name: "Nancy", latitude: 48.6921, longitude: 6.1844 },
  { name: "Argenteuil", latitude: 48.9472, longitude: 2.2467 },
  { name: "Montreuil", latitude: 48.8638, longitude: 2.4485 },
  { name: "Roubaix", latitude: 50.6942, longitude: 3.1746 },
];

const EARTH_RADIUS_KM = 6371;
const MAX_DISTANCE_KM = 30;

function distanceKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(latB - latA);
  const deltaLon = toRadians(lonB - lonA);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Le nom est calculé dans le navigateur, sans service externe.
export function nearestCity(latitude: number, longitude: number): string {
  let bestName = "";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const city of CITIES) {
    const distance = distanceKm(latitude, longitude, city.latitude, city.longitude);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestName = city.name;
    }
  }

  if (bestDistance > MAX_DISTANCE_KM) {
    return `Zone ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  }
  return bestName;
}
