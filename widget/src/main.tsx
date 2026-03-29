// widget/src/main.tsx

import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { applyTheme } from "./theme";
import { routeToView } from "./router";
import type { ViewProps } from "./router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Onboarding } from "./views/Onboarding";
import "./global.css";

function App() {
  const [viewProps, setViewProps] = useState<(ViewProps & { toolName: string }) | null>(null);
  const bridge = window.openai;

  useEffect(() => {
    // Apply theme on mount
    applyTheme();

    // If tool output is already available (synchronous delivery)
    if (bridge?.toolOutput) {
      const meta = (bridge.toolResponseMetadata ?? {}) as Record<string, unknown>;
      const toolName = (meta.toolName as string) ?? "unknown";
      setViewProps({
        data: bridge.toolOutput as Record<string, unknown>,
        meta,
        toolName,
      });
    }
  }, []);

  // Report height after every render
  useEffect(() => {
    if (bridge) {
      requestAnimationFrame(() => {
        bridge.notifyIntrinsicHeight(document.body.scrollHeight);
      });
    }
  });

  // No bridge = not in ChatGPT iframe (dev mode)
  if (!bridge) {
    return <div style={{ padding: "16px" }}>Development mode — not in ChatGPT iframe.</div>;
  }

  // No tool output yet = show onboarding
  if (!viewProps) {
    return <Onboarding />;
  }

  const View = routeToView(viewProps.toolName);

  return (
    <ErrorBoundary data={viewProps.data}>
      <View data={viewProps.data} meta={viewProps.meta} />
    </ErrorBoundary>
  );
}

render(<App />, document.getElementById("app")!);
