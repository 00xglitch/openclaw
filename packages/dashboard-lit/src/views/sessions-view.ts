import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import {
  loadSessions,
  type SessionSummary,
  type SessionsListResult,
} from "../controllers/sessions.js";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;

@customElement("sessions-view")
export class SessionsView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private result: SessionsListResult | null = null;
  @state() private limit = 50;
  @state() private activeWithin = 0; // minutes, 0 = no filter
  @state() private includeGlobal = false;
  @state() private includeUnknown = false;
  @state() private filterText = "";
  @state() private deleteConfirm: string | null = null;
  @state() private compacting: string | null = null;
  @state() private selectedKeys = new Set<string>();
  @state() private bulkAction: "delete" | "compact" | null = null;
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
      const params: Record<string, unknown> = {
        limit: this.limit,
        includeGlobal: this.includeGlobal,
        includeUnknown: this.includeUnknown,
        includeDerivedTitles: true,
      };
      if (this.activeWithin > 0) {
        params.activeWithinMinutes = this.activeWithin;
      }
      this.result = await loadSessions(this.gateway.request, params);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private async patchSession(key: string, patch: Record<string, unknown>): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("sessions.patch", { key, ...patch });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async compactSession(key: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    this.compacting = key;
    try {
      await this.gateway.request("sessions.compact", { key });
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.compacting = null;
    }
  }

  private async deleteSession(key: string): Promise<void> {
    if (!this.gateway?.connected) {
      return;
    }
    try {
      await this.gateway.request("sessions.delete", { key });
      this.deleteConfirm = null;
      this.selectedKeys.delete(key);
      void this.refresh();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async executeBulkAction(): Promise<void> {
    if (!this.gateway?.connected || this.selectedKeys.size === 0 || !this.bulkAction) {
      return;
    }
    const keys = [...this.selectedKeys];
    const action = this.bulkAction;
    this.bulkAction = null;

    for (const key of keys) {
      try {
        if (action === "delete") {
          await this.gateway.request("sessions.delete", { key });
        } else if (action === "compact") {
          await this.gateway.request("sessions.compact", { key });
        }
      } catch {
        // continue with remaining
      }
    }
    this.selectedKeys = new Set();
    void this.refresh();
  }

  private toggleSelect(key: string): void {
    const next = new Set(this.selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selectedKeys = next;
  }

  private toggleSelectAll(): void {
    const sessions = this.filteredSessions;
    if (this.selectedKeys.size === sessions.length) {
      this.selectedKeys = new Set();
    } else {
      this.selectedKeys = new Set(sessions.map((s) => s.key));
    }
  }

  private get filteredSessions(): SessionSummary[] {
    const sessions = this.result?.sessions ?? [];
    if (!this.filterText.trim()) {
      return sessions;
    }
    const q = this.filterText.toLowerCase();
    return sessions.filter(
      (s) =>
        s.key.toLowerCase().includes(q) ||
        (s.label ?? "").toLowerCase().includes(q) ||
        (s.derivedTitle ?? "").toLowerCase().includes(q) ||
        (s.agentId ?? "").toLowerCase().includes(q),
    );
  }

  private navigateToChat(sessionKey: string): void {
    this.dispatchEvent(
      new CustomEvent("tab-change", { detail: "chat", bubbles: true, composed: true }),
    );
    const url = new URL(window.location.href);
    url.searchParams.set("session", sessionKey);
    window.history.replaceState({}, "", url.toString());
  }

  private formatTime(ts: number | null): string {
    if (!ts) {
      return "—";
    }
    const diffMs = Date.now() - ts;
    if (diffMs < 60_000) {
      return "just now";
    }
    if (diffMs < 3600_000) {
      return `${Math.floor(diffMs / 60_000)}m ago`;
    }
    if (diffMs < 86400_000) {
      return `${Math.floor(diffMs / 3600_000)}h ago`;
    }
    return new Date(ts).toLocaleDateString();
  }

  override render() {
    const sessions = this.filteredSessions;
    const hasSelection = this.selectedKeys.size > 0;
    const allSelected = sessions.length > 0 && this.selectedKeys.size === sessions.length;

    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">${icon("fileText", { className: "icon-sm" })} Sessions</h2>
          <div class="view-actions">
            ${
              hasSelection
                ? html`
              <span class="muted" style="font-size:0.82rem">${this.selectedKeys.size} selected</span>
              <button class="btn-ghost-sm" @click=${() => {
                this.bulkAction = "compact";
                void this.executeBulkAction();
              }}
                title="Compact selected">
                ${icon("refresh", { className: "icon-xs" })} Compact
              </button>
              <button class="btn-danger-sm" @click=${() => {
                this.bulkAction = "delete";
                void this.executeBulkAction();
              }}
                title="Delete selected">
                ${icon("x", { className: "icon-xs" })} Delete
              </button>
              <span class="agent-chat__input-divider"></span>
            `
                : nothing
            }
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}

        <div class="view-toolbar">
          <input
            type="text"
            class="view-search"
            placeholder="Filter by key, label, agent..."
            .value=${this.filterText}
            @input=${(e: Event) => {
              this.filterText = (e.target as HTMLInputElement).value;
            }}
          />
          <select class="view-select" .value=${String(this.activeWithin)}
            @change=${(e: Event) => {
              this.activeWithin = Number((e.target as HTMLSelectElement).value);
              void this.refresh();
            }}>
            <option value="0">All time</option>
            <option value="5">Active 5m</option>
            <option value="30">Active 30m</option>
            <option value="60">Active 1h</option>
            <option value="1440">Active 24h</option>
          </select>
          <label class="view-checkbox">
            <input type="checkbox" .checked=${this.includeGlobal}
              @change=${(e: Event) => {
                this.includeGlobal = (e.target as HTMLInputElement).checked;
                void this.refresh();
              }}
            /> Global
          </label>
          <label class="view-checkbox">
            <input type="checkbox" .checked=${this.includeUnknown}
              @change=${(e: Event) => {
                this.includeUnknown = (e.target as HTMLInputElement).checked;
                void this.refresh();
              }}
            /> Unknown
          </label>
          <select class="view-select" .value=${String(this.limit)}
            @change=${(e: Event) => {
              this.limit = Number((e.target as HTMLSelectElement).value);
              void this.refresh();
            }}>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>

        ${
          this.loading && !this.result
            ? html`<div class="view-loading">${icon("loader", { className: "icon-sm icon-spin" })} Loading sessions...</div>`
            : nothing
        }

        ${
          this.result
            ? html`
          <div class="view-count">${this.result.count} total · ${sessions.length} shown</div>

          <div class="view-table-wrap">
            <table class="view-table">
              <thead>
                <tr>
                  <th style="width:32px">
                    <input type="checkbox" .checked=${allSelected}
                      @change=${() => this.toggleSelectAll()} />
                  </th>
                  <th>Key</th>
                  <th>Label</th>
                  <th>Agent</th>
                  <th>Thinking</th>
                  <th>Updated</th>
                  <th>Tokens</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${sessions.map((s) => this.renderRow(s))}
                ${
                  sessions.length === 0
                    ? html`
                        <tr>
                          <td colspan="8" class="view-table-empty">No sessions found</td>
                        </tr>
                      `
                    : nothing
                }
              </tbody>
            </table>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private renderRow(s: SessionSummary) {
    const isDeleting = this.deleteConfirm === s.key;
    const isCompacting = this.compacting === s.key;
    const isSelected = this.selectedKeys.has(s.key);

    return html`
      <tr class="view-table-row ${isSelected ? "view-table-row--selected" : ""}">
        <td>
          <input type="checkbox" .checked=${isSelected}
            @change=${() => this.toggleSelect(s.key)} />
        </td>
        <td>
          <button class="btn-link" @click=${() => this.navigateToChat(s.key)} title="Open in chat">
            ${s.key.length > 28 ? s.key.slice(0, 28) + "..." : s.key}
          </button>
        </td>
        <td>
          <input type="text" class="inline-input" .value=${s.label ?? s.derivedTitle ?? ""}
            placeholder="Add label..."
            @change=${(e: Event) => {
              void this.patchSession(s.key, { label: (e.target as HTMLInputElement).value });
            }}
          />
        </td>
        <td><span class="chip">${s.agentId ?? "default"}</span></td>
        <td>
          <select class="inline-select"
            .value=${((s as Record<string, unknown>).thinkingLevel as string) ?? "medium"}
            @change=${(e: Event) => {
              void this.patchSession(s.key, {
                thinkingLevel: (e.target as HTMLSelectElement).value,
              });
            }}>
            ${THINKING_LEVELS.map((lv) => html`<option value=${lv}>${lv}</option>`)}
          </select>
        </td>
        <td class="muted">${this.formatTime(s.updatedAt)}</td>
        <td>${s.totalTokens != null ? s.totalTokens.toLocaleString() : "—"}</td>
        <td>
          <div style="display:flex;gap:2px;align-items:center">
            <button class="btn-ghost-sm" @click=${() => void this.compactSession(s.key)}
              ?disabled=${isCompacting} title="Compact">
              ${
                isCompacting
                  ? icon("loader", { className: "icon-xs icon-spin" })
                  : icon("refresh", { className: "icon-xs" })
              }
            </button>
            ${
              isDeleting
                ? html`
                  <button class="btn-danger-sm" @click=${() => void this.deleteSession(s.key)}>Yes</button>
                  <button class="btn-ghost-sm" @click=${() => {
                    this.deleteConfirm = null;
                  }}>No</button>
                `
                : html`
                  <button class="btn-ghost-sm" @click=${() => {
                    this.deleteConfirm = s.key;
                  }} title="Delete">
                    ${icon("x", { className: "icon-xs" })}
                  </button>
                `
            }
          </div>
        </td>
      </tr>
    `;
  }
}
