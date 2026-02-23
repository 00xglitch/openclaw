import { useState, useEffect, useCallback } from "react";
import { getStoredConfig } from "../lib/config-store.js";
import { MicCapture } from "../lib/mic-capture.js";
import type { HealthResult } from "../lib/protocol-types.js";

type Props = {
  onResetConnection: () => void;
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  connected: boolean;
};

export function SettingsView({ onResetConnection, request, connected }: Props) {
  const config = getStoredConfig();
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>(
    () => localStorage.getItem("openclaw:selectedMic") ?? "",
  );
  const [ttsStatus, setTtsStatus] = useState<"checking" | "ok" | "error">("checking");
  const [healthCheck, setHealthCheck] = useState<{
    status: "idle" | "checking" | "done";
    result: HealthResult | null;
    error: string | null;
  }>({ status: "idle", result: null, error: null });

  // Enumerate mic devices on mount
  useEffect(() => {
    MicCapture.listDevices()
      .then(setMicDevices)
      .catch(() => setMicDevices([]));
  }, []);

  // Check TTS endpoint health
  useEffect(() => {
    setTtsStatus("checking");
    window.openclawBridge
      .getConfig()
      .then((cfg) =>
        fetch(`${cfg.ttsUrl}/v1/models`, { signal: AbortSignal.timeout(5000) }),
      )
      .then((r) => setTtsStatus(r.ok ? "ok" : "error"))
      .catch(() => setTtsStatus("error"));
  }, []);

  const handleMicSelect = useCallback((deviceId: string) => {
    setSelectedMic(deviceId);
    localStorage.setItem("openclaw:selectedMic", deviceId);
  }, []);

  const handleHealthCheck = useCallback(async () => {
    if (!connected) {return;}
    setHealthCheck({ status: "checking", result: null, error: null });
    try {
      const result = await request<HealthResult>("health", {});
      setHealthCheck({ status: "done", result, error: null });
    } catch (err) {
      setHealthCheck({
        status: "done",
        result: null,
        error: err instanceof Error ? err.message : "Health check failed",
      });
    }
  }, [request, connected]);

  const handleOpenDashboard = useCallback(() => {
    const url = config.gatewayUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
    window.open(url, "_blank");
  }, [config.gatewayUrl]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-300">Settings</h2>

      {/* Connection */}
      <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Connection</h3>
        <div className="text-xs text-zinc-500 break-all font-mono">{config.gatewayUrl}</div>
        <div className="flex gap-2">
          <button
            onClick={onResetConnection}
            className="flex-1 py-2 px-3 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700"
          >
            Reconfigure
          </button>
          <button
            onClick={handleOpenDashboard}
            className="flex-1 py-2 px-3 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700"
          >
            Open Dashboard
          </button>
        </div>
      </section>

      {/* Gateway Health Check */}
      <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Gateway Health
        </h3>
        <button
          onClick={handleHealthCheck}
          disabled={!connected || healthCheck.status === "checking"}
          className="w-full py-2 px-3 text-sm rounded-lg bg-orange-600/15 hover:bg-orange-600/25 text-orange-300 transition-colors border border-orange-600/30 disabled:opacity-50"
        >
          {healthCheck.status === "checking" ? "Checking..." : "Run Health Check"}
        </button>
        {healthCheck.status === "done" && healthCheck.result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  healthCheck.result.status === "ok"
                    ? "bg-emerald-400"
                    : healthCheck.result.status === "degraded"
                      ? "bg-amber-400"
                      : "bg-red-400"
                }`}
              />
              <span className="text-xs text-zinc-300 capitalize">{healthCheck.result.status}</span>
              {healthCheck.result.version && (
                <span className="text-[10px] text-zinc-500 ml-auto">v{healthCheck.result.version}</span>
              )}
            </div>
            {healthCheck.result.checks.map((c) => (
              <div key={c.name} className="flex items-center gap-2 pl-4">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    c.status === "ok" ? "bg-emerald-400" : c.status === "degraded" ? "bg-amber-400" : "bg-red-400"
                  }`}
                />
                <span className="text-[10px] text-zinc-400">{c.name}</span>
                <span className="text-[10px] text-zinc-600">{c.status}</span>
              </div>
            ))}
          </div>
        )}
        {healthCheck.status === "done" && healthCheck.error && (
          <p className="text-xs text-red-400">{healthCheck.error}</p>
        )}
      </section>

      {/* TTS */}
      <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Text-to-Speech
        </h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              ttsStatus === "ok"
                ? "bg-emerald-400"
                : ttsStatus === "error"
                  ? "bg-red-400"
                  : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-xs text-zinc-400">
            {ttsStatus === "ok"
              ? "Chatterbox connected"
              : ttsStatus === "error"
                ? "TTS unreachable"
                : "Checking..."}
          </span>
        </div>
      </section>

      {/* Microphone */}
      <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Microphone</h3>
        {micDevices.length === 0 ? (
          <p className="text-xs text-zinc-600">No microphone devices found</p>
        ) : (
          <div className="space-y-1.5">
            {micDevices.map((d) => {
              const isSelected = selectedMic === d.deviceId || (!selectedMic && d.deviceId === "default");
              return (
                <button
                  key={d.deviceId}
                  onClick={() => handleMicSelect(d.deviceId)}
                  className={`w-full flex items-center gap-2 text-xs py-2 px-3 rounded-lg transition-colors text-left ${
                    isSelected
                      ? "bg-orange-600/15 text-orange-300 border border-orange-600/30"
                      : "text-zinc-400 hover:bg-zinc-800 border border-transparent"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isSelected ? "bg-orange-400" : "bg-emerald-400"
                    }`}
                  />
                  <span className="truncate">{d.label || `Mic ${d.deviceId.slice(0, 8)}`}</span>
                  {isSelected && (
                    <span className="text-[9px] text-orange-400/70 ml-auto flex-shrink-0">Selected</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* About */}
      <section className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">About</h3>
        <p className="text-xs text-zinc-500">OpenClaw Linux v0.1.0</p>
        <p className="text-xs text-zinc-600">Electron + React + Tailwind</p>
      </section>
    </div>
  );
}
