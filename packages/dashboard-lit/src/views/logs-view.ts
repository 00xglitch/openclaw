import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import { loadLogsTail } from "../controllers/logs.js";

type LogEntry = {
  level?: string;
  time?: string;
  subsystem?: string;
  msg?: string;
  raw: string;
};

const LEVEL_COLORS: Record<string, string> = {
  trace: "var(--muted)",
  debug: "var(--muted)",
  info: "var(--text)",
  warn: "var(--warn)",
  error: "var(--danger)",
  fatal: "var(--danger)",
};

@customElement("logs-view")
export class LogsView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private entries: LogEntry[] = [];
  @state() private cursor = 0;
  @state() private truncated = false;
  @state() private filterText = "";
  @state() private autoFollow = true;
  @state() private streaming = false;
  @state() private subsystemFilter = "";
  @state() private sortNewestFirst = true;
  @state() private levelFilters: Record<string, boolean> = {
    trace: false,
    debug: false,
    info: true,
    warn: true,
    error: true,
    fatal: true,
  };

  private lastConnectedState: boolean | null = null;
  private scrollEl: HTMLElement | null = null;
  private unsubscribeLogs: (() => void) | null = null;
  private streamingInterval: ReturnType<typeof setInterval> | null = null;

  override updated(): void {
    const connected = this.gateway?.connected ?? false;
    if (connected && this.lastConnectedState !== true) {
      void this.refresh();
    }
    if (!connected && this.lastConnectedState === true) {
      this.stopStreaming();
    }
    this.lastConnectedState = connected;

    if (this.autoFollow && this.scrollEl) {
      this.scrollEl.scrollTop = this.scrollEl.scrollHeight;
    }
  }

  override firstUpdated(): void {
    this.scrollEl = this.querySelector(".logs-scroll");
  }

  override disconnectedCallback(): void {
    this.stopStreaming();
    super.disconnectedCallback();
  }

  private toggleStreaming(): void {
    if (this.streaming) {
      this.stopStreaming();
    } else {
      this.startStreaming();
    }
  }

  private startStreaming(): void {
    this.stopStreaming();
    this.streaming = true;
    // Poll every 2 seconds for new log lines
    this.streamingInterval = setInterval(() => {
      void this.refresh();
    }, 2000);
  }

  private stopStreaming(): void {
    this.streaming = false;
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
    }
    this.unsubscribeLogs?.();
    this.unsubscribeLogs = null;
  }

  private async refresh(): Promise<void> {
    if (!this.gateway?.connected || this.loading) {
      return;
    }
    this.loading = true;
    try {
      const result = await loadLogsTail(this.gateway.request, { cursor: this.cursor });
      const newEntries = result.lines.map((line) => this.parseLine(line));
      this.entries = [...this.entries, ...newEntries];
      this.cursor = result.cursor;
      this.truncated = result.truncated;
    } catch {
      /* ignore */
    } finally {
      this.loading = false;
    }
  }

  private parseLine(raw: string): LogEntry {
    try {
      const obj = JSON.parse(raw);
      return {
        level: obj.level ?? obj.lvl,
        time: obj.time ?? obj.ts ?? obj.timestamp,
        subsystem: obj.subsystem ?? obj.module ?? obj.component,
        msg: obj.msg ?? obj.message,
        raw,
      };
    } catch {
      return { raw, msg: raw };
    }
  }

  private get filteredEntries(): LogEntry[] {
    const filtered = this.entries.filter((e) => {
      const level = (e.level ?? "info").toLowerCase();
      if (!this.levelFilters[level]) {
        return false;
      }
      if (
        this.subsystemFilter &&
        (e.subsystem ?? "").toLowerCase() !== this.subsystemFilter.toLowerCase()
      ) {
        return false;
      }
      if (this.filterText.trim()) {
        const q = this.filterText.toLowerCase();
        return (
          (e.msg ?? "").toLowerCase().includes(q) ||
          (e.subsystem ?? "").toLowerCase().includes(q) ||
          e.raw.toLowerCase().includes(q)
        );
      }
      return true;
    });
    if (this.sortNewestFirst) {
      return filtered.slice().toSorted((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
      });
    }
    return filtered;
  }

  private get availableSubsystems(): string[] {
    const subs = new Set<string>();
    for (const e of this.entries) {
      if (e.subsystem) {
        subs.add(e.subsystem);
      }
    }
    return [...subs].toSorted();
  }

  private toggleLevel(level: string): void {
    this.levelFilters = { ...this.levelFilters, [level]: !this.levelFilters[level] };
  }

  private clearLogs(): void {
    this.entries = [];
    this.cursor = 0;
  }

  private exportLogs(): void {
    const lines = this.filteredEntries.map((e) => e.raw).join("\n");
    const blob = new Blob([lines], { type: "application/x-jsonlines" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private formatTime(time?: string): string {
    if (!time) {
      return "";
    }
    try {
      const d = new Date(time);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return time;
    }
  }

  override render() {
    const entries = this.filteredEntries;

    return html`
      <div class="view-container view-container--full-height">
        <div class="view-header">
          <h2 class="view-title">${icon("scrollText", { className: "icon-sm" })} Logs</h2>
          <div class="view-actions">
            <button class="btn-ghost ${this.streaming ? "btn-ghost--active" : ""}" @click=${() => this.toggleStreaming()}>
              ${this.streaming ? icon("stop", { className: "icon-xs" }) : icon("activity", { className: "icon-xs" })}
              ${this.streaming ? "Stop" : "Stream"}
            </button>
            <button class="btn-ghost" @click=${() => void this.refresh()} ?disabled=${this.loading}>
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
            <button class="btn-ghost" @click=${() => this.exportLogs()} ?disabled=${entries.length === 0}>
              ${icon("download", { className: "icon-xs" })} Export
            </button>
            <button class="btn-ghost" @click=${() => this.clearLogs()}>Clear</button>
          </div>
        </div>

        <div class="view-toolbar">
          <input type="text" class="view-search" placeholder="Filter logs..."
            .value=${this.filterText}
            @input=${(e: Event) => {
              this.filterText = (e.target as HTMLInputElement).value;
            }}
          />
          <select class="view-select" .value=${this.subsystemFilter}
            @change=${(e: Event) => {
              this.subsystemFilter = (e.target as HTMLSelectElement).value;
            }}>
            <option value="">All subsystems</option>
            ${this.availableSubsystems.map((s) => html`<option value=${s}>${s}</option>`)}
          </select>
          <div class="level-toggles">
            ${Object.entries(this.levelFilters).map(
              ([level, enabled]) => html`
              <button
                class="level-toggle ${enabled ? "level-toggle--active" : ""}"
                style="--level-color: ${LEVEL_COLORS[level] ?? "var(--text)"}"
                @click=${() => this.toggleLevel(level)}
              >${level}</button>
            `,
            )}
          </div>
          <button class="btn-ghost-sm" @click=${() => {
            this.sortNewestFirst = !this.sortNewestFirst;
          }}>
            ${icon("arrowDown", { className: "icon-xs" })}
            ${this.sortNewestFirst ? "Newest First" : "Oldest First"}
          </button>
          <label class="view-checkbox">
            <input type="checkbox" .checked=${this.autoFollow}
              @change=${(e: Event) => {
                this.autoFollow = (e.target as HTMLInputElement).checked;
              }}
            /> Auto-follow
          </label>
        </div>

        ${
          this.truncated
            ? html`
                <div class="view-callout">Log file was truncated. Some entries may be missing.</div>
              `
            : nothing
        }

        <div class="logs-scroll">
          <table class="logs-table">
            <thead>
              <tr>
                <th style="width:80px">Time</th>
                <th style="width:60px">Level</th>
                <th style="width:120px">Subsystem</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              ${repeat(
                entries,
                (_e, index) => index,
                (e) => {
                  const level = (e.level ?? "info").toLowerCase();
                  const color = LEVEL_COLORS[level] ?? "var(--text)";
                  return html`
                  <tr class="log-row" style="color:${color}">
                    <td class="log-time">${this.formatTime(e.time)}</td>
                    <td><span class="log-level" style="color:${color}">${level}</span></td>
                    <td class="log-subsystem">${e.subsystem ?? ""}</td>
                    <td class="log-msg">${e.msg ?? e.raw}</td>
                  </tr>
                `;
                },
              )}
              ${
                entries.length === 0
                  ? html`
                <tr><td colspan="4" class="view-table-empty">No log entries${this.filterText ? " matching filter" : ""}</td></tr>
              `
                  : nothing
              }
            </tbody>
          </table>
        </div>

        <div class="logs-status">
          ${entries.length} entries · cursor: ${this.cursor}
        </div>
      </div>
    `;
  }
}
