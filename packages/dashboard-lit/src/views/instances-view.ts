import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import "../components/status-chip.js";
import "../components/empty-state.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadPresence, type PresenceEntry } from "../controllers/presence.js";

const ACTIVE_THRESHOLD_MS = 2 * 60_000; // 2 minutes

@customElement("instances-view")
export class InstancesView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private entries: PresenceEntry[] = [];
  @state() private error: string | null = null;
  @state() private expandedKeys = new Set<string>();
  @state() private showPairingInfo = false;

  private lastConnectedState: boolean | null = null;
  private unsubPresence: (() => void) | null = null;

  override updated(): void {
    const connected = this.gateway?.connected ?? false;
    if (connected && this.lastConnectedState !== true) {
      void this.refresh();
      this.subscribeToPresence();
    }
    if (!connected && this.lastConnectedState === true) {
      this.unsubscribePresence();
    }
    this.lastConnectedState = connected;
  }

  override disconnectedCallback(): void {
    this.unsubscribePresence();
    super.disconnectedCallback();
  }

  private subscribeToPresence(): void {
    this.unsubscribePresence();
    if (this.gateway?.subscribe) {
      this.unsubPresence = this.gateway.subscribe("system-presence", () => {
        void this.refresh();
      });
    }
  }

  private unsubscribePresence(): void {
    if (this.unsubPresence) {
      this.unsubPresence();
      this.unsubPresence = null;
    }
  }

  private async refresh(): Promise<void> {
    if (!this.gateway?.connected || this.loading) {
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      this.entries = await loadPresence(this.gateway.request);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load instances";
    } finally {
      this.loading = false;
    }
  }

  private entryIsConnected(entry: PresenceEntry): boolean {
    if (!entry.lastActiveAt) {
      return false;
    }
    return Date.now() - entry.lastActiveAt < ACTIVE_THRESHOLD_MS;
  }

  private toggleExpanded(key: string): void {
    const next = new Set(this.expandedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.expandedKeys = next;
  }

  private formatAge(ts?: number): string {
    if (!ts) {
      return "\u2014";
    }
    const diff = Date.now() - ts;
    if (diff < 60_000) {
      return "just now";
    }
    if (diff < 3600_000) {
      return `${Math.floor(diff / 60_000)}m ago`;
    }
    if (diff < 86400_000) {
      return `${Math.floor(diff / 3600_000)}h ago`;
    }
    return `${Math.floor(diff / 86400_000)}d ago`;
  }

  private renderDetail(label: string, value: string | undefined) {
    if (!value) {
      return nothing;
    }
    return html`<div class="muted"><strong>${label}:</strong> ${value}</div>`;
  }

  private renderEntry(entry: PresenceEntry) {
    const connected = this.entryIsConnected(entry);
    const status = connected ? "connected" : "disconnected";
    const expanded = this.expandedKeys.has(entry.key);
    const hasDetails =
      entry.roles?.length ||
      entry.scopes?.length ||
      entry.platform ||
      entry.deviceFamily ||
      entry.deviceId;

    return html`
      <div class="glass-dashboard-card instance-card">
        <div class="card-header">
          <span class="card-header__prefix">${icon("monitor", { className: "icon-xs" })}</span>
          <h3 class="card-header__title">${entry.key}</h3>
          <status-chip status=${status}></status-chip>
        </div>
        <div class="instance-meta">
          ${entry.mode ? html`<span class="chip">${entry.mode}</span>` : nothing}
          ${entry.clientVersion ? html`<span class="chip chip--muted">v${entry.clientVersion}</span>` : nothing}
        </div>
        <div class="instance-times">
          <span class="muted">Connected: ${this.formatAge(entry.connectedAt)}</span>
          <span class="muted">Last active: ${this.formatAge(entry.lastActiveAt)}</span>
        </div>
        ${
          hasDetails
            ? html`
          <button class="btn-ghost-sm" @click=${() => this.toggleExpanded(entry.key)}>
            ${icon(expanded ? "chevronUp" : "chevronDown", { className: "icon-xs" })}
            ${expanded ? "Hide details" : "Show details"}
          </button>
        `
            : nothing
        }
        ${
          expanded && hasDetails
            ? html`
          <div class="instance-meta">
            ${entry.roles?.length ? this.renderDetail("Roles", entry.roles.join(", ")) : nothing}
            ${entry.scopes?.length ? this.renderDetail("Scopes", entry.scopes.join(", ")) : nothing}
            ${this.renderDetail("Platform", entry.platform)}
            ${this.renderDetail("Device family", entry.deviceFamily)}
            ${this.renderDetail("Device ID", entry.deviceId)}
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  override render() {
    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("radio", { className: "icon-sm" })} Instances</h2>
          <div class="view-actions">
            <button class="btn-ghost" @click=${() => {
              this.showPairingInfo = !this.showPairingInfo;
            }}>
              ${icon("plus", { className: "icon-xs" })} Pair Device
            </button>
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${
          this.showPairingInfo
            ? html`
          <div class="glass-dashboard-card">
            <div class="card-header">
              <span class="card-header__prefix">${icon("link", { className: "icon-xs" })}</span>
              <h3 class="card-header__title">Pair a New Device</h3>
            </div>
            <p class="muted">
              Use <code>openclaw devices pair</code> on the device you want to connect.
            </p>
            <button class="btn-ghost-sm" @click=${() => {
              this.showPairingInfo = false;
            }}>
              Dismiss
            </button>
          </div>
        `
            : nothing
        }

        ${
          this.error
            ? html`
          <div class="view-error">
            ${icon("alert", { className: "icon-xs" })} ${this.error}
          </div>
        `
            : nothing
        }

        ${
          this.loading && this.entries.length === 0
            ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Loading...</div>`
            : nothing
        }

        ${
          this.entries.length === 0 && !this.loading && !this.error
            ? html`
          <empty-state
            icon="radio"
            heading="No instances"
            message="No connected instances found."
            actionLabel="Refresh"
            @action=${() => void this.refresh()}
          ></empty-state>
        `
            : nothing
        }

        ${
          this.entries.length > 0
            ? html`
          <div class="instances-list">
            ${this.entries.map((entry) => this.renderEntry(entry))}
          </div>
        `
            : nothing
        }
      </div>
    `;
  }
}
