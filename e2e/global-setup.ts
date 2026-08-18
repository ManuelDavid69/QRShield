import { execSync } from "node:child_process";

import { API_URL } from "./playwright.config";

function compose(command: string) {
  execSync(`wsl.exe -e sh -c "cd /mnt/d/Portfolio/QRShield && docker compose ${command}"`, { stdio: "ignore" });
}

// Redémarre l'API pour repartir de compteurs de limitation de débit à zéro
export default async function globalSetup() {
  compose("restart backend");

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    if (health?.ok) {
      // La fonction renvoyée est lancée à la fin : elle retire les comptes créés par les tests
      return () =>
        compose("exec -T db psql -U qrshield -d qrshield -c \\\"delete from users where email like 'e2e-%'\\\"");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("L'API ne répond pas : lancer docker compose up -d");
}
