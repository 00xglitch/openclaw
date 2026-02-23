import { useState, useCallback } from "react";

export type View = "chat" | "board" | "calendar" | "search" | "more" | "settings" | "usage" | "config" | "agents" | "logs" | "channels" | "skills" | "about" | "sessions";

const secondaryViews = new Set<View>(["settings", "usage", "config", "agents", "logs", "channels", "skills", "about", "sessions"]);

export function isSecondaryView(v: View): boolean {
  return secondaryViews.has(v);
}

export function useNavigation(initial: View = "chat") {
  const [view, setView] = useState<View>(initial);
  const navigate = useCallback((v: View) => setView(v), []);
  return { view, navigate } as const;
}
