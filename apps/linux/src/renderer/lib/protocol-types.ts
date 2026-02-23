export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  server?: { name?: string; version?: string; commit?: string };
  features?: { methods?: string[]; events?: string[] };
  snapshot?: {
    agents?: AgentInfo[];
    channels?: ChannelInfo[];
    sessions?: SessionInfo[];
    [key: string]: unknown;
  };
  auth?: { deviceToken?: string; role?: string; scopes?: string[] };
  policy?: { tickIntervalMs?: number };
};

export type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  seq?: number;
  message?: unknown;
  errorMessage?: string;
  usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
  stopReason?: string;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: unknown;
  timestamp?: number;
};

// Agent metadata from agents.list
export type AgentIdentity = {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
};

export type AgentInfo = {
  id: string;
  name?: string;
  identity?: AgentIdentity;
};

// Session metadata from sessions.list
export type SessionInfo = {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  channel?: string;
  updatedAt: number | null;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
};

// Node metadata from node.list
export type NodeInfo = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  caps: string[];
  commands: string[];
  connected: boolean;
  paired: boolean;
  connectedAtMs?: number;
};

// --- Logs ---

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogEntry = {
  raw: string;
  time?: string | null;
  level?: LogLevel | null;
  subsystem?: string | null;
  message: string;
  meta?: Record<string, unknown>;
};

// --- Usage ---

export type SessionsUsageTotals = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  missingCostEntries: number;
};

export type SessionsUsageEntry = {
  key: string;
  label?: string;
  updatedAt?: number;
  agentId?: string;
  channel?: string;
  model?: string;
  modelProvider?: string;
  providerOverride?: string;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    totalCost: number;
    inputCost?: number;
    outputCost?: number;
    cacheReadCost?: number;
    cacheWriteCost?: number;
    missingCostEntries: number;
    firstActivity?: number;
    lastActivity?: number;
    activityDates?: string[];
  } | null;
};

export type SessionsUsageResult = {
  updatedAt: number;
  startDate: string;
  endDate: string;
  sessions: SessionsUsageEntry[];
  totals: SessionsUsageTotals;
  aggregates: {
    daily: Array<{ date: string; tokens: number; cost: number; messages: number }>;
    byModel: Array<{ provider?: string; model?: string; count: number; totals: SessionsUsageTotals }>;
    byAgent: Array<{ agentId: string; totals: SessionsUsageTotals }>;
    byChannel: Array<{ channel: string; totals: SessionsUsageTotals }>;
    [key: string]: unknown;
  };
};

export type CostUsageDailyEntry = SessionsUsageTotals & { date: string };

export type CostUsageSummary = {
  updatedAt: number;
  days: number;
  daily: CostUsageDailyEntry[];
  totals: SessionsUsageTotals;
};

// --- Agents ---

export type AgentFileEntry = {
  name: string;
  size?: number;
  modifiedAt?: number;
  content?: string;
};

export type AgentIdentityFull = {
  name?: string;
  emoji?: string;
  theme?: string;
  avatarUrl?: string;
  instructions?: string;
};

export type SkillEntry = {
  name: string;
  enabled: boolean;
  description?: string;
  version?: string;
};

export type SkillStatusReport = {
  eligible: SkillEntry[];
  missing: SkillEntry[];
  blocked: SkillEntry[];
};

// --- Config ---

export type ConfigSnapshot = {
  raw: string;
  config: Record<string, unknown>;
  hash: string;
  valid: boolean;
  issues: Array<{ path: string; message: string }>;
};

// --- Health ---

export type HealthCheck = {
  name: string;
  status: "ok" | "degraded" | "error";
  message?: string;
};

export type HealthResult = {
  status: "ok" | "degraded" | "error";
  checks: HealthCheck[];
  uptime?: number;
  version?: string;
  commit?: string;
};

export type HeartbeatResult = {
  state: "ok" | "pending" | "stale" | "disabled";
  sentAt?: number;
  age?: number;
};

export type StatusResult = {
  activity?: string;
  workLabel?: string;
  channels?: number;
};

// --- Channels ---

export type ChannelInfo = {
  id: string;
  type: string;
  status: "connected" | "disconnected" | "error" | "connecting";
  account?: string;
  error?: string;
};

export type ChannelsStatusResult = {
  channels: ChannelInfo[];
};

// --- Skills (extended) ---

export type SkillInfo = {
  name: string;
  status: "eligible" | "missing" | "blocked" | "active";
  type: "mcp" | "builtin" | "custom";
  description?: string;
  enabled: boolean;
  version?: string;
};

export type SkillsStatusResult = {
  skills: SkillInfo[];
};

export function generateUUID(): string {
  return crypto.randomUUID();
}
