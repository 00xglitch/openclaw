import { useState, useCallback, useEffect, useRef } from "react";
import type { AgentInfo, SessionInfo, NodeInfo } from "../lib/protocol-types.js";

export type DashboardTab = "agents" | "sessions" | "nodes";

export type DashboardState = {
  open: boolean;
  tab: DashboardTab;
  agents: AgentInfo[];
  defaultAgentId: string | null;
  sessions: SessionInfo[];
  nodes: NodeInfo[];
  loading: boolean;
};

export function useDashboard(
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>,
  connected: boolean,
) {
  const [state, setState] = useState<DashboardState>({
    open: false,
    tab: "agents",
    agents: [],
    defaultAgentId: null,
    sessions: [],
    nodes: [],
    loading: false,
  });

  const setTab = useCallback((tab: DashboardTab) => {
    setState((s) => ({ ...s, tab }));
  }, []);

  const toggle = useCallback(() => {
    setState((s) => {
      const opening = !s.open;
      return { ...s, open: opening };
    });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const refresh = useCallback(async () => {
    if (!connected) {return;}
    setState((s) => ({ ...s, loading: true }));

    try {
      const [agentsRes, sessionsRes, nodesRes] = await Promise.all([
        request<{ defaultId?: string; agents?: AgentInfo[] }>("agents.list", {}),
        request<{ sessions?: SessionInfo[] }>("sessions.list", {}),
        request<{ nodes?: NodeInfo[] }>("node.list", {}),
      ]);

      setState((s) => ({
        ...s,
        loading: false,
        agents: (agentsRes.agents ?? []),
        defaultAgentId: (agentsRes.defaultId as string) ?? null,
        sessions: (sessionsRes.sessions ?? []),
        nodes: (nodesRes.nodes ?? []),
      }));
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [request, connected]);

  // Auto-refresh on connect and every 30s while connected
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!connected) {return;}
    refreshRef.current();
    const interval = setInterval(() => refreshRef.current(), 30_000);
    return () => clearInterval(interval);
  }, [connected]);

  return { ...state, setTab, toggle, close, refresh };
}
