import { useState } from "react";
import { StatusDot } from "./StatusDot.js";
import type { AgentInfo, SessionInfo, NodeInfo } from "../lib/protocol-types.js";

type Props = {
  agents: AgentInfo[];
  defaultAgentId: string | null;
  sessions: SessionInfo[];
  nodes: NodeInfo[];
  loading: boolean;
};

function getAgentDisplayName(agent: AgentInfo): string {
  return agent.identity?.name ?? agent.name ?? agent.id;
}

function getAgentEmoji(agent: AgentInfo): string {
  return agent.identity?.emoji ?? "🤖";
}

export function AgentBanner({ agents, defaultAgentId, sessions, nodes, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (agents.length === 0 && !loading) {return null;}

  const primary = agents.find((a) => a.id === defaultAgentId) ?? agents[0];
  const subAgents = agents.filter((a) => a.id !== primary?.id);
  const activeSessions = sessions.filter((s) => s.updatedAt && Date.now() - s.updatedAt < 3_600_000);
  const connectedNodes = nodes.filter((n) => n.connected);

  return (
    <div className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800">
      {/* Collapsed: single line */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors"
      >
        {primary && (
          <>
            <span className="text-sm">{getAgentEmoji(primary)}</span>
            <span className="text-xs font-medium text-zinc-300 truncate">
              {getAgentDisplayName(primary)}
            </span>
          </>
        )}

        {subAgents.length > 0 && (
          <span className="text-[10px] text-zinc-500 ml-1">
            +{subAgents.length} agent{subAgents.length > 1 ? "s" : ""}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {activeSessions.length > 0 && (
            <span className="text-[10px] text-zinc-500">
              {activeSessions.length} active
            </span>
          )}
          <svg
            className={`w-3 h-3 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded: full details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-1">
          {/* Agent list */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Agents</h4>
            {agents.map((agent) => {
              const agentSessions = sessions.filter(
                (s) => s.key.includes(agent.id) || (agent.id === defaultAgentId && !agents.some((a) => a.id !== defaultAgentId && s.key.includes(a.id))),
              );
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 py-1 px-2 rounded-lg bg-zinc-800/50"
                >
                  <span className="text-xs">{getAgentEmoji(agent)}</span>
                  <span className="text-xs text-zinc-300 truncate flex-1">
                    {getAgentDisplayName(agent)}
                  </span>
                  {agent.id === defaultAgentId && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-300 font-medium">
                      default
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500">
                    {agentSessions.length} sess
                  </span>
                </div>
              );
            })}
          </div>

          {/* Connected nodes */}
          {nodes.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Nodes
              </h4>
              {nodes.map((node) => (
                <div
                  key={node.nodeId}
                  className="flex items-center gap-2 py-1 px-2 rounded-lg bg-zinc-800/50"
                >
                  <StatusDot status={node.connected ? "online" : "offline"} />
                  <span className="text-xs text-zinc-300 truncate flex-1">
                    {node.displayName ?? node.nodeId.slice(0, 12)}
                  </span>
                  {node.platform && (
                    <span className="text-[10px] text-zinc-500">{node.platform}</span>
                  )}
                  {node.version && (
                    <span className="text-[10px] text-zinc-600">{node.version}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="flex gap-3 text-[10px] text-zinc-500">
            <span>{agents.length} agent{agents.length !== 1 ? "s" : ""}</span>
            <span>{connectedNodes.length}/{nodes.length} nodes</span>
            <span>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}
