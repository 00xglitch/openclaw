import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadSkillsStatus } from "../controllers/skills.js";
import type { SkillStatusEntry, SkillStatusReport } from "../types/dashboard.js";
import "../components/empty-state.js";

@customElement("skills-view")
export class SkillsView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private report: SkillStatusReport | null = null;
  @state() private filterText = "";
  @state() private showSource: "all" | "bundled" | "workspace" | "managed" = "all";
  @state() private expandedSkills = new Set<string>();
  @state() private togglingSkill: string | null = null;
  @state() private error = "";

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
      this.report = await loadSkillsStatus(this.gateway.request);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async toggleSkill(skill: SkillStatusEntry): Promise<void> {
    if (!this.gateway?.connected || this.togglingSkill) {
      return;
    }
    this.togglingSkill = skill.skillKey;
    try {
      const newDisabled = !skill.disabled;
      await this.gateway.request("config.patch", {
        path: `skills.overrides.${skill.skillKey}.disabled`,
        value: newDisabled,
      });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.togglingSkill = null;
    }
  }

  private toggleExpand(skillKey: string): void {
    const next = new Set(this.expandedSkills);
    if (next.has(skillKey)) {
      next.delete(skillKey);
    } else {
      next.add(skillKey);
    }
    this.expandedSkills = next;
  }

  private get groupedSkills(): Map<string, SkillStatusEntry[]> {
    const skills = this.report?.skills ?? [];
    let filtered = skills;

    if (this.showSource !== "all") {
      filtered = filtered.filter((s) => {
        if (this.showSource === "bundled") {
          return s.bundled;
        }
        if (this.showSource === "workspace") {
          return s.source === "workspace";
        }
        if (this.showSource === "managed") {
          return s.source === "managed";
        }
        return true;
      });
    }

    if (this.filterText.trim()) {
      const q = this.filterText.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.skillKey.toLowerCase().includes(q),
      );
    }

    const groups = new Map<string, SkillStatusEntry[]>();
    for (const skill of filtered) {
      const source = skill.source || "unknown";
      if (!groups.has(source)) {
        groups.set(source, []);
      }
      groups.get(source)!.push(skill);
    }
    return groups;
  }

  override render() {
    const groups = this.groupedSkills;
    const total = this.report?.skills.length ?? 0;
    const enabled = this.report?.skills.filter((s) => !s.disabled).length ?? 0;

    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("zap", { className: "icon-sm" })} Skills</h2>
          <div class="view-actions">
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}

        ${
          this.report
            ? html`
          <div class="view-count">${total} skills · ${enabled} enabled</div>
        `
            : nothing
        }

        <div class="view-toolbar">
          <input type="text" class="view-search" placeholder="Filter skills by name, description, key..."
            .value=${this.filterText}
            @input=${(e: Event) => {
              this.filterText = (e.target as HTMLInputElement).value;
            }}
          />
          <select class="view-select" .value=${this.showSource}
            @change=${(e: Event) => {
              this.showSource = (e.target as HTMLSelectElement).value as
                | "all"
                | "bundled"
                | "workspace"
                | "managed";
            }}>
            <option value="all">All sources</option>
            <option value="bundled">Bundled</option>
            <option value="workspace">Workspace</option>
            <option value="managed">Managed</option>
          </select>
        </div>

        ${
          this.loading && !this.report
            ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Loading skills...</div>`
            : nothing
        }

        <div class="skills-groups">
          ${Array.from(groups.entries()).map(
            ([source, skills]) => html`
            <details class="skills-group" open>
              <summary class="skills-group__header">
                <span class="skills-group__title">${source}</span>
                <span class="chip">${skills.length}</span>
              </summary>
              <div class="skills-list">
                ${skills.map((skill) => this.renderSkill(skill))}
              </div>
            </details>
          `,
          )}

          ${
            groups.size === 0 && this.report
              ? html`
            <empty-state
              icon="zap"
              heading="No skills found"
              message=${this.filterText ? "No skills matching your filter." : "No skills configured."}
              actionLabel="Clear Filter"
              @action=${() => {
                this.filterText = "";
                this.showSource = "all";
              }}
            ></empty-state>
          `
              : nothing
          }
        </div>
      </div>
    `;
  }

  private renderSkill(skill: SkillStatusEntry) {
    const hasMissing = Object.keys(skill.missing).length > 0;
    const isExpanded = this.expandedSkills.has(skill.skillKey);
    const isToggling = this.togglingSkill === skill.skillKey;

    return html`
      <div class="glass-dashboard-card skill-card ${skill.disabled ? "skill-card--disabled" : ""}">
        <div class="skill-card__header">
          <span class="skill-card__emoji">${skill.emoji ?? "⚡"}</span>
          <div class="skill-card__info">
            <div class="skill-card__name">${skill.name}</div>
            <div class="skill-card__desc muted">${skill.description}</div>
          </div>
          <div class="skill-card__badges">
            ${
              skill.bundled
                ? html`
                    <span class="chip chip--muted">bundled</span>
                  `
                : nothing
            }
            ${
              skill.always
                ? html`
                    <span class="chip chip--accent">always</span>
                  `
                : nothing
            }
            ${
              skill.blockedByAllowlist
                ? html`
                    <span class="chip chip--warn">blocked</span>
                  `
                : nothing
            }
            ${
              hasMissing
                ? html`
                    <span class="chip chip--warn">missing deps</span>
                  `
                : nothing
            }
          </div>
          <div style="display:flex;gap:4px;align-items:center;margin-left:auto;">
            <button class="btn-ghost-sm" @click=${() => this.toggleExpand(skill.skillKey)}
              title="${isExpanded ? "Collapse" : "Expand"}">
              ${isExpanded ? icon("chevronDown", { className: "icon-xs" }) : icon("chevronRight", { className: "icon-xs" })}
            </button>
            <button class="btn-ghost-sm ${skill.disabled ? "" : "btn-ghost-sm--active"}"
              @click=${() => void this.toggleSkill(skill)}
              ?disabled=${isToggling || skill.always}
              title="${skill.disabled ? "Enable skill" : "Disable skill"}">
              ${
                isToggling
                  ? icon("loader", { className: "icon-xs icon-spin" })
                  : skill.disabled
                    ? icon("eyeOff", { className: "icon-xs" })
                    : icon("eye", { className: "icon-xs" })
              }
            </button>
          </div>
        </div>

        ${
          hasMissing
            ? html`
          <div class="skill-card__missing">
            <strong>Missing:</strong>
            ${Object.entries(skill.missing).map(
              ([k, v]) => html`
              <span class="chip chip--warn">${k}: ${v}</span>
            `,
            )}
          </div>
        `
            : nothing
        }

        ${
          skill.configChecks.length > 0
            ? html`
          <div class="skill-card__checks">
            ${skill.configChecks.map(
              (c) => html`
              <span class="chip ${c.ok ? "chip--success" : "chip--warn"}">
                ${c.ok ? icon("check", { className: "icon-xs" }) : icon("alert", { className: "icon-xs" })}
                ${c.key}${c.message ? `: ${c.message}` : ""}
              </span>
            `,
            )}
          </div>
        `
            : nothing
        }

        ${
          isExpanded
            ? html`
          <div class="skill-card__details" style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--lg-border-subtle);">
            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:0.82rem;">
              <span class="muted">Key:</span><span>${skill.skillKey}</span>
              <span class="muted">Source:</span><span>${skill.source}</span>
              <span class="muted">Path:</span><span style="word-break:break-all;">${skill.filePath}</span>
              <span class="muted">Base Dir:</span><span style="word-break:break-all;">${skill.baseDir}</span>
              ${skill.primaryEnv ? html`<span class="muted">Env:</span><span>${skill.primaryEnv}</span>` : nothing}
              ${skill.homepage ? html`<span class="muted">Homepage:</span><a href="${skill.homepage}" target="_blank" rel="noopener" style="color:var(--accent);">${skill.homepage}</a>` : nothing}
              <span class="muted">Eligible:</span><span>${skill.eligible ? "Yes" : "No"}</span>
              <span class="muted">Status:</span><span>${skill.disabled ? "Disabled" : "Enabled"}</span>
            </div>

            ${
              Object.keys(skill.requirements).length > 0
                ? html`
              <div style="margin-top:0.5rem;">
                <span class="muted" style="font-size:0.78rem;">Requirements:</span>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
                  ${Object.entries(skill.requirements).map(
                    ([k, v]) => html`
                    <span class="chip ${skill.missing[k] ? "chip--warn" : "chip--success"}">${k}: ${v}</span>
                  `,
                  )}
                </div>
              </div>
            `
                : nothing
            }

            ${
              skill.install.length > 0
                ? html`
              <div style="margin-top:0.5rem;">
                <span class="muted" style="font-size:0.78rem;">Install:</span>
                ${skill.install.map(
                  (inst) => html`
                  <div style="font-size:0.78rem;margin-top:2px;">${inst.label}: <code class="code-inline">${inst.command}</code></div>
                `,
                )}
              </div>
            `
                : nothing
            }
          </div>
        `
            : nothing
        }
      </div>
    `;
  }
}
