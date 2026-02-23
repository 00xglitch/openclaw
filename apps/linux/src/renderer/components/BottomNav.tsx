import type { View } from "../hooks/useNavigation.js";
import { isSecondaryView } from "../hooks/useNavigation.js";

type Props = {
  active: View;
  onNavigate: (view: View) => void;
};

function TabIcon({ tab }: { tab: "chat" | "board" | "calendar" | "search" | "more" }) {
  const props = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (tab) {
    case "chat":
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "board":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "more":
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

const tabs: { key: "chat" | "board" | "calendar" | "search" | "more"; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Cron" },
  { key: "search", label: "Search" },
  { key: "more", label: "More" },
];

export function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="flex items-center border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-sm" role="tablist" aria-label="Navigation">
      {tabs.map((tab) => {
        const isActive = tab.key === "more"
          ? active === "more" || isSecondaryView(active)
          : active === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            title={tab.label}
            onClick={() => onNavigate(tab.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 transition-colors relative ${
              isActive ? "text-orange-400" : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {isActive && (
              <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-orange-400 rounded-b" />
            )}
            <TabIcon tab={tab.key} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
