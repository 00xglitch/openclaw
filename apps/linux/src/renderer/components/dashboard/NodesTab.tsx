import type { NodeInfo } from "../../lib/protocol-types.js";

type Props = {
  nodes: NodeInfo[];
};

const platformIcons: Record<string, string> = {
  linux: "🐧",
  darwin: "🍎",
  windows: "🪟",
};

export function NodesTab({ nodes }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-sm">
        <span>No nodes paired</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {nodes.map((node) => {
        const name = node.displayName || node.nodeId;
        const platformEmoji = platformIcons[node.platform ?? ""] ?? "💻";

        return (
          <div
            key={node.nodeId}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/50"
          >
            {/* Platform icon */}
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">{platformEmoji}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200 truncate">{name}</span>
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    node.connected ? "bg-emerald-400" : "bg-red-400"
                  }`}
                  title={node.connected ? "Connected" : "Disconnected"}
                />
              </div>
              {node.version && (
                <span className="text-xs text-zinc-500">v{node.version}</span>
              )}
            </div>

            {/* Capabilities */}
            {node.caps.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {node.caps.slice(0, 3).map((cap) => (
                  <span
                    key={cap}
                    className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded"
                  >
                    {cap}
                  </span>
                ))}
                {node.caps.length > 3 && (
                  <span className="text-[9px] text-zinc-600">+{node.caps.length - 3}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
