const KEYS = {
  gatewayUrl: "openclaw:gatewayUrl",
  ttsUrl: "openclaw:ttsUrl",
  onboardingComplete: "openclaw:onboardingComplete",
} as const;

const SECRET_TOKEN_KEY = "openclaw:token";

const DEFAULTS = {
  gatewayUrl: "wss://127.0.0.1:9443",
  token: "",
  ttsUrl: "http://127.0.0.1:4123/v1",
};

function getBridge() {
  return window.openclawBridge;
}

export type StoredConfig = {
  gatewayUrl: string;
  token: string;
  ttsUrl: string;
};

// Token is loaded async; cache it in memory once loaded
let cachedToken: string | null = null;

/** Initialize token from safeStorage (call at startup) */
export async function initTokenCache(): Promise<void> {
  const bridge = getBridge();
  try {
    // Migrate from localStorage if present
    const localToken = localStorage.getItem("openclaw:token");
    if (localToken) {
      await bridge.secretsSet(SECRET_TOKEN_KEY, localToken);
      localStorage.removeItem("openclaw:token");
      cachedToken = localToken;
      return;
    }
    cachedToken = await bridge.secretsGet(SECRET_TOKEN_KEY) ?? null;
  } catch {
    cachedToken = null;
  }
}

export function getStoredConfig(): StoredConfig {
  return {
    gatewayUrl: localStorage.getItem(KEYS.gatewayUrl) ?? DEFAULTS.gatewayUrl,
    token: cachedToken ?? DEFAULTS.token,
    ttsUrl: localStorage.getItem(KEYS.ttsUrl) ?? DEFAULTS.ttsUrl,
  };
}

export function saveStoredConfig(config: Partial<StoredConfig>): void {
  if (config.gatewayUrl !== undefined) {localStorage.setItem(KEYS.gatewayUrl, config.gatewayUrl);}
  if (config.ttsUrl !== undefined) {localStorage.setItem(KEYS.ttsUrl, config.ttsUrl);}
  if (config.token !== undefined) {
    cachedToken = config.token;
    const bridge = getBridge();
    bridge.secretsSet(SECRET_TOKEN_KEY, config.token).catch(() => {
      console.warn("config-store: failed to persist token to safeStorage");
    });
  }
}

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(KEYS.onboardingComplete) === "true";
}

export function setOnboardingComplete(value: boolean): void {
  localStorage.setItem(KEYS.onboardingComplete, value ? "true" : "false");
}
