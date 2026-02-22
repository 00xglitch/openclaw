import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GatewayState } from "../context/gateway-context.js";
import { icon } from "./icons.js";

const MAX_SCROLLBACK = 1000;
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

@customElement("terminal-emulator")
export class TerminalEmulator extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false }) gateway: GatewayState | null = null;

  @state() private lines: string[] = [];
  @state() private inputValue = "";
  @state() private history: string[] = [];
  @state() private historyIndex = -1;
  @state() private running = false;

  private stripAnsi(text: string): string {
    return text.replace(ANSI_RE, "");
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const el = this.querySelector(".terminal-output");
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  private appendLines(newLines: string[]): void {
    const combined = [...this.lines, ...newLines];
    this.lines =
      combined.length > MAX_SCROLLBACK
        ? combined.slice(combined.length - MAX_SCROLLBACK)
        : combined;
    this.scrollToBottom();
  }

  private async sendCommand(): Promise<void> {
    const command = this.inputValue.trim();
    if (!command || !this.gateway?.connected) {
      return;
    }

    this.history = [...this.history, command];
    this.historyIndex = -1;
    this.inputValue = "";
    this.appendLines([`$ ${command}`]);
    this.running = true;

    try {
      const result = await this.gateway.request<{
        output?: string;
        stdout?: string;
        stderr?: string;
      }>("exec.run", { command });
      const output = result?.output ?? result?.stdout ?? "";
      const stderr = result?.stderr ?? "";
      if (output) {
        const cleaned = this.stripAnsi(String(output));
        this.appendLines(cleaned.split("\n"));
      }
      if (stderr) {
        const cleaned = this.stripAnsi(String(stderr));
        this.appendLines(cleaned.split("\n").map((l) => `ERROR: ${l}`));
      }
      if (!output && !stderr) {
        this.appendLines(["(no output)"]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.appendLines([`ERROR: ${msg}`]);
    } finally {
      this.running = false;
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      void this.sendCommand();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this.history.length === 0) {
        return;
      }
      if (this.historyIndex === -1) {
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.inputValue = this.history[this.historyIndex];
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.historyIndex === -1) {
        return;
      }
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.inputValue = this.history[this.historyIndex];
      } else {
        this.historyIndex = -1;
        this.inputValue = "";
      }
    }
  }

  private lineClass(line: string): string {
    if (line.startsWith("$")) {
      return "terminal-line terminal-line--cmd";
    }
    if (line.startsWith("ERROR:") || line.startsWith("Error:")) {
      return "terminal-line terminal-line--error";
    }
    return "terminal-line";
  }

  override render() {
    return html`
      <div class="glass-dashboard-card">
        <div class="card-header">
          <span class="card-header__prefix">${icon("terminal", { className: "icon-xs" })}</span>
          <h3 class="card-header__title">Terminal</h3>
          ${
            this.lines.length > 0
              ? html`
              <div class="view-actions">
                <button class="btn-ghost-sm" @click=${() => {
                  this.lines = [];
                }}>Clear</button>
              </div>
            `
              : nothing
          }
        </div>
        <div class="terminal-output" style="
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          background: var(--surface-900, #0d1117);
          color: var(--text, #e6edf3);
          max-height: 400px;
          overflow-y: auto;
          padding: 0.5rem;
          border-radius: var(--radius-sm, 4px);
          white-space: pre-wrap;
          word-break: break-all;
        ">
          ${
            this.lines.length === 0
              ? html`
                  <span class="muted">Type a command below and press Enter.</span>
                `
              : this.lines.map(
                  (line) =>
                    html`<div class="${this.lineClass(line)}" style="${
                      line.startsWith("$")
                        ? "color: var(--accent, #58a6ff);"
                        : line.startsWith("ERROR:") || line.startsWith("Error:")
                          ? "color: var(--danger, #f85149);"
                          : ""
                    }">${line}</div>`,
                )
          }
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;padding:0 0.25rem;">
          <span style="font-family:var(--font-mono,monospace);color:var(--accent,#58a6ff);font-weight:bold;">$</span>
          <input
            type="text"
            style="
              flex:1;
              font-family: var(--font-mono, monospace);
              font-size: 0.85rem;
              background: var(--surface-800, #161b22);
              color: var(--text, #e6edf3);
              border: 1px solid var(--border, #30363d);
              border-radius: var(--radius-sm, 4px);
              padding: 0.4rem 0.5rem;
              outline: none;
            "
            placeholder="Enter command..."
            .value=${this.inputValue}
            @input=${(e: Event) => {
              this.inputValue = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => this.handleKeydown(e)}
            ?disabled=${this.running}
          />
          <button
            class="btn-primary"
            @click=${() => void this.sendCommand()}
            ?disabled=${this.running || !this.inputValue.trim()}
          >
            ${
              this.running
                ? icon("loader", { className: "icon-xs icon-spin" })
                : icon("send", { className: "icon-xs" })
            }
          </button>
        </div>
      </div>
    `;
  }
}
