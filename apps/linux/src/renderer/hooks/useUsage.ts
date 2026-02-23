import { useState, useCallback, useEffect, useRef } from "react";
import type { SessionsUsageResult, CostUsageSummary } from "../lib/protocol-types.js";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function useUsage(
  request: <T>(method: string, params?: unknown) => Promise<T>,
  enabled: boolean,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageResult, setUsageResult] = useState<SessionsUsageResult | null>(null);
  const [costSummary, setCostSummary] = useState<CostUsageSummary | null>(null);
  const [startDate, setStartDate] = useState(() => daysAgo(7));
  const [endDate, setEndDate] = useState(todayStr);
  const [chartMode, setChartMode] = useState<"tokens" | "cost">("cost");
  const requestRef = useRef(request);
  requestRef.current = request;
  const loadedRef = useRef(false);

  const load = useCallback(async (start?: string, end?: string) => {
    setLoading(true);
    setError(null);
    const s = start ?? startDate;
    const e = end ?? endDate;
    try {
      const [sessionsRes, costRes] = await Promise.all([
        requestRef.current<SessionsUsageResult>("sessions.usage", {
          startDate: s,
          endDate: e,
          limit: 1000,
          includeContextWeight: true,
        }),
        requestRef.current<CostUsageSummary>("usage.cost", { startDate: s, endDate: e }),
      ]);
      setUsageResult(sessionsRes);
      setCostSummary(costRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Auto-load on first enable
  useEffect(() => {
    if (enabled && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
    if (!enabled) {loadedRef.current = false;}
  }, [enabled, load]);

  const setRange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    load(start, end);
  }, [load]);

  const setPreset = useCallback((preset: "today" | "7d" | "30d") => {
    const end = todayStr();
    const start = preset === "today" ? end : preset === "7d" ? daysAgo(7) : daysAgo(30);
    setRange(start, end);
  }, [setRange]);

  return {
    loading,
    error,
    usageResult,
    costSummary,
    startDate,
    endDate,
    chartMode,
    setChartMode,
    setRange,
    setPreset,
    refresh: () => load(),
  };
}
