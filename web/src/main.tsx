import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App";
import { LangProvider } from "./i18n";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Élément racine introuvable");
}

createRoot(container).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
);
