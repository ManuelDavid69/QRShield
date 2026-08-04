// 3 décimales font environ 100 mètres : assez pour retrouver un quartier ou un lieu
// habituel, sans enregistrer l'adresse exacte de l'utilisateur
export function coarsenCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}
