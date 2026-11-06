import { load, save } from "./storage";

export type ThemeMode = "auto" | "light" | "dark";
const MODES: ThemeMode[] = ["auto", "light", "dark"];

export const theme = $state({
  mode: load<ThemeMode>("theme", "auto"),
  /** Counts the system's light/dark switches, for redrawing what is painted with theme colors */
  systemChanges: 0,
});

function apply() {
  if (theme.mode === "auto")
    document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme.mode);
}

/** Cycles auto -> light -> dark */
export function nextTheme() {
  theme.mode = MODES[(MODES.indexOf(theme.mode) + 1) % MODES.length];
  save("theme", theme.mode);
  apply();
}

/** Reads the theme colors again on every change of the theme */
export const watchTheme = () => {
  void theme.mode;
  void theme.systemChanges;
};

apply();
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  () => theme.systemChanges++,
);
