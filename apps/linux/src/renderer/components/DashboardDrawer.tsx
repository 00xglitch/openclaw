import { useEffect } from "react";
import type { DashboardTab } from "../hooks/useDashboard.js";
import type { AgentInfo, SessionInfo, NodeInfo } from "../lib/protocol-types.js";
import { AgentsTab } from "./dashboard/AgentsTab.js";
import { SessionsTab } from "./dashboard/SessionsTab.js";
import { NodesTab } from "./dashboard/NodesTab.js";

type Props = {
  open: boolean;
  tab: DashboardTab;
  agents: AgentInfo[];
  defaultAgentId: string | null;
  sessions: SessionInfo[];
  nodes: NodeInfo[];
  loading: boolean;
  currentSessionKey?: string;
  onTabChange: (tab: DashboardTab) => void;
  onClose: () => void;
  onRefresh: () => void;
  onSelectSession?: (key: string) => void;
  onSelectAgent?: (agentId: string) => void;
};

const tabs: { key: DashboardTab; label: string }[] = [
  { key: "agents", label: "Agents" },
  { key: "sessions", label: "Sessions" },
  { key: "nodes", label: "Nodes" },
];

export function DashboardDrawer({
  open,
  tab,
  agents,
  defaultAgentId,
  sessions,
  nodes,
  loading,
  currentSessionKey,
  onTabChange,
  onClose,
  onRefresh,
  onSelectSession,
  onSelectAgent,
}: Props) {
  // Fetch data when opening
  useEffect(() => {
    if (open) {onRefresh();}
  }, [open, onRefresh]);

  if (!open) {return null;}

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        style={{ animation: "drawer-backdrop-in 200ms ease-out" }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="relative w-80 max-w-[80%] h-full bg-zinc-900 border-r border-zinc-800 flex flex-col"
        style={{ animation: "drawer-slide-in 200ms ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-200">Dashboard</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800"
              title="Refresh"
              disabled={loading}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={loading ? "animate-spin" : ""}
              >
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800"
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-1 px-3 py-2 border-b border-zinc-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t.key
                  ? "bg-orange-600/20 text-orange-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {t.label}
              <span className="ml-1 text-[10px] opacity-60">
                {t.key === "agents" ? agents.length : t.key === "sessions" ? sessions.length : nodes.length}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && agents.length === 0 && sessions.length === 0 && nodes.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
              Loading...
            </div>
          ) : (
            <>
              {tab === "agents" && (
                <AgentsTab
                  agents={agents}
                  defaultAgentId={defaultAgentId}
                  onSelect={onSelectAgent}
                />
              )}
              {tab === "sessions" && (
                <SessionsTab
                  sessions={sessions}
                  currentSessionKey={currentSessionKey}
                  onSelect={onSelectSession}
                />
              )}
              {tab === "nodes" && <NodesTab nodes={nodes} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
