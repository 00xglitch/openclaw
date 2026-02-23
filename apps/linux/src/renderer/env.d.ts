/// <reference types="vite/client" />

import type { OpenClawBridge } from "../preload/preload.js";

declare global {
  interface Window {
    openclawBridge: OpenClawBridge;
  }
}
