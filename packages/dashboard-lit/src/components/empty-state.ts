import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icon, type IconName } from "./icons.js";

@customElement("empty-state")
export class EmptyState extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property() icon: IconName = "folder";
  @property() heading = "";
  @property() message = "";
  @property() actionLabel = "";

  private _onAction = () => {
    this.dispatchEvent(new CustomEvent("action"));
  };

  override render() {
    return html`
      <div class="empty-state">
        <div class="empty-state__icon">
          ${icon(this.icon, { className: "icon-xl" })}
        </div>
        <div class="empty-state__heading">${this.heading}</div>
        ${this.message ? html`<div class="empty-state__message">${this.message}</div>` : nothing}
        ${
          this.actionLabel
            ? html`<button class="btn-primary" @click=${this._onAction}>
              ${this.actionLabel}
            </button>`
            : nothing
        }
      </div>
    `;
  }
}
