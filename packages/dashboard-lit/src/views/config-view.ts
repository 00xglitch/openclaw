import { consume } from "@lit/context";
import { LitElement, html, nothing, type TemplateResult } from "lit";
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

/** Max nesting depth for recursive form fields before falling back to json-viewer */
const MAX_FORM_DEPTH = 2;

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
  @state() private editedValues: Record<string, unknown> = {};
  @state() private sectionSaving = false;

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

  /** Get the effective value for a dot-path, checking editedValues first, then original config */
  private getEffectiveValue(dotPath: string): unknown {
    if (dotPath in this.editedValues) {
      return this.editedValues[dotPath];
    }
    const parts = dotPath.split(".");
    let current: unknown = this.configJson;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /** Get the original (non-edited) value for a dot-path */
  private getOriginalValue(dotPath: string): unknown {
    const parts = dotPath.split(".");
    let current: unknown = this.configJson;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /** Check if a section has any pending edits */
  private sectionHasEdits(sectionKey: string): boolean {
    const prefix = sectionKey + ".";
    return Object.keys(this.editedValues).some((k) => k === sectionKey || k.startsWith(prefix));
  }

  /** Get all edited paths for a section */
  private getSectionEditedPaths(sectionKey: string): string[] {
    const prefix = sectionKey + ".";
    return Object.keys(this.editedValues).filter((k) => k === sectionKey || k.startsWith(prefix));
  }

  /** Revert all edits for the active section */
  private revertSection = (): void => {
    const paths = this.getSectionEditedPaths(this.activeSection);
    const next = { ...this.editedValues };
    for (const p of paths) {
      delete next[p];
    }
    this.editedValues = next;
  };

  /** Save all edited values for the active section via config.patch */
  private saveSectionEdits = (): void => {
    void this._saveSectionEdits();
  };

  private async _saveSectionEdits(): Promise<void> {
    if (!this.gateway?.connected || this.sectionSaving) {
      return;
    }
    const paths = this.getSectionEditedPaths(this.activeSection);
    if (paths.length === 0) {
      return;
    }

    this.sectionSaving = true;
    this.error = "";
    this.saveMessage = "";
    try {
      for (const path of paths) {
        await this.gateway.request("config.patch", {
          path,
          value: this.editedValues[path],
        });
      }
      // Clear saved edits
      const next = { ...this.editedValues };
      for (const p of paths) {
        delete next[p];
      }
      this.editedValues = next;
      this.saveMessage = `Saved ${paths.length} change${paths.length > 1 ? "s" : ""} to ${this.activeSection}`;
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.sectionSaving = false;
      setTimeout(() => {
        this.saveMessage = "";
      }, 3000);
    }
  }

  /** Handle a field value change */
  private handleFieldChange = (dotPath: string, value: unknown): void => {
    const original = this.getOriginalValue(dotPath);
    // If value matches original, remove from editedValues
    if (JSON.stringify(value) === JSON.stringify(original)) {
      const next = { ...this.editedValues };
      delete next[dotPath];
      this.editedValues = next;
    } else {
      this.editedValues = { ...this.editedValues, [dotPath]: value };
    }
  };

  /** Add a new item to an array field */
  private handleArrayAdd = (dotPath: string, currentArr: unknown[]): void => {
    // Add a sensible default based on existing items
    let defaultVal: unknown = "";
    if (currentArr.length > 0) {
      const sample = currentArr[0];
      if (typeof sample === "number") {
        defaultVal = 0;
      } else if (typeof sample === "boolean") {
        defaultVal = false;
      } else if (typeof sample === "object" && sample !== null) {
        defaultVal = {};
      }
    }
    this.handleFieldChange(dotPath, [...currentArr, defaultVal]);
  };

  /** Remove an item from an array field */
  private handleArrayRemove = (dotPath: string, currentArr: unknown[], index: number): void => {
    const next = [...currentArr];
    next.splice(index, 1);
    this.handleFieldChange(dotPath, next);
  };

  /** Render a form field based on value type */
  private renderField(dotPath: string, value: unknown, depth: number): TemplateResult {
    if (value === null || value === undefined) {
      return html`
        <span class="muted" style="font-style: italic">null</span>
      `;
    }

    if (typeof value === "string") {
      const isEdited = dotPath in this.editedValues;
      return html`
        <input type="text" class="inline-input ${isEdited ? "inline-input--edited" : ""}"
          style="width:100%;"
          .value=${value}
          @input=${(e: Event) => {
            this.handleFieldChange(dotPath, (e.target as HTMLInputElement).value);
          }}
        />
      `;
    }

    if (typeof value === "number") {
      const isEdited = dotPath in this.editedValues;
      return html`
        <input type="number" class="inline-input ${isEdited ? "inline-input--edited" : ""}"
          style="width:120px;"
          .value=${String(value)}
          @input=${(e: Event) => {
            const raw = (e.target as HTMLInputElement).value;
            const num = Number(raw);
            if (!Number.isNaN(num)) {
              this.handleFieldChange(dotPath, num);
            }
          }}
        />
      `;
    }

    if (typeof value === "boolean") {
      const isEdited = dotPath in this.editedValues;
      return html`
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;" class="${isEdited ? "inline-input--edited" : ""}">
          <input type="checkbox"
            .checked=${value}
            @change=${(e: Event) => {
              this.handleFieldChange(dotPath, (e.target as HTMLInputElement).checked);
            }}
          />
          <span class="muted">${value ? "true" : "false"}</span>
        </label>
      `;
    }

    if (Array.isArray(value)) {
      if (depth >= MAX_FORM_DEPTH) {
        return html`<json-viewer .data=${value} .maxDepth=${2}></json-viewer>`;
      }
      return html`
        <div class="config-form-array" style="display:flex;flex-direction:column;gap:4px;">
          ${value.map(
            (item, i) => html`
            <div style="display:flex;align-items:flex-start;gap:6px;">
              <span class="muted" style="min-width:24px;text-align:right;padding-top:6px;font-size:0.75rem;">${i}</span>
              <div style="flex:1;">
                ${this.renderField(`${dotPath}.${i}`, this.getEffectiveValue(`${dotPath}.${i}`) ?? item, depth + 1)}
              </div>
              <button class="btn-ghost" style="padding:2px 4px;flex-shrink:0;"
                title="Remove item"
                @click=${() => {
                  this.handleArrayRemove(dotPath, value, i);
                }}>
                ${icon("x", { className: "icon-xs" })}
              </button>
            </div>
          `,
          )}
          <button class="btn-ghost" style="align-self:flex-start;font-size:0.75rem;"
            @click=${() => {
              this.handleArrayAdd(dotPath, value);
            }}>
            ${icon("plus", { className: "icon-xs" })} Add item
          </button>
        </div>
      `;
    }

    if (typeof value === "object") {
      if (depth >= MAX_FORM_DEPTH) {
        return html`<json-viewer .data=${value} .maxDepth=${2}></json-viewer>`;
      }
      const entries = Object.entries(value as Record<string, unknown>);
      return html`
        <fieldset class="config-form-fieldset" style="border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px 12px;margin:0;">
          ${entries.map(([key]) => {
            const childPath = `${dotPath}.${key}`;
            const childValue =
              this.getEffectiveValue(childPath) ?? (value as Record<string, unknown>)[key];
            return this.renderFieldRow(key, childPath, childValue, depth + 1);
          })}
        </fieldset>
      `;
    }

    // Fallback for unknown types
    return html`<span class="muted">${JSON.stringify(value)}</span>`;
  }

  /** Render a labeled row for a field */
  private renderFieldRow(
    label: string,
    dotPath: string,
    value: unknown,
    depth: number,
  ): TemplateResult {
    const isComplex = typeof value === "object" && value !== null;
    const isEdited = dotPath in this.editedValues;
    return html`
      <div class="config-form-row" style="display:flex;${isComplex ? "flex-direction:column;" : "align-items:center;"}gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <label class="stat-label" style="min-width:160px;font-size:0.8rem;flex-shrink:0;${isEdited ? "color:var(--color-accent, #60a5fa);font-weight:600;" : ""}">
          ${label}
          ${
            isEdited
              ? html`
                  <span style="font-size: 0.6rem; vertical-align: super"> *</span>
                `
              : nothing
          }
        </label>
        <div style="flex:1;min-width:0;">
          ${this.renderField(dotPath, value, depth)}
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

    const hasEdits = this.sectionHasEdits(this.activeSection);

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
              ${
                this.sectionHasEdits(sec.key)
                  ? html`
                      <span style="color: var(--color-accent, #60a5fa); font-size: 0.6rem; vertical-align: super">
                        *</span
                      >
                    `
                  : nothing
              }
            </button>
          `,
          )}
        </div>
        <div class="config-content">
          <div class="glass-dashboard-card">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <h3 class="card-header__title">${CONFIG_SECTIONS.find((s) => s.key === this.activeSection)?.label ?? this.activeSection}</h3>
              ${
                hasEdits
                  ? html`
                  <div style="display:flex;gap:6px;">
                    <button class="btn-ghost" @click=${this.revertSection}
                      title="Revert all changes in this section">
                      ${icon("x", { className: "icon-xs" })} Revert
                    </button>
                    <button class="btn-primary" @click=${this.saveSectionEdits}
                      ?disabled=${this.sectionSaving}>
                      ${this.sectionSaving ? icon("loader", { className: "icon-xs icon-spin" }) : icon("check", { className: "icon-xs" })}
                      Save Changes
                    </button>
                  </div>
                `
                  : nothing
              }
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

    // For primitive top-level section values (unlikely but handle gracefully)
    if (typeof data !== "object") {
      return this.renderField(
        this.activeSection,
        this.getEffectiveValue(this.activeSection) ?? data,
        0,
      );
    }

    // Render each top-level key in the section as a form row
    const entries = Object.entries(data as Record<string, unknown>);
    return html`
      <div class="config-form-section" style="display:flex;flex-direction:column;">
        ${entries.map(([key]) => {
          const dotPath = `${this.activeSection}.${key}`;
          const value = this.getEffectiveValue(dotPath) ?? (data as Record<string, unknown>)[key];
          return this.renderFieldRow(key, dotPath, value, 0);
        })}
      </div>
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
