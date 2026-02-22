import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";

type NodeEntry = {
  id: string;
  host?: string;
  status?: string;
  connectedAt?: number;
  capabilities?: string[];
  commands?: string[];
};

type DeviceEntry = {
  id: string;
  label?: string;
  status?: "pending" | "paired" | "revoked";
  family?: string;
  role?: string;
  pairedAt?: number;
};

@customElement("nodes-view")
export class NodesView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private nodes: NodeEntry[] = [];
  @state() private devices: DeviceEntry[] = [];
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
      const [nodesRes, devicesRes] = await Promise.allSettled([
        this.gateway.request<{ nodes: NodeEntry[] }>("node.list", {}),
        this.gateway.request<{ devices: DeviceEntry[] }>("device.pair.list", {}),
      ]);
      if (nodesRes.status === "fulfilled") {
        this.nodes = nodesRes.value?.nodes ?? [];
      }
      if (devicesRes.status === "fulfilled") {
        this.devices = devicesRes.value?.devices ?? [];
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async approveDevice(id: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("device.pair.approve", { id });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async rejectDevice(id: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("device.pair.reject", { id });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async revokeDevice(id: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("device.pair.revoke", { id });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async rotateToken(id: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("device.token.rotate", { id });
      this.error = ""; // clear any previous error
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private formatAge(ts?: number): string {
    if (!ts) {
      return "—";
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

  override render() {
    const pendingDevices = this.devices.filter((d) => d.status === "pending");
    const pairedDevices = this.devices.filter((d) => d.status === "paired");

    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("monitor", { className: "icon-sm" })} Nodes & Devices</h2>
          <div class="view-actions">
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}

        ${
          this.loading && this.nodes.length === 0 && this.devices.length === 0
            ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Loading...</div>`
            : nothing
        }

        <!-- Exec Nodes -->
        <h3 class="view-section-title">Exec Nodes</h3>
        <div class="nodes-grid">
          ${this.nodes.map(
            (node) => html`
            <div class="glass-dashboard-card node-card">
              <div class="card-header">
                <span class="card-header__prefix">${icon("server", { className: "icon-xs" })}</span>
                <h3 class="card-header__title">${node.host ?? node.id}</h3>
                <span class="chip ${node.status === "connected" ? "chip--success" : "chip--muted"}">${node.status ?? "unknown"}</span>
              </div>
              <div class="node-meta">
                <span class="muted">Connected: ${this.formatAge(node.connectedAt)}</span>
              </div>
              ${
                node.capabilities?.length
                  ? html`
                <div class="node-caps">
                  ${node.capabilities.map((c) => html`<span class="chip">${c}</span>`)}
                </div>
              `
                  : nothing
              }
            </div>
          `,
          )}
          ${
            this.nodes.length === 0 && !this.loading
              ? html`
                  <div class="glass-dashboard-card"><p class="muted">No exec nodes connected.</p></div>
                `
              : nothing
          }
        </div>

        <!-- Pending Device Pairings -->
        ${
          pendingDevices.length > 0
            ? html`
          <h3 class="view-section-title">Pending Pairings (${pendingDevices.length})</h3>
          <div class="nodes-grid">
            ${pendingDevices.map(
              (d) => html`
              <div class="glass-dashboard-card node-card node-card--pending">
                <div class="card-header">
                  <span class="card-header__prefix">${icon("key", { className: "icon-xs" })}</span>
                  <h3 class="card-header__title">${d.label ?? d.id}</h3>
                  <span class="chip chip--warn">pending</span>
                </div>
                <div class="node-meta">
                  ${d.family ? html`<span class="chip">${d.family}</span>` : nothing}
                  ${d.role ? html`<span class="chip">${d.role}</span>` : nothing}
                </div>
                <div class="node-actions">
                  <button class="btn-primary-sm" @click=${() => void this.approveDevice(d.id)}>
                    ${icon("check", { className: "icon-xs" })} Approve
                  </button>
                  <button class="btn-ghost-sm" @click=${() => void this.rejectDevice(d.id)}>
                    ${icon("x", { className: "icon-xs" })} Reject
                  </button>
                </div>
              </div>
            `,
            )}
          </div>
        `
            : nothing
        }

        <!-- Paired Devices -->
        <h3 class="view-section-title">Paired Devices (${pairedDevices.length})</h3>
        <div class="nodes-grid">
          ${pairedDevices.map(
            (d) => html`
            <div class="glass-dashboard-card node-card">
              <div class="card-header">
                <span class="card-header__prefix">${icon("shield", { className: "icon-xs" })}</span>
                <h3 class="card-header__title">${d.label ?? d.id}</h3>
                <span class="chip chip--success">paired</span>
              </div>
              <div class="node-meta">
                ${d.family ? html`<span class="chip">${d.family}</span>` : nothing}
                ${d.role ? html`<span class="chip">${d.role}</span>` : nothing}
                <span class="muted">Paired: ${this.formatAge(d.pairedAt)}</span>
              </div>
              <div class="node-actions" style="margin-top:8px;display:flex;gap:4px;">
                <button class="btn-ghost-sm" @click=${() => void this.rotateToken(d.id)} title="Rotate token">
                  ${icon("refresh", { className: "icon-xs" })} Rotate
                </button>
                <button class="btn-danger-sm" @click=${() => void this.revokeDevice(d.id)} title="Revoke device">
                  ${icon("x", { className: "icon-xs" })} Revoke
                </button>
              </div>
            </div>
          `,
          )}
          ${
            pairedDevices.length === 0 && !this.loading
              ? html`
                  <div class="glass-dashboard-card"><p class="muted">No paired devices.</p></div>
                `
              : nothing
          }
        </div>
      </div>
    `;
  }
}
