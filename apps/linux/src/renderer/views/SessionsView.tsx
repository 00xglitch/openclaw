import { useState, useMemo } from "react";
import type { SessionInfo } from "../lib/protocol-types.js";

type Props = {
  sessions: SessionInfo[];
  currentSessionKey: string;
  onSwitchSession: (key: string) => void;
  onNewSession: () => void;
};

type SortMode = "recent" | "alpha" | "tokens";

const kindColors: Record<string, string> = {
  direct: "bg-blue-600/30 text-blue-400",
  group: "bg-purple-600/30 text-purple-400",
  global: "bg-emerald-600/30 text-emerald-400",
  unknown: "bg-zinc-600/30 text-zinc-400",
};

function formatRelative(ts: number | null): string {
  if (!ts) {return "";}
  const diff = Date.now() - ts;
  if (diff < 60_000) {return "just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatTokens(n: number | undefined): string {
  if (!n) {return "";}
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}k`;}
  return String(n);
}

export function SessionsView({ sessions, currentSessionKey, onSwitchSession, onNewSession }: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [groupByChannel, setGroupByChannel] = useState(false);

  const filtered = useMemo(() => {
    let list = sessions;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const title = (s.label || s.derivedTitle || s.displayName || s.key).toLowerCase();
        const preview = (s.lastMessagePreview ?? "").toLowerCase();
        const channel = (s.channel ?? "").toLowerCase();
        return title.includes(q) || preview.includes(q) || channel.includes(q);
      });
    }
    const sorted = [...list];
    switch (sort) {
      case "recent":
        sorted.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        break;
      case "alpha":
        sorted.sort((a, b) => {
          const aTitle = a.label || a.derivedTitle || a.displayName || a.key;
          const bTitle = b.label || b.derivedTitle || b.displayName || b.key;
          return aTitle.localeCompare(bTitle);
        });
        break;
      case "tokens":
        sorted.sort((a, b) => (b.totalTokens ?? 0) - (a.totalTokens ?? 0));
        break;
    }
    return sorted;
  }, [sessions, search, sort]);

  const grouped = useMemo(() => {
    if (!groupByChannel) {return null;}
    const map = new Map<string, SessionInfo[]>();
    for (const s of filtered) {
      const ch = s.channel || "No channel";
      if (!map.has(ch)) {map.set(ch, []);}
      map.get(ch)!.push(s);
    }
    return map;
  }, [filtered, groupByChannel]);

  const sortButtons: { mode: SortMode; label: string }[] = [
    { mode: "recent", label: "Recent" },
    { mode: "alpha", label: "A-Z" },
    { mode: "tokens", label: "Tokens" },
  ];

  function renderSession(session: SessionInfo) {
    const title = session.label || session.derivedTitle || session.displayName || session.key;
    const isActive = session.key === currentSessionKey;
    const kindClass = kindColors[session.kind] ?? kindColors.unknown;

    return (
      <button
        key={session.key}
        onClick={() => onSwitchSession(session.key)}
        className={`w-full flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-colors ${
          isActive
            ? "bg-orange-600/10 border-orange-600/30"
            : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate flex-1 ${isActive ? "text-orange-300" : "text-zinc-200"}`}>
            {title}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${kindClass}`}>
            {session.kind}
          </span>
        </div>

        {session.lastMessagePreview && (
          <p className="text-xs text-zinc-500 truncate">{session.lastMessagePreview}</p>
        )}

        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          {session.channel && <span>{session.channel}</span>}
          {session.totalTokens != null && session.totalTokens > 0 && (
            <span>{formatTokens(session.totalTokens)} tokens</span>
          )}
          {session.model && <span>{session.model}</span>}
          <span className="ml-auto">{formatRelative(session.updatedAt)}</span>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold text-zinc-100 flex-1">Sessions</h1>
        <button
          onClick={onNewSession}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors"
        >
          + New Session
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <input
          type="text"
          placeholder="Search sessions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
        />
        <div className="flex gap-1">
          {sortButtons.map((sb) => (
            <button
              key={sb.mode}
              onClick={() => setSort(sb.mode)}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                sort === sb.mode
                  ? "bg-orange-600/20 text-orange-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {sb.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setGroupByChannel((v) => !v)}
          className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
            groupByChannel
              ? "bg-orange-600/20 text-orange-400"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          }`}
          title="Group by channel"
        >
          Group
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
            {search ? "No sessions match your search" : "No sessions yet"}
          </div>
        ) : grouped ? (
          Array.from(grouped.entries()).map(([channel, channelSessions]) => (
            <div key={channel}>
              <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mt-3 mb-2 px-1">
                {channel}
              </h3>
              <div className="space-y-2">
                {channelSessions.map(renderSession)}
              </div>
            </div>
          ))
        ) : (
          filtered.map(renderSession)
        )}
      </div>
    </div>
  );
}
