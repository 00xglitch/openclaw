import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AgentProfile } from "../lib/agent-profiles.js";
import { getProviderTheme, modelTag } from "../lib/agent-theme.js";
import { agentColor } from "./agent-avatar.js";
import { icon } from "./icons.js";
import "./agent-avatar.js";

@customElement("agent-dropdown-switcher")
export class AgentDropdownSwitcher extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ type: Array }) agents: AgentProfile[] = [];
  @property({ type: String }) selectedId: string | null = null;
  @property({ type: Boolean }) compact = false;
  @property({ type: Object }) spawnConfig: Record<string, string> = {};

  @state() private open = false;
  @state() private search = "";

  private onDocClick = (e: MouseEvent): void => {
    const path = e.composedPath();
    if (!path.includes(this)) {
      this.open = false;
      this.search = "";
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      this.open = false;
      this.search = "";
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("click", this.onDocClick, true);
    document.addEventListener("keydown", this.onKeyDown);
  }

  override disconnectedCallback(): void {
    document.removeEventListener("click", this.onDocClick, true);
    document.removeEventListener("keydown", this.onKeyDown);
    super.disconnectedCallback();
  }

  private toggle(): void {
    this.open = !this.open;
    if (!this.open) {
      this.search = "";
    }
  }

  private select(id: string): void {
    this.open = false;
    this.search = "";
    this.dispatchEvent(
      new CustomEvent("agent-select", { detail: id, bubbles: true, composed: true }),
    );
  }

  private fireCreate(): void {
    this.open = false;
    this.search = "";
    this.dispatchEvent(new CustomEvent("create-new", { bubbles: true, composed: true }));
  }

  private get filteredAgents(): AgentProfile[] {
    const base = this.search.trim()
      ? (() => {
          const q = this.search.toLowerCase();
          return this.agents.filter(
            (a) =>
              a.name.toLowerCase().includes(q) ||
              a.personality.toLowerCase().includes(q) ||
              a.duties.some((d) => d.toLowerCase().includes(q)),
          );
        })()
      : this.agents;

    // Group: parents first, then their subagents indented below
    if (!this.spawnConfig || Object.keys(this.spawnConfig).length === 0) {
      return base;
    }

    const childToParent = this.spawnConfig;
    const childIds = new Set(Object.keys(childToParent));
    const parents = base.filter((a) => !childIds.has(a.id));
    const grouped: AgentProfile[] = [];

    for (const parent of parents) {
      grouped.push(parent);
      const children = base.filter((a) => childToParent[a.id] === parent.id);
      grouped.push(...children);
    }

    // Append any orphan children whose parent wasn't in the filtered list
    const added = new Set(grouped.map((a) => a.id));
    for (const agent of base) {
      if (!added.has(agent.id)) {
        grouped.push(agent);
      }
    }

    return grouped;
  }

  private isSubagent(agentId: string): boolean {
    return this.spawnConfig != null && agentId in this.spawnConfig;
  }

  private get selected(): AgentProfile | null {
    return this.agents.find((a) => a.id === this.selectedId) ?? null;
  }

  private roleBadge(agent: AgentProfile) {
    if (agent.isTaskRunner) {
      return html`
        <span class="agent-role-badge agent-role-badge--ops">ops</span>
      `;
    }
    if (agent.isAgentBuilder) {
      return html`
        <span class="agent-role-badge agent-role-badge--builder">builder</span>
      `;
    }
    if (agent.isRetrospective) {
      return html`
        <span class="agent-role-badge agent-role-badge--retro">retro</span>
      `;
    }
    return nothing;
  }

  override render() {
    const sel = this.selected;
    const tag = sel ? modelTag(sel.model) : "";
    const theme = sel ? getProviderTheme(sel.model) : null;

    return html`
      <div class="agent-dropdown ${this.compact ? "agent-dropdown--compact" : ""}">
        <button class="agent-dropdown__trigger" @click=${() => this.toggle()}>
          ${
            sel
              ? html`
                <agent-avatar .agent=${sel} .size=${this.compact ? 22 : 28}></agent-avatar>
                <span class="agent-dropdown__name">${sel.name}</span>
                ${
                  tag
                    ? html`<span class="agent-dropdown__model" style="background:${theme?.badge ?? ""};color:${theme?.text ?? ""}">${tag}</span>`
                    : nothing
                }
                ${
                  !this.compact
                    ? html`
                      <span class="agent-dropdown__meta">
                        ${sel.tools.length ? html`<span>${sel.tools.length} tools</span>` : nothing}
                        ${sel.duties.length ? html`<span>${sel.duties.length} duties</span>` : nothing}
                      </span>
                    `
                    : nothing
                }
              `
              : html`${icon("bot", { className: "icon-sm" })} <span class="agent-dropdown__name">Agent</span>`
          }
          ${icon("chevronDown", { className: "icon-xs" })}
        </button>

        ${
          this.open
            ? html`
              <div class="agent-dropdown__panel">
                <div class="agent-dropdown__search-wrap">
                  ${icon("search", { className: "icon-xs" })}
                  <input
                    type="text"
                    class="agent-dropdown__search"
                    placeholder="Search agents..."
                    .value=${this.search}
                    @input=${(e: Event) => {
                      this.search = (e.target as HTMLInputElement).value;
                    }}
                    @click=${(e: Event) => e.stopPropagation()}
                  />
                </div>
                <div class="agent-dropdown__list">
                  ${this.filteredAgents.map((agent) => {
                    const t = getProviderTheme(agent.model);
                    const color = agentColor(agent);
                    const isActive = agent.id === this.selectedId;
                    const mt = modelTag(agent.model);
                    const isSub = this.isSubagent(agent.id);
                    return html`
                      <button
                        class="agent-dropdown__item ${isActive ? "agent-dropdown__item--active" : ""} ${isSub ? "agent-dropdown__item--subagent" : ""}"
                        style="${isSub ? "padding-left:24px;" : ""}"
                        @click=${() => this.select(agent.id)}
                      >
                        ${
                          isSub
                            ? html`
                                <span class="agent-dropdown__connector"></span>
                              `
                            : nothing
                        }
                        <span class="agent-dropdown__accent" style="background:${color}"></span>
                        <agent-avatar .agent=${agent} .size=${24}></agent-avatar>
                        <span class="agent-dropdown__item-name">${agent.name}</span>
                        ${this.roleBadge(agent)}
                        ${
                          mt
                            ? html`<span class="agent-dropdown__model" style="background:${t.badge};color:${t.text}">${mt}</span>`
                            : nothing
                        }
                        ${
                          agent.tools.length
                            ? html`<span class="agent-dropdown__tool-count">${agent.tools.length}</span>`
                            : nothing
                        }
                        ${isActive ? html`<span class="agent-dropdown__check">${icon("check", { className: "icon-xs" })}</span>` : nothing}
                      </button>
                    `;
                  })}
                </div>
                <button class="agent-dropdown__create" @click=${() => this.fireCreate()}>
                  ${icon("plus", { className: "icon-xs" })}
                  New agent
                </button>
              </div>
            `
            : nothing
        }
      </div>
    `;
  }
}
