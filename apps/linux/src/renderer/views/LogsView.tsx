import { useEffect, useRef } from "react";
import type { LogLevel, LogEntry } from "../lib/protocol-types.js";

type LogsProps = {
  entries: LogEntry[];
  loading: boolean;
  error: string | null;
  autoFollow: boolean;
  setAutoFollow: (v: boolean) => void;
  filterText: string;
  setFilterText: (v: string) => void;
  levelFilter: Set<LogLevel>;
  toggleLevel: (l: LogLevel) => void;
  refresh: () => void;
};

type DebugProps = {
  method: string;
  setMethod: (v: string) => void;
  params: string;
  setParams: (v: string) => void;
  result: string | null;
  rpcError: string | null;
  running: boolean;
  call: () => void;
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: "text-zinc-600",
  debug: "text-zinc-500",
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  fatal: "text-red-500 font-bold",
};

const VISIBLE_LEVELS: LogLevel[] = ["info", "warn", "error", "fatal", "debug", "trace"];

function LogLine({ entry }: { entry: LogEntry }) {
  const levelColor = entry.level ? LEVEL_COLORS[entry.level] : "text-zinc-400";
  const time = entry.time ? new Date(entry.time).toLocaleTimeString("en-US", { hour12: false }) : "";
  return (
    <div className="flex gap-2 py-0.5 px-2 font-mono text-[11px] leading-tight hover:bg-zinc-900/50">
      {time && <span className="text-zinc-600 shrink-0 w-16">{time}</span>}
      {entry.level && <span className={`shrink-0 w-10 uppercase ${levelColor}`}>{entry.level}</span>}
      {entry.subsystem && <span className="text-cyan-600 shrink-0 max-w-24 truncate">[{entry.subsystem}]</span>}
      <span className={`break-all ${levelColor}`}>{entry.message}</span>
    </div>
  );
}

export function LogsView({ logs, debug }: { logs: LogsProps; debug: DebugProps }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-follow scroll
  useEffect(() => {
    if (logs.autoFollow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.entries, logs.autoFollow]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <input
          type="text"
          placeholder="Filter..."
          value={logs.filterText}
          onChange={(e) => logs.setFilterText(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={logs.refresh}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-1"
          title="Refresh"
        >
          {logs.loading ? "\u23F3" : "\u21BB"}
        </button>
        <button
          onClick={() => logs.setAutoFollow(!logs.autoFollow)}
          className={`text-xs px-1 ${logs.autoFollow ? "text-orange-400" : "text-zinc-600"}`}
          title="Auto-follow"
        >
          \u2B07
        </button>
      </div>

      {/* Level filter chips */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800/50">
        {VISIBLE_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => logs.toggleLevel(level)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              logs.levelFilter.has(level)
                ? `${LEVEL_COLORS[level]} border-current opacity-90`
                : "text-zinc-700 border-zinc-800"
            }`}
          >
            {level}
          </button>
        ))}
        <span className="text-[10px] text-zinc-600 ml-auto">{logs.entries.length}</span>
      </div>

      {/* Log stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          if (!atBottom && logs.autoFollow) {logs.setAutoFollow(false);}
          if (atBottom && !logs.autoFollow) {logs.setAutoFollow(true);}
        }}
      >
        {logs.entries.length === 0 && !logs.loading && (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">No log entries</div>
        )}
        {logs.entries.map((entry, i) => (
          <LogLine key={i} entry={entry} />
        ))}
      </div>

      {/* Debug RPC panel */}
      <div className="border-t border-zinc-800">
        <details className="group">
          <summary className="px-3 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer select-none">
            Debug RPC
          </summary>
          <div className="px-3 pb-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="method (e.g. status)"
                value={debug.method}
                onChange={(e) => debug.setMethod(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={debug.call}
                disabled={debug.running || !debug.method.trim()}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-xs rounded text-white transition-colors"
              >
                {debug.running ? "..." : "Call"}
              </button>
            </div>
            <textarea
              placeholder='{"param": "value"}'
              value={debug.params}
              onChange={(e) => debug.setParams(e.target.value)}
              className="w-full h-12 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 font-mono resize-none focus:outline-none focus:border-orange-500"
            />
            {debug.result && (
              <pre className="bg-zinc-900 border border-zinc-800 rounded p-2 text-[10px] text-green-400 font-mono max-h-32 overflow-auto whitespace-pre-wrap">
                {debug.result}
              </pre>
            )}
            {debug.rpcError && (
              <pre className="bg-zinc-900 border border-red-900/50 rounded p-2 text-[10px] text-red-400 font-mono max-h-32 overflow-auto whitespace-pre-wrap">
                {debug.rpcError}
              </pre>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
