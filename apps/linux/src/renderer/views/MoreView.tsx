import { useState, useCallback } from "react";
import type { View } from "../hooks/useNavigation.js";

type Props = {
  onNavigate: (view: View) => void;
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  connected: boolean;
};

type Tile = { view: View; label: string; icon: string; desc: string };

type TileCategory = { title: string; tiles: Tile[] };

const categories: TileCategory[] = [
  {
    title: "Monitoring",
    tiles: [
      { view: "logs", label: "Logs", icon: "\uD83D\uDCDC", desc: "Live logs & debug" },
      { view: "usage", label: "Usage", icon: "\uD83D\uDCCA", desc: "Token & cost analytics" },
    ],
  },
  {
    title: "Management",
    tiles: [
      { view: "sessions", label: "Sessions", icon: "\uD83D\uDCCB", desc: "Browse & switch sessions" },
      { view: "agents", label: "Agents", icon: "\uD83E\uDD16", desc: "Manage agents & files" },
      { view: "config", label: "Config", icon: "\uD83D\uDD27", desc: "Edit gateway config" },
      { view: "channels", label: "Channels", icon: "\uD83D\uDD17", desc: "Channel connections" },
      { view: "skills", label: "Skills", icon: "\u26A1", desc: "Skill status & install" },
    ],
  },
  {
    title: "App",
    tiles: [
      { view: "settings", label: "Settings", icon: "\u2699\uFE0F", desc: "Connection & preferences" },
      { view: "about", label: "About", icon: "\u2139\uFE0F", desc: "App & gateway info" },
    ],
  },
];

type ToggleState = { heartbeats: boolean; browser: boolean; talkMode: boolean };

export function MoreView({ onNavigate, request, connected }: Props) {
  const [toggles, setToggles] = useState<ToggleState>({
    heartbeats: true,
    browser: false,
    talkMode: false,
  });
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = useCallback(
    async (key: keyof ToggleState) => {
      if (!connected) {return;}
      setToggling(key);
      const newValue = !toggles[key];
      try {
        if (key === "heartbeats") {
          await request("set-heartbeats", { enabled: newValue });
        } else if (key === "browser") {
          await request("config.patch", { path: "browser.enabled", value: newValue });
        } else if (key === "talkMode") {
          await request("talk.mode", { enabled: newValue });
        }
        setToggles((s) => ({ ...s, [key]: newValue }));
      } catch {
        // Revert on failure — state stays unchanged
      } finally {
        setToggling(null);
      }
    },
    [connected, request, toggles],
  );

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto space-y-4">
      {/* Quick Controls */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Quick Controls
        </h2>
        <div className="flex gap-2 flex-wrap">
          <ToggleButton
            label="Heartbeats"
            icon="🔄"
            active={toggles.heartbeats}
            loading={toggling === "heartbeats"}
            onClick={() => handleToggle("heartbeats")}
          />
          <ToggleButton
            label="Browser"
            icon="🌐"
            active={toggles.browser}
            loading={toggling === "browser"}
            onClick={() => handleToggle("browser")}
          />
          <ToggleButton
            label="Talk Mode"
            icon="🎙"
            active={toggles.talkMode}
            loading={toggling === "talkMode"}
            onClick={() => handleToggle("talkMode")}
          />
        </div>
      </section>

      {/* Categorized views */}
      {categories.map((cat) => (
        <section key={cat.title}>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">{cat.title}</h2>
          <div className="grid grid-cols-2 gap-3">
            {cat.tiles.map((tile) => (
              <button
                key={tile.view}
                onClick={() => onNavigate(tile.view)}
                className="flex flex-col items-start gap-1 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-colors text-left"
              >
                <span className="text-2xl">{tile.icon}</span>
                <span className="text-sm font-medium text-zinc-200">{tile.label}</span>
                <span className="text-xs text-zinc-500">{tile.desc}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type ToggleButtonProps = {
  label: string;
  icon: string;
  active: boolean;
  loading: boolean;
  onClick: () => void;
};

function ToggleButton({ label, icon, active, loading, onClick }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
        active
          ? "bg-orange-600/15 border-orange-600/30 text-orange-300"
          : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
      } ${loading ? "opacity-50" : ""}`}
    >
      <span>{icon}</span>
      <span className="text-xs font-medium">{label}</span>
      <span
        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
          active ? "bg-orange-600/30 text-orange-300" : "bg-zinc-700 text-zinc-500"
        }`}
      >
        {active ? "ON" : "OFF"}
      </span>
    </button>
  );
}
