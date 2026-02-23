import { useState } from "react";
import type { AgentInfo, SessionInfo } from "../lib/protocol-types.js";
import { Skeleton } from "../components/Skeleton.js";
import type { FeedEntry } from "../hooks/useFeed.js";
import { FeedView } from "./FeedView.js";

type BoardMode = "kanban" | "feed";
type KanbanStatus = "todo" | "active" | "done";

type KanbanCard = {
  id: string;
  title: string;
  preview: string;
  agentId: string;
  status: KanbanStatus;
  updatedAt: number;
};

type Props = {
  agents: AgentInfo[];
  sessions: SessionInfo[];
  feedEntries: FeedEntry[];
  loading: boolean;
  onRefresh: () => void;
};

function deriveCards(sessions: SessionInfo[], agents: AgentInfo[]): KanbanCard[] {
  return sessions
    .filter((s) => s.updatedAt)
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .map((s) => {
      const isRecent = Date.now() - (s.updatedAt ?? 0) < 3_600_000; // last hour
      const hasTokens = (s.totalTokens ?? 0) > 0;
      const status: KanbanStatus = isRecent ? "active" : hasTokens ? "done" : "todo";

      return {
        id: s.key,
        title: s.displayName || s.derivedTitle || s.label || s.key,
        preview: s.lastMessagePreview || "",
        agentId: agents[0]?.id ?? "default",
        status,
        updatedAt: s.updatedAt ?? 0,
      };
    });
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {return "now";}
  if (mins < 60) {return `${mins}m`;}
  const hours = Math.floor(mins / 60);
  if (hours < 24) {return `${hours}h`;}
  return `${Math.floor(hours / 24)}d`;
}

const columns: { key: KanbanStatus; label: string; dot: string }[] = [
  { key: "todo", label: "Queued", dot: "bg-zinc-500" },
  { key: "active", label: "Active", dot: "bg-amber-400" },
  { key: "done", label: "Completed", dot: "bg-emerald-400" },
];

function KanbanColumn({
  label,
  dot,
  cards,
}: {
  label: string;
  dot: string;
  cards: KanbanCard[];
}) {
  return (
    <div className="flex flex-col min-w-[200px] max-w-[280px] flex-1">
      <div className="flex items-center gap-2 px-2 py-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto">{cards.length}</span>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto px-1">
        {cards.map((card) => (
          <div
            key={card.id}
            className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <div className="text-sm text-zinc-200 font-medium truncate">{card.title}</div>
            {card.preview && (
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{card.preview}</p>
            )}
            <div className="text-[10px] text-zinc-700 mt-2">{relativeTime(card.updatedAt)}</div>
          </div>
        ))}
        {cards.length === 0 && (
          <div className="text-xs text-zinc-700 text-center py-4">No items</div>
        )}
      </div>
    </div>
  );
}

export function KanbanView({ agents, sessions, feedEntries, loading, onRefresh }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<string | "all">("all");
  const [mode, setMode] = useState<BoardMode>("kanban");
  const cards = deriveCards(sessions, agents);

  const filtered =
    selectedAgent === "all" ? cards : cards.filter((c) => c.agentId === selectedAgent);

  if (mode === "feed") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
          <button
            onClick={() => setMode("kanban")}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            Board
          </button>
          <button className="text-xs text-orange-400 px-2 py-1 rounded border border-orange-600/30 bg-orange-600/10">
            Feed
          </button>
        </div>
        <FeedView entries={feedEntries} loading={loading} onRefresh={onRefresh} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with mode toggle + agent filter */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setMode("kanban")}
          className="text-xs text-orange-400 px-2 py-1 rounded border border-orange-600/30 bg-orange-600/10 shrink-0"
        >
          Board
        </button>
        <button
          onClick={() => setMode("feed")}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition-colors shrink-0"
        >
          Feed
        </button>
        <div className="w-px h-4 bg-zinc-800 shrink-0" />
        <button
          onClick={() => setSelectedAgent("all")}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors shrink-0 ${
            selectedAgent === "all"
              ? "bg-orange-600/20 text-orange-400 border border-orange-600/30"
              : "text-zinc-500 border border-zinc-800 hover:border-zinc-700"
          }`}
        >
          All
        </button>
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedAgent(a.id)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors truncate max-w-[100px] shrink-0 ${
              selectedAgent === a.id
                ? "bg-orange-600/20 text-orange-400 border border-orange-600/30"
                : "text-zinc-500 border border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {a.identity?.emoji ?? ""} {a.name ?? a.id}
          </button>
        ))}
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh"
          className="ml-auto p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 disabled:opacity-50 shrink-0"
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
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto">
        {loading && sessions.length === 0 ? (
          <div className="flex gap-4 p-4 h-full">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 min-w-[200px] space-y-3">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 p-3 h-full min-w-max">
            {columns.map((col) => (
              <KanbanColumn
                key={col.key}
                label={col.label}
                dot={col.dot}
                cards={filtered.filter((c) => c.status === col.key)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
