import { useState, useCallback, useRef } from "react";
import { generateUUID } from "../lib/protocol-types.js";
import { loadOrCreateDeviceIdentity, signDevicePayload } from "../lib/device-identity.js";

export type ConnectionTestState = {
  status: "idle" | "connecting" | "success" | "error";
  agentName: string | null;
  errorMessage: string | null;
};

const CLIENT_ID = "openclaw-control-ui";
const CLIENT_MODE = "ui";
const ROLE = "operator";
const SCOPES = ["operator.admin", "operator.approvals", "operator.pairing"];

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

export function useConnectionTest() {
  const [state, setState] = useState<ConnectionTestState>({
    status: "idle",
    agentName: null,
    errorMessage: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const test = useCallback(
    (url: string, token: string) => {
      cleanup();
      setState({ status: "connecting", agentName: null, errorMessage: null });

      timeoutRef.current = setTimeout(() => {
        cleanup();
        setState({ status: "error", agentName: null, errorMessage: "Connection timed out (8s)" });
      }, 8000);

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.addEventListener("message", (ev) => {
          let frame: Record<string, unknown>;
          try {
            frame = JSON.parse(String(ev.data ?? ""));
          } catch {
            return;
          }

          if (frame.type === "event") {
            const evt = frame as { event: string; payload?: { nonce?: string } };
            if (evt.event === "connect.challenge") {
              const nonce = evt.payload?.nonce ?? "";
              // Build signed connect with device identity
              void (async () => {
                try {
                  const deviceIdentity = await loadOrCreateDeviceIdentity();
                  const signedAtMs = Date.now();
                  const payload = buildDeviceAuthPayload({
                    deviceId: deviceIdentity.deviceId,
                    clientId: CLIENT_ID,
                    clientMode: CLIENT_MODE,
                    role: ROLE,
                    scopes: SCOPES,
                    signedAtMs,
                    token: token || null,
                    nonce,
                  });
                  const signature = await signDevicePayload(deviceIdentity.privateKey, payload);

                  const id = generateUUID();
                  ws.send(
                    JSON.stringify({
                      type: "req",
                      id,
                      method: "connect",
                      params: {
                        minProtocol: 3,
                        maxProtocol: 3,
                        client: {
                          id: CLIENT_ID,
                          displayName: "OpenClaw Linux (test)",
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
                        auth: token ? { token } : undefined,
                        locale: navigator.language,
                      },
                    }),
                  );
                } catch (err) {
                  cleanup();
                  setState({ status: "error", agentName: null, errorMessage: String(err) });
                }
              })();
            }
            return;
          }

          if (frame.type === "res") {
            const res = frame as {
              ok: boolean;
              payload?: Record<string, unknown>;
              error?: { message?: string };
            };
            if (res.ok) {
              const payload = res.payload;
              if (payload?.type === "hello-ok") {
                const snapshot = payload.snapshot as Record<string, unknown> | undefined;
                const agents = snapshot?.agents as Record<string, unknown> | undefined;
                const defaultAgent = agents?.defaultAgent as Record<string, unknown> | undefined;
                const agentName = (defaultAgent?.name as string) || "Assistant";

                if (timeoutRef.current) {clearTimeout(timeoutRef.current);}
                timeoutRef.current = null;
                wsRef.current = null;
                ws.close();
                setState({ status: "success", agentName, errorMessage: null });
              }
            } else {
              const errMsg = res.error?.message ?? "Authentication failed";
              if (timeoutRef.current) {clearTimeout(timeoutRef.current);}
              timeoutRef.current = null;
              wsRef.current = null;
              ws.close();
              setState({ status: "error", agentName: null, errorMessage: errMsg });
            }
          }
        });

        ws.addEventListener("error", () => {
          if (wsRef.current === ws) {
            cleanup();
            setState({
              status: "error",
              agentName: null,
              errorMessage: "Could not reach gateway at " + url,
            });
          }
        });

        ws.addEventListener("close", () => {
          // Only handle if we haven't already transitioned
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
        });
      } catch (err) {
        cleanup();
        setState({ status: "error", agentName: null, errorMessage: String(err) });
      }
    },
    [cleanup],
  );

  return { ...state, test, cleanup };
}
