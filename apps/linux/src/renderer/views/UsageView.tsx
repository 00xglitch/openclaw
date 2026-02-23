import type { SessionsUsageResult, CostUsageSummary } from "../lib/protocol-types.js";
import { buildCsv, downloadCsv } from "../lib/csv-export.js";

type Props = {
  loading: boolean;
  error: string | null;
  usageResult: SessionsUsageResult | null;
  costSummary: CostUsageSummary | null;
  startDate: string;
  endDate: string;
  chartMode: "tokens" | "cost";
  setChartMode: (m: "tokens" | "cost") => void;
  setPreset: (p: "today" | "7d" | "30d") => void;
  setRange: (start: string, end: string) => void;
  refresh: () => void;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}K`;}
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {return "now";}
  if (mins < 60) {return `${mins}m`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `${hrs}h`;}
  return `${Math.floor(hrs / 24)}d`;
}

export function UsageView(props: Props) {
  const { usageResult, costSummary, loading, error, chartMode } = props;
  const totals = usageResult?.totals;
  const daily = usageResult?.aggregates?.daily ?? [];
  const sessions = usageResult?.sessions ?? [];

  // Find max for bar scaling
  const maxDaily = Math.max(1, ...daily.map((d) => chartMode === "cost" ? d.cost : d.tokens));

  const handleExport = () => {
    if (!sessions.length) {return;}
    const headers = ["Session", "Agent", "Channel", "Model", "Tokens", "Cost"];
    const rows = sessions.map((s) => [
      s.label ?? s.key, s.agentId ?? "", s.channel ?? "", s.model ?? "",
      s.usage?.totalTokens ?? 0, s.usage?.totalCost?.toFixed(4) ?? "0",
    ]);
    const csv = buildCsv(headers, rows);
    downloadCsv(csv, `openclaw-usage-${props.startDate}-${props.endDate}.csv`);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Date range & controls */}
      <div className="px-3 py-2 border-b border-zinc-800 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["today", "7d", "30d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => props.setPreset(p)}
                className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => props.setChartMode(chartMode === "cost" ? "tokens" : "cost")}
            className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-orange-400"
          >
            {chartMode === "cost" ? "$" : "#"}
          </button>
          <button onClick={props.refresh} className="text-xs text-zinc-500 hover:text-zinc-300" title="Refresh">
            {loading ? "\u23F3" : "\u21BB"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={props.startDate}
            onChange={(e) => props.setRange(e.target.value, props.endDate)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-zinc-300 focus:outline-none focus:border-orange-500"
          />
          <span className="text-zinc-600 text-xs">\u2192</span>
          <input
            type="date"
            value={props.endDate}
            onChange={(e) => props.setRange(props.startDate, e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-zinc-300 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {error && <div className="mx-3 mt-2 text-xs text-red-400 bg-red-950/30 rounded px-2 py-1">{error}</div>}

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-3 gap-2 px-3 py-3">
          <div className="bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase">Tokens</div>
            <div className="text-sm font-semibold text-zinc-200">{formatTokens(totals.totalTokens)}</div>
          </div>
          <div className="bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase">Cost</div>
            <div className="text-sm font-semibold text-zinc-200">{formatCost(totals.totalCost)}</div>
          </div>
          <div className="bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
            <div className="text-[10px] text-zinc-500 uppercase">Sessions</div>
            <div className="text-sm font-semibold text-zinc-200">{sessions.length}</div>
          </div>
        </div>
      )}

      {/* Daily chart */}
      {daily.length > 0 && (
        <div className="px-3 pb-2">
          <div className="text-[10px] text-zinc-500 uppercase mb-1">Daily {chartMode}</div>
          <div className="space-y-1">
            {daily.map((d) => {
              const value = chartMode === "cost" ? d.cost : d.tokens;
              const pct = (value / maxDaily) * 100;
              return (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 w-16 shrink-0">{d.date.slice(5)}</span>
                  <div className="flex-1 h-4 bg-zinc-900 rounded-sm overflow-hidden">
                    <div className="h-full bg-orange-500/70 rounded-sm transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-400 w-14 text-right shrink-0">
                    {chartMode === "cost" ? formatCost(value) : formatTokens(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session list */}
      {sessions.length > 0 && (
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500 uppercase">Sessions</span>
            <button onClick={handleExport} className="text-[10px] text-zinc-600 hover:text-zinc-400">CSV</button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {sessions
              .filter((s) => s.usage)
              .toSorted((a, b) => (b.usage?.totalTokens ?? 0) - (a.usage?.totalTokens ?? 0))
              .slice(0, 50)
              .map((s) => (
                <div key={s.key} className="flex items-center gap-2 py-1 px-2 rounded bg-zinc-900/50 hover:bg-zinc-900">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-300 truncate">{s.label ?? s.key}</div>
                    <div className="text-[10px] text-zinc-600">
                      {s.agentId && <span>{s.agentId}</span>}
                      {s.channel && <span> \u00B7 {s.channel}</span>}
                      {s.usage?.lastActivity && <span> \u00B7 {relativeTime(s.usage.lastActivity)}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-zinc-300">{formatTokens(s.usage?.totalTokens ?? 0)}</div>
                    <div className="text-[10px] text-zinc-500">{formatCost(s.usage?.totalCost ?? 0)}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {!loading && !usageResult && !error && (
        <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">No usage data</div>
      )}
    </div>
  );
}
