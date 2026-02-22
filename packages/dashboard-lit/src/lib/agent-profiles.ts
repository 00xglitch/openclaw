export interface AgentProfile {
  id: string;
  name: string;
  emoji?: string;
  avatar?: string;
  personality: string;
  duties: string[];
  tools: string[];
  skills: string[];
  model?: string;
  avatarColor?: string;
  isTaskRunner?: boolean;
  isAgentBuilder?: boolean;
  isRetrospective?: boolean;
  isHidden?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RequestFn = <T = unknown>(method: string, params?: unknown) => Promise<T>;

type GatewayAgent = {
  id: string;
  name?: string;
  identity?: { name?: string; emoji?: string; avatar?: string };
  model?: string;
};

type AgentsListResult = {
  defaultId: string;
  agents: GatewayAgent[];
};

const now = () => new Date().toISOString();

const STORAGE_KEY = "claw-dash:agent-profiles:v2";

function isValidProfile(o: unknown): o is AgentProfile {
  if (!o || typeof o !== "object") {
    return false;
  }
  const p = o as Record<string, unknown>;
  return typeof p.id === "string" && typeof p.name === "string";
}

function loadFromStorage(): AgentProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidProfile);
  } catch {
    return [];
  }
}

function saveToStorage(profiles: AgentProfile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function mapGatewayAgent(agent: GatewayAgent): AgentProfile {
  const ts = now();
  return {
    id: agent.id,
    name: agent.identity?.name ?? agent.name ?? agent.id,
    emoji: agent.identity?.emoji,
    avatar: agent.identity?.avatar,
    personality: "",
    duties: [],
    tools: [],
    skills: [],
    model: agent.model,
    createdAt: ts,
    updatedAt: ts,
  };
}

export type AgentStoreListener = () => void;

export class AgentProfileStore {
  private _agents: AgentProfile[] = [];
  private _selectedId: string | null = null;
  private _defaultId: string | null = null;
  private _listeners = new Set<AgentStoreListener>();
  private _storageHandler: ((e: StorageEvent) => void) | null = null;

  get agents(): AgentProfile[] {
    return this._agents;
  }

  get visibleAgents(): AgentProfile[] {
    return this._agents.filter((a) => !a.isHidden);
  }

  get selectedId(): string | null {
    return this._selectedId;
  }

  get selectedAgent(): AgentProfile | null {
    if (!this._selectedId) {
      return null;
    }
    return this._agents.find((a) => a.id === this._selectedId) ?? null;
  }

  get defaultId(): string | null {
    return this._defaultId;
  }

  constructor() {
    this._agents = loadFromStorage();
    if (this._agents.length && !this._selectedId) {
      const first = this.visibleAgents[0];
      if (first) {
        this._selectedId = first.id;
      }
    }
  }

  subscribe(fn: AgentStoreListener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this._listeners) {
      fn();
    }
  }

  async syncFromGateway(requestFn: RequestFn): Promise<void> {
    const result = await requestFn<AgentsListResult>("agents.list", {});
    if (!result || !Array.isArray(result.agents)) {
      return;
    }

    this._defaultId = result.defaultId ?? null;

    // Merge: gateway agents take priority, preserve local-only agents
    const gatewayIds = new Set(result.agents.map((a) => a.id));
    const localOnly = this._agents.filter(
      (a) => !gatewayIds.has(a.id) && a.createdAt !== a.updatedAt,
    );
    const gatewayProfiles = result.agents.map((ga) => {
      const existing = this._agents.find((a) => a.id === ga.id);
      const mapped = mapGatewayAgent(ga);
      // Preserve local customizations if the agent existed before
      if (existing) {
        return {
          ...mapped,
          personality: existing.personality || mapped.personality,
          duties: existing.duties.length ? existing.duties : mapped.duties,
          tools: existing.tools.length ? existing.tools : mapped.tools,
          skills: existing.skills.length ? existing.skills : mapped.skills,
          avatarColor: existing.avatarColor,
          isHidden: existing.isHidden,
          createdAt: existing.createdAt,
          updatedAt: now(),
        };
      }
      return mapped;
    });

    this._agents = [...gatewayProfiles, ...localOnly];
    saveToStorage(this._agents);

    if (!this._selectedId || !this._agents.some((a) => a.id === this._selectedId)) {
      this._selectedId =
        this._defaultId && this._agents.some((a) => a.id === this._defaultId)
          ? this._defaultId
          : (this.visibleAgents[0]?.id ?? null);
    }

    this.notify();
  }

  startSync(): void {
    if (this._storageHandler) {
      return;
    }
    this._storageHandler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) {
        return;
      }
      this._agents = loadFromStorage();
      this.notify();
    };
    window.addEventListener("storage", this._storageHandler);
  }

  stopSync(): void {
    if (this._storageHandler) {
      window.removeEventListener("storage", this._storageHandler);
      this._storageHandler = null;
    }
  }

  selectAgent(id: string): void {
    if (this._agents.some((a) => a.id === id)) {
      this._selectedId = id;
      this.notify();
    }
  }

  createAgent(partial: Partial<AgentProfile> & { name: string }): AgentProfile {
    const id = partial.id ?? `agent-${Date.now().toString(36)}`;
    const profile: AgentProfile = {
      id,
      name: partial.name,
      emoji: partial.emoji,
      avatar: partial.avatar,
      personality: partial.personality ?? "",
      duties: partial.duties ?? [],
      tools: partial.tools ?? [],
      skills: partial.skills ?? [],
      model: partial.model,
      avatarColor: partial.avatarColor,
      isTaskRunner: partial.isTaskRunner,
      isAgentBuilder: partial.isAgentBuilder,
      isRetrospective: partial.isRetrospective,
      createdAt: now(),
      updatedAt: now(),
    };
    this._agents = [...this._agents, profile];
    saveToStorage(this._agents);
    this.notify();
    return profile;
  }

  updateAgent(id: string, patch: Partial<AgentProfile>): void {
    this._agents = this._agents.map((a) =>
      a.id === id ? { ...a, ...patch, id: a.id, updatedAt: now() } : a,
    );
    saveToStorage(this._agents);
    this.notify();
  }

  deleteAgent(id: string): void {
    this._agents = this._agents.filter((a) => a.id !== id);
    if (this._selectedId === id) {
      this._selectedId = this.visibleAgents[0]?.id ?? null;
    }
    saveToStorage(this._agents);
    this.notify();
  }
}
