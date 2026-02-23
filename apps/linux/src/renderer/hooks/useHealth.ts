import { useState, useEffect, useCallback, useRef } from "react";
import type { HealthResult, HeartbeatResult, StatusResult } from "../lib/protocol-types.js";

export type HealthState = {
  health: HealthResult | null;
  heartbeat: HeartbeatResult | null;
  activity: StatusResult | null;
  lastChecked: number | null;
  loading: boolean;
};

export function useHealth(
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>,
  connected: boolean,
) {
  const [state, setState] = useState<HealthState>({
    health: null,
    heartbeat: null,
    activity: null,
    lastChecked: null,
    loading: false,
  });

  const requestRef = useRef(request);
  requestRef.current = request;

  const fetchHealth = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [health, heartbeat, activity] = await Promise.allSettled([
        requestRef.current<HealthResult>("health", {}),
        requestRef.current<HeartbeatResult>("last-heartbeat", {}),
        requestRef.current<StatusResult>("status", {}),
      ]);
      setState({
        health: health.status === "fulfilled" ? health.value : null,
        heartbeat: heartbeat.status === "fulfilled" ? heartbeat.value : null,
        activity: activity.status === "fulfilled" ? activity.value : null,
        lastChecked: Date.now(),
        loading: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  // Poll health every 15s, heartbeat every 30s (health handles both for simplicity)
  useEffect(() => {
    if (!connected) {
      setState({ health: null, heartbeat: null, activity: null, lastChecked: null, loading: false });
      return;
    }
    fetchHealth();
    const timer = setInterval(fetchHealth, 15_000);
    return () => clearInterval(timer);
  }, [connected, fetchHealth]);

  return { ...state, refresh: fetchHealth };
}
