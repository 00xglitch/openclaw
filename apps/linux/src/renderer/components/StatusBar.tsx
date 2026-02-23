import { useState, useEffect, useRef } from "react";
import type { AgentInfo, SessionInfo } from "../lib/protocol-types.js";

type Props = {
  connected: boolean;
  agentName: string;
  agentEmoji?: string | null;
  agents: AgentInfo[];
  defaultAgentId: string | null;
  sessions: SessionInfo[];
  currentSessionKey: string;
  onSwitchSession: (key: string) => void;
  onSwitchAgent: (agentId: string) => void;
  onNewSession?: () => void;
  onMenu?: () => void;
};

function formatRelative(ts: number | null): string {
  if (!ts) {return "";}
  const diff = Date.now() - ts;
  if (diff < 60_000) {return "now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h`;}
  return `${Math.floor(diff / 86_400_000)}d`;
}

const kindColors: Record<string, string> = {
  direct: "bg-blue-600/30 text-blue-400",
  group: "bg-purple-600/30 text-purple-400",
  global: "bg-emerald-600/30 text-emerald-400",
  unknown: "bg-zinc-600/30 text-zinc-400",
};

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function StatusBar({
  connected,
  agentName,
  agentEmoji,
  agents,
  defaultAgentId,
  sessions,
  currentSessionKey,
  onSwitchSession,
  onSwitchAgent,
  onNewSession,
  onMenu,
}: Props) {
  const [dropdown, setDropdown] = useState<"agent" | "session" | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!dropdown) {return;}
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {setDropdown(null);}
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [dropdown]);

  // Derive display name for current session
  const currentSession = sessions.find((s) => s.key === currentSessionKey);
  const sessionLabel = currentSession?.label || currentSession?.derivedTitle || currentSession?.displayName || currentSessionKey || "main";

  // Sort sessions by most recent
  const sortedSessions = [...sessions].toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return (
    <div className="relative flex items-center px-3 py-2 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm gap-2" ref={dropdownRef}>
      {/* Hamburger */}
      {onMenu && (
        <button
          onClick={onMenu}
          className="p-1 -ml-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800 flex-shrink-0"
          title="Dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Agent picker */}
      <button
        onClick={() => setDropdown(dropdown === "agent" ? null : "agent")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors text-left min-w-0 ${
          dropdown === "agent" ? "bg-zinc-800 text-zinc-100" : "hover:bg-zinc-800/50 text-zinc-300"
        }`}
      >
        {agentEmoji && <span className="text-sm flex-shrink-0">{agentEmoji}</span>}
        <span className="text-xs font-medium truncate max-w-[100px]">{agentName}</span>
        <Chevron />
      </button>

      {/* Session picker */}
      <button
        onClick={() => setDropdown(dropdown === "session" ? null : "session")}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors text-left min-w-0 flex-1 ${
          dropdown === "session" ? "bg-zinc-800 text-zinc-100" : "hover:bg-zinc-800/50 text-zinc-400"
        }`}
      >
        <span className="text-xs truncate">{sessionLabel}</span>
        <Chevron />
      </button>

      {/* Connection dot */}
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400" : "bg-red-400"}`}
        title={connected ? "Connected" : "Disconnected"}
      />

      {/* Agent dropdown */}
      {dropdown === "agent" && (
        <div className="absolute left-3 top-full mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 py-1 max-h-64 overflow-y-auto">
          {agents.length === 0 ? (
            <div className="px-3 py-4 text-xs text-zinc-500 text-center">No agents</div>
          ) : (
            agents.map((agent) => {
              const name = agent.identity?.name ?? agent.name ?? agent.id;
              const emoji = agent.identity?.emoji ?? "🤖";
              const isActive = name === agentName;
              return (
                <button
                  key={agent.id}
                  onClick={() => { onSwitchAgent(agent.id); setDropdown(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-orange-600/15 text-orange-300" : "hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <span className="text-sm flex-shrink-0">{emoji}</span>
                  <span className="text-xs font-medium truncate flex-1">{name}</span>
                  {agent.id === defaultAgentId && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 font-medium flex-shrink-0">
                      default
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Session dropdown */}
      {dropdown === "session" && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 py-1 max-h-72 overflow-y-auto">
          {onNewSession && (
            <>
              <button
                onClick={() => { onNewSession(); setDropdown(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-orange-400 hover:bg-zinc-800 transition-colors"
              >
                <span className="text-xs font-medium">+ New Session</span>
              </button>
              {sortedSessions.length > 0 && (
                <div className="border-t border-zinc-800 my-1" />
              )}
            </>
          )}
          {sortedSessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-zinc-500 text-center">No sessions</div>
          ) : (
            sortedSessions.map((session) => {
              const title = session.label || session.derivedTitle || session.displayName || session.key;
              const isActive = session.key === currentSessionKey;
              const kindClass = kindColors[session.kind] ?? kindColors.unknown;
              const tokens = session.totalTokens;
              return (
                <button
                  key={session.key}
                  onClick={() => { onSwitchSession(session.key); setDropdown(null); }}
                  className={`w-full flex flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-orange-600/15 text-orange-300" : "hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-xs truncate flex-1">{title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${kindClass}`}>
                      {session.kind}
                    </span>
                    {tokens != null && tokens > 0 && (
                      <span className="text-[9px] text-zinc-600 flex-shrink-0">
                        {tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600 flex-shrink-0">
                      {formatRelative(session.updatedAt)}
                    </span>
                  </div>
                  {session.lastMessagePreview && (
                    <span className="text-[10px] text-zinc-600 truncate w-full">
                      {session.lastMessagePreview}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
