type GatewayRequest = <T = unknown>(method: string, params?: unknown) => Promise<T>;

export type SessionSummary = {
  key: string;
  agentId?: string;
  createdAt?: number;
  lastActiveAt?: number;
  messageCount?: number;
};

export type SessionsListResult = {
  count: number;
  sessions: SessionSummary[];
};

export async function loadSessions(
  request: GatewayRequest,
  opts?: { limit?: number; offset?: number },
): Promise<SessionsListResult> {
  const result = await request<SessionsListResult>("sessions.list", {
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
  });
  return result ?? { count: 0, sessions: [] };
}
