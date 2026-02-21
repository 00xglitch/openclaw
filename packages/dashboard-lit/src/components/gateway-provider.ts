import { ContextProvider } from "@lit/context";
import {
  DashboardGatewayClient,
  type GatewayClientEventFrame,
  type GatewayClientHelloOk,
} from "@openclaw/dashboard-gateway-client";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { gatewayContext, type GatewayState } from "../context/gateway-context.js";
import {
  loadStoredGatewayUrl,
  loadStoredToken,
  storeGatewayUrl,
  storeToken,
} from "../lib/local-settings.js";
import { consumeBootstrapUrlState } from "../lib/url-state.js";

function resolveDefaultGatewayUrl(): string {
  return typeof import.meta.env !== "undefined" && import.meta.env?.VITE_GATEWAY_URL
    ? String(import.meta.env.VITE_GATEWAY_URL)
    : "ws://127.0.0.1:18789";
}

@customElement("gateway-provider")
export class GatewayProvider extends LitElement {
  @state() connected = false;
  @state() connecting = true;
  @state() lastError: string | null = null;
  @state() hello: GatewayClientHelloOk | null = null;
  @state() lastEvent: GatewayClientEventFrame | null = null;

  private client: DashboardGatewayClient | null = null;
  private provider: ContextProvider<typeof gatewayContext> | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    const bootstrap = consumeBootstrapUrlState();
    const token = bootstrap.token || loadStoredToken();
    const gatewayUrl = bootstrap.gatewayUrl || loadStoredGatewayUrl() || resolveDefaultGatewayUrl();

    if (bootstrap.token) {
      storeToken(bootstrap.token);
    }
    if (bootstrap.gatewayUrl) {
      storeGatewayUrl(bootstrap.gatewayUrl);
    }

    const client = new DashboardGatewayClient({
      gatewayUrl,
      token: token || undefined,
      reconnect: true,
      onOpen: () => {
        this.connecting = true;
      },
      onHello: (nextHello) => {
        this.hello = nextHello;
        this.connected = true;
        this.connecting = false;
        this.lastError = null;
      },
      onEvent: (event) => {
        this.lastEvent = event;
      },
      onClose: () => {
        this.connected = false;
        this.connecting = true;
      },
      onError: (error) => {
        this.lastError = error.message || "gateway error";
      },
      onGap: ({ expected, received }) => {
        this.lastError = `event gap detected (expected ${expected}, got ${received})`;
      },
    });

    this.client = client;
    client.start();

    this.provider = new ContextProvider(this, {
      context: gatewayContext,
      initialValue: this.buildGatewayState(),
    });
  }

  override disconnectedCallback(): void {
    if (this.client) {
      this.client.stop();
      this.client = null;
    }
    this.provider = null;
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (
      this.provider &&
      (changed.has("connected") ||
        changed.has("connecting") ||
        changed.has("lastError") ||
        changed.has("hello") ||
        changed.has("lastEvent"))
    ) {
      this.provider.setValue(this.buildGatewayState());
    }
  }

  private buildGatewayState(): GatewayState {
    return {
      connected: this.connected,
      connecting: this.connecting,
      lastError: this.lastError,
      hello: this.hello,
      lastEvent: this.lastEvent,
      request: async (method, params) => {
        if (!this.client) {
          throw new Error("gateway client unavailable");
        }
        return this.client.request(method, params);
      },
    };
  }

  override render() {
    return html`
      <slot></slot>
    `;
  }
}
