import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import "../components/confirm-dialog.js";
import "../components/json-viewer.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadAgents, type AgentsListResult } from "../controllers/agents.js";
import { loadModels } from "../controllers/models.js";
import { loadSkillsStatus } from "../controllers/skills.js";
import { getProviderTheme, modelTag } from "../lib/agent-theme.js";
import type { ModelCatalogEntry, CronJob, SkillStatusEntry } from "../types/dashboard.js";

type AgentDetail = {
  id: string;
  name?: string;
  identity?: { name?: string; emoji?: string; avatar?: string };
  model?: string;
  skills?: string[];
  sandbox?: string;
  heartbeat?: { enabled?: boolean; intervalMs?: number };
  tools?: Record<string, unknown>;
  files?: Array<{ name: string; size?: number }>;
};

type AgentFile = {
  name: string;
  content?: string;
  dirty?: boolean;
  saving?: boolean;
  loading?: boolean;
};

type AgentDetailTab = "overview" | "files" | "tools" | "skills" | "channels" | "cron" | "subagents";

type BindingEntry = {
  agentId: string;
  match: {
    channel?: string;
    peer?: { id?: string; kind?: string };
  };
};

type SpawnConfig = {
  maxSpawnDepth?: number;
  maxChildrenPerAgent?: number;
  children?: Record<string, string>; // childId -> parentId
};

@customElement("agents-view")
export class AgentsView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private agentsList: AgentsListResult | null = null;
  @state() private selectedAgentId: string | null = null;
  @state() private agentDetail: AgentDetail | null = null;
  @state() private agentFiles: AgentFile[] = [];
  @state() private activeTab: AgentDetailTab = "overview";
  @state() private models: ModelCatalogEntry[] = [];
  @state() private error = "";

  // Search/filter
  @state() private sidebarSearch = "";

  // Create agent form
  @state() private showCreateForm = false;
  @state() private createId = "";
  @state() private createName = "";
  @state() private createModel = "";
  @state() private creating = false;

  // Delete agent
  @state() private showDeleteConfirm = false;
  @state() private deleting = false;

  // Tab data
  @state() private agentToolsConfig: Record<string, unknown> | null = null;
  @state() private agentSkills: SkillStatusEntry[] = [];
  @state() private agentBindings: BindingEntry[] = [];
  @state() private cronJobs: CronJob[] = [];
  @state() private tabLoading = false;

  // Files
  @state() private loadingAllFiles = false;

  // Subagents
  @state() private spawnConfig: SpawnConfig | null = null;

  private lastConnectedState: boolean | null = null;

  override updated(): void {
    const connected = this.gateway?.connected ?? false;
    if (connected && this.lastConnectedState !== true) {
      void this.refresh();
    }
    this.lastConnectedState = connected;
  }

  private async refresh(): Promise<void> {
    if (!this.gateway?.connected || this.loading) {
      return;
    }
    this.loading = true;
    this.error = "";
    try {
      const [agents, models] = await Promise.allSettled([
        loadAgents(this.gateway.request),
        loadModels(this.gateway.request),
      ]);
      if (agents.status === "fulfilled") {
        this.agentsList = agents.value;
        if (!this.selectedAgentId && agents.value.agents.length > 0) {
          this.selectedAgentId = agents.value.defaultId || agents.value.agents[0].id;
          void this.loadAgentDetail(this.selectedAgentId);
        }
      }
      if (models.status === "fulfilled") {
        this.models = models.value;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async loadAgentDetail(agentId: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      const [identity, files, config] = await Promise.allSettled([
        this.gateway.request<{ identity: { name?: string; emoji?: string; avatar?: string } }>(
          "agent.identity.get",
          { agentId },
        ),
        this.gateway.request<{ files: Array<{ name: string }> }>("agents.files.list", { agentId }),
        this.gateway.request<Record<string, unknown>>("config.get", { section: "agents" }),
      ]);

      const agent = this.agentsList?.agents.find((a) => a.id === agentId);

      // Extract per-agent config from the agents section
      let agentConfig: Record<string, unknown> = {};
      if (config.status === "fulfilled" && config.value) {
        const agentsSection = config.value;
        const agentsCfg = (agentsSection.agents ?? agentsSection) as Record<string, unknown>;
        if (agentsCfg[agentId] && typeof agentsCfg[agentId] === "object") {
          agentConfig = agentsCfg[agentId] as Record<string, unknown>;
        }
      }

      const identityData =
        identity.status === "fulfilled" ? identity.value?.identity : agent?.identity;

      this.agentDetail = {
        id: agentId,
        name: agent?.name ?? (agentConfig.name as string | undefined),
        identity: identityData
          ? {
              name: identityData.name,
              emoji: identityData.emoji,
              avatar: (identityData as { avatar?: string }).avatar,
            }
          : undefined,
        model: agent?.model ?? (agentConfig.model as string | undefined),
        skills: agent?.skills ?? (agentConfig.skills as string[] | undefined),
        sandbox: agent?.sandbox ?? (agentConfig.sandbox as string | undefined),
        heartbeat:
          agent?.heartbeat ??
          (agentConfig.heartbeat as { enabled?: boolean; intervalMs?: number } | undefined),
        tools: agent?.tools ?? (agentConfig.tools as Record<string, unknown> | undefined),
      };

      if (files.status === "fulfilled") {
        this.agentFiles = (files.value?.files ?? []).map((f) => ({ name: f.name }));
      }
    } catch {
      /* best effort */
    }
  }

  private async loadFileContent(fileName: string): Promise<void> {
    if (!this.gateway?.connected || !this.selectedAgentId) {
      return;
    }
    // Set loading state for this file
    this.agentFiles = this.agentFiles.map((f) =>
      f.name === fileName ? { ...f, loading: true } : f,
    );
    try {
      const result = await this.gateway.request<{ content: string }>("agents.files.get", {
        agentId: this.selectedAgentId,
        fileName,
      });
      this.agentFiles = this.agentFiles.map((f) =>
        f.name === fileName
          ? { ...f, content: result?.content ?? "", dirty: false, loading: false }
          : f,
      );
    } catch {
      this.agentFiles = this.agentFiles.map((f) =>
        f.name === fileName ? { ...f, loading: false } : f,
      );
    }
  }

  private async loadAllFiles(): Promise<void> {
    if (!this.gateway?.connected || !this.selectedAgentId) {
      return;
    }
    this.loadingAllFiles = true;
    try {
      const promises = this.agentFiles
        .filter((f) => f.content === undefined)
        .map((f) => this.loadFileContent(f.name));
      await Promise.allSettled(promises);
    } finally {
      this.loadingAllFiles = false;
    }
  }

  private async saveFile(fileName: string): Promise<void> {
    if (!this.gateway?.connected || !this.selectedAgentId) {
      return;
    }
    const file = this.agentFiles.find((f) => f.name === fileName);
    if (!file || file.content === undefined) {
      return;
    }

    this.agentFiles = this.agentFiles.map((f) =>
      f.name === fileName ? { ...f, saving: true } : f,
    );

    try {
      await this.gateway.request("agents.files.set", {
        agentId: this.selectedAgentId,
        fileName,
        content: file.content,
      });
      this.agentFiles = this.agentFiles.map((f) =>
        f.name === fileName ? { ...f, dirty: false, saving: false } : f,
      );
    } catch {
      this.agentFiles = this.agentFiles.map((f) =>
        f.name === fileName ? { ...f, saving: false } : f,
      );
    }
  }

  private onFileEdit(fileName: string, content: string): void {
    this.agentFiles = this.agentFiles.map((f) =>
      f.name === fileName ? { ...f, content, dirty: true } : f,
    );
  }

  private async loadTabData(tab: AgentDetailTab): Promise<void> {
    if (!this.gateway?.connected || !this.selectedAgentId) {
      return;
    }
    this.tabLoading = true;
    try {
      switch (tab) {
        case "tools": {
          const config = await this.gateway.request<Record<string, unknown>>("config.get", {
            section: "agents",
          });
          if (config) {
            const agentsSection = config.agents ?? config;
            const agentCfg = (agentsSection as Record<string, unknown>)[this.selectedAgentId];
            if (agentCfg && typeof agentCfg === "object") {
              const cfg = agentCfg as Record<string, unknown>;
              this.agentToolsConfig = {
                sandbox: cfg.sandbox ?? "not set",
                tools: cfg.tools ?? {},
              };
            } else {
              this.agentToolsConfig = { sandbox: "not set", tools: {} };
            }
          }
          break;
        }
        case "skills": {
          const report = await loadSkillsStatus(this.gateway.request, {
            agentId: this.selectedAgentId,
          });
          this.agentSkills = report.skills ?? [];
          break;
        }
        case "channels": {
          const config = await this.gateway.request<Record<string, unknown>>("config.get", {
            section: "bindings",
          });
          if (config) {
            const bindingsSection = config;
            const bindings = (bindingsSection.bindings ?? bindingsSection) as unknown;
            if (Array.isArray(bindings)) {
              this.agentBindings = (bindings as BindingEntry[]).filter(
                (b) => b.agentId === this.selectedAgentId,
              );
            } else {
              this.agentBindings = [];
            }
          }
          break;
        }
        case "cron": {
          const result = await this.gateway.request<{ jobs: CronJob[] }>("cron.list", {});
          if (result?.jobs) {
            this.cronJobs = result.jobs.filter((j) => j.agentId === this.selectedAgentId);
          } else {
            this.cronJobs = [];
          }
          break;
        }
        case "subagents": {
          await this.loadSpawnConfig();
          break;
        }
      }
    } catch {
      /* best effort */
    } finally {
      this.tabLoading = false;
    }
  }

  private async loadSpawnConfig(): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      const config = await this.gateway.request<Record<string, unknown>>("config.get", {
        section: "agents",
      });
      if (config) {
        const agentsSection = (config.agents ?? config) as Record<string, unknown>;
        const defaults = agentsSection.defaults as Record<string, unknown> | undefined;
        const spawn = agentsSection.spawn as Record<string, unknown> | undefined;

        this.spawnConfig = {
          maxSpawnDepth: (spawn?.maxSpawnDepth ?? defaults?.maxSpawnDepth ?? 2) as number,
          maxChildrenPerAgent: (spawn?.maxChildrenPerAgent ??
            defaults?.maxChildrenPerAgent ??
            5) as number,
          children: {},
        };

        // Try to find parent-child relationships from agent configs
        const children: Record<string, string> = {};
        for (const [key, value] of Object.entries(agentsSection)) {
          if (key === "defaults" || key === "spawn" || typeof value !== "object" || !value) {
            continue;
          }
          const agentCfg = value as Record<string, unknown>;
          if (agentCfg.parentId && typeof agentCfg.parentId === "string") {
            children[key] = agentCfg.parentId;
          }
        }
        this.spawnConfig = { ...this.spawnConfig, children };
      }
    } catch {
      this.spawnConfig = null;
    }
  }

  private selectAgent(id: string): void {
    this.selectedAgentId = id;
    this.activeTab = "overview";
    this.agentDetail = null;
    this.agentFiles = [];
    this.agentToolsConfig = null;
    this.agentSkills = [];
    this.agentBindings = [];
    this.cronJobs = [];
    this.spawnConfig = null;
    void this.loadAgentDetail(id);
  }

  private switchTab(tab: AgentDetailTab): void {
    this.activeTab = tab;
    if (
      tab === "tools" ||
      tab === "skills" ||
      tab === "channels" ||
      tab === "cron" ||
      tab === "subagents"
    ) {
      void this.loadTabData(tab);
    }
  }

  // ── Filtered agents for sidebar ────────────────────────

  private get filteredAgents() {
    const agents = this.agentsList?.agents ?? [];
    const q = this.sidebarSearch.trim().toLowerCase();
    if (!q) {
      return agents;
    }
    return agents.filter((a) => {
      const name = (a.identity?.name ?? a.name ?? "").toLowerCase();
      const id = a.id.toLowerCase();
      const model = (a.model ?? "").toLowerCase();
      return name.includes(q) || id.includes(q) || model.includes(q);
    });
  }

  // ── Create Agent ──────────────────────────────────────

  private async createAgent(): Promise<void> {
    if (!this.gateway?.connected || !this.createId.trim()) {
      return;
    }
    this.creating = true;
    try {
      const agentId = this.createId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-");
      const patch: Record<string, unknown> = {
        model: this.createModel || undefined,
      };
      if (this.createName.trim()) {
        patch.identity = { name: this.createName.trim() };
      }
      await this.gateway.request("config.patch", {
        section: "agents",
        path: agentId,
        value: patch,
      });
      this.showCreateForm = false;
      this.createId = "";
      this.createName = "";
      this.createModel = "";
      await this.refresh();
      this.selectAgent(agentId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.creating = false;
    }
  }

  private cancelCreate(): void {
    this.showCreateForm = false;
    this.createId = "";
    this.createName = "";
    this.createModel = "";
  }

  // ── Delete Agent ──────────────────────────────────────

  private async deleteAgent(): Promise<void> {
    if (!this.gateway?.connected || !this.selectedAgentId) {
      return;
    }
    this.deleting = true;
    try {
      await this.gateway.request("config.patch", {
        section: "agents",
        path: this.selectedAgentId,
        value: null,
      });
      this.showDeleteConfirm = false;
      this.selectedAgentId = null;
      this.agentDetail = null;
      this.agentFiles = [];
      await this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.deleting = false;
    }
  }

  // ── Render ────────────────────────────────────────────

  override render() {
    const agents = this.filteredAgents;
    const defaultId = this.agentsList?.defaultId;

    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("folder", { className: "icon-sm" })} Agents</h2>
          <div class="view-actions">
            <button class="btn-ghost" @click=${() => {
              this.showCreateForm = !this.showCreateForm;
            }}>
              ${icon("plus", { className: "icon-xs" })} New Agent
            </button>
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}

        ${this.showCreateForm ? this.renderCreateForm() : nothing}

        <div class="agents-layout">
          <!-- Agent Sidebar -->
          <div class="agents-sidebar">
            <div style="padding: 0.5rem; border-bottom: 1px solid var(--color-border, #333);">
              <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem; background: var(--color-surface-2, #1a1a2e); border: 1px solid var(--color-border, #333);">
                ${icon("search", { className: "icon-xs" })}
                <input
                  type="text"
                  placeholder="Filter agents..."
                  .value=${this.sidebarSearch}
                  @input=${(e: Event) => {
                    this.sidebarSearch = (e.target as HTMLInputElement).value;
                  }}
                  style="flex: 1; background: transparent; border: none; outline: none; color: var(--color-text, #e0e0e0); font-size: 0.85rem;"
                />
                ${
                  this.sidebarSearch
                    ? html`<button style="background: none; border: none; cursor: pointer; color: var(--color-text-muted, #888); padding: 0;" @click=${() => {
                        this.sidebarSearch = "";
                      }}>
                    ${icon("x", { className: "icon-xs" })}
                  </button>`
                    : nothing
                }
              </div>
            </div>
            ${
              this.loading && agents.length === 0
                ? html`<div class="view-loading">${icon("loader", { className: "icon-xs icon-spin" })} Loading...</div>`
                : nothing
            }
            ${
              agents.length === 0 && this.sidebarSearch
                ? html`<div style="padding: 0.75rem; text-align: center;" class="muted">No agents match "${this.sidebarSearch}"</div>`
                : nothing
            }
            ${agents.map((a) => {
              const emoji = a.identity?.emoji ?? "";
              const name = a.identity?.name ?? a.name ?? a.id;
              const isDefault = a.id === defaultId;
              const isSelected = a.id === this.selectedAgentId;
              return html`
                <button class="agent-sidebar-item ${isSelected ? "agent-sidebar-item--active" : ""}"
                  @click=${() => this.selectAgent(a.id)}>
                  <span class="agent-sidebar-emoji">${emoji || "🤖"}</span>
                  <span class="agent-sidebar-name">${name}</span>
                  ${
                    isDefault
                      ? html`
                          <span class="chip chip--accent">default</span>
                        `
                      : nothing
                  }
                </button>
              `;
            })}
          </div>

          <!-- Agent Detail -->
          <div class="agents-detail">
            ${
              this.selectedAgentId
                ? this.renderDetail()
                : html`
                    <div class="agents-empty">
                      <p class="muted">Select an agent from the list</p>
                    </div>
                  `
            }
          </div>
        </div>
      </div>
    `;
  }

  private renderCreateForm() {
    return html`
      <div class="glass-dashboard-card" style="margin-bottom: 1rem;">
        <div class="card-header">
          <h3 class="card-header__title">Create New Agent</h3>
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end; padding: 0.75rem 0;">
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label class="stat-label">Agent ID *</label>
            <input class="inline-input" placeholder="my-agent" .value=${this.createId}
              @input=${(e: Event) => {
                this.createId = (e.target as HTMLInputElement).value;
              }} />
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label class="stat-label">Display Name</label>
            <input class="inline-input" placeholder="My Agent" .value=${this.createName}
              @input=${(e: Event) => {
                this.createName = (e.target as HTMLInputElement).value;
              }} />
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label class="stat-label">Model</label>
            <select class="inline-select" .value=${this.createModel}
              @change=${(e: Event) => {
                this.createModel = (e.target as HTMLSelectElement).value;
              }}>
              <option value="">Default</option>
              ${this.models.map((m) => html`<option value=${m.id}>${m.name} (${m.provider})</option>`)}
            </select>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-ghost" @click=${() => void this.createAgent()} ?disabled=${this.creating || !this.createId.trim()}>
              ${this.creating ? html`${icon("loader", { className: "icon-xs icon-spin" })} Creating...` : html`${icon("check", { className: "icon-xs" })} Create`}
            </button>
            <button class="btn-ghost" @click=${() => this.cancelCreate()}>
              ${icon("x", { className: "icon-xs" })} Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderDetail() {
    const detail = this.agentDetail;
    const emoji = detail?.identity?.emoji ?? "";
    const name = detail?.identity?.name ?? detail?.name ?? this.selectedAgentId ?? "";
    const isDefault = this.selectedAgentId === this.agentsList?.defaultId;

    const tabs: Array<{ id: AgentDetailTab; label: string }> = [
      { id: "overview", label: "Overview" },
      { id: "files", label: `Files (${this.agentFiles.length})` },
      { id: "tools", label: "Tools" },
      { id: "skills", label: "Skills" },
      { id: "channels", label: "Channels" },
      { id: "cron", label: "Cron" },
      { id: "subagents", label: "Subagents" },
    ];

    return html`
      <div class="agent-detail-header">
        <span class="agent-detail-emoji">${emoji || "🤖"}</span>
        <div style="flex: 1;">
          <h3 class="agent-detail-name">${name}</h3>
          <span class="muted">${this.selectedAgentId}</span>
        </div>
        ${
          !isDefault
            ? html`
          <button class="btn-ghost" style="color: var(--danger);"
            @click=${() => {
              this.showDeleteConfirm = true;
            }}>
            ${icon("x", { className: "icon-xs" })} Delete
          </button>
        `
            : nothing
        }
      </div>

      <div class="agent-detail-tabs">
        ${tabs.map(
          (t) => html`
          <button class="agent-detail-tab ${this.activeTab === t.id ? "agent-detail-tab--active" : ""}"
            @click=${() => this.switchTab(t.id)}>
            ${t.label}
          </button>
        `,
        )}
      </div>

      <div class="agent-detail-content">
        ${this.renderTabContent()}
      </div>

      <confirm-dialog
        .open=${this.showDeleteConfirm}
        title="Delete Agent"
        message="Are you sure you want to delete this agent? This will remove it from configuration."
        confirmLabel="Delete"
        confirmVariant="danger"
        @confirm=${() => void this.deleteAgent()}
        @cancel=${() => {
          this.showDeleteConfirm = false;
        }}
      ></confirm-dialog>
    `;
  }

  private renderTabContent() {
    switch (this.activeTab) {
      case "overview":
        return this.renderOverviewTab();
      case "files":
        return this.renderFilesTab();
      case "tools":
        return this.renderToolsTab();
      case "skills":
        return this.renderSkillsTab();
      case "channels":
        return this.renderChannelsTab();
      case "cron":
        return this.renderCronTab();
      case "subagents":
        return this.renderSubagentsTab();
      default:
        return nothing;
    }
  }

  // ── Overview Tab ──────────────────────────────────────

  private renderOverviewTab() {
    const detail = this.agentDetail;
    if (!detail) {
      return html`<div class="view-loading">${icon("loader", { className: "icon-xs icon-spin" })} Loading...</div>`;
    }

    const modelId = detail.model ?? "default";
    const modelEntry = this.models.find((m) => m.id === modelId);
    const modelName = modelEntry?.name ?? modelId;
    const provider = modelEntry?.provider ?? this.extractProvider(modelId);
    const providerTheme = getProviderTheme(modelId);
    const tag = modelTag(modelId);

    const toolKeys = detail.tools ? Object.keys(detail.tools) : [];
    const skillsList = detail.skills ?? [];

    return html`
      <div class="glass-dashboard-card">
        <!-- Row 1: Agent ID + Model -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">${icon("bot", { className: "icon-xs" })} Agent ID</div>
            <div class="stat-value">${detail.id}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${icon("brain", { className: "icon-xs" })} Model</div>
            <div class="stat-value" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span>${modelName}</span>
              ${tag ? html`<span class="chip" style="background: ${providerTheme.badge}; color: ${providerTheme.text};">${tag}</span>` : nothing}
              ${provider ? html`<span class="chip" style="background: ${providerTheme.badge}; color: ${providerTheme.text}; font-size: 0.7rem;">${provider}</span>` : nothing}
            </div>
          </div>
        </div>

        <!-- Row 2: Identity + Sandbox -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">${icon("bot", { className: "icon-xs" })} Identity</div>
            <div class="stat-value" style="display: flex; align-items: center; gap: 0.5rem;">
              ${detail.identity?.emoji ? html`<span style="font-size: 1.4rem;">${detail.identity.emoji}</span>` : nothing}
              ${
                detail.identity?.name
                  ? html`<span>${detail.identity.name}</span>`
                  : html`
                      <span class="muted">not set</span>
                    `
              }
              ${
                detail.identity?.avatar
                  ? html`<img src="${detail.identity.avatar}" alt="avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;" />`
                  : nothing
              }
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${icon("shield", { className: "icon-xs" })} Sandbox</div>
            <div class="stat-value">
              ${
                detail.sandbox
                  ? html`<span class="chip ${detail.sandbox === "all" ? "chip--accent" : ""}">${detail.sandbox}</span>`
                  : html`
                      <span class="muted">not set</span>
                    `
              }
            </div>
          </div>
        </div>

        <!-- Row 3: Tools + Skills -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">${icon("hammer", { className: "icon-xs" })} Tools (${toolKeys.length})</div>
            <div class="stat-value">
              ${
                toolKeys.length > 0
                  ? html`
                  <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                    ${toolKeys.map((t) => html`<span class="chip" style="font-size: 0.75rem;">${t}</span>`)}
                  </div>
                `
                  : html`
                      <span class="muted">default</span>
                    `
              }
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${icon("zap", { className: "icon-xs" })} Skills (${skillsList.length})</div>
            <div class="stat-value">
              ${
                skillsList.length > 0
                  ? html`
                  <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                    ${skillsList.map((s) => html`<span class="chip" style="font-size: 0.75rem;">${s}</span>`)}
                  </div>
                `
                  : html`
                      <span class="muted">default</span>
                    `
              }
            </div>
          </div>
        </div>

        <!-- Row 4: Heartbeat + Files -->
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">${icon("activity", { className: "icon-xs" })} Heartbeat</div>
            <div class="stat-value">
              ${
                detail.heartbeat
                  ? html`
                    <span class="chip ${detail.heartbeat.enabled ? "chip--accent" : ""}">${detail.heartbeat.enabled ? "enabled" : "disabled"}</span>
                    ${
                      detail.heartbeat.intervalMs
                        ? html`<span class="muted" style="margin-left: 0.5rem;">every ${Math.round(detail.heartbeat.intervalMs / 1000)}s</span>`
                        : nothing
                    }
                  `
                  : html`
                      <span class="muted">not configured</span>
                    `
              }
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">${icon("fileText", { className: "icon-xs" })} Files</div>
            <div class="stat-value">${this.agentFiles.length}</div>
          </div>
        </div>
      </div>
    `;
  }

  private extractProvider(modelId: string): string {
    if (modelId.startsWith("claude-") || modelId.startsWith("anthropic/")) {
      return "anthropic";
    }
    if (modelId.startsWith("gpt-") || modelId.startsWith("openai/")) {
      return "openai";
    }
    if (modelId.startsWith("ollama/")) {
      return "ollama";
    }
    if (modelId.startsWith("blockrun/")) {
      return "blockrun";
    }
    if (modelId.includes("/")) {
      return modelId.split("/")[0];
    }
    return "";
  }

  // ── Files Tab ─────────────────────────────────────────

  private renderFilesTab() {
    const hasUnloaded = this.agentFiles.some((f) => f.content === undefined && !f.loading);

    return html`
      <div class="agent-files">
        ${
          this.agentFiles.length === 0
            ? html`
                <p class="muted">No files for this agent.</p>
              `
            : html`
              ${
                hasUnloaded
                  ? html`
                <div style="margin-bottom: 0.75rem;">
                  <button class="btn-ghost" @click=${() => void this.loadAllFiles()} ?disabled=${this.loadingAllFiles}>
                    ${
                      this.loadingAllFiles
                        ? html`${icon("loader", { className: "icon-xs icon-spin" })} Loading...`
                        : html`${icon("download", { className: "icon-xs" })} Load All Files`
                    }
                  </button>
                </div>
              `
                  : nothing
              }
            `
        }
        ${this.agentFiles.map((f) => this.renderFileCard(f))}
      </div>
    `;
  }

  private renderFileCard(f: AgentFile) {
    return html`
      <div class="glass-dashboard-card agent-file-card">
        <div class="card-header">
          <span class="card-header__prefix">${icon("fileText", { className: "icon-xs" })}</span>
          <h3 class="card-header__title">${f.name}</h3>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${
              f.loading
                ? html`<span class="muted" style="font-size: 0.8rem;">${icon("loader", { className: "icon-xs icon-spin" })} Loading...</span>`
                : f.content === undefined
                  ? html`
              <button class="btn-ghost-sm" @click=${() => void this.loadFileContent(f.name)}>
                ${icon("download", { className: "icon-xs" })} Load
              </button>
            `
                  : html`
              ${
                f.dirty
                  ? html`
                      <span class="chip" style="font-size: 0.7rem">unsaved</span>
                    `
                  : nothing
              }
              ${
                f.saving
                  ? html`<span class="muted" style="font-size: 0.8rem;">${icon("loader", { className: "icon-xs icon-spin" })} Saving...</span>`
                  : html`
                    <button class="btn-ghost-sm" @click=${() => void this.saveFile(f.name)} ?disabled=${!f.dirty}>
                      ${icon("check", { className: "icon-xs" })} Save
                    </button>
                  `
              }
            `
            }
          </div>
        </div>
        ${
          f.content !== undefined
            ? html`
          <textarea
            class="code-block"
            style="width: 100%; min-height: 200px; max-height: 500px; resize: vertical; font-family: monospace; font-size: 0.85rem; background: var(--color-surface-2, #1a1a2e); color: var(--color-text, #e0e0e0); border: 1px solid var(--color-border, #333); border-radius: 0.25rem; padding: 0.75rem; white-space: pre; overflow: auto;"
            .value=${f.content}
            @input=${(e: Event) => this.onFileEdit(f.name, (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        `
            : nothing
        }
      </div>
    `;
  }

  // ── Tools Tab ─────────────────────────────────────────

  private renderToolsTab() {
    if (this.tabLoading) {
      return html`<div class="view-loading">${icon("loader", { className: "icon-xs icon-spin" })} Loading tools config...</div>`;
    }

    if (!this.agentToolsConfig) {
      return html`
        <div class="glass-dashboard-card"><p class="muted">No tools configuration loaded.</p></div>
      `;
    }

    return html`
      <div class="glass-dashboard-card">
        <div class="card-header">
          <h3 class="card-header__title">${icon("hammer", { className: "icon-xs" })} Tool Configuration</h3>
          <button class="btn-ghost-sm" @click=${() => void this.loadTabData("tools")}>
            ${icon("refresh", { className: "icon-xs" })} Reload
          </button>
        </div>
        <json-viewer .data=${this.agentToolsConfig} .expanded=${true}></json-viewer>
      </div>
    `;
  }

  // ── Skills Tab ────────────────────────────────────────

  private renderSkillsTab() {
    if (this.tabLoading) {
      return html`<div class="view-loading">${icon("loader", { className: "icon-xs icon-spin" })} Loading skills...</div>`;
    }

    if (this.agentSkills.length === 0) {
      return html`
        <div class="glass-dashboard-card"><p class="muted">No skills found for this agent.</p></div>
      `;
    }

    return html`
      <div class="glass-dashboard-card">
        <div class="card-header">
          <h3 class="card-header__title">${icon("zap", { className: "icon-xs" })} Skills (${this.agentSkills.length})</h3>
          <button class="btn-ghost-sm" @click=${() => void this.loadTabData("skills")}>
            ${icon("refresh", { className: "icon-xs" })} Reload
          </button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
          ${this.agentSkills.map(
            (skill) => html`
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 0.25rem; background: var(--color-surface-2, #1a1a2e);">
              <span style="font-size: 1.2rem;">${skill.emoji ?? "🔧"}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500;">${skill.name}</div>
                ${skill.description ? html`<div class="muted" style="font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${skill.description}</div>` : nothing}
                <div class="muted" style="font-size: 0.75rem;">${skill.source}</div>
              </div>
              <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                ${
                  skill.disabled
                    ? html`
                        <span class="chip">disabled</span>
                      `
                    : html`
                        <span class="chip chip--accent">enabled</span>
                      `
                }
                ${
                  skill.eligible
                    ? html`
                        <span class="chip chip--accent">eligible</span>
                      `
                    : skill.blockedByAllowlist
                      ? html`
                          <span class="chip">blocked</span>
                        `
                      : html`
                          <span class="chip">ineligible</span>
                        `
                }
                ${
                  skill.bundled
                    ? html`
                        <span class="chip">bundled</span>
                      `
                    : nothing
                }
              </div>
            </div>
          `,
          )}
        </div>
      </div>
    `;
  }

  // ── Channels Tab ──────────────────────────────────────

  private renderChannelsTab() {
    if (this.tabLoading) {
      return html`<div class="view-loading">${icon("loader", { className: "icon-xs icon-spin" })} Loading bindings...</div>`;
    }

    if (this.agentBindings.length === 0) {
      return html`
        <div class="glass-dashboard-card"><p class="muted">No channel bindings for this agent.</p></div>
      `;
    }

    return html`
      <div class="glass-dashboard-card">
        <div class="card-header">
          <h3 class="card-header__title">${icon("radio", { className: "icon-xs" })} Channel Bindings (${this.agentBindings.length})</h3>
          <button class="btn-ghost-sm" @click=${() => void this.loadTabData("channels")}>
            ${icon("refresh", { className: "icon-xs" })} Reload
          </button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
          ${this.agentBindings.map(
            (binding) => html`
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 0.25rem; background: var(--color-surface-2, #1a1a2e);">
              <span>${icon("radio", { className: "icon-xs" })}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500;">${
                  binding.match?.channel ??
                  html`
                    <span class="muted">any channel</span>
                  `
                }</div>
                ${
                  binding.match?.peer
                    ? html`
                  <div class="muted" style="font-size: 0.8rem;">
                    Peer: ${binding.match.peer.kind ?? ""}${binding.match.peer.kind && binding.match.peer.id ? " / " : ""}${binding.match.peer.id ?? ""}
                  </div>
                `
                    : nothing
                }
              </div>
              ${binding.match?.channel ? html`<span class="chip">${binding.match.channel}</span>` : nothing}
            </div>
          `,
          )}
        </div>
      </div>
    `;
  }

  // ── Cron Tab ──────────────────────────────────────────

  private renderCronTab() {
    if (this.tabLoading) {
      return html`<div class="view-loading">${icon("loader", { className: "icon-xs icon-spin" })} Loading cron jobs...</div>`;
    }

    if (this.cronJobs.length === 0) {
      return html`
        <div class="glass-dashboard-card"><p class="muted">No cron jobs for this agent.</p></div>
      `;
    }

    return html`
      <div class="glass-dashboard-card">
        <div class="card-header">
          <h3 class="card-header__title">${icon("clock", { className: "icon-xs" })} Cron Jobs (${this.cronJobs.length})</h3>
          <button class="btn-ghost-sm" @click=${() => void this.loadTabData("cron")}>
            ${icon("refresh", { className: "icon-xs" })} Reload
          </button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
          ${this.cronJobs.map((job) => this.renderCronJob(job))}
        </div>
      </div>
    `;
  }

  private renderCronJob(job: CronJob) {
    const schedule = this.formatSchedule(job.schedule);
    const nextRun = job.state.nextRunAtMs
      ? new Date(job.state.nextRunAtMs).toLocaleString()
      : "N/A";
    const lastStatus = job.state.lastStatus;

    return html`
      <div style="padding: 0.5rem 0.75rem; border-radius: 0.25rem; background: var(--color-surface-2, #1a1a2e);">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span>${icon("clock", { className: "icon-xs" })}</span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500;">${job.name}</div>
            ${job.description ? html`<div class="muted" style="font-size: 0.8rem;">${job.description}</div>` : nothing}
          </div>
          <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
            ${
              job.enabled
                ? html`
                    <span class="chip chip--accent">enabled</span>
                  `
                : html`
                    <span class="chip">disabled</span>
                  `
            }
            ${
              lastStatus
                ? html`<span class="chip ${lastStatus === "ok" ? "chip--accent" : lastStatus === "error" ? "" : ""}">${lastStatus}</span>`
                : nothing
            }
          </div>
        </div>
        <div style="display: flex; gap: 1.5rem; margin-top: 0.25rem; font-size: 0.8rem;" class="muted">
          <span>Schedule: <code>${schedule}</code></span>
          <span>Next: ${nextRun}</span>
          ${job.state.lastRunAtMs ? html`<span>Last: ${new Date(job.state.lastRunAtMs).toLocaleString()}</span>` : nothing}
          ${job.state.lastDurationMs ? html`<span>Duration: ${job.state.lastDurationMs}ms</span>` : nothing}
        </div>
      </div>
    `;
  }

  private formatSchedule(schedule: CronJob["schedule"]): string {
    switch (schedule.kind) {
      case "cron":
        return schedule.expr + (schedule.tz ? ` (${schedule.tz})` : "");
      case "every":
        return `every ${Math.round(schedule.everyMs / 1000)}s`;
      case "at":
        return `at ${schedule.at}`;
      default:
        return "unknown";
    }
  }

  // ── Subagents Tab ─────────────────────────────────────

  private renderSubagentsTab() {
    if (this.tabLoading) {
      return html`<div class="view-loading">${icon("loader", { className: "icon-xs icon-spin" })} Loading spawn config...</div>`;
    }

    if (!this.spawnConfig) {
      return html`
        <div class="glass-dashboard-card"><p class="muted">No spawn configuration available.</p></div>
      `;
    }

    const agents = this.agentsList?.agents ?? [];
    const children = this.spawnConfig.children ?? {};
    const childEntries = Object.entries(children);

    // Find children of the selected agent
    const myChildren = childEntries
      .filter(([, parentId]) => parentId === this.selectedAgentId)
      .map(([childId]) => childId);

    // Find parent of the selected agent
    const myParent = children[this.selectedAgentId ?? ""] ?? null;

    return html`
      <div class="glass-dashboard-card">
        <div class="card-header">
          <h3 class="card-header__title">${icon("bot", { className: "icon-xs" })} Subagent Configuration</h3>
          <button class="btn-ghost-sm" @click=${() => void this.loadTabData("subagents")}>
            ${icon("refresh", { className: "icon-xs" })} Reload
          </button>
        </div>

        <!-- Spawn limits -->
        <div class="stats-row" style="margin-top: 0.75rem;">
          <div class="stat-card">
            <div class="stat-label">Max Spawn Depth</div>
            <div class="stat-value">${this.spawnConfig.maxSpawnDepth ?? "N/A"}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Max Children per Agent</div>
            <div class="stat-value">${this.spawnConfig.maxChildrenPerAgent ?? "N/A"}</div>
          </div>
        </div>

        <!-- Parent relationship -->
        ${
          myParent
            ? html`
          <div style="margin-top: 0.75rem;">
            <div class="stat-label" style="margin-bottom: 0.5rem;">Parent Agent</div>
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 0.25rem; background: var(--color-surface-2, #1a1a2e); cursor: pointer;"
              @click=${() => this.selectAgent(myParent)}>
              <span style="font-size: 1.2rem;">${this.getAgentEmoji(myParent, agents)}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500;">${this.getAgentName(myParent, agents)}</div>
                <div class="muted" style="font-size: 0.8rem;">${myParent}</div>
              </div>
              <span class="chip">parent</span>
            </div>
          </div>
        `
            : nothing
        }

        <!-- Children -->
        <div style="margin-top: 0.75rem;">
          <div class="stat-label" style="margin-bottom: 0.5rem;">Children (${myChildren.length})</div>
          ${
            myChildren.length > 0
              ? html`
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${myChildren.map(
                  (childId) => html`
                  <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 0.25rem; background: var(--color-surface-2, #1a1a2e); cursor: pointer;"
                    @click=${() => this.selectAgent(childId)}>
                    <span style="font-size: 1.2rem;">${this.getAgentEmoji(childId, agents)}</span>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-weight: 500;">${this.getAgentName(childId, agents)}</div>
                      <div class="muted" style="font-size: 0.8rem;">${childId}</div>
                    </div>
                    <span class="chip chip--accent">child</span>
                  </div>
                `,
                )}
              </div>
            `
              : html`
                  <p class="muted">No child agents spawned by this agent.</p>
                `
          }
        </div>

        <!-- All relationships overview -->
        ${
          childEntries.length > 0
            ? html`
          <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--color-border, #333);">
            <div class="stat-label" style="margin-bottom: 0.5rem;">All Parent-Child Relationships</div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              ${childEntries.map(
                ([childId, parentId]) => html`
                <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.85rem;" class="muted">
                  <span>${this.getAgentEmoji(parentId, agents)}</span>
                  <span>${this.getAgentName(parentId, agents)}</span>
                  <span style="opacity: 0.5;">${icon("chevronRight", { className: "icon-xs" })}</span>
                  <span>${this.getAgentEmoji(childId, agents)}</span>
                  <span>${this.getAgentName(childId, agents)}</span>
                </div>
              `,
              )}
            </div>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private getAgentEmoji(
    agentId: string,
    agents: Array<{ id: string; identity?: { emoji?: string } }>,
  ): string {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.identity?.emoji ?? "🤖";
  }

  private getAgentName(
    agentId: string,
    agents: Array<{ id: string; name?: string; identity?: { name?: string } }>,
  ): string {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.identity?.name ?? agent?.name ?? agentId;
  }
}
