type DeviceAuthEntry = {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
};

type DeviceAuthStore = {
  version: 1;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
};

const STORAGE_KEY = "openclaw.device.auth.v1";

function getBridge() {
  return window.openclawBridge;
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase() || "operator";
}

// Synchronous read from in-memory cache (populated on init)
let cachedStore: DeviceAuthStore | null = null;

/** Initialize cache from safeStorage (call once at startup) */
export async function initDeviceAuthCache(): Promise<void> {
  const bridge = getBridge();
  try {
    // Try safeStorage first, then migrate from localStorage
    const raw = await bridge.secretsGet(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeviceAuthStore;
      if (parsed?.version === 1 && parsed.deviceId && parsed.tokens) {
        cachedStore = parsed;
        // Migrate from localStorage to safeStorage
        if (localStorage.getItem(STORAGE_KEY)) {
          await bridge.secretsSet(STORAGE_KEY, JSON.stringify(parsed));
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  } catch {
    // best-effort
  }
}

function writeStore(store: DeviceAuthStore) {
  cachedStore = store;
  const bridge = getBridge();
  // Fire-and-forget async write to safeStorage
  bridge.secretsSet(STORAGE_KEY, JSON.stringify(store)).catch(() => {
    console.warn("device-auth: failed to persist to safeStorage");
  });
}

export function loadDeviceAuthToken(params: {
  deviceId: string;
  role: string;
}): DeviceAuthEntry | null {
  if (!cachedStore || cachedStore.deviceId !== params.deviceId) {return null;}
  const role = normalizeRole(params.role);
  const entry = cachedStore.tokens[role];
  if (!entry || typeof entry.token !== "string") {return null;}
  return entry;
}

export function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): void {
  const role = normalizeRole(params.role);
  const next: DeviceAuthStore = {
    version: 1,
    deviceId: params.deviceId,
    tokens: {},
  };
  if (cachedStore && cachedStore.deviceId === params.deviceId) {
    next.tokens = { ...cachedStore.tokens };
  }
  next.tokens[role] = {
    token: params.token,
    role,
    scopes: params.scopes ?? [],
    updatedAtMs: Date.now(),
  };
  writeStore(next);
}
