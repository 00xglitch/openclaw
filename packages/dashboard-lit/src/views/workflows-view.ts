import { consume } from "@lit/context";
import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import "../components/empty-state.js";

type BindingMatch = {
  channel?: string;
  peer?: { kind?: string; id?: string };
};

type BindingEntry = {
  agentId?: string;
  match?: BindingMatch;
  priority?: number;
};

type ChannelGroup = {
  channel: string;
  bindings: BindingEntry[];
};

@customElement("workflows-view")
export class WorkflowsView extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @consume({ context: gatewayContext, subscribe: true })
  gateway!: GatewayState;

  @state() private loading = false;
  @state() private bindings: BindingEntry[] = [];
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
      const result = await this.gateway.request("config.get", {
        key: "bindings",
      });
      this.bindings = Array.isArray(result) ? (result as BindingEntry[]) : [];
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private get groupedByChannel(): ChannelGroup[] {
    const groups = new Map<string, BindingEntry[]>();
    for (const binding of this.bindings) {
      const channel = binding.match?.channel ?? "(catch-all)";
      if (!groups.has(channel)) {
        groups.set(channel, []);
      }
      groups.get(channel)!.push(binding);
    }
    return Array.from(groups.entries()).map(([channel, bindings]) => ({
      channel,
      bindings,
    }));
  }

  override render() {
    const groups = this.groupedByChannel;

    return html`
      <div class="view-container">
        <div class="view-header">
          <h2 class="view-title">
            ${icon("activity", { className: "icon-sm" })} Workflows
          </h2>
          <div class="view-actions">
            <button
              class="btn-ghost"
              @click=${() => void this.refresh()}
              ?disabled=${this.loading}
            >
              ${icon("refresh", { className: "icon-xs" })} Refresh
            </button>
          </div>
        </div>

        ${this.error ? html`<div class="view-error">${this.error}</div>` : nothing}

        ${
          this.loading && this.bindings.length === 0
            ? html`<div class="view-loading">
                ${icon("loader", { className: "icon-sm icon-spin" })} Loading
                bindings...
              </div>`
            : nothing
        }

        ${
          !this.loading && this.bindings.length === 0
            ? html`
                <empty-state
                  heading="No Workflows"
                  message="Configure agent bindings to create multi-agent workflows."
                  icon="activity"
                ></empty-state>
              `
            : nothing
        }

        ${
          this.bindings.length > 0
            ? html`
                <div class="view-count">
                  ${this.bindings.length} binding${this.bindings.length === 1 ? "" : "s"}
                  across ${groups.length} channel${groups.length === 1 ? "" : "s"}
                </div>
              `
            : nothing
        }

        <div class="workflows-groups">
          ${groups.map(
            (group) => html`
              <details class="skills-group" open>
                <summary class="skills-group__header">
                  <span class="skills-group__title">
                    ${icon("link", { className: "icon-xs" })}
                    ${group.channel}
                  </span>
                  <span class="chip">${group.bindings.length}</span>
                </summary>
                <div class="skills-list">
                  ${group.bindings.map((binding, idx) => this.renderBinding(binding, idx))}
                </div>
              </details>
            `,
          )}
        </div>
      </div>
    `;
  }

  private renderBinding(binding: BindingEntry, index: number) {
    const agentId = binding.agentId ?? "(unset)";
    const channel = binding.match?.channel ?? "*";
    const peer = binding.match?.peer;

    return html`
      <div class="glass-dashboard-card">
        <div style="display:flex;align-items:center;gap:0.75rem;">
          <span
            class="chip chip--accent"
            style="min-width:1.5rem;text-align:center;"
            title="Binding order"
            >#${index + 1}</span
          >
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
              ${icon("bot", { className: "icon-xs" })}
              <strong>${agentId}</strong>
              <span class="chip chip--muted">${channel}</span>
            </div>
            ${
              peer
                ? html`
                    <div
                      class="muted"
                      style="font-size:0.82rem;margin-top:0.25rem;"
                    >
                      Peer: ${peer.kind ?? "any"}${peer.id ? ` / ${peer.id}` : ""}
                    </div>
                  `
                : nothing
            }
          </div>
          ${
            binding.priority != null
              ? html`
                  <span class="chip" title="Priority"
                    >p${binding.priority}</span
                  >
                `
              : nothing
          }
        </div>
      </div>
    `;
  }
}
