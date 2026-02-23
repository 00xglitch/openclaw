import { usePolling } from "./usePolling.js";
import type { SessionInfo } from "../lib/protocol-types.js";

export type FeedEntry = {
  key: string;
  label: string;
  preview: string;
  timestamp: number;
  channel?: string;
  kind: string;
};

function toFeedEntries(sessions: SessionInfo[]): FeedEntry[] {
  return sessions
    .filter((s) => s.updatedAt)
    .toSorted((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .map((s) => ({
      key: s.key,
      label: s.displayName || s.derivedTitle || s.label || s.key,
      preview: s.lastMessagePreview || "",
      timestamp: s.updatedAt ?? 0,
      channel: s.channel,
      kind: s.kind,
    }));
}

export function useFeed(
  request: <T>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
) {
  return usePolling(
    async () => {
      const res = await request<{ sessions?: SessionInfo[] }>("sessions.list", {
        includeLastMessage: true,
        limit: 50,
      });
      return toFeedEntries(res.sessions ?? []);
    },
    30_000,
    enabled,
  );
}
