import { useState } from "react";
import type { FeedEntry } from "../hooks/useFeed.js";
import { Skeleton } from "../components/Skeleton.js";

type Props = {
  entries: FeedEntry[];
  loading: boolean;
  onRefresh: () => void;
};

const channelIcons: Record<string, string> = {
  whatsapp: "W",
  webchat: "C",
  telegram: "T",
  slack: "S",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {return "just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hours = Math.floor(mins / 60);
  if (hours < 24) {return `${hours}h ago`;}
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const filters = ["All", "WhatsApp", "Web", "Direct", "Group"] as const;
type Filter = (typeof filters)[number];

function matchesFilter(entry: FeedEntry, filter: Filter): boolean {
  if (filter === "All") {return true;}
  if (filter === "WhatsApp") {return entry.channel === "whatsapp";}
  if (filter === "Web") {return entry.channel === "webchat";}
  if (filter === "Direct") {return entry.kind === "direct";}
  if (filter === "Group") {return entry.kind === "group";}
  return true;
}

export function FeedView({ entries, loading, onRefresh }: Props) {
  const [filter, setFilter] = useState<Filter>("All");
  const filtered = entries.filter((e) => matchesFilter(e, filter));

  return (
    <div className="flex flex-col h-full">
      {/* Filter pills */}
      <div className="flex gap-1.5 px-4 py-2.5 border-b border-zinc-800 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-orange-600/20 text-orange-400 border border-orange-600/30"
                : "text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto">
        {loading && entries.length === 0 && (
          <div className="p-4 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span className="text-sm">
              {entries.length === 0 ? "No activity yet" : "No matches"}
            </span>
          </div>
        )}

        {filtered.map((entry) => {
          const icon = channelIcons[entry.channel ?? ""] ?? "?";
          return (
            <div
              key={entry.key}
              className="px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-zinc-400">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {entry.label}
                    </span>
                    <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                      {relativeTime(entry.timestamp)}
                    </span>
                  </div>
                  {entry.preview && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{entry.preview}</p>
                  )}
                  <span className="text-[10px] text-zinc-700 mt-1 inline-block">
                    {entry.channel ?? entry.kind}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {loading && entries.length > 0 && (
          <div className="flex justify-center py-3">
            <div className="w-4 h-4 border-2 border-zinc-700 border-t-orange-400 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
