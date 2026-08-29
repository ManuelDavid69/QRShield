import { defineConfig } from "@playwright/test";

export const API_URL = "http://127.0.0.1:8000";

// Les tests se suivent et partagent la vraie base : pas de parallélisme
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  globalSetup: "./global-setup.ts",
  use: {
    // Edge est déjà présent sous Windows : aucun navigateur à télécharger
    channel: "msedge",
    locale: "en-US",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [
    { name: "api", testMatch: "api.spec.ts" },
    { name: "web", testMatch: "web.spec.ts", use: { baseURL: "http://localhost:8080" } },
    { name: "mobile", testMatch: "mobile.spec.ts", use: { baseURL: "http://localhost:8082" } },
  ],
  webServer: {
    command: "npx expo start --web --port 8082",
    cwd: "../mobile",
    url: "http://localhost:8082",
    reuseExistingServer: true,
    timeout: 180_000,
    env: { CI: "1", EXPO_PUBLIC_API_URL: API_URL },
  },
});
