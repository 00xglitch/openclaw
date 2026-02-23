import { useState, useCallback } from "react";

export type DiscoveredInstance = {
  url: string;
  name: string;
  version: string;
};

type Props = {
  onConnect: (url: string) => void;
};

export function DiscoveryPanel({ onConnect }: Props) {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<DiscoveredInstance[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setResults([]);
    try {
      const found = await window.openclawBridge.discoveryScan();
      setResults(found);
      if (found.length === 0) {
        setError("No instances found on local network");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-full py-2.5 px-4 text-sm rounded-xl font-medium transition-all bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {scanning ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Scanning...
          </span>
        ) : (
          "Scan Local Network"
        )}
      </button>

      {error && <p className="text-xs text-zinc-500 text-center">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((instance) => (
            <button
              key={instance.url}
              onClick={() => onConnect(instance.url)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-900/30 flex items-center justify-center text-orange-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 font-medium truncate">{instance.name}</p>
                <p className="text-[10px] text-zinc-500 font-mono truncate">{instance.url}</p>
              </div>
              <span className="text-[10px] text-zinc-600 shrink-0">{instance.version}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
