const TOKEN_KEY = "openclaw.dashboard.token";
const GATEWAY_URL_KEY = "openclaw.dashboard.gateway-url";

export function loadStoredToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export function storeToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!token.trim()) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token.trim());
}

export function loadStoredGatewayUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(GATEWAY_URL_KEY) ?? "";
}

export function storeGatewayUrl(url: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!url.trim()) {
    window.localStorage.removeItem(GATEWAY_URL_KEY);
    return;
  }
  window.localStorage.setItem(GATEWAY_URL_KEY, url.trim());
}
