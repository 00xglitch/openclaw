type GatewayRequest = <T = unknown>(method: string, params?: unknown) => Promise<T>;

export type PresenceEntry = {
  key: string;
  mode?: string;
  connectedAt?: number;
  lastActiveAt?: number;
  clientVersion?: string;
};

export async function loadPresence(request: GatewayRequest): Promise<PresenceEntry[]> {
  const result = await request<PresenceEntry[]>("system-presence");
  return Array.isArray(result) ? result : [];
}
