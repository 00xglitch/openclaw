import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { normalizeBasePath, pathForTab, tabFromPath, type Tab } from "./lib/navigation.js";
import "./components/gateway-provider.js";
import "./views/overview-view.js";
import "./views/chat-view.js";

declare global {
  interface Window {
    __OPENCLAW_CONTROL_UI_BASE_PATH__?: string;
  }
}

function resolveBasePath(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const overrideBase = window.__OPENCLAW_CONTROL_UI_BASE_PATH__;
  if (overrideBase !== undefined && overrideBase !== null) {
    return normalizeBasePath(String(overrideBase));
  }

  const viteBase = String(import.meta.env?.BASE_URL ?? "").trim();
  if (!viteBase || viteBase === "/" || viteBase === "." || viteBase === "./") {
    return "";
  }

  return normalizeBasePath(viteBase);
}

@customElement("dashboard-app")
export class DashboardApp extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @state() tab: Tab = "overview";
  @state() basePath = "";

  override connectedCallback(): void {
    super.connectedCallback();
    this.basePath = resolveBasePath();
    this.syncTabFromUrl();
    window.addEventListener("popstate", this.handlePopState);
  }

  override disconnectedCallback(): void {
    window.removeEventListener("popstate", this.handlePopState);
    super.disconnectedCallback();
  }

  private handlePopState = (): void => {
    this.syncTabFromUrl();
  };

  private syncTabFromUrl(): void {
    const tab = tabFromPath(window.location.pathname, this.basePath);
    if (tab) {
      this.tab = tab;
    }
  }

  private setTab(tab: Tab): void {
    if (this.tab === tab) {
      return;
    }
    this.tab = tab;
    const path = pathForTab(tab, this.basePath);
    window.history.pushState({}, "", path);
  }

  override render() {
    const base = this.basePath || "";

    return html`
      <gateway-provider>
        <div class="app-shell">
          <header class="topbar">
            <strong>OpenClaw Dashboard</strong>
            <nav>
              <a
                class="tab-link ${this.tab === "overview" ? "active" : ""}"
                href="${base}/overview"
                @click=${(e: Event) => {
                  e.preventDefault();
                  this.setTab("overview");
                }}
              >
                Overview
              </a>
              <a
                class="tab-link ${this.tab === "chat" ? "active" : ""}"
                href="${base}/chat"
                @click=${(e: Event) => {
                  e.preventDefault();
                  this.setTab("chat");
                }}
              >
                Chat
              </a>
            </nav>
          </header>
          <main>
            ${
              this.tab === "overview"
                ? html`
                    <overview-view></overview-view>
                  `
                : null
            }
            ${
              this.tab === "chat"
                ? html`
                    <chat-view></chat-view>
                  `
                : null
            }
          </main>
        </div>
      </gateway-provider>
    `;
  }
}
