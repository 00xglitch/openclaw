import { useState, useEffect, useRef, useCallback } from "react";
import { GatewayClient } from "../lib/gateway-client.js";
import { extractText } from "../lib/message-extract.js";
import { generateUUID } from "../lib/protocol-types.js";
import { getStoredConfig } from "../lib/config-store.js";
import type { AgentInfo, ChatEventPayload, ChatMessage, GatewayHelloOk } from "../lib/protocol-types.js";

export type GatewayState = {
  connected: boolean;
  sessionKey: string;
  agentName: string;
  agentEmoji: string | null;
  agentAvatar: string | null;
  agents: AgentInfo[];
  messages: ChatMessage[];
  streamText: string | null;
  sending: boolean;
  error: string | null;
};

export function useGateway() {
  const [state, setState] = useState<GatewayState>({
    connected: false,
    sessionKey: "",
    agentName: "Assistant",
    agentEmoji: null,
    agentAvatar: null,
    agents: [],
    messages: [],
    streamText: null,
    sending: false,
    error: null,
  });

  const clientRef = useRef<GatewayClient | null>(null);
  const runIdRef = useRef<string | null>(null);
  const sessionKeyRef = useRef<string>("");

  // Keep ref in sync
  sessionKeyRef.current = state.sessionKey;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const ipcConfig = await window.openclawBridge.getConfig();
      const stored = getStoredConfig();
      const config = {
        gatewayUrl: stored.gatewayUrl || ipcConfig.gatewayUrl,
        token: stored.token || ipcConfig.token,
        ttsUrl: stored.ttsUrl || ipcConfig.ttsUrl,
      };

      const client = new GatewayClient({
        url: config.gatewayUrl,
        token: config.token,
        onHello: (hello: GatewayHelloOk) => {
          if (cancelled) {return;}
          const snap = hello.snapshot as Record<string, unknown> | undefined;
          const defaults = snap?.sessionDefaults as Record<string, unknown> | undefined;
          const key = (defaults?.mainSessionKey as string) || "main";
          const agents = snap?.agents as Record<string, unknown> | undefined;
          const defaultAgent = agents?.defaultAgent as Record<string, unknown> | undefined;
          const agentName = (defaultAgent?.name as string) || "Assistant";

          sessionKeyRef.current = key;
          setState((s) => ({ ...s, connected: true, sessionKey: key, agentName, error: null }));

          // Load history
          client.request<{ messages?: ChatMessage[] }>("chat.history", {
            sessionKey: key,
            limit: 100,
          }).then((res) => {
            if (!cancelled && Array.isArray(res.messages)) {
              setState((s) => ({ ...s, messages: res.messages as ChatMessage[] }));
            }
          }).catch(() => {});

          // Fetch agent metadata (emoji, avatar)
          client.request<{ defaultId?: string; agents?: AgentInfo[] }>("agents.list", {}).then((res) => {
            if (cancelled) {return;}
            const agentsList = (res.agents ?? []);
            const defaultAgent = agentsList.find((a) => a.id === res.defaultId);
            setState((s) => ({
              ...s,
              agents: agentsList,
              agentEmoji: defaultAgent?.identity?.emoji ?? null,
              agentAvatar: defaultAgent?.identity?.avatarUrl ?? null,
            }));
          }).catch(() => {});
        },
        onEvent: (evt) => {
          if (cancelled) {return;}
          if (evt.event === "chat") {
            handleChatEvent(evt.payload as ChatEventPayload);
          }
        },
        onClose: () => {
          if (!cancelled) {
            setState((s) => ({ ...s, connected: false }));
          }
        },
      });

      clientRef.current = client;
      client.start();
    }

    function handleChatEvent(payload: ChatEventPayload) {
      if (!payload || payload.sessionKey !== sessionKeyRef.current) {return;}

      // Ignore events from other runs
      if (payload.runId && runIdRef.current && payload.runId !== runIdRef.current) {
        if (payload.state === "final") {
          // Reload history for sub-agent messages
          clientRef.current?.request<{ messages?: ChatMessage[] }>("chat.history", {
            sessionKey: sessionKeyRef.current,
            limit: 100,
          }).then((res) => {
            if (Array.isArray(res.messages)) {
              setState((s) => ({ ...s, messages: res.messages as ChatMessage[] }));
            }
          }).catch(() => {});
        }
        return;
      }

      if (payload.state === "delta") {
        const text = extractText(payload.message);
        if (typeof text === "string") {
          setState((s) => {
            const current = s.streamText ?? "";
            return { ...s, streamText: text.length >= current.length ? text : current };
          });
        }
      } else if (payload.state === "final") {
        runIdRef.current = null;
        setState((s) => ({ ...s, streamText: null, sending: false }));

        // Reload history
        clientRef.current?.request<{ messages?: ChatMessage[] }>("chat.history", {
          sessionKey: sessionKeyRef.current,
          limit: 100,
        }).then((res) => {
          if (Array.isArray(res.messages)) {
            setState((s) => ({ ...s, messages: res.messages as ChatMessage[] }));
          }
        }).catch(() => {});
      } else if (payload.state === "aborted" || payload.state === "error") {
        runIdRef.current = null;
        setState((s) => ({
          ...s,
          streamText: null,
          sending: false,
          error: payload.state === "error" ? (payload.errorMessage ?? "Error") : null,
        }));
      }
    }

    init();

    return () => {
      cancelled = true;
      clientRef.current?.stop();
      clientRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const client = clientRef.current;
    if (!client?.connected || !text.trim()) {return null;}

    const msg = text.trim();
    const runId = generateUUID();
    runIdRef.current = runId;

    // Optimistically add user message
    setState((s) => ({
      ...s,
      messages: [
        ...s.messages,
        { role: "user" as const, content: [{ type: "text", text: msg }], timestamp: Date.now() },
      ],
      sending: true,
      streamText: "",
      error: null,
    }));

    try {
      await client.request("chat.send", {
        sessionKey: sessionKeyRef.current,
        message: msg,
        deliver: false,
        idempotencyKey: runId,
      });
      return runId;
    } catch (err) {
      runIdRef.current = null;
      setState((s) => ({
        ...s,
        sending: false,
        streamText: null,
        error: String(err),
      }));
      return null;
    }
  }, []);

  const abortRun = useCallback(async () => {
    const client = clientRef.current;
    if (!client?.connected) {return;}
    try {
      await client.request("chat.abort", {
        sessionKey: sessionKeyRef.current,
        runId: runIdRef.current ?? undefined,
      });
    } catch {
      // Best effort
    }
  }, []);

  const switchSession = useCallback(async (newKey: string) => {
    const client = clientRef.current;
    if (!client?.connected || !newKey) {return;}

    // Abort any active run
    if (runIdRef.current) {
      try { await client.request("chat.abort", { sessionKey: sessionKeyRef.current, runId: runIdRef.current }); } catch {}
      runIdRef.current = null;
    }

    sessionKeyRef.current = newKey;
    setState((s) => ({
      ...s,
      sessionKey: newKey,
      messages: [],
      streamText: null,
      sending: false,
      error: null,
    }));

    // Load history for new session
    try {
      const res = await client.request<{ messages?: ChatMessage[] }>("chat.history", {
        sessionKey: newKey,
        limit: 100,
      });
      if (Array.isArray(res.messages)) {
        setState((s) => (s.sessionKey === newKey ? { ...s, messages: res.messages as ChatMessage[] } : s));
      }
    } catch {}

    // Update active agent from session key (pattern: agent:{id}:key)
    const agentMatch = newKey.match(/^agent:([^:]+):/);
    if (agentMatch) {
      setState((s) => {
        const agent = s.agents.find((a) => a.id === agentMatch[1]);
        if (agent) {
          return {
            ...s,
            agentName: agent.identity?.name ?? agent.name ?? agent.id,
            agentEmoji: agent.identity?.emoji ?? null,
            agentAvatar: agent.identity?.avatarUrl ?? null,
          };
        }
        return s;
      });
    }
  }, []);

  const switchAgent = useCallback(async (agentId: string) => {
    // Build agent-scoped session key: agent:{agentId}:main
    const baseKey = sessionKeyRef.current.replace(/^agent:[^:]+:/, "") || "main";
    const newKey = `agent:${agentId}:${baseKey}`;
    await switchSession(newKey);
  }, [switchSession]);

  const request = useCallback(async <T = unknown>(method: string, params?: unknown): Promise<T> => {
    const client = clientRef.current;
    if (!client?.connected) {throw new Error("not connected");}
    return client.request<T>(method, params);
  }, []);

  return { ...state, sendMessage, abortRun, switchSession, switchAgent, request };
}
