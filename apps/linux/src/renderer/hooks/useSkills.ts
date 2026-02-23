import { useCallback } from "react";
import { usePolling } from "./usePolling.js";
import type { SkillsStatusResult } from "../lib/protocol-types.js";

export function useSkills(
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
  agentId?: string,
) {
  const fetcher = useCallback(
    () => request<SkillsStatusResult>("skills.status", { agentId }),
    [request, agentId],
  );

  const { data, loading, error, refresh } = usePolling(fetcher, 30_000, enabled);

  const install = useCallback(
    async (skillName: string) => {
      await request("skills.install", { name: skillName, agentId });
      refresh();
    },
    [request, agentId, refresh],
  );

  return {
    skills: data?.skills ?? [],
    loading,
    error,
    refresh,
    install,
  };
}
