import { useState, useEffect, useCallback } from "react";
import { useConnectionTest } from "../../hooks/useConnectionTest.js";
import { getStoredConfig, saveStoredConfig } from "../../lib/config-store.js";
import { DiscoveryPanel } from "../DiscoveryPanel.js";

type Props = {
  onNext: (agentName: string) => void;
  onBack: () => void;
};

export function ConnectStep({ onNext, onBack }: Props) {
  const stored = getStoredConfig();
  const [url, setUrl] = useState(stored.gatewayUrl);
  const [token, setToken] = useState(stored.token);
  const [showToken, setShowToken] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const { status, agentName, errorMessage, test, cleanup } = useConnectionTest();

  useEffect(() => cleanup, [cleanup]);

  // Pre-fill from IPC config (reads env vars) if stored config is empty
  useEffect(() => {
    window.openclawBridge.getConfig().then((ipc) => {
      if (!stored.gatewayUrl && ipc.gatewayUrl) {setUrl(ipc.gatewayUrl);}
      if (!stored.token && ipc.token) {setToken(ipc.token);}
    }).catch(() => {});
  }, []);

  const handleTest = () => test(url, token);

  const handleDiscoveryConnect = useCallback((discoveredUrl: string) => {
    setUrl(discoveredUrl);
    setShowDiscovery(false);
    // Auto-test the discovered URL
    test(discoveredUrl, token);
  }, [token, test]);

  const handleContinue = () => {
    saveStoredConfig({ gatewayUrl: url, token });
    onNext(agentName ?? "Assistant");
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-lg font-semibold text-zinc-100 mb-1">Connect to Gateway</h2>
      <p className="text-sm text-zinc-500 mb-6">Enter your gateway details below.</p>

      <label className="text-xs font-medium text-zinc-400 mb-1.5">Gateway URL</label>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="wss://127.0.0.1:9443"
        disabled={status === "connecting"}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50 mb-4"
      />

      <label className="text-xs font-medium text-zinc-400 mb-1.5">Token</label>
      <div className="relative mb-6">
        <input
          type={showToken ? "text" : "password"}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Gateway token"
          disabled={status === "connecting"}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setShowToken((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {showToken ? (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            ) : (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Discovery */}
      <div className="mb-4">
        <button
          onClick={() => setShowDiscovery(!showDiscovery)}
          className="text-xs text-zinc-500 hover:text-orange-400 transition-colors"
        >
          {showDiscovery ? "Hide scanner" : "Or scan local network..."}
        </button>
        {showDiscovery && (
          <div className="mt-2">
            <DiscoveryPanel onConnect={handleDiscoveryConnect} />
          </div>
        )}
      </div>

      <button
        onClick={handleTest}
        disabled={!url.trim() || status === "connecting"}
        className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-200 font-medium border border-zinc-700 hover:bg-zinc-700 disabled:opacity-40 transition-colors mb-3"
      >
        {status === "connecting" ? (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            Testing...
          </span>
        ) : (
          "Test Connection"
        )}
      </button>

      {status === "success" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/50 border border-emerald-900/50 mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400">
            Connected — agent: <span className="font-medium">{agentName}</span>
          </span>
        </div>
      )}
      {status === "error" && (
        <div className="px-3 py-2 rounded-lg bg-red-950/50 border border-red-900/50 mb-4">
          <p className="text-xs text-red-400">{errorMessage}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={status !== "success"}
          className="px-6 py-2 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-500 disabled:opacity-30 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
