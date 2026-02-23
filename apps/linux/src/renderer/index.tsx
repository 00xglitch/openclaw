import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { initTokenCache } from "./lib/config-store.js";
import { initDeviceAuthCache } from "./lib/device-auth.js";
import "./styles/globals.css";

// Initialize encrypted secret caches before rendering
Promise.all([initTokenCache(), initDeviceAuthCache()]).then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
