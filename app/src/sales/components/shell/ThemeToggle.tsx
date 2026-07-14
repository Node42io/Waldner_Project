import { useEffect, useState } from "react";

// The visible light/dark switch is now the @node42/ui-kit <ThemeToggle> (used in
// TopNav). It sets `data-theme` on <html> but — unlike the app's old toggle —
// emits no custom event. So this hook tracks the active theme by OBSERVING the
// `data-theme` attribute, which makes it react to ANY source that changes it.

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme(readTheme());
    const el = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
