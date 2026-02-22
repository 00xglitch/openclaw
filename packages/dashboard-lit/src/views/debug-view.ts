import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import "../components/json-viewer.js";
import "../components/terminal-emulator.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadHealth } from "../controllers/health.js";
import { loadModels } from "../controllers/models.js";
import type { HealthSummary, ModelCatalogEntry } from "../types/dashboard.js";

type EventLogEntry = {
  event: string;
  ts: number;
  payload: unknown;
};

@customElement("debug-view")
export class DebugView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private status: unknown = null;
  @state() private health: HealthSummary | null = null;
  @state() private models: ModelCatalogEntry[] = [];
  @state() private loading = false;

  // Manual RPC
  @state() private rpcMethod = "";
  @state() private rpcParams = "{}";
  @state() private rpcResult: unknown = null;
  @state() private rpcError = "";
  @state() private rpcLoading = false;
  @state() private rpcDurationMs: number | null = null;

  // Debug tab
  @state() private debugTab: "rpc" | "events" | "terminal" = "rpc";

  // Live event log
  @state() private eventLog: EventLogEntry[] = [];
  @state() private eventLogPaused = false;
  @state() private eventLogExpanded: number | null = null;
  @state() private eventFilter = "";
  @state() private knownMethods: string[] = [];

  private lastConnectedState: boolean | null = null;
  private unsubscribeEvents: (() => void) | null = null;

  override updated(): void {
    const connected = this.gateway?.connected ?? false;
    if (connected && this.lastConnectedState !== true) {
      void this.refresh();
      this.startEventLog();
    }
    if (!connected && this.lastConnectedState === true) {
      this.stopEventLog();
    }
    this.lastConnectedState = connected;
  }

  override disconnectedCallback(): void {
    this.stopEventLog();
    super.disconnectedCallback();
  }

  private startEventLog(): void {
    this.stopEventLog();
    if (!this.gateway?.subscribe) {
      return;
    }
    // Subscribe to all events by subscribing to the wildcard-like catch-all
    this.unsubscribeEvents = this.gateway.subscribe("*", (payload: unknown) => {
      if (this.eventLogPaused) {
        return;
      }
      const entry: EventLogEntry = {
        event: (payload as { event?: string })?.event ?? "*",
        ts: Date.now(),
        payload,
      };
      this.eventLog = [...this.eventLog.slice(-99), entry];
    });
  }

  private stopEventLog(): void {
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;
  }

  private async refresh(): Promise<void> {
    if (!this.gateway?.connected || this.loading) {
      return;
    }
    this.loading = true;
    try {
      const [statusRes, healthRes, modelsRes] = await Promise.allSettled([
        this.gateway.request("status", {}),
        loadHealth(this.gateway.request),
        loadModels(this.gateway.request),
      ]);
      if (statusRes.status === "fulfilled") {
        this.status = statusRes.value;
      }
      if (healthRes.status === "fulfilled") {
        this.health = healthRes.value;
      }
      if (modelsRes.status === "fulfilled") {
        this.models = modelsRes.value;
      }
      // Extract known RPC methods from hello handshake
      const methods = this.gateway?.hello?.features?.methods;
      if (Array.isArray(methods)) {
        this.knownMethods = methods;
      }
    } finally {
      this.loading = false;
    }
  }

  private async callRpc(): Promise<void> {
    if (!this.gateway?.connected || !this.rpcMethod.trim()) {
      return;
    }
    this.rpcLoading = true;
    this.rpcError = "";
    this.rpcResult = null;
    this.rpcDurationMs = null;
    try {
      let params: unknown = {};
      if (this.rpcParams.trim()) {
        params = JSON.parse(this.rpcParams);
      }
      const start = performance.now();
      const result = await this.gateway.request(this.rpcMethod.trim(), params);
      this.rpcDurationMs = Math.round(performance.now() - start);
      this.rpcResult = result;
    } catch (err) {
      this.rpcError = err instanceof Error ? err.message : String(err);
    } finally {
      this.rpcLoading = false;
    }
  }

  private get filteredEventLog(): EventLogEntry[] {
    if (!this.eventFilter.trim()) {
      return this.eventLog;
    }
    const q = this.eventFilter.toLowerCase();
    return this.eventLog.filter(
      (e) =>
        e.event.toLowerCase().includes(q) || JSON.stringify(e.payload).toLowerCase().includes(q),
    );
  }

  override render() {
    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("bug", { className: "icon-sm" })} Debug</h2>
          <div class="view-actions" style="display:flex;gap:0.25rem;align-items:center;">
            <button class="btn-ghost-sm ${this.debugTab === "rpc" ? "btn-ghost-sm--active" : ""}"
              @click=${() => {
                this.debugTab = "rpc";
              }}>
              ${icon("terminal", { className: "icon-xs" })} RPC
            </button>
            <button class="btn-ghost-sm ${this.debugTab === "events" ? "btn-ghost-sm--active" : ""}"
              @click=${() => {
                this.debugTab = "events";
              }}>
              ${icon("activity", { className: "icon-xs" })} Events
            </button>
            <button class="btn-ghost-sm ${this.debugTab === "terminal" ? "btn-ghost-sm--active" : ""}"
              @click=${() => {
                this.debugTab = "terminal";
              }}>
              ${icon("monitor", { className: "icon-xs" })} Terminal
            </button>
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${
          this.debugTab === "terminal"
            ? html`
          <terminal-emulator .gateway=${this.gateway}></terminal-emulator>
        `
            : nothing
        }

        ${
          this.debugTab === "events"
            ? html`
        <!-- Live Event Log -->
        <div class="glass-dashboard-card" style="margin-top:1rem;">
          <div class="card-header">
            <span class="card-header__prefix">${icon("activity", { className: "icon-xs" })}</span>
            <h3 class="card-header__title">Live Events (${this.filteredEventLog.length}${this.eventFilter ? ` / ${this.eventLog.length}` : ""})</h3>
            <div class="view-actions">
              <button class="btn-ghost-sm" @click=${() => {
                this.eventLogPaused = !this.eventLogPaused;
              }}>
                ${this.eventLogPaused ? icon("refresh", { className: "icon-xs" }) : icon("stop", { className: "icon-xs" })}
                ${this.eventLogPaused ? "Resume" : "Pause"}
              </button>
              <button class="btn-ghost-sm" @click=${() => {
                this.eventLog = [];
              }}>Clear</button>
            </div>
          </div>
          <div style="padding:0.5rem;">
            <input type="text" class="view-search" placeholder="Filter events by name or payload..."
              .value=${this.eventFilter}
              @input=${(e: Event) => {
                this.eventFilter = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <div style="max-height:300px;overflow-y:auto;">
            ${
              this.filteredEventLog.length === 0
                ? html`
                    <p class="muted" style="padding: 0.5rem">
                      ${this.eventFilter ? "No events matching filter." : "No events received yet. Events will appear as they arrive from the gateway."}
                    </p>
                  `
                : html`
                <table class="view-table">
                  <thead><tr><th style="width:80px">Time</th><th style="width:150px">Event</th><th>Payload</th></tr></thead>
                  <tbody>
                    ${this.filteredEventLog.map(
                      (e, i) => html`
                      <tr class="view-table-row" @click=${() => {
                        this.eventLogExpanded = this.eventLogExpanded === i ? null : i;
                      }}>
                        <td class="muted">${new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                        <td><span class="chip">${e.event}</span></td>
                        <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${JSON.stringify(e.payload).slice(0, 100)}</td>
                      </tr>
                      ${
                        this.eventLogExpanded === i
                          ? html`
                        <tr><td colspan="3"><json-viewer .data=${e.payload} .maxDepth=${2}></json-viewer></td></tr>
                      `
                          : nothing
                      }
                    `,
                    )}
                  </tbody>
                </table>
              `
            }
          </div>
        </div>
        `
            : nothing
        }

        ${
          this.debugTab === "rpc"
            ? html`
        <!-- Manual RPC Caller -->
        <div class="glass-dashboard-card">
          <div class="card-header">
            <span class="card-header__prefix">${icon("terminal", { className: "icon-xs" })}</span>
            <h3 class="card-header__title">Manual RPC</h3>
          </div>
          <div class="rpc-form">
            <div class="rpc-form__row">
              <input type="text" class="rpc-method-input"
                placeholder="method name (e.g. status)"
                list="rpc-methods"
                .value=${this.rpcMethod}
                @input=${(e: Event) => {
                  this.rpcMethod = (e.target as HTMLInputElement).value;
                }}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter") {
                    void this.callRpc();
                  }
                }}
              />
              <datalist id="rpc-methods">
                ${this.knownMethods.map((m) => html`<option value=${m}></option>`)}
              </datalist>
              <button class="btn-primary" @click=${() => void this.callRpc()} ?disabled=${this.rpcLoading || !this.rpcMethod.trim()}>
                ${this.rpcLoading ? icon("loader", { className: "icon-xs icon-spin" }) : "Call"}
              </button>
            </div>
            <textarea class="rpc-params-input" rows="3"
              placeholder='{"key": "value"}'
              .value=${this.rpcParams}
              @input=${(e: Event) => {
                this.rpcParams = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
          </div>
          ${this.rpcError ? html`<div class="view-error">${this.rpcError}</div>` : nothing}
          ${
            this.rpcResult !== null
              ? html`
            <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
              ${this.rpcDurationMs !== null ? html`<span class="chip chip--muted">${this.rpcDurationMs}ms</span>` : nothing}
            </div>
            <json-viewer .data=${this.rpcResult} .maxDepth=${3}></json-viewer>
          `
              : nothing
          }
        </div>

        <!-- Status -->
        <div class="debug-panels">
          <div class="glass-dashboard-card">
            <div class="card-header">
              <span class="card-header__prefix">${icon("activity", { className: "icon-xs" })}</span>
              <h3 class="card-header__title">Status</h3>
            </div>
            ${
              this.status
                ? html`<json-viewer .data=${this.status} .maxDepth=${2}></json-viewer>`
                : html`
                    <p class="muted">Loading...</p>
                  `
            }
          </div>

          <div class="glass-dashboard-card">
            <div class="card-header">
              <span class="card-header__prefix">${icon("shield", { className: "icon-xs" })}</span>
              <h3 class="card-header__title">Health</h3>
            </div>
            ${
              this.health
                ? html`<json-viewer .data=${this.health} .maxDepth=${2}></json-viewer>`
                : html`
                    <p class="muted">Loading...</p>
                  `
            }
          </div>

          <div class="glass-dashboard-card">
            <div class="card-header">
              <span class="card-header__prefix">${icon("spark", { className: "icon-xs" })}</span>
              <h3 class="card-header__title">Models (${this.models.length})</h3>
            </div>
            ${
              this.models.length > 0
                ? html`<json-viewer .data=${this.models} .maxDepth=${2}></json-viewer>`
                : html`
                    <p class="muted">Loading...</p>
                  `
            }
          </div>
        </div>

        <!-- Hello / Connection Info -->
        ${
          this.gateway?.hello
            ? html`
          <div class="glass-dashboard-card">
            <div class="card-header">
              <span class="card-header__prefix">${icon("link", { className: "icon-xs" })}</span>
              <h3 class="card-header__title">Hello Handshake</h3>
            </div>
            <json-viewer .data=${this.gateway.hello} .maxDepth=${3}></json-viewer>
          </div>
        `
            : nothing
        }
        `
            : nothing
        }
      </div>
    `;
  }
}
