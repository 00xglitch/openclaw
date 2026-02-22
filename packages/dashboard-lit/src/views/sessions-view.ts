import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import "../components/confirm-dialog.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import {
  loadSessions,
  type SessionSummary,
  type SessionsListResult,
} from "../controllers/sessions.js";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;

type SortField = "updated" | "tokens" | "key";
type SortDir = "asc" | "desc";

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
  @state() private bulkDeleteConfirmOpen = false;
  @state() private sortBy: SortField = "updated";
  @state() private sortDir: SortDir = "desc";
  @state() private expandedKeys = new Set<string>();

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

  private toggleExpanded(key: string): void {
    const next = new Set(this.expandedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.expandedKeys = next;
  }

  private get filteredSessions(): SessionSummary[] {
    const sessions = this.result?.sessions ?? [];
    let filtered = sessions;
    if (this.filterText.trim()) {
      const q = this.filterText.toLowerCase();
      filtered = sessions.filter(
        (s) =>
          s.key.toLowerCase().includes(q) ||
          (s.label ?? "").toLowerCase().includes(q) ||
          (s.derivedTitle ?? "").toLowerCase().includes(q) ||
          (s.agentId ?? "").toLowerCase().includes(q),
      );
    }

    const dir = this.sortDir === "asc" ? 1 : -1;
    return [...filtered].toSorted((a, b) => {
      switch (this.sortBy) {
        case "updated": {
          const aT = a.updatedAt ?? 0;
          const bT = b.updatedAt ?? 0;
          return (aT - bT) * dir;
        }
        case "tokens": {
          const aT = a.totalTokens ?? 0;
          const bT = b.totalTokens ?? 0;
          return (aT - bT) * dir;
        }
        case "key":
          return a.key.localeCompare(b.key) * dir;
        default:
          return 0;
      }
    });
  }

  private navigateToChat(sessionKey: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set("session", sessionKey);
    window.history.replaceState({}, "", url.toString());
    this.dispatchEvent(
      new CustomEvent("tab-change", { detail: "chat", bubbles: true, composed: true }),
    );
  }

  private formatTime(ts: number | null): string {
    if (!ts) {
      return "\u2014";
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
                this.bulkDeleteConfirmOpen = true;
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
          <span class="agent-chat__input-divider"></span>
          <select class="view-select" .value=${`${this.sortBy}:${this.sortDir}`}
            @change=${(e: Event) => {
              const [field, dir] = (e.target as HTMLSelectElement).value.split(":") as [
                SortField,
                SortDir,
              ];
              this.sortBy = field;
              this.sortDir = dir;
            }}>
            <option value="updated:desc">Updated (newest)</option>
            <option value="updated:asc">Updated (oldest)</option>
            <option value="tokens:desc">Tokens (most)</option>
            <option value="tokens:asc">Tokens (least)</option>
            <option value="key:asc">Key (A-Z)</option>
            <option value="key:desc">Key (Z-A)</option>
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
                ${repeat(
                  sessions,
                  (s) => s.key,
                  (s) => this.renderRow(s),
                )}
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

      <confirm-dialog
        .open=${this.bulkDeleteConfirmOpen}
        title="Delete Sessions"
        message=${`Delete ${this.selectedKeys.size} selected sessions? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        @confirm=${() => {
          this.bulkDeleteConfirmOpen = false;
          this.bulkAction = "delete";
          void this.executeBulkAction();
        }}
        @cancel=${() => {
          this.bulkDeleteConfirmOpen = false;
        }}
      ></confirm-dialog>
    `;
  }

  private renderRow(s: SessionSummary) {
    const isDeleting = this.deleteConfirm === s.key;
    const isCompacting = this.compacting === s.key;
    const isSelected = this.selectedKeys.has(s.key);
    const isExpanded = this.expandedKeys.has(s.key);

    return html`
      <tr class="view-table-row ${isSelected ? "view-table-row--selected" : ""}">
        <td>
          <input type="checkbox" .checked=${isSelected}
            @change=${() => this.toggleSelect(s.key)} />
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:4px">
            <button class="btn-ghost-sm" @click=${() => this.toggleExpanded(s.key)}
              title="${isExpanded ? "Collapse" : "Expand"}" style="padding:0 2px;min-width:auto">
              ${icon(isExpanded ? "chevronDown" : "chevronRight", { className: "icon-xs" })}
            </button>
            <button class="btn-link" @click=${() => this.navigateToChat(s.key)} title="Open in chat">
              ${s.key.length > 28 ? s.key.slice(0, 28) + "..." : s.key}
            </button>
          </div>
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
        <td>${s.totalTokens != null ? s.totalTokens.toLocaleString() : "\u2014"}</td>
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
      ${isExpanded ? this.renderExpandedDetail(s) : nothing}
    `;
  }

  private renderExpandedDetail(s: SessionSummary) {
    return html`
      <tr class="view-table-row view-table-row--detail">
        <td></td>
        <td colspan="7">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.5rem 1.5rem;padding:0.5rem 0;font-size:0.82rem">
            <div>
              <span class="muted">Full key:</span>
              <code style="font-size:0.78rem;word-break:break-all">${s.key}</code>
            </div>
            ${
              s.channel
                ? html`
              <div>
                <span class="muted">Channel:</span>
                <span class="chip">${s.channel}</span>
              </div>
            `
                : nothing
            }
            ${
              s.model
                ? html`
              <div>
                <span class="muted">Model:</span>
                <span>${s.model}</span>
              </div>
            `
                : nothing
            }
            ${
              s.modelProvider
                ? html`
              <div>
                <span class="muted">Provider:</span>
                <span>${s.modelProvider}</span>
              </div>
            `
                : nothing
            }
            ${
              s.sendPolicy
                ? html`
              <div>
                <span class="muted">Send policy:</span>
                <span class="chip">${s.sendPolicy}</span>
              </div>
            `
                : nothing
            }
            ${
              s.kind
                ? html`
              <div>
                <span class="muted">Kind:</span>
                <span>${s.kind}</span>
              </div>
            `
                : nothing
            }
            ${
              s.displayName
                ? html`
              <div>
                <span class="muted">Display name:</span>
                <span>${s.displayName}</span>
              </div>
            `
                : nothing
            }
          </div>
        </td>
      </tr>
    `;
  }
}
