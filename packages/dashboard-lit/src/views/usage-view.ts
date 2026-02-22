import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadUsage } from "../controllers/usage.js";
import type { SessionsUsageResult, SessionUsageEntry } from "../types/dashboard.js";

@customElement("usage-view")
export class UsageView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private result: SessionsUsageResult | null = null;
  @state() private days = 7;
  @state() private filterText = "";
  @state() private sortBy: "cost" | "tokens" | "updated" = "cost";
  @state() private chartMode: "tokens" | "cost" = "cost";
  @state() private error = "";
  @state() private expandedSession: string | null = null;

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
    // Sort
    sessions = [...sessions].toSorted((a, b) => {
      switch (this.sortBy) {
        case "cost":
          return (b.usage?.totalCost ?? 0) - (a.usage?.totalCost ?? 0);
        case "tokens":
          return (b.usage?.totalTokens ?? 0) - (a.usage?.totalTokens ?? 0);
        case "updated":
          return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        default:
          return 0;
      }
    });
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
      return "—";
    }
    if (v > 1_000_000) {
      return `${(v / 1_000_000).toFixed(1)}M`;
    }
    if (v > 1_000) {
      return `${(v / 1_000).toFixed(1)}K`;
    }
    return v.toLocaleString();
  }

  private exportCsv(): void {
    const sessions = this.filteredSessions;
    const lines = ["key,label,agent,channel,model,tokens,cost,updated"];
    for (const s of sessions) {
      lines.push(
        [
          s.key,
          s.label ?? "",
          s.agentId ?? "",
          s.channel ?? "",
          s.model ?? "",
          String(s.usage?.totalTokens ?? 0),
          String(s.usage?.totalCost ?? 0),
          s.updatedAt ? new Date(s.updatedAt).toISOString() : "",
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  override render() {
    const r = this.result;
    const sessions = this.filteredSessions;
    const daily = r?.aggregates?.daily ?? [];

    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("barChart", { className: "icon-sm" })} Usage</h2>
          <div class="view-actions">
            <select class="view-select" .value=${String(this.days)}
              @change=${(e: Event) => {
                this.days = Number((e.target as HTMLSelectElement).value);
                void this.refresh();
              }}>
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
            <button class="btn-ghost" @click=${() => this.exportCsv()} ?disabled=${sessions.length === 0}>
              ${icon("download", { className: "icon-xs" })} CSV
            </button>
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}

        ${
          this.loading && !r
            ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Loading usage data...</div>`
            : nothing
        }

        ${
          r
            ? html`
          <!-- Totals -->
          <div class="glass-dashboard-card" style="margin-bottom:1rem;">
            <div class="stats-row">
              <div class="stat-card">
                <div class="stat-label">Total Cost</div>
                <div class="stat-value">${this.formatCost(r.totals.totalCost)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Tokens</div>
                <div class="stat-value">${this.formatTokens(r.totals.totalTokens)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Input</div>
                <div class="stat-value">${this.formatTokens(r.totals.input)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Output</div>
                <div class="stat-value">${this.formatTokens(r.totals.output)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Cache Read</div>
                <div class="stat-value">${this.formatTokens(r.totals.cacheRead)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Sessions</div>
                <div class="stat-value">${r.sessions.length}</div>
              </div>
            </div>
          </div>

          <!-- Daily Chart (simple bar chart) -->
          ${
            daily.length > 0
              ? html`
            <div class="glass-dashboard-card" style="margin-bottom:1rem;">
              <div class="card-header">
                <h3 class="card-header__title">Daily ${this.chartMode === "cost" ? "Cost" : "Tokens"}</h3>
                <div class="view-actions">
                  <button class="btn-ghost-sm ${this.chartMode === "cost" ? "btn-ghost-sm--active" : ""}" @click=${() => {
                    this.chartMode = "cost";
                  }}>Cost</button>
                  <button class="btn-ghost-sm ${this.chartMode === "tokens" ? "btn-ghost-sm--active" : ""}" @click=${() => {
                    this.chartMode = "tokens";
                  }}>Tokens</button>
                </div>
              </div>
              <div class="usage-chart">
                ${daily.map((d) => {
                  const val = this.chartMode === "cost" ? d.cost : d.tokens;
                  const maxVal = Math.max(
                    ...daily.map((x) => (this.chartMode === "cost" ? x.cost : x.tokens)),
                    1,
                  );
                  const pct = (val / maxVal) * 100;
                  return html`
                    <div class="usage-chart-bar" title="${d.date}: ${this.chartMode === "cost" ? this.formatCost(d.cost) : this.formatTokens(d.tokens)}">
                      <div class="usage-chart-fill" style="height:${pct}%"></div>
                      <div class="usage-chart-label">${d.date.slice(5)}</div>
                    </div>
                  `;
                })}
              </div>
            </div>
          `
              : nothing
          }

          <!-- By Model Breakdown -->
          ${
            r.aggregates.byModel.length > 0
              ? html`
            <div class="glass-dashboard-card" style="margin-bottom:1rem;">
              <div class="card-header">
                <h3 class="card-header__title">By Model</h3>
              </div>
              <div class="view-table-wrap">
                <table class="view-table">
                  <thead>
                    <tr><th>Provider</th><th>Model</th><th>Calls</th><th>Tokens</th><th>Cost</th></tr>
                  </thead>
                  <tbody>
                    ${r.aggregates.byModel.map(
                      (m) => html`
                      <tr>
                        <td>${m.provider ?? "—"}</td>
                        <td>${m.model ?? "—"}</td>
                        <td>${m.count}</td>
                        <td>${this.formatTokens(m.totals.totalTokens)}</td>
                        <td>${this.formatCost(m.totals.totalCost)}</td>
                      </tr>
                    `,
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          `
              : nothing
          }

          <!-- By Agent Breakdown -->
          ${
            r.aggregates.byAgent?.length > 0
              ? html`
            <div class="glass-dashboard-card" style="margin-bottom:1rem;">
              <div class="card-header">
                <h3 class="card-header__title">By Agent</h3>
              </div>
              <div class="view-table-wrap">
                <table class="view-table">
                  <thead>
                    <tr><th>Agent</th><th>Tokens</th><th>Cost</th></tr>
                  </thead>
                  <tbody>
                    ${r.aggregates.byAgent.map(
                      (a) => html`
                      <tr>
                        <td><span class="chip">${a.agentId}</span></td>
                        <td>${this.formatTokens(a.totals.totalTokens)}</td>
                        <td>${this.formatCost(a.totals.totalCost)}</td>
                      </tr>
                    `,
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          `
              : nothing
          }

          <!-- By Channel Breakdown -->
          ${
            r.aggregates.byChannel?.length > 0
              ? html`
            <div class="glass-dashboard-card" style="margin-bottom:1rem;">
              <div class="card-header">
                <h3 class="card-header__title">By Channel</h3>
              </div>
              <div class="view-table-wrap">
                <table class="view-table">
                  <thead>
                    <tr><th>Channel</th><th>Tokens</th><th>Cost</th></tr>
                  </thead>
                  <tbody>
                    ${r.aggregates.byChannel.map(
                      (c) => html`
                      <tr>
                        <td><span class="chip">${c.channel}</span></td>
                        <td>${this.formatTokens(c.totals.totalTokens)}</td>
                        <td>${this.formatCost(c.totals.totalCost)}</td>
                      </tr>
                    `,
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          `
              : nothing
          }

          <!-- Sessions Table -->
          <div class="view-toolbar">
            <input type="text" class="view-search" placeholder="Filter sessions... (agent:sherlock has:errors)"
              .value=${this.filterText}
              @input=${(e: Event) => {
                this.filterText = (e.target as HTMLInputElement).value;
              }}
            />
            <select class="view-select" .value=${this.sortBy}
              @change=${(e: Event) => {
                this.sortBy = (e.target as HTMLSelectElement).value as
                  | "cost"
                  | "tokens"
                  | "updated";
              }}>
              <option value="cost">Sort: Cost</option>
              <option value="tokens">Sort: Tokens</option>
              <option value="updated">Sort: Updated</option>
            </select>
          </div>

          <div class="view-table-wrap">
            <table class="view-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Agent</th>
                  <th>Channel</th>
                  <th>Model</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                ${sessions.map(
                  (s) => html`
                  <tr class="view-table-row" style="cursor:pointer;" @click=${() => {
                    this.expandedSession = this.expandedSession === s.key ? null : s.key;
                  }}>
                    <td title=${s.key}>${s.label ?? (s.key.length > 25 ? s.key.slice(0, 25) + "…" : s.key)}</td>
                    <td>${s.agentId ?? "—"}</td>
                    <td>${s.channel ?? "—"}</td>
                    <td><span class="chip chip--model">${s.model ?? "—"}</span></td>
                    <td>${this.formatTokens(s.usage?.totalTokens)}</td>
                    <td>${this.formatCost(s.usage?.totalCost)}</td>
                  </tr>
                  ${
                    this.expandedSession === s.key && s.usage
                      ? html`
                    <tr>
                      <td colspan="6" style="padding:0.5rem 1rem;">
                        <div class="stats-row" style="margin-bottom:0.5rem;">
                          <div class="stat-card">
                            <div class="stat-label">Input</div>
                            <div class="stat-value">${this.formatTokens(s.usage.input)}</div>
                          </div>
                          <div class="stat-card">
                            <div class="stat-label">Output</div>
                            <div class="stat-value">${this.formatTokens(s.usage.output)}</div>
                          </div>
                          <div class="stat-card">
                            <div class="stat-label">Cache Read</div>
                            <div class="stat-value">${this.formatTokens(s.usage.cacheRead)}</div>
                          </div>
                          <div class="stat-card">
                            <div class="stat-label">Messages</div>
                            <div class="stat-value">${s.usage.messageCounts?.total ?? "—"}</div>
                          </div>
                          <div class="stat-card">
                            <div class="stat-label">Tool Calls</div>
                            <div class="stat-value">${s.usage.toolUsage?.totalCalls ?? "—"}</div>
                          </div>
                          ${
                            s.usage.latency
                              ? html`
                            <div class="stat-card">
                              <div class="stat-label">Avg Latency</div>
                              <div class="stat-value">${Math.round(s.usage.latency.avgMs)}ms</div>
                            </div>
                          `
                              : nothing
                          }
                        </div>
                      </td>
                    </tr>
                  `
                      : nothing
                  }
                `,
                )}
                ${
                  sessions.length === 0
                    ? html`
                        <tr>
                          <td colspan="6" class="view-table-empty">No sessions found</td>
                        </tr>
                      `
                    : nothing
                }
              </tbody>
            </table>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }
}
