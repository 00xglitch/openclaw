import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import "../components/status-chip.js";
import "../components/empty-state.js";
import "../components/confirm-dialog.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadPresence, type PresenceEntry } from "../controllers/presence.js";

const ACTIVE_THRESHOLD_MS = 2 * 60_000; // 2 minutes
const REFRESH_INTERVAL_MS = 15_000; // 15 seconds

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
  @state() private waitingForDevice = false;
  @state() private pairingCopied = false;
  @state() private lastRefreshedAt: number | null = null;
  @state() private timeSinceRefresh = "";
  @state() private disconnectConfirmKey: string | null = null;

  private lastConnectedState: boolean | null = null;
  private unsubPresence: (() => void) | null = null;
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private tickIntervalId: ReturnType<typeof setInterval> | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.startPeriodicRefresh();
    this.startTickTimer();
  }

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
    this.stopPeriodicRefresh();
    this.stopTickTimer();
    super.disconnectedCallback();
  }

  private startPeriodicRefresh(): void {
    this.stopPeriodicRefresh();
    this.refreshIntervalId = setInterval(() => {
      void this.refresh();
    }, REFRESH_INTERVAL_MS);
  }

  private stopPeriodicRefresh(): void {
    if (this.refreshIntervalId !== null) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  private startTickTimer(): void {
    this.stopTickTimer();
    this.tickIntervalId = setInterval(() => {
      this.updateTimeSinceRefresh();
    }, 1000);
  }

  private stopTickTimer(): void {
    if (this.tickIntervalId !== null) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
  }

  private updateTimeSinceRefresh(): void {
    if (!this.lastRefreshedAt) {
      this.timeSinceRefresh = "";
      return;
    }
    const seconds = Math.floor((Date.now() - this.lastRefreshedAt) / 1000);
    this.timeSinceRefresh = `${seconds}s ago`;
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
      this.lastRefreshedAt = Date.now();
      this.updateTimeSinceRefresh();
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

  private formatUptime(connectedAt?: number): string {
    if (!connectedAt) {
      return "\u2014";
    }
    const diff = Date.now() - connectedAt;
    if (diff < 0) {
      return "\u2014";
    }
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  }

  private getPairingGatewayUrl(): string {
    if (this.gateway?.gatewayUrl) {
      return this.gateway.gatewayUrl;
    }
    const loc = window.location;
    const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${loc.host}`;
  }

  private getPairingInfo(): string {
    const url = this.getPairingGatewayUrl();
    return `openclaw devices pair --gateway "${url}"`;
  }

  private handleCopyPairing = (): void => {
    const info = this.getPairingInfo();
    navigator.clipboard.writeText(info).catch(() => {});
    this.pairingCopied = true;
    setTimeout(() => {
      this.pairingCopied = false;
    }, 2000);
  };

  private handlePairDevice = (): void => {
    this.showPairingInfo = !this.showPairingInfo;
    if (this.showPairingInfo) {
      this.waitingForDevice = false;
      this.pairingCopied = false;
    }
  };

  private handleWaitForDevice = (): void => {
    this.waitingForDevice = true;
  };

  private handleDismissPairing = (): void => {
    this.showPairingInfo = false;
    this.waitingForDevice = false;
    this.pairingCopied = false;
  };

  private async disconnectInstance(key: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("instances.disconnect", { key });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to disconnect instance";
    }
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
          <span class="muted">Last seen: ${this.formatAge(entry.lastActiveAt)}</span>
          <span class="muted">Connected: ${this.formatAge(entry.connectedAt)}</span>
          <span class="muted">Uptime: ${this.formatUptime(entry.connectedAt)}</span>
        </div>
        <div class="instance-actions">
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
            connected
              ? html`
            <button class="btn-ghost-sm btn-ghost-sm--danger" @click=${() => {
              this.disconnectConfirmKey = entry.key;
            }}>
              ${icon("x", { className: "icon-xs" })} Disconnect
            </button>
          `
              : nothing
          }
        </div>
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
            ${
              this.timeSinceRefresh
                ? html`<span class="muted text-xs">Last updated: ${this.timeSinceRefresh}</span>`
                : nothing
            }
            <button class="btn-ghost" @click=${this.handlePairDevice}>
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
              Run the following command on the device you want to connect:
            </p>
            <div class="pairing-command">
              <code class="pairing-command__text">${this.getPairingInfo()}</code>
              <button class="btn-ghost-sm" @click=${this.handleCopyPairing}>
                ${icon(this.pairingCopied ? "check" : "copy", { className: "icon-xs" })}
                ${this.pairingCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div class="pairing-details muted">
              <div><strong>Gateway URL:</strong> <code>${this.getPairingGatewayUrl()}</code></div>
            </div>
            <div class="instance-actions" style="margin-top: 0.5rem;">
              ${
                this.waitingForDevice
                  ? html`
                <span class="muted">
                  ${icon("loader", { className: "icon-xs icon-spin" })} Waiting for device...
                </span>
              `
                  : html`
                <button class="btn-ghost-sm" @click=${this.handleWaitForDevice}>
                  ${icon("clock", { className: "icon-xs" })} Wait for device
                </button>
              `
              }
              <button class="btn-ghost-sm" @click=${this.handleDismissPairing}>
                Dismiss
              </button>
            </div>
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

      <confirm-dialog
        .open=${this.disconnectConfirmKey !== null}
        title="Disconnect Instance"
        message="This will forcefully disconnect the instance. It may automatically reconnect."
        confirmLabel="Disconnect"
        confirmVariant="danger"
        @confirm=${() => {
          if (this.disconnectConfirmKey) {
            void this.disconnectInstance(this.disconnectConfirmKey);
            this.disconnectConfirmKey = null;
          }
        }}
        @cancel=${() => {
          this.disconnectConfirmKey = null;
        }}
      ></confirm-dialog>
    `;
  }
}
