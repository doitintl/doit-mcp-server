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
    }}>
      {children}
    </main>
  );
}
