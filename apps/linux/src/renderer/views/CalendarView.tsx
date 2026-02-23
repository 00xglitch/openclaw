import type { CronJob } from "../hooks/useCron.js";
import { Skeleton } from "../components/Skeleton.js";

type Props = {
  jobs: CronJob[];
  loading: boolean;
  onRefresh: () => void;
};

function relativeTime(ts: number | undefined): string {
  if (!ts) {return "never";}
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {return "just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hours = Math.floor(mins / 60);
  if (hours < 24) {return `${hours}h ago`;}
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function humanCron(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length < 5) {return expr;}
  const [min, hour, , , dow] = parts;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayStr = dow === "*" ? "every day" : days[Number(dow)] ?? dow;
  return `${dayStr} at ${hour}:${min.padStart(2, "0")}`;
}

export function CalendarView({ jobs, loading, onRefresh }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">Cron Jobs</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-800 disabled:opacity-50"
          title="Refresh"
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

      <div className="flex-1 overflow-y-auto">
        {loading && jobs.length === 0 && (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-44" />
              </div>
            ))}
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-sm">No cron jobs configured</span>
          </div>
        )}

        <div className="p-3 space-y-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${job.enabled ? "bg-emerald-400" : "bg-zinc-600"}`}
                />
                <span className="text-sm font-medium text-zinc-200">{job.name}</span>
              </div>
              <div className="text-xs text-zinc-500 font-mono">{job.schedule.expr}</div>
              <div className="text-xs text-zinc-600">{humanCron(job.schedule.expr)}</div>
              <div className="flex items-center gap-4 text-[10px] text-zinc-600 pt-1">
                <span>Last: {relativeTime(job.lastRunAt)}</span>
                {job.nextRunAt && <span>Next: {relativeTime(job.nextRunAt)}</span>}
                {job.schedule.tz && <span>{job.schedule.tz}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
