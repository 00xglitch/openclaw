import type { HealthResult } from "../lib/protocol-types.js";

type Props = {
  health: HealthResult | null;
  gatewayUrl: string;
};

function formatUptime(ms?: number): string {
  if (!ms) {return "Unknown";}
  const secs = Math.floor(ms / 1000);
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days > 0) {return `${days}d ${hours}h ${mins}m`;}
  if (hours > 0) {return `${hours}h ${mins}m`;}
  return `${mins}m`;
}

type InfoRowProps = { label: string; value: string };

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-zinc-500 flex-shrink-0">{label}</span>
      <span className="text-xs text-zinc-300 text-right font-mono truncate">{value}</span>
    </div>
  );
}

export function AboutView({ health, gatewayUrl }: Props) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-300">About</h2>

      {/* App Info */}
      <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-1">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Application</h3>
        <InfoRow label="App" value="OpenClaw Linux v0.1.0" />
        <InfoRow label="Platform" value="Linux (Electron)" />
        <InfoRow label="Electron" value={typeof process !== "undefined" ? (process.versions?.electron ?? "Unknown") : "Unknown"} />
        <InfoRow label="Node.js" value={typeof process !== "undefined" ? (process.versions?.node ?? "Unknown") : "Unknown"} />
        <InfoRow label="Chrome" value={typeof process !== "undefined" ? (process.versions?.chrome ?? "Unknown") : "Unknown"} />
      </section>

      {/* Gateway Info */}
      <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-1">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Gateway</h3>
        <InfoRow label="URL" value={gatewayUrl} />
        <InfoRow label="Version" value={health?.version ?? "Unknown"} />
        <InfoRow label="Commit" value={health?.commit ? health.commit.slice(0, 12) : "Unknown"} />
        <InfoRow label="Uptime" value={formatUptime(health?.uptime)} />
        <InfoRow label="Status" value={health?.status ?? "Unknown"} />
      </section>

      {/* Health Checks */}
      {health?.checks && health.checks.length > 0 && (
        <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            Health Checks
          </h3>
          <div className="space-y-2">
            {health.checks.map((check) => (
              <div key={check.name} className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    check.status === "ok"
                      ? "bg-emerald-400"
                      : check.status === "degraded"
                        ? "bg-amber-400"
                        : "bg-red-400"
                  }`}
                />
                <span className="text-xs text-zinc-300 flex-1">{check.name}</span>
                <span className="text-[10px] text-zinc-500">{check.status}</span>
                {check.message && (
                  <span className="text-[9px] text-zinc-600 truncate max-w-[150px]">
                    {check.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Config */}
      <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-1">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Configuration
        </h3>
        <InfoRow label="Config file" value="~/.openclaw/openclaw.json" />
        <InfoRow label="Workspace" value="~/.openclaw/workspace/" />
      </section>
    </div>
  );
}
