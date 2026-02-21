import { consume } from "@lit/context";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { gatewayContext } from "../context/gateway-context.js";

type ThemeMode = "dark" | "light";

const THEME_KEY = "openclaw.dashboard.theme";

@customElement("overview-view")
export class OverviewView extends LitElement {
  @consume({ context: gatewayContext, subscribe: true })
  gateway!: import("../context/gateway-context.js").GatewayState;

  @state() gatewayUrlInput = "";
  @state() sharedSecretInput = "";
  @state() theme: ThemeMode = "dark";

  override createRenderRoot() {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.initTheme();
  }

  override updated(): void {
    if (this.gateway && !this.gatewayUrlInput) {
      this.gatewayUrlInput = this.gateway.gatewayUrl;
    }
  }

  private initTheme(): void {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
      this.theme = saved;
      this.applyTheme(saved);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    this.theme = prefersDark ? "dark" : "light";
    this.applyTheme(this.theme);
  }

  private applyTheme(theme: ThemeMode): void {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.dataset.theme = theme;
  }

  private setTheme = (theme: ThemeMode): void => {
    this.theme = theme;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, theme);
    }
    this.applyTheme(theme);
  };

  private onReconnect = (): void => {
    if (!this.gateway) {
      return;
    }
    this.gateway.reconnect({
      gatewayUrl: this.gatewayUrlInput,
      sharedSecret: this.sharedSecretInput,
    });
  };

  private handleReconnectKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      this.onReconnect();
    }
  };

  override render() {
    const g = this.gateway;
    if (!g) {
      return html`
        <p class="muted">Loading...</p>
      `;
    }

    const error = g.lastError || "";
    const lowerError = error.toLowerCase();
    const isPasswordMismatch =
      lowerError.includes("password mismatch") || lowerError.includes("token mismatch");
    const needsDeviceIdentity = lowerError.includes("device identity");
    const hasSecureContext = typeof window !== "undefined" && window.isSecureContext;
    const showManualRetry = !g.connected && g.retryStalled;

    return html`
      <section class="overview-grid">
        <article class="panel hero-panel">
          <div class="hero-head">
            <div>
              <h2 class="title-with-icon">${icon("shield", { className: "icon-accent" })}Gateway connection</h2>
              <p class="muted">Securely connect this dashboard to your OpenClaw gateway.</p>
            </div>
            <div class="hero-actions">
              <span class="connection-badge ${g.connected ? "ok" : "warn"}">
                ${g.connected ? "Online" : "Offline"}
              </span>
              <div class="theme-toggle" role="group" aria-label="Theme">
                <button
                  class="theme-btn ${this.theme === "dark" ? "active" : ""}"
                  type="button"
                  @click=${() => this.setTheme("dark")}
                >
                  ${icon("moon", { className: "icon icon-xs" })}Dark
                </button>
                <button
                  class="theme-btn ${this.theme === "light" ? "active" : ""}"
                  type="button"
                  @click=${() => this.setTheme("light")}
                >
                  ${icon("sun", { className: "icon icon-xs" })}Light
                </button>
              </div>
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-card">
              <span class="stat-label">${icon("link", { className: "icon icon-xs icon-muted" })}State</span>
              <strong>${g.connected ? "Connected" : "Disconnected"}</strong>
            </div>
            <div class="stat-card">
              <span class="stat-label">${icon("activity", { className: "icon icon-xs icon-muted" })}Transport</span>
              <strong>${g.connecting ? "Reconnecting" : "Stable"}</strong>
            </div>
            <div class="stat-card">
              <span class="stat-label">${icon("refresh", { className: "icon icon-xs icon-muted" })}Retry attempts</span>
              <strong>${g.reconnectFailures}</strong>
            </div>
          </div>

          ${g.lastError ? html`<p class="error">${g.lastError}</p>` : null}

          ${
            showManualRetry
              ? html`
                  <div class="alert-card">
                    <strong class="title-with-icon">${icon("refresh", { className: "icon icon-sm" })}Reconnect is taking longer than expected</strong>
                    <p class="muted">Automatic retries are running. Force a fresh connect now.</p>
                    <button type="button" @click=${() => g.retryNow()}>${icon("refresh", { className: "icon icon-xs" })}Connect now</button>
                  </div>
                `
              : null
          }

          ${
            !hasSecureContext
              ? html`
                  <div class="alert-card">
                    <strong class="title-with-icon">${icon("alert", { className: "icon icon-sm" })}Secure context required</strong>
                    <p class="muted">
                      Use <code>http://localhost:5174</code> or HTTPS so device identity signing can work.
                    </p>
                  </div>
                `
              : null
          }

          ${
            needsDeviceIdentity
              ? html`
                  <div class="alert-card">
                    <strong class="title-with-icon">${icon("shield", { className: "icon icon-sm" })}Device identity required</strong>
                    <p class="muted">
                      If this persists, clear browser storage for this site and reconnect.
                    </p>
                  </div>
                `
              : null
          }

          ${
            isPasswordMismatch
              ? html`
                  <div class="alert-card">
                    <strong class="title-with-icon">${icon("key", { className: "icon icon-sm" })}Password mismatch fix</strong>
                    <ol>
                      <li>Run <code>openclaw config get gateway.auth.password</code></li>
                      <li>If empty, run <code>openclaw config get gateway.auth.token</code></li>
                      <li>Paste it below, then click <b>Connect</b></li>
                    </ol>
                  </div>
                `
              : null
          }

          <div class="connect-form">
            <label>
              Gateway URL
              <input
                .value=${this.gatewayUrlInput}
                @input=${(e: Event) => {
                  this.gatewayUrlInput = (e.target as HTMLInputElement).value;
                }}
                @keydown=${this.handleReconnectKeyDown}
                placeholder="ws://127.0.0.1:18789"
              />
            </label>

            <label>
              Shared secret
              <div class="input-row">
                <input
                  type="password"
                  .value=${this.sharedSecretInput}
                  @input=${(e: Event) => {
                    this.sharedSecretInput = (e.target as HTMLInputElement).value;
                  }}
                  @keydown=${this.handleReconnectKeyDown}
                  placeholder="Gateway shared secret (password/token)"
                />
                <button type="button" @click=${this.onReconnect}>${icon("spark", { className: "icon icon-xs" })}Connect</button>
              </div>
            </label>
          </div>

          <p class="muted">Tip: use <code>?token=...&gatewayUrl=...</code> to bootstrap settings.</p>
        </article>

        <article class="panel">
          <h3 class="title-with-icon">${icon("shield", { className: "icon icon-sm" })}Hello snapshot</h3>
          <pre>${JSON.stringify(g.hello, null, 2) || "(waiting for hello-ok)"}</pre>
        </article>

        <article class="panel">
          <h3 class="title-with-icon">${icon("activity", { className: "icon icon-sm" })}Latest event</h3>
          <pre>${JSON.stringify(g.lastEvent, null, 2) || "(no events yet)"}</pre>
        </article>
      </section>
    `;
  }
}
