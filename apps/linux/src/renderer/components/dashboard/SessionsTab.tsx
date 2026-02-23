import type { SessionInfo } from "../../lib/protocol-types.js";

type Props = {
  sessions: SessionInfo[];
  currentSessionKey?: string;
  onSelect?: (sessionKey: string) => void;
};

function formatRelative(ts: number | null): string {
  if (!ts) {return "";}
  const diff = Date.now() - ts;
  if (diff < 60_000) {return "just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const kindColors: Record<string, string> = {
  direct: "bg-blue-600/30 text-blue-400",
  group: "bg-purple-600/30 text-purple-400",
  global: "bg-emerald-600/30 text-emerald-400",
  unknown: "bg-zinc-600/30 text-zinc-400",
};

export function SessionsTab({ sessions, currentSessionKey, onSelect }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-sm">
        <span>No active sessions</span>
      </div>
    );
  }

  // Sort by most recent first
  const sorted = [...sessions].toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((session) => {
        const title = session.label || session.derivedTitle || session.displayName || session.key;
        const preview = session.lastMessagePreview;
        const kindClass = kindColors[session.kind] ?? kindColors.unknown;
        const isActive = session.key === currentSessionKey;
        const interactive = !!onSelect;

        return (
          <div
            key={session.key}
            onClick={interactive ? () => onSelect(session.key) : undefined}
            className={`flex flex-col gap-1 px-3 py-2.5 rounded-lg transition-colors ${
              interactive ? "cursor-pointer" : ""
            } ${
              isActive
                ? "bg-orange-600/15 border border-orange-600/30"
                : interactive ? "hover:bg-zinc-800/50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`text-sm font-medium truncate ${isActive ? "text-orange-300" : "text-zinc-200"}`}>{title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${kindClass}`}>
                  {session.kind}
                </span>
              </div>
              <span className="text-[10px] text-zinc-600 flex-shrink-0 ml-2">
                {formatRelative(session.updatedAt)}
              </span>
            </div>
            {preview && (
              <span className="text-xs text-zinc-500 truncate">{preview}</span>
            )}
            {session.totalTokens != null && session.totalTokens > 0 && (
              <span className="text-[10px] text-zinc-600">
                {session.totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
