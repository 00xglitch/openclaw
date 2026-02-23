import { useState } from "react";
import type { HealthState } from "../hooks/useHealth.js";
import type { View } from "../hooks/useNavigation.js";

type Props = HealthState & {
  sessionCount: number;
  nodeCount: number;
  onNavigate: (view: View) => void;
};

function formatAge(ms: number | null | undefined): string {
  if (!ms) {return "?";}
  const secs = Math.floor(ms / 1000);
  if (secs < 60) {return `${secs}s`;}
  if (secs < 3600) {return `${Math.floor(secs / 60)}m`;}
  return `${Math.floor(secs / 3600)}h`;
}

function formatSince(ts: number | null): string {
  if (!ts) {return "";}
  return formatAge(Date.now() - ts);
}

const healthColors: Record<string, string> = {
  ok: "bg-emerald-400",
  degraded: "bg-amber-400",
  error: "bg-red-400",
};

const heartbeatColors: Record<string, string> = {
  ok: "text-emerald-400",
  pending: "text-amber-400",
  stale: "text-red-400",
  disabled: "text-zinc-600",
};

export function InfoBar({
  health,
  heartbeat,
  activity,
  lastChecked,
  sessionCount,
  nodeCount,
  onNavigate,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const healthStatus = health?.status ?? "unknown";
  const dotColor = healthColors[healthStatus] ?? "bg-zinc-600";

  // Collapsed: just indicator dots
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-3 py-1 border-b border-zinc-800/50 bg-zinc-950/60 hover:bg-zinc-900/60 transition-colors"
      >
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} title={`Health: ${healthStatus}`} />
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            heartbeat?.state === "ok"
              ? "bg-emerald-400"
              : heartbeat?.state === "stale"
                ? "bg-red-400"
                : heartbeat?.state === "pending"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-zinc-600"
          }`}
          title={`Heartbeat: ${heartbeat?.state ?? "unknown"}`}
        />
        {activity?.workLabel && (
          <span className="text-[9px] text-orange-400/70 truncate max-w-[120px]">
            {activity.workLabel}
          </span>
        )}
        <span className="text-[9px] text-zinc-600 ml-auto">{sessionCount}s · {nodeCount}n</span>
      </button>
    );
  }

  // Expanded: full info strip
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-zinc-800/50 bg-zinc-950/60 text-[10px]">
      {/* Health */}
      <button
        onClick={() => onNavigate("logs")}
        className="flex items-center gap-1.5 hover:bg-zinc-800/50 px-1.5 py-0.5 rounded transition-colors"
        title="View logs"
      >
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-zinc-400">
          Health {healthStatus}
          {lastChecked ? ` · ${formatSince(lastChecked)}` : ""}
        </span>
      </button>

      {/* Heartbeat */}
      <div className="flex items-center gap-1">
        <span className={heartbeatColors[heartbeat?.state ?? ""] ?? "text-zinc-600"}>
          {heartbeat?.state === "ok" ? "♥" : heartbeat?.state === "stale" ? "♡" : "♥"}
        </span>
        <span className="text-zinc-500">
          {heartbeat?.state ?? "unknown"}
          {heartbeat?.age != null ? ` · ${formatAge(heartbeat.age)}` : ""}
        </span>
      </div>

      {/* Activity */}
      {activity?.workLabel && (
        <div className="flex items-center gap-1">
          <span className="text-orange-400">⚡</span>
          <span className="text-zinc-400 truncate max-w-[140px]">{activity.workLabel}</span>
        </div>
      )}

      {/* Gateway version */}
      {health?.version && (
        <span className="text-zinc-600">v{health.version}</span>
      )}

      {/* Counts — clickable */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onNavigate("sessions")}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
          title="View sessions"
        >
          {sessionCount} session{sessionCount !== 1 ? "s" : ""}
        </button>
        <span className="text-zinc-700">·</span>
        <button
          onClick={() => onNavigate("logs")}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
          title="View nodes"
        >
          {nodeCount} node{nodeCount !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setExpanded(false)}
        className="text-zinc-600 hover:text-zinc-400 transition-colors px-1"
        title="Collapse"
      >
        ▴
      </button>
    </div>
  );
}
