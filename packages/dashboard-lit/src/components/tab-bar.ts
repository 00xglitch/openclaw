import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icon, type IconName } from "./icons.js";

export interface TabDef {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

@customElement("tab-bar")
export class TabBar extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false }) tabs: TabDef[] = [];
  @property() activeTab = "";

  private _onTabClick(tabId: string) {
    this.dispatchEvent(new CustomEvent("tab-change", { detail: tabId, bubbles: true }));
  }

  override render() {
    return html`
      <div class="tab-bar" role="tablist">
        ${this.tabs.map((tab) => {
          const isActive = tab.id === this.activeTab;
          return html`
            <button
              class="tab-bar__tab ${isActive ? "tab-bar__tab--active" : ""}"
              role="tab"
              aria-selected=${isActive}
              @click=${() => this._onTabClick(tab.id)}
            >
              ${tab.icon ? icon(tab.icon as IconName, { className: "icon-sm" }) : nothing}
              <span class="tab-bar__label">${tab.label}</span>
              ${
                tab.badge != null && tab.badge > 0
                  ? html`<span class="tab-bar__badge">${tab.badge}</span>`
                  : nothing
              }
            </button>
          `;
        })}
      </div>
    `;
  }
}
