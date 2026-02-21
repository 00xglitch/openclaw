import { consume } from "@lit/context";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { gatewayContext } from "../context/gateway-context.js";

@customElement("overview-view")
export class OverviewView extends LitElement {
  @consume({ context: gatewayContext, subscribe: true })
  gateway!: import("../context/gateway-context.js").GatewayState;

  override render() {
    const g = this.gateway;
    if (!g) {
      return html`
        <p class="muted">Loading...</p>
      `;
    }

    return html`
      <section class="panel">
        <h2>Connection</h2>
        <div class="status-row">
          <span class="status-pill">${g.connected ? "Connected" : "Disconnected"}</span>
          <span class="status-pill">${g.connecting ? "Reconnecting" : "Stable"}</span>
        </div>
        ${g.lastError ? html`<p class="error">${g.lastError}</p>` : null}
        <p class="muted">
          Gateway is the security/control plane. This UI does not bypass auth, pairing, or scope
          checks.
        </p>
      </section>

      <section class="panel">
        <h2>Hello snapshot</h2>
        <pre>${JSON.stringify(g.hello, null, 2) || "(waiting for hello-ok)"}</pre>
      </section>

      <section class="panel">
        <h2>Latest event</h2>
        <pre>${JSON.stringify(g.lastEvent, null, 2) || "(no events yet)"}</pre>
      </section>
    `;
  }
}
