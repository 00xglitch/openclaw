import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import "../components/json-viewer.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";

type ConfigSection = {
  key: string;
  label: string;
  icon: string;
};

const CONFIG_SECTIONS: ConfigSection[] = [
  { key: "env", label: "Environment", icon: "server" },
  { key: "agents", label: "Agents", icon: "folder" },
  { key: "auth", label: "Authentication", icon: "shield" },
  { key: "channels", label: "Channels", icon: "link" },
  { key: "messages", label: "Messages", icon: "messageSquare" },
  { key: "commands", label: "Commands", icon: "terminal" },
  { key: "hooks", label: "Hooks", icon: "zap" },
  { key: "skills", label: "Skills", icon: "zap" },
  { key: "tools", label: "Tools", icon: "settings" },
  { key: "gateway", label: "Gateway", icon: "radio" },
  { key: "wizard", label: "Wizard", icon: "spark" },
  { key: "meta", label: "Meta", icon: "fileText" },
  { key: "logging", label: "Logging", icon: "scrollText" },
];

@customElement("config-view")
export class ConfigView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private saving = false;
  @state() private configRaw = "";
  @state() private configJson: Record<string, unknown> | null = null;
  @state() private schema: unknown = null;
  @state() private mode: "form" | "raw" = "form";
  @state() private activeSection = "env";
  @state() private error = "";
  @state() private saveMessage = "";
  @state() private editedRaw = "";
  @state() private patchPath = "";
  @state() private patchValue = "";
  @state() private patching = false;

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
      const [configRes, schemaRes] = await Promise.allSettled([
        this.gateway.request<{ config: string; json?: Record<string, unknown> }>("config.get", {}),
        this.gateway.request("config.schema", {}),
      ]);
      if (configRes.status === "fulfilled") {
        const val = configRes.value;
        if (typeof val === "string") {
          this.configRaw = val;
          try {
            this.configJson = JSON.parse(val);
          } catch {
            this.configJson = null;
          }
        } else if (val && typeof val === "object") {
          if ("config" in val && typeof val.config === "string") {
            this.configRaw = val.config;
            try {
              this.configJson = JSON.parse(val.config);
            } catch {
              this.configJson = null;
            }
          } else {
            this.configJson = val as Record<string, unknown>;
            this.configRaw = JSON.stringify(val, null, 2);
          }
        }
        this.editedRaw = this.configRaw;
      }
      if (schemaRes.status === "fulfilled") {
        this.schema = schemaRes.value;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async saveConfig(): Promise<void> {
    if (!this.gateway?.connected || this.saving) {
      return;
    }
    this.saving = true;
    this.error = "";
    this.saveMessage = "";
    try {
      if (this.mode === "raw") {
        // Validate JSON
        JSON.parse(this.editedRaw);
        await this.gateway.request("config.set", { config: this.editedRaw });
      }
      this.saveMessage = "Config saved successfully";
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.saving = false;
      setTimeout(() => {
        this.saveMessage = "";
      }, 3000);
    }
  }

  private async patchConfig(): Promise<void> {
    if (!this.gateway?.connected || this.patching || !this.patchPath.trim()) {
      return;
    }
    this.patching = true;
    this.error = "";
    this.saveMessage = "";
    try {
      let value: unknown;
      try {
        value = JSON.parse(this.patchValue);
      } catch {
        value = this.patchValue; // treat as string if not valid JSON
      }
      await this.gateway.request("config.patch", {
        path: this.patchPath.trim(),
        value,
      });
      this.saveMessage = `Patched "${this.patchPath.trim()}" successfully`;
      this.patchPath = "";
      this.patchValue = "";
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.patching = false;
      setTimeout(() => {
        this.saveMessage = "";
      }, 3000);
    }
  }

  private async applyConfig(): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("config.apply", {});
      this.saveMessage = "Config applied (live reload)";
      setTimeout(() => {
        this.saveMessage = "";
      }, 3000);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private getSectionData(key: string): unknown {
    if (!this.configJson) {
      return null;
    }
    return this.configJson[key] ?? null;
  }

  override render() {
    return html`
      <div class="view-container view-container--full-height">
        <div class="view-header">
          <h2 class="view-title">${icon("settings", { className: "icon-sm" })} Config</h2>
          <div class="view-actions">
            <button class="btn-ghost ${this.mode === "form" ? "btn-ghost--active" : ""}"
              @click=${() => {
                this.mode = "form";
              }}>Form</button>
            <button class="btn-ghost ${this.mode === "raw" ? "btn-ghost--active" : ""}"
              @click=${() => {
                this.mode = "raw";
              }}>Raw</button>
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Reload
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}
        ${this.saveMessage ? html`<div class="view-success">${this.saveMessage}</div>` : nothing}

        ${
          this.loading && !this.configJson
            ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Loading config...</div>`
            : nothing
        }

        ${this.mode === "form" ? this.renderForm() : this.renderRaw()}

        <!-- Config Patch -->
        <div class="glass-dashboard-card" style="margin-top:1rem;">
          <div class="card-header">
            <span class="card-header__prefix">${icon("edit", { className: "icon-xs" })}</span>
            <h3 class="card-header__title">Quick Patch</h3>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <label class="muted" style="font-size:0.75rem;">Path (dot-separated)</label>
              <input type="text" class="inline-input" style="width:100%;"
                placeholder="e.g. agents.defaults.thinkingDefault"
                .value=${this.patchPath}
                @input=${(e: Event) => {
                  this.patchPath = (e.target as HTMLInputElement).value;
                }}
              />
            </div>
            <div style="flex:1;min-width:200px;">
              <label class="muted" style="font-size:0.75rem;">Value (JSON or string)</label>
              <input type="text" class="inline-input" style="width:100%;"
                placeholder='e.g. "medium" or true or 42'
                .value=${this.patchValue}
                @input=${(e: Event) => {
                  this.patchValue = (e.target as HTMLInputElement).value;
                }}
              />
            </div>
            <button class="btn-primary" @click=${() => void this.patchConfig()}
              ?disabled=${this.patching || !this.patchPath.trim()}>
              ${this.patching ? icon("loader", { className: "icon-xs icon-spin" }) : "Patch"}
            </button>
          </div>
        </div>

        <div class="config-actions" style="margin-top:1rem;display:flex;gap:8px;">
          ${
            this.mode === "raw"
              ? html`
            <button class="btn-primary" @click=${() => void this.saveConfig()} ?disabled=${this.saving}>
              ${this.saving ? icon("loader", { className: "icon-xs icon-spin" }) : "Save to File"}
            </button>
          `
              : nothing
          }
          <button class="btn-ghost" @click=${() => void this.applyConfig()}>
            ${icon("zap", { className: "icon-xs" })} Apply Live
          </button>
        </div>
      </div>
    `;
  }

  private renderForm() {
    if (!this.configJson) {
      return html`
        <p class="muted">No config loaded.</p>
      `;
    }

    return html`
      <div class="config-layout">
        <div class="config-sidebar">
          ${CONFIG_SECTIONS.map(
            (sec) => html`
            <button class="config-section-btn ${this.activeSection === sec.key ? "config-section-btn--active" : ""}"
              @click=${() => {
                this.activeSection = sec.key;
              }}>
              ${sec.label}
            </button>
          `,
          )}
        </div>
        <div class="config-content">
          <div class="glass-dashboard-card">
            <div class="card-header">
              <h3 class="card-header__title">${CONFIG_SECTIONS.find((s) => s.key === this.activeSection)?.label ?? this.activeSection}</h3>
            </div>
            ${this.renderSectionContent()}
          </div>
        </div>
      </div>
    `;
  }

  private renderSectionContent() {
    const data = this.getSectionData(this.activeSection);
    if (data === null || data === undefined) {
      return html`
        <p class="muted">No configuration for this section.</p>
      `;
    }
    return html`
      <json-viewer .data=${data} .maxDepth=${3}></json-viewer>
    `;
  }

  private renderRaw() {
    return html`
      <div class="config-raw-editor">
        <textarea class="config-textarea"
          .value=${this.editedRaw}
          @input=${(e: Event) => {
            this.editedRaw = (e.target as HTMLTextAreaElement).value;
          }}
          spellcheck="false"
        ></textarea>
      </div>
    `;
  }
}
