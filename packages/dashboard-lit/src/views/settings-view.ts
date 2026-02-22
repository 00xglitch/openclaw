import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import {
  loadStoredToken,
  storeToken,
  storeGatewayUrl,
  loadStoredGatewayUrl,
} from "../lib/local-settings.js";

type ThemeMode = "docsTheme" | "landingTheme" | "light";
const THEME_KEY = "openclaw.dashboard.theme";

@customElement("settings-view")
export class SettingsView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private gatewayUrl = "";
  @state() private token = "";
  @state() private tokenVisible = false;
  @state() private sessionKey = "agent:main:main";
  @state() private theme: ThemeMode = "docsTheme";
  @state() private language = "en";
  @state() private saved = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.token = loadStoredToken();
    this.gatewayUrl = loadStoredGatewayUrl();
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "docsTheme" || savedTheme === "landingTheme" || savedTheme === "light") {
      this.theme = savedTheme;
    }
  }

  private save(): void {
    if (this.gatewayUrl.trim()) {
      storeGatewayUrl(this.gatewayUrl.trim());
    }
    if (this.token.trim()) {
      storeToken(this.token.trim());
    }
    localStorage.setItem(THEME_KEY, this.theme);
    document.documentElement.setAttribute("data-theme", this.theme);
    this.saved = true;
    setTimeout(() => {
      this.saved = false;
    }, 2000);
  }

  private reconnect(): void {
    this.save();
    this.gateway?.reconnect({
      gatewayUrl: this.gatewayUrl.trim() || "ws://127.0.0.1:18789",
      token: this.token.trim(),
      password: "",
    });
  }

  override render() {
    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("settings", { className: "icon-sm" })} Settings</h2>
        </div>

        <div class="settings-grid">
          <!-- Connection -->
          <div class="glass-dashboard-card">
            <div class="card-header">
              <span class="card-header__prefix">${icon("link", { className: "icon-xs" })}</span>
              <h3 class="card-header__title">Connection</h3>
            </div>
            <div class="settings-form">
              <label>
                Gateway URL
                <input type="text" .value=${this.gatewayUrl}
                  @input=${(e: Event) => {
                    this.gatewayUrl = (e.target as HTMLInputElement).value;
                  }}
                  placeholder="ws://127.0.0.1:18789"
                />
              </label>
              <label>
                Gateway Token
                <div class="input-with-toggle">
                  <input type=${this.tokenVisible ? "text" : "password"} .value=${this.token}
                    @input=${(e: Event) => {
                      this.token = (e.target as HTMLInputElement).value;
                    }}
                    placeholder="OPENCLAW_GATEWAY_TOKEN"
                  />
                  <button type="button" class="input-toggle-btn"
                    @click=${() => {
                      this.tokenVisible = !this.tokenVisible;
                    }}
                    title=${this.tokenVisible ? "Hide" : "Show"}>
                    ${icon(this.tokenVisible ? "eyeOff" : "eye", { className: "icon-xs" })}
                  </button>
                </div>
              </label>
              <label>
                Default Session Key
                <input type="text" .value=${this.sessionKey}
                  @input=${(e: Event) => {
                    this.sessionKey = (e.target as HTMLInputElement).value;
                  }}
                />
              </label>
            </div>
          </div>

          <!-- Appearance -->
          <div class="glass-dashboard-card">
            <div class="card-header">
              <span class="card-header__prefix">${icon("sun", { className: "icon-xs" })}</span>
              <h3 class="card-header__title">Appearance</h3>
            </div>
            <div class="settings-form">
              <label>
                Theme
                <select .value=${this.theme}
                  @change=${(e: Event) => {
                    this.theme = (e.target as HTMLSelectElement).value as ThemeMode;
                  }}>
                  <option value="docsTheme">Docs (Warm Dark)</option>
                  <option value="landingTheme">Landing (Deep Dark)</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <label>
                Language
                <select .value=${this.language}
                  @change=${(e: Event) => {
                    this.language = (e.target as HTMLSelectElement).value;
                  }}>
                  <option value="en">English</option>
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-TW">繁體中文</option>
                  <option value="pt-BR">Português (Brasil)</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div class="settings-actions" style="margin-top:1rem;display:flex;gap:8px;align-items:center;">
          <button class="btn-primary" @click=${() => this.save()}>Save Preferences</button>
          <button @click=${() => this.reconnect()}>Save & Reconnect</button>
          ${this.saved ? html`<span class="muted" style="font-size:0.82rem;">${icon("check", { className: "icon-xs" })} Saved</span>` : nothing}
        </div>

        <div class="glass-dashboard-card" style="margin-top:1rem;">
          <div class="card-header">
            <h3 class="card-header__title">About</h3>
          </div>
          <p class="muted" style="font-size:0.82rem;">
            OpenClaw Dashboard (Lit Edition). Settings are stored in localStorage and persist across sessions.
          </p>
        </div>
      </div>
    `;
  }
}
