import type { SessionInfo } from "../lib/protocol-types.js";

type Props = {
  query: string;
  results: SessionInfo[];
  loading: boolean;
  onQueryChange: (q: string) => void;
};

function relativeTime(ts: number | null): string {
  if (!ts) {return "";}
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {return "just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hours = Math.floor(mins / 60);
  if (hours < 24) {return `${hours}h ago`;}
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SearchView({ query, results, loading, onQueryChange }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
            autoFocus
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 p-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-orange-400 rounded-full animate-spin" />
          </div>
        )}

        {!loading && !query && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-sm">Search sessions by name or content</span>
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
            <span className="text-sm">No results found</span>
          </div>
        )}

        {results.map((session) => (
          <div
            key={session.key}
            className="px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-zinc-200 truncate">
                {session.displayName || session.derivedTitle || session.label || session.key}
              </span>
              <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                {relativeTime(session.updatedAt)}
              </span>
            </div>
            {session.lastMessagePreview && (
              <p className="text-xs text-zinc-500 truncate">{session.lastMessagePreview}</p>
            )}
            <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-700">
              <span>{session.channel ?? session.kind}</span>
              {session.model && <span>{session.model}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
