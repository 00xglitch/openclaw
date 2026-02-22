import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadUsage } from "../controllers/usage.js";
import type { SessionsUsageResult, SessionUsageEntry } from "../types/dashboard.js";
import "../components/empty-state.js";

@customElement("retros-view")
export class RetrosView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private result: SessionsUsageResult | null = null;
  @state() private days = 30;
  @state() private filterText = "";
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
      this.result = await loadUsage(this.gateway.request, { days: this.days });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private get filteredSessions(): SessionUsageEntry[] {
    let sessions = this.result?.sessions ?? [];
    if (this.filterText.trim()) {
      const q = this.filterText.toLowerCase();
      sessions = sessions.filter(
        (s) =>
          s.key.toLowerCase().includes(q) ||
          (s.label ?? "").toLowerCase().includes(q) ||
          (s.agentId ?? "").toLowerCase().includes(q) ||
          (s.channel ?? "").toLowerCase().includes(q),
      );
    }
    // Sort by cost descending
    sessions = [...sessions].toSorted(
      (a, b) => (b.usage?.totalCost ?? 0) - (a.usage?.totalCost ?? 0),
    );
    return sessions;
  }

  private formatCost(v?: number): string {
    if (v == null || v === 0) {
      return "$0.00";
    }
    if (v < 0.01) {
      return `$${v.toFixed(4)}`;
    }
    return `$${v.toFixed(2)}`;
  }

  private formatTokens(v?: number): string {
    if (v == null) {
      return "\u2014";
    }
    if (v > 1_000_000) {
      return `${(v / 1_000_000).toFixed(1)}M`;
    }
    if (v > 1_000) {
      return `${(v / 1_000).toFixed(1)}K`;
    }
    return v.toLocaleString();
  }

  private formatDuration(ms?: number): string {
    if (ms == null) {
      return "\u2014";
    }
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60_000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    const mins = Math.floor(ms / 60_000);
    const secs = Math.round((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  }

  override render() {
    const sessions = this.filteredSessions;

    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">
            ${icon("brain", { className: "icon-sm" })} Retrospectives
          </h2>
          <div class="view-actions">
            <select
              class="view-select"
              .value=${String(this.days)}
              @change=${(e: Event) => {
                this.days = Number((e.target as HTMLSelectElement).value);
                void this.refresh();
              }}
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
            <button
              class="btn-ghost"
              @click=${() => void this.refresh()}
              ?disabled=${this.loading}
            >
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}

        ${
          this.loading && !this.result
            ? html`<div class="view-loading">
                ${icon("loader", { className: "icon-sm icon-spin" })} Loading
                session data...
              </div>`
            : nothing
        }

        ${
          this.result && this.result.sessions.length === 0
            ? html`
                <empty-state
                  heading="No Retrospectives"
                  message="Session data will appear here after agents process messages."
                  icon="brain"
                ></empty-state>
              `
            : nothing
        }

        ${
          this.result && this.result.sessions.length > 0
            ? html`
                <div class="view-toolbar">
                  <input
                    type="text"
                    class="view-search"
                    placeholder="Filter by session, agent, or channel..."
                    .value=${this.filterText}
                    @input=${(e: Event) => {
                      this.filterText = (e.target as HTMLInputElement).value;
                    }}
                  />
                </div>

                <div class="view-count">
                  ${sessions.length} session${sessions.length === 1 ? "" : "s"}
                </div>

                <div class="skills-list">
                  ${sessions.map((s) => this.renderSession(s))}
                </div>

                ${
                  sessions.length === 0 && this.filterText
                    ? html`
                        <div class="muted" style="text-align: center; padding: 2rem">No sessions matching your filter.</div>
                      `
                    : nothing
                }
              `
            : nothing
        }
      </div>
    `;
  }

  private renderSession(s: SessionUsageEntry) {
    const u = s.usage;
    const errors = u?.messageCounts?.errors ?? 0;
    const label = s.label ?? (s.key.length > 30 ? s.key.slice(0, 30) + "\u2026" : s.key);

    return html`
      <div class="glass-dashboard-card">
        <div
          style="display:flex;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;"
        >
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
              <strong title=${s.key}>${label}</strong>
              ${s.agentId ? html`<span class="chip">${s.agentId}</span>` : nothing}
              ${s.channel ? html`<span class="chip chip--muted">${s.channel}</span>` : nothing}
              ${
                errors > 0
                  ? html`<span class="chip chip--warn"
                      >${icon("alert", { className: "icon-xs" })}
                      ${errors} error${errors === 1 ? "" : "s"}</span
                    >`
                  : nothing
              }
            </div>
            ${
              s.model
                ? html`<div class="muted" style="font-size:0.82rem;margin-top:0.25rem;">
                    ${s.model}
                  </div>`
                : nothing
            }
          </div>

          <div class="stats-row" style="gap:1rem;">
            <div class="stat-card">
              <div class="stat-label">Input</div>
              <div class="stat-value">${this.formatTokens(u?.input)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Output</div>
              <div class="stat-value">${this.formatTokens(u?.output)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Cache</div>
              <div class="stat-value">${this.formatTokens(u?.cacheRead)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Cost</div>
              <div class="stat-value">${this.formatCost(u?.totalCost)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Duration</div>
              <div class="stat-value">
                ${this.formatDuration(u?.durationMs)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
