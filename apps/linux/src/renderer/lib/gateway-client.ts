import type {
  GatewayEventFrame,
  GatewayHelloOk,
  GatewayResponseFrame,
} from "./protocol-types.js";
import { generateUUID } from "./protocol-types.js";
import { loadOrCreateDeviceIdentity, signDevicePayload } from "./device-identity.js";
import { loadDeviceAuthToken, storeDeviceAuthToken } from "./device-auth.js";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export type GatewayClientOptions = {
  url: string;
  token?: string;
  autoReconnect?: boolean;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string }) => void;
};

// Matches src/gateway/device-auth.ts buildDeviceAuthPayload
function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
}): string {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  return [
    "v2",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
  ].join("|");
}

const CLIENT_ID = "openclaw-control-ui";
const CLIENT_MODE = "ui";
const ROLE = "operator";
const SCOPES = ["operator.admin", "operator.approvals", "operator.pairing"];

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private backoffMs = 800;

  constructor(private opts: GatewayClientOptions) {}

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("client stopped"));
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.connectSent;
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("not connected");
    }
    const id = generateUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.ws!.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  private connect(): void {
    if (this.closed) {return;}
    this.connectSent = false;
    this.connectNonce = null;

    this.ws = new WebSocket(this.opts.url);

    this.ws.addEventListener("open", () => {
      // Wait for connect.challenge event
    });

    this.ws.addEventListener("message", (ev) => {
      this.handleMessage(String(ev.data ?? ""));
    });

    this.ws.addEventListener("close", (ev) => {
      this.ws = null;
      this.flushPending(new Error(`closed (${ev.code}): ${ev.reason}`));
      this.opts.onClose?.({ code: ev.code, reason: ev.reason });
      this.scheduleReconnect();
    });

    this.ws.addEventListener("error", () => {
      // Close handler will fire
    });
  }

  private scheduleReconnect(): void {
    if (this.closed || this.opts.autoReconnect === false) {return;}
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    setTimeout(() => this.connect(), delay);
  }

  private flushPending(err: Error): void {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private handleMessage(raw: string): void {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    if (frame.type === "event") {
      const evt = frame as unknown as GatewayEventFrame;

      // Track sequence for gap detection
      if (typeof evt.seq === "number") {
        this.lastSeq = evt.seq;
      }

      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: string } | undefined;
        this.connectNonce = payload?.nonce ?? null;
        void this.sendConnect();
        return;
      }

      this.opts.onEvent?.(evt);
      return;
    }

    if (frame.type === "res") {
      const res = frame as unknown as GatewayResponseFrame;
      const p = this.pending.get(res.id);
      if (!p) {return;}
      this.pending.delete(res.id);

      if (res.ok) {
        // Check for hello-ok
        const payload = res.payload as Record<string, unknown> | undefined;
        if (payload?.type === "hello-ok") {
          this.backoffMs = 800;
          this.handleHelloOk(payload as unknown as GatewayHelloOk);
        }
        p.resolve(res.payload);
      } else {
        const err = res.error;
        p.reject(new Error(err?.message ?? "request failed"));
      }
    }
  }

  private handleHelloOk(hello: GatewayHelloOk): void {
    // Cache device token if the gateway issued one
    const auth = (hello as Record<string, unknown>).auth as
      | { deviceToken?: string; role?: string; scopes?: string[] }
      | undefined;
    if (auth?.deviceToken) {
      loadOrCreateDeviceIdentity()
        .then((identity) => {
          storeDeviceAuthToken({
            deviceId: identity.deviceId,
            role: auth.role ?? ROLE,
            token: auth.deviceToken!,
            scopes: auth.scopes,
          });
        })
        .catch(() => {});
    }
    this.opts.onHello?.(hello);
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent || !this.ws) {return;}
    this.connectSent = true;

    const deviceIdentity = await loadOrCreateDeviceIdentity();

    // Use cached device token if available, fall back to shared token
    const storedToken = loadDeviceAuthToken({
      deviceId: deviceIdentity.deviceId,
      role: ROLE,
    })?.token;
    const authToken = storedToken ?? this.opts.token;

    const nonce = this.connectNonce ?? "";
    const signedAtMs = Date.now();
    const payload = buildDeviceAuthPayload({
      deviceId: deviceIdentity.deviceId,
      clientId: CLIENT_ID,
      clientMode: CLIENT_MODE,
      role: ROLE,
      scopes: SCOPES,
      signedAtMs,
      token: authToken ?? null,
      nonce,
    });
    const signature = await signDevicePayload(deviceIdentity.privateKey, payload);

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: CLIENT_ID,
        displayName: "OpenClaw Linux",
        version: "0.1.0",
        platform: "linux",
        mode: CLIENT_MODE,
        instanceId: generateUUID(),
      },
      role: ROLE,
      scopes: SCOPES,
      device: {
        id: deviceIdentity.deviceId,
        publicKey: deviceIdentity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      },
      caps: [],
      auth: authToken ? { token: authToken } : undefined,
      locale: navigator.language,
    };

    const id = generateUUID();
    this.pending.set(id, {
      resolve: () => {
        // hello-ok handled in handleMessage
      },
      reject: (err) => {
        console.error("Connect failed:", err);
        this.ws?.close();
      },
    });

    this.ws.send(JSON.stringify({ type: "req", id, method: "connect", params }));
  }
}
