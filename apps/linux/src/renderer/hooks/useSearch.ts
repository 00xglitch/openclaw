import { useState, useCallback, useRef } from "react";
import type { SessionInfo } from "../lib/protocol-types.js";

export function useSearch(
  request: <T>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
) {
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number>(0);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await request<{ sessions?: SessionInfo[] }>("sessions.list", {
          search: q.trim(),
          limit: 20,
        });
        setResults(res.sessions ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [request],
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (enabled) {doSearch(q);}
      }, 300);
    },
    [enabled, doSearch],
  );

  return { query, results, loading, setQuery };
}
