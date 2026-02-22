import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon, type IconName } from "../components/icons.js";
import "../components/json-viewer.js";
import "../components/empty-state.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";

type ChannelSnapshot = {
  channels?: Record<string, unknown>;
  channelAccounts?: Record<
    string,
    Array<{ id?: string; name?: string; status?: string; lastActivity?: number }>
  >;
  channelMeta?: Array<{ key: string; label?: string; icon?: string; enabled?: boolean }>;
  channelOrder?: string[];
};

type BindingEntry = {
  agentId?: string;
  match?: { channel?: string; peer?: unknown };
};

const CHANNEL_ICONS: Record<string, { icon: IconName; emoji: string }> = {
  whatsapp: { icon: "messageSquare", emoji: "\u{1F4AC}" },
  telegram: { icon: "send", emoji: "\u2708\uFE0F" },
  discord: { icon: "monitor", emoji: "\u{1F3AE}" },
  slack: { icon: "radio", emoji: "\u{1F4BC}" },
  signal: { icon: "key", emoji: "\u{1F512}" },
  imessage: { icon: "messageSquare", emoji: "\u{1F34E}" },
  web: { icon: "externalLink", emoji: "\u{1F310}" },
  email: { icon: "fileText", emoji: "\u{1F4E7}" },
};

const DEFAULT_CHANNEL_ICON: { icon: IconName; emoji: string } = {
  icon: "radio",
  emoji: "\u{1F4E1}",
};

@customElement("channels-view")
export class ChannelsView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private snapshot: ChannelSnapshot | null = null;
  @state() private rawExpanded = false;
  @state() private error = "";
  @state() private qrModalOpen = false;
  @state() private qrData = "";
  @state() private qrLoading = false;
  @state() private expandedConfigs = new Set<string>();
  @state() private channelConfigs = new Map<string, unknown>();
  @state() private bindings: BindingEntry[] = [];

  private lastConnectedState: boolean | null = null;
  private qrUnsubscribe: (() => void) | null = null;

  override updated(): void {
    const connected = this.gateway?.connected ?? false;
    if (connected && this.lastConnectedState !== true) {
      void this.refresh();
    }
    this.lastConnectedState = connected;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupQrSubscription();
  }

  private cleanupQrSubscription(): void {
    if (this.qrUnsubscribe) {
      this.qrUnsubscribe();
      this.qrUnsubscribe = null;
    }
  }

  private async refresh(): Promise<void> {
    if (!this.gateway?.connected || this.loading) {
      return;
    }
    this.loading = true;
    this.error = "";
    try {
      const [snapshot, configRes] = await Promise.allSettled([
        this.gateway.request<ChannelSnapshot>("channels.status", { probe: true, timeoutMs: 8000 }),
        this.gateway.request<{ config: string; json?: Record<string, unknown> }>("config.get", {}),
      ]);
      if (snapshot.status === "fulfilled") {
        this.snapshot = snapshot.value;
      } else {
        this.error =
          snapshot.reason instanceof Error ? snapshot.reason.message : String(snapshot.reason);
      }
      if (configRes.status === "fulfilled" && configRes.value.json) {
        const json = configRes.value.json;
        // Extract bindings
        const rawBindings = json.bindings;
        if (Array.isArray(rawBindings)) {
          this.bindings = rawBindings as BindingEntry[];
        } else {
          this.bindings = [];
        }
        // Extract per-channel config from channels section
        const channels = json.channels;
        if (channels && typeof channels === "object") {
          const map = new Map<string, unknown>();
          for (const [k, v] of Object.entries(channels as Record<string, unknown>)) {
            map.set(k, v);
          }
          this.channelConfigs = map;
        }
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async logoutChannel(channel: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("channels.logout", { channel });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async startWhatsAppLogin(): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    this.qrModalOpen = true;
    this.qrData = "";
    this.qrLoading = true;

    // Subscribe to QR events
    this.cleanupQrSubscription();
    this.qrUnsubscribe = this.gateway.subscribe("web.login.qr", (payload: unknown) => {
      const p = payload as { qr?: string; data?: string };
      this.qrData = p.qr ?? p.data ?? JSON.stringify(payload);
      this.qrLoading = false;
    });

    try {
      await this.gateway.request("web.login.start", {});
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.qrLoading = false;
    }
  }

  private closeQrModal(): void {
    this.qrModalOpen = false;
    this.qrData = "";
    this.qrLoading = false;
    this.cleanupQrSubscription();
  }

  private toggleConfig(channelKey: string): void {
    const next = new Set(this.expandedConfigs);
    if (next.has(channelKey)) {
      next.delete(channelKey);
    } else {
      next.add(channelKey);
    }
    this.expandedConfigs = next;
  }

  private hasRecentActivity(lastActivity?: number): boolean {
    if (!lastActivity) {
      return false;
    }
    return Date.now() - lastActivity < 600_000; // 10 minutes
  }

  private getBindingsForChannel(channelKey: string): BindingEntry[] {
    return this.bindings.filter((b) => b.match?.channel === channelKey);
  }

  override render() {
    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("link", { className: "icon-sm" })} Channels</h2>
          <div class="view-actions">
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${icon("alert", { className: "icon-xs" })} ${this.error}</div>` : nothing}

        ${
          this.loading && !this.snapshot
            ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Probing channels...</div>`
            : nothing
        }

        ${this.snapshot ? this.renderChannels() : nothing}

        ${this.qrModalOpen ? this.renderQrModal() : nothing}
      </div>
    `;
  }

  private renderQrModal() {
    return html`
      <div class="modal-overlay" @click=${() => this.closeQrModal()}>
        <div class="glass-dashboard-card" style="max-width:480px;margin:auto;margin-top:10vh;" @click=${(e: Event) => e.stopPropagation()}>
          <div class="card-header">
            <span class="card-header__prefix">${icon("messageSquare", { className: "icon-sm" })}</span>
            <h3 class="card-header__title">WhatsApp QR Login</h3>
            <button class="btn-ghost-sm" @click=${() => this.closeQrModal()}>
              ${icon("x", { className: "icon-xs" })}
            </button>
          </div>
          ${
            this.qrLoading
              ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Waiting for QR code...</div>`
              : this.qrData
                ? html`<pre class="code-block" style="word-break:break-all;white-space:pre-wrap;font-size:0.7rem;">${this.qrData}</pre>`
                : html`
                    <p class="muted">No QR data received yet.</p>
                  `
          }
          <div class="channel-actions" style="margin-top:0.5rem;">
            <button class="btn-ghost-sm" @click=${() => this.closeQrModal()}>Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderChannels() {
    const snap = this.snapshot!;
    const order = snap.channelOrder ?? Object.keys(snap.channels ?? {});
    const meta = snap.channelMeta ?? [];

    if (order.length === 0) {
      return html`
        <empty-state
          icon="radio"
          heading="No Channels"
          message="No channels configured. Add channel configuration in the Config view."
          actionLabel="Refresh"
          @action=${() => void this.refresh()}
        ></empty-state>
      `;
    }

    return html`
      <div class="channel-grid">
        ${order.map((key) => {
          const m = meta.find((x) => x.key === key);
          const accounts = snap.channelAccounts?.[key] ?? [];
          const channelData = (snap.channels as Record<string, unknown>)?.[key];
          const isEnabled = m?.enabled !== false;
          const ch = CHANNEL_ICONS[key] ?? DEFAULT_CHANNEL_ICON;
          const channelBindings = this.getBindingsForChannel(key);
          const configExpanded = this.expandedConfigs.has(key);
          const channelConfig = this.channelConfigs.get(key);

          return html`
            <div class="glass-dashboard-card channel-card ${isEnabled ? "" : "channel-card--disabled"}">
              <div class="card-header">
                <span class="card-header__prefix">${icon(ch.icon, { className: "icon-sm" })} ${ch.emoji}</span>
                <h3 class="card-header__title">${m?.label ?? key}</h3>
                <span class="chip ${isEnabled ? "chip--success" : "chip--muted"}">${isEnabled ? "Enabled" : "Disabled"}</span>
              </div>

              ${
                accounts.length > 0
                  ? html`
                <div class="channel-accounts">
                  ${accounts.map(
                    (acc) => html`
                    <div class="channel-account">
                      <span class="channel-account__name">${acc.name ?? acc.id ?? "Account"}</span>
                      <span class="chip ${this.hasRecentActivity(acc.lastActivity) ? "chip--success" : "chip--muted"}">
                        ${acc.status ?? (this.hasRecentActivity(acc.lastActivity) ? "Active" : "Idle")}
                      </span>
                    </div>
                  `,
                  )}
                </div>
              `
                  : html`
                      <p class="muted" style="font-size: 0.82rem">No accounts configured</p>
                    `
              }

              ${
                channelBindings.length > 0
                  ? html`
                <div style="display:flex;flex-wrap:wrap;gap:0.25rem;margin-top:0.25rem;">
                  ${channelBindings.map(
                    (b) => html`
                    <span class="chip">${icon("bot", { className: "icon-xs" })} ${b.agentId ?? "unknown"}</span>
                  `,
                  )}
                </div>
              `
                  : nothing
              }

              <div class="channel-actions">
                ${
                  key === "whatsapp"
                    ? html`
                  <button class="btn-ghost-sm" @click=${() => void this.startWhatsAppLogin()}>
                    ${icon("key", { className: "icon-xs" })} QR Login
                  </button>
                `
                    : nothing
                }
                ${
                  channelData || channelConfig
                    ? html`
                  <button class="btn-ghost-sm" @click=${() => this.toggleConfig(key)}>
                    ${icon(configExpanded ? "chevronDown" : "chevronRight", { className: "icon-xs" })} Config
                  </button>
                `
                    : nothing
                }
                ${
                  isEnabled
                    ? html`
                  <button class="btn-ghost-sm" @click=${() => void this.logoutChannel(key)}>
                    Logout
                  </button>
                `
                    : nothing
                }
              </div>

              ${
                configExpanded
                  ? html`
                ${
                  channelConfig
                    ? html`
                  <json-viewer .data=${channelConfig} .expanded=${true} .maxDepth=${4}></json-viewer>
                `
                    : nothing
                }
                ${
                  channelData && !channelConfig
                    ? html`
                  <json-viewer .data=${channelData} .expanded=${true} .maxDepth=${4}></json-viewer>
                `
                    : channelData && channelConfig
                      ? html`
                  <details class="channel-raw" style="margin-top:0.5rem;">
                    <summary class="muted" style="font-size:0.75rem;cursor:pointer;">Raw status data</summary>
                    <json-viewer .data=${channelData} .expanded=${false} .maxDepth=${3}></json-viewer>
                  </details>
                `
                      : nothing
                }
              `
                  : nothing
              }
            </div>
          `;
        })}
      </div>

      <details class="view-raw-details" .open=${this.rawExpanded} @toggle=${(e: Event) => {
        this.rawExpanded = (e.target as HTMLDetailsElement).open;
      }}>
        <summary class="muted" style="cursor:pointer;margin-top:1rem;">Full channel snapshot</summary>
        <json-viewer .data=${this.snapshot} .expanded=${false} .maxDepth=${3}></json-viewer>
      </details>
    `;
  }
}
