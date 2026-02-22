import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icon, type IconName } from "./icons.js";

export type ChipStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "pending"
  | "running"
  | "stopped"
  | "warning"
  | "ok";

const STATUS_LABELS: Record<ChipStatus, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Error",
  pending: "Pending",
  running: "Running",
  stopped: "Stopped",
  warning: "Warning",
  ok: "OK",
};

const STATUS_ICONS: Record<ChipStatus, string> = {
  connected: "radio",
  disconnected: "link",
  error: "alert",
  pending: "loader",
  running: "activity",
  stopped: "x",
  warning: "alert",
  ok: "check",
};

@customElement("status-chip")
export class StatusChip extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property() status: ChipStatus = "disconnected";
  @property() label = "";

  override render() {
    const pulsing = this.status === "connected" || this.status === "running";
    const displayLabel = this.label || STATUS_LABELS[this.status];
    const iconName = STATUS_ICONS[this.status] ?? "alert";

    return html`
      <span class="status-chip status-chip--${this.status}">
        <span class="status-chip__dot ${pulsing ? "status-chip__dot--pulse" : ""}"></span>
        ${icon(iconName as IconName, { className: "icon-xs" })}
        <span class="status-chip__label">${displayLabel}</span>
      </span>
    `;
  }
}
