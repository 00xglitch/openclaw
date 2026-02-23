import { useState } from "react";
import type { SkillInfo } from "../lib/protocol-types.js";

type Props = {
  skills: SkillInfo[];
  loading: boolean;
  error: string | null;
  onInstall: (name: string) => void;
  onRefresh: () => void;
};

const statusOrder: Record<string, number> = { active: 0, eligible: 1, missing: 2, blocked: 3 };

const statusStyles: Record<string, { badge: string; label: string }> = {
  eligible: { badge: "bg-emerald-600/20 text-emerald-400", label: "Eligible" },
  active: { badge: "bg-blue-600/20 text-blue-400", label: "Active" },
  missing: { badge: "bg-amber-600/20 text-amber-400", label: "Missing deps" },
  blocked: { badge: "bg-red-600/20 text-red-400", label: "Blocked" },
};

const typeStyles: Record<string, string> = {
  mcp: "bg-purple-600/20 text-purple-400",
  builtin: "bg-zinc-600/20 text-zinc-400",
  custom: "bg-orange-600/20 text-orange-400",
};

type FilterStatus = "all" | "eligible" | "active" | "missing" | "blocked";

export function SkillsView({ skills, loading, error, onInstall, onRefresh }: Props) {
  const [filter, setFilter] = useState<FilterStatus>("all");

  const filtered = skills
    .filter((s) => filter === "all" || s.status === filter)
    .toSorted((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  const counts = {
    all: skills.length,
    eligible: skills.filter((s) => s.status === "eligible").length,
    active: skills.filter((s) => s.status === "active").length,
    missing: skills.filter((s) => s.status === "missing").length,
    blocked: skills.filter((s) => s.status === "blocked").length,
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">Skills</h2>
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

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(["all", "active", "eligible", "missing", "blocked"] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-1 rounded-lg transition-colors capitalize ${
              filter === f
                ? "bg-orange-600/20 text-orange-400 border border-orange-600/30"
                : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-zinc-500 text-sm">No skills found</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((skill) => {
          const styles = statusStyles[skill.status] ?? statusStyles.blocked;
          const typeClass = typeStyles[skill.type] ?? typeStyles.custom;

          return (
            <div
              key={skill.name}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200 truncate">{skill.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${styles.badge}`}>
                    {styles.label}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${typeClass}`}>
                    {skill.type}
                  </span>
                </div>
                {skill.description && (
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{skill.description}</p>
                )}
                {skill.version && (
                  <span className="text-[9px] text-zinc-600">v{skill.version}</span>
                )}
              </div>
              {skill.status === "missing" && (
                <button
                  onClick={() => onInstall(skill.name)}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 transition-colors border border-orange-600/30 flex-shrink-0"
                >
                  Install
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
