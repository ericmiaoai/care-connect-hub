export type Theme = "black" | "gray" | "light" | "blue" | "stone" | "prototypeLovable";

const STORAGE_KEY = "caresync-theme";

export const THEMES: { id: Theme; label: string }[] = [
  { id: "black",            label: "Black"   },
  { id: "gray",             label: "Gray"    },
  { id: "light",            label: "Light"   },
  { id: "blue",             label: "Blue"    },
  { id: "stone",            label: "Stone"   },
  { id: "prototypeLovable", label: "Purple"  },
];

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "black" || v === "gray" || v === "light" || v === "blue" ||
        v === "stone" || v === "prototypeLovable") return v as Theme;
  } catch { /* SSR / privacy mode */ }
  return "black";
}

export function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.setAttribute("data-theme", theme);
  if (theme === "light") {
    html.classList.remove("dark");
  } else {
    html.classList.add("dark");
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
}
