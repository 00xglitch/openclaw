import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("confirm-dialog")
export class ConfirmDialog extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ type: Boolean }) open = false;
  @property() title = "";
  @property() message = "";
  @property() confirmLabel = "Confirm";
  @property() confirmVariant: "danger" | "primary" = "primary";

  private _onConfirm = () => {
    this.dispatchEvent(new CustomEvent("confirm"));
  };

  private _onCancel = () => {
    this.dispatchEvent(new CustomEvent("cancel"));
  };

  private _onBackdropClick = (e: Event) => {
    if ((e.target as HTMLElement).classList.contains("confirm-overlay")) {
      this._onCancel();
    }
  };

  override render() {
    if (!this.open) {
      return nothing;
    }

    const confirmClass = this.confirmVariant === "danger" ? "btn-danger-sm" : "btn-primary";

    return html`
      <div class="confirm-overlay" @click=${this._onBackdropClick}>
        <div class="confirm-card">
          <div class="confirm-card__title">${this.title}</div>
          <div class="confirm-card__message">${this.message}</div>
          <div class="confirm-card__actions">
            <button class="btn-ghost" @click=${this._onCancel}>Cancel</button>
            <button class=${confirmClass} @click=${this._onConfirm}>
              ${this.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
