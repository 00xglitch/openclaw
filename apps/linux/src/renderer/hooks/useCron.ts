import { usePolling } from "./usePolling.js";

export type CronJob = {
  id: string;
  name: string;
  schedule: { kind: string; expr: string; tz?: string };
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
};

export function useCron(
  request: <T>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
) {
  return usePolling(
    async () => {
      const res = await request<{ jobs?: CronJob[] }>("cron.list", {});
      return res.jobs ?? [];
    },
    60_000,
    enabled,
  );
}
