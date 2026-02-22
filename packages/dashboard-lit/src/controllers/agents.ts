type GatewayRequest = <T = unknown>(method: string, params?: unknown) => Promise<T>;

export type AgentInfo = {
  id: string;
  name?: string;
  identity?: { name?: string; emoji?: string };
  model?: string;
  skills?: string[];
  sandbox?: string;
  heartbeat?: { enabled?: boolean; intervalMs?: number };
  tools?: Record<string, unknown>;
};

export type AgentsListResult = {
  defaultId: string;
  agents: AgentInfo[];
};

export async function loadAgents(request: GatewayRequest): Promise<AgentsListResult> {
  const result = await request<AgentsListResult>("agents.list", {});
  return result ?? { defaultId: "main", agents: [] };
}
