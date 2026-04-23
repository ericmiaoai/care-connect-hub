import { useState, useCallback, useEffect } from "react";
import { type Theme, getStoredTheme, applyTheme } from "@/lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("black");

  // On mount: read persisted preference and apply it
  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
  }, []);

  return { theme, setTheme };
}
