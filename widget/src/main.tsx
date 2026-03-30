// widget/src/main.tsx

import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { applyTheme } from "./theme";
import { routeToView } from "./router";
import type { ViewProps } from "./router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Onboarding } from "./views/Onboarding";
import { McpApp } from "./app";
import type { ToolResultParams } from "./app";
import "./global.css";

// Create the McpApp instance immediately so message listeners are registered
// before ChatGPT sends the first notification.
const app = new McpApp();

function App() {
  const [viewProps, setViewProps] = useState<(ViewProps & { toolName: string }) | null>(null);

  const handleResult = (result: ToolResultParams) => {
    const toolName = (result._meta?.toolName as string) ?? "unknown";
    const data = (result.structuredContent ?? {}) as Record<string, unknown>;
    setViewProps({ data, meta: result._meta ?? {}, toolName });
  };

  useEffect(() => {
    // --- New MCP Apps bridge: ui/notifications/tool-result ---
    app.on("ui/notifications/tool-result", (params) => {
      handleResult(params as ToolResultParams);
    });

    app.on("ui/notifications/host-context-changed", (params: any) => {
      if (params?.theme?.mode) applyTheme(params.theme.mode);
    });

    // Connect (performs ui/initialize handshake)
    app.connect().then((ctx) => {
      if (ctx.theme?.mode) applyTheme(ctx.theme.mode);
    }).catch(() => {
      // Not in an MCP Apps host — fall through to legacy path
    });

    // --- Legacy ChatGPT path: window.openai.toolOutput ---
    // Data may arrive synchronously (pre-populated) or via the openai:set_globals event.
    const tryLegacy = () => {
      const w = window as any;
      const toolOutput = w.openai?.toolOutput;
      if (toolOutput) {
        handleResult({
          structuredContent: toolOutput,
          _meta: { toolName: w.openai?.toolName ?? "unknown" },
        });
        applyTheme(w.openai?.theme?.mode);
      }
    };

    tryLegacy();
    window.addEventListener("openai:set_globals", tryLegacy);

    applyTheme();

    return () => {
      window.removeEventListener("openai:set_globals", tryLegacy);
    };
  }, []);

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
