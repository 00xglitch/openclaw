import type { ChannelInfo } from "../lib/protocol-types.js";

type Props = {
  channels: ChannelInfo[];
  loading: boolean;
  error: string | null;
  onLogin: (channelId: string) => void;
  onLogout: (channelId: string) => void;
  onRefresh: () => void;
};

const typeIcons: Record<string, string> = {
  discord: "💬",
  slack: "📱",
  telegram: "✈️",
  whatsapp: "📞",
  web: "🌐",
  cli: "⌨️",
};

const statusColors: Record<string, { dot: string; badge: string }> = {
  connected: { dot: "bg-emerald-400", badge: "bg-emerald-600/20 text-emerald-400" },
  disconnected: { dot: "bg-zinc-600", badge: "bg-zinc-600/20 text-zinc-400" },
  error: { dot: "bg-red-400", badge: "bg-red-600/20 text-red-400" },
  connecting: { dot: "bg-amber-400 animate-pulse", badge: "bg-amber-600/20 text-amber-400" },
};

export function ChannelsView({ channels, loading, error, onLogin, onLogout, onRefresh }: Props) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">Channels</h2>
        <button
          onClick={onRefresh}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg p-3">
          {error}
        </div>
      )}

      {channels.length === 0 && !loading && !error && (
        <div className="text-center py-12">
          <p className="text-zinc-500 text-sm">No channels configured</p>
          <p className="text-zinc-600 text-xs mt-1">Channels are configured in the gateway config</p>
        </div>
      )}

      <div className="space-y-2">
        {channels.map((ch) => {
          const icon = typeIcons[ch.type.toLowerCase()] ?? "📡";
          const colors = statusColors[ch.status] ?? statusColors.disconnected;

          return (
            <div
              key={ch.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3"
            >
              <span className="text-xl flex-shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200 truncate">{ch.id}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${colors.badge}`}>
                    {ch.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-500 capitalize">{ch.type}</span>
                  {ch.account && (
                    <span className="text-xs text-zinc-600 truncate">· {ch.account}</span>
                  )}
                </div>
                {ch.error && (
                  <p className="text-[10px] text-red-400/80 mt-1 truncate">{ch.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                {ch.status === "connected" ? (
                  <button
                    onClick={() => onLogout(ch.id)}
                    className="text-[10px] px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors border border-zinc-700"
                  >
                    Logout
                  </button>
                ) : ch.status === "disconnected" ? (
                  <button
                    onClick={() => onLogin(ch.id)}
                    className="text-[10px] px-2 py-1 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 transition-colors border border-orange-600/30"
                  >
                    Login
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
