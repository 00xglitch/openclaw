import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icon } from "../components/icons.js";
import { titleForTab, subtitleForTab, iconForTab, type Tab } from "../lib/navigation.js";

/**
 * Generic placeholder view for tabs that haven't been built yet.
 * Displays the tab icon, title, subtitle, and a "Coming soon" badge.
 *
 * Usage: `<placeholder-view .tab=${"channels"}></placeholder-view>`
 */
@customElement("placeholder-view")
export class PlaceholderView extends LitElement {
  @property() tab: Tab = "overview";

  override createRenderRoot() {
    return this;
  }

  override render() {
    const tab = this.tab;
    const tabIcon = iconForTab(tab);
    const title = titleForTab(tab);
    const subtitle = subtitleForTab(tab);

    return html`
      <div class="placeholder-view">
        <div class="panel placeholder-panel">
          <div class="placeholder-icon">${icon(tabIcon, { className: "icon-xl" })}</div>
          <h2 class="placeholder-title">${title}</h2>
          <p class="placeholder-subtitle">${subtitle}</p>
          <span class="placeholder-badge">Coming soon</span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "placeholder-view": PlaceholderView;
  }
}
