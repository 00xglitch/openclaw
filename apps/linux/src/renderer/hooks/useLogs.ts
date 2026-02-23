import { useState, useEffect, useCallback, useRef } from "react";
import { parseLogLine } from "../lib/log-parser.js";
import type { LogEntry, LogLevel } from "../lib/protocol-types.js";

const LOG_BUFFER_LIMIT = 2000;
const POLL_INTERVAL = 2000;

export type LogsData = {
  entries: LogEntry[];
  loading: boolean;
  error: string | null;
  autoFollow: boolean;
  filterText: string;
  levelFilter: Set<LogLevel>;
  filteredEntries: LogEntry[];
};

export function useLogs(
  request: <T>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [levelFilter, setLevelFilter] = useState<Set<LogLevel>>(new Set(["info", "warn", "error", "fatal"]));
  const cursorRef = useRef<number | null>(null);
  const requestRef = useRef(request);
  requestRef.current = request;

  const fetchLogs = useCallback(async (reset?: boolean) => {
    try {
      const res = await requestRef.current<{
        file?: string;
        cursor?: number;
        lines?: unknown;
        truncated?: boolean;
        reset?: boolean;
      }>("logs.tail", {
        cursor: reset ? undefined : (cursorRef.current ?? undefined),
        limit: 200,
        maxBytes: 512_000,
      });
      const lines = Array.isArray(res.lines) ? res.lines.filter((l): l is string => typeof l === "string") : [];
      const parsed = lines.map(parseLogLine);
      const shouldReset = reset || res.reset || cursorRef.current == null;
      setEntries((prev) =>
        shouldReset ? parsed : [...prev, ...parsed].slice(-LOG_BUFFER_LIMIT),
      );
      if (typeof res.cursor === "number") {cursorRef.current = res.cursor;}
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    if (!enabled) {return;}
    setLoading(true);
    cursorRef.current = null;
    fetchLogs(true).finally(() => setLoading(false));
    const timer = setInterval(() => fetchLogs(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [enabled, fetchLogs]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    setEntries([]);
    return fetchLogs(true);
  }, [fetchLogs]);

  const toggleLevel = useCallback((level: LogLevel) => {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {next.delete(level);}
      else {next.add(level);}
      return next;
    });
  }, []);

  // Filter entries
  const lowerFilter = filterText.toLowerCase();
  const filteredEntries = entries.filter((e) => {
    if (e.level && !levelFilter.has(e.level)) {return false;}
    if (lowerFilter && !e.message.toLowerCase().includes(lowerFilter) && !(e.subsystem?.toLowerCase().includes(lowerFilter))) {return false;}
    return true;
  });

  return {
    entries: filteredEntries,
    allEntries: entries,
    loading,
    error,
    autoFollow,
    setAutoFollow,
    filterText,
    setFilterText,
    levelFilter,
    toggleLevel,
    refresh,
  };
}

// Debug RPC hook
export function useDebugRpc(
  request: <T>(method: string, params?: unknown) => Promise<T>,
) {
  const [method, setMethod] = useState("");
  const [params, setParams] = useState("{}");
  const [result, setResult] = useState<string | null>(null);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const call = useCallback(async () => {
    if (!method.trim()) {return;}
    setRunning(true);
    setResult(null);
    setRpcError(null);
    try {
      let parsed: unknown = undefined;
      if (params.trim()) {
        parsed = JSON.parse(params);
      }
      const res = await request<unknown>(method.trim(), parsed);
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setRpcError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [method, params, request]);

  return { method, setMethod, params, setParams, result, rpcError, running, call };
}
