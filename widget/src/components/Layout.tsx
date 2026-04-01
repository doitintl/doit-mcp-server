import type { ComponentChildren } from "preact";

interface Props {
  children: ComponentChildren;
  padding?: string;
}

/**
 * Responsive container. Collapses gracefully on mobile.
 * Max width prevents overly wide layouts on desktop.
 */
export function Layout({ children, padding = "16px" }: Props) {
  return (
    <main style={{
      padding,
      maxWidth: "640px",
      width: "100%",
      fontFamily: "inherit",
      border: "var(--dci-card-border, 1px solid #e5e5e5)",
      borderRadius: "var(--dci-radius, 12px)",
      boxShadow: "var(--dci-card-shadow, 0 1px 4px rgba(0,0,0,0.08))",
      background: "var(--dci-bg, #ffffff)",
    }}>
      {children}
    </main>
  );
}
