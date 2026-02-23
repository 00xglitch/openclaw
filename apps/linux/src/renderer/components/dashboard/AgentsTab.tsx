import type { AgentInfo } from "../../lib/protocol-types.js";

type Props = {
  agents: AgentInfo[];
  defaultAgentId: string | null;
  onSelect?: (agentId: string) => void;
};

export function AgentsTab({ agents, defaultAgentId, onSelect }: Props) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-sm">
        <span>No agents configured</span>
      </div>
    );
  }

  const interactive = !!onSelect;

  return (
    <div className="flex flex-col gap-1">
      {agents.map((agent) => {
        const isDefault = agent.id === defaultAgentId;
        const name = agent.name ?? agent.identity?.name ?? agent.id;
        const emoji = agent.identity?.emoji;
        const avatarUrl = agent.identity?.avatarUrl;

        return (
          <div
            key={agent.id}
            onClick={interactive ? () => onSelect(agent.id) : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              interactive ? "cursor-pointer" : ""
            } ${
              isDefault ? "bg-orange-950/30 border-l-2 border-orange-500" : interactive ? "hover:bg-zinc-800/50" : ""
            }`}
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover" />
              ) : emoji ? (
                <span className="text-lg">{emoji}</span>
              ) : (
                <span className="text-sm font-semibold text-orange-400">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200 truncate">{name}</span>
                {isDefault && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-600/30 text-orange-400 rounded font-medium">
                    default
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-500 font-mono">{agent.id}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
