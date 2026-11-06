import { find } from "./dom";
import { load, save } from "./storage";

type Theme = "auto" | "light" | "dark";
const THEMES: Theme[] = ["auto", "light", "dark"];
const ICONS: Record<Theme, string> = {
  auto: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  light:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};

let theme = load<Theme>("theme", "auto");

/**
 * Sets up the theme button, which cycles auto -> light -> dark.
 * `onChange` runs after a theme change, to redraw what is painted with theme colors.
 */
export function initTheme(onChange: () => void) {
  const button = find("#theme");
  const apply = () => {
    if (theme === "auto")
      document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
    button.innerHTML = ICONS[theme];
    button.title = `Theme: ${theme}`;
    requestAnimationFrame(onChange);
  };
  button.onclick = () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    save("theme", theme);
    apply();
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", apply);
  apply();
}
