// widget/src/theme.ts

/**
 * Apply ChatGPT theme to CSS custom properties.
 * Called once on init and whenever theme changes.
 */
export function applyTheme(mode?: "light" | "dark"): void {
  const root = document.documentElement;
  const isDark = mode === "dark" || (!mode && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  // System theme hint for browser
  root.style.colorScheme = isDark ? "dark" : "light";

  // Map OpenAI theme to our CSS custom properties
  // These are the fallback values when theme properties aren't available
  root.style.setProperty("--dci-bg", isDark ? "#1a1a1a" : "#ffffff");
  root.style.setProperty("--dci-bg-secondary", isDark ? "#2a2a2a" : "#f7f7f8");
  root.style.setProperty("--dci-text", isDark ? "#e3e3e3" : "#1a1a1a");
  root.style.setProperty("--dci-text-secondary", isDark ? "#999999" : "#666666");
  root.style.setProperty("--dci-border", isDark ? "#333333" : "#e5e5e5");
  root.style.setProperty("--dci-accent", "#00D764"); // DoiT green — primary buttons ONLY
  root.style.setProperty("--dci-danger", isDark ? "#ff6b6b" : "#dc2626");
  root.style.setProperty("--dci-warning", isDark ? "#fbbf24" : "#d97706");
  root.style.setProperty("--dci-success", isDark ? "#34d399" : "#16a34a");
  root.style.setProperty("--dci-radius", "12px");
}
