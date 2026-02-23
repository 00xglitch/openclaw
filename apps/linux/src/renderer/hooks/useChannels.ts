import { useCallback } from "react";
import { usePolling } from "./usePolling.js";
import type { ChannelsStatusResult } from "../lib/protocol-types.js";

export function useChannels(
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
) {
  const fetcher = useCallback(
    () => request<ChannelsStatusResult>("channels.status", {}),
    [request],
  );

  const { data, loading, error, refresh } = usePolling(fetcher, 10_000, enabled);

  const login = useCallback(
    async (channelId: string) => {
      await request("web.login.start", { channelId });
      refresh();
    },
    [request, refresh],
  );

  const logout = useCallback(
    async (channelId: string) => {
      await request("channels.logout", { channelId });
      refresh();
    },
    [request, refresh],
  );

  return {
    channels: data?.channels ?? [],
    loading,
    error,
    refresh,
    login,
    logout,
  };
}
