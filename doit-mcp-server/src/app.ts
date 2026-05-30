import { Hono } from "hono";
import { cors } from "hono/cors";
import { layout, homeContent } from "./utils";
import { protectedResourceMetadata } from "./oauth/protectedResourceMetadata";
import type { DoitWorkerEnv } from "./runtimeEnv.js";
import { WIDGET_HTML } from "./widgetHtml";

export type Bindings = DoitWorkerEnv;

const app = new Hono<{
  Bindings: Bindings;
}>();

// Add CORS middleware
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization", "Cache-Control", "mcp-session-id"],
  })
);

// Handle preflight requests for SSE
app.options("/sse", (c) => {
  return c.text("", 200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "content-type, mcp-session-id",
  });
});

// Render a basic homepage placeholder to make sure the app is up
app.get("/", async (c) => {
  const content = await homeContent(c.req.raw);
  return c.html(layout(content, "DoiT MCP Remote - Home"));
});

// Serve the full widget HTML at a stable URL so the cached stub can fetch
// the latest version without requiring ChatGPT app re-registration.
app.get("/widget", (c) => {
  return c.body(WIDGET_HTML, 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
});

// Proxy images from storage.googleapis.com so the CSP-sandboxed widget can load them.
// Only allows the specific GCS bucket used for anomaly charts.
app.get("/proxy-image", async (c) => {
  const url = c.req.query("url");
  if (!url || !url.startsWith("https://storage.googleapis.com/me-doit-intl-com-gcp-anomalies/")) {
    return c.text("Forbidden", 403);
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) return c.text("Not found", 404);
    return c.body(resp.body as any, 200, {
      "Content-Type": resp.headers.get("Content-Type") || "image/png",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    });
  } catch {
    return c.text("Fetch error", 502);
  }
});

// Note: /.well-known/oauth-protected-resource is also served by handleRequest() in
// index.ts so it works under all path prefixes (e.g. /sse/.well-known/...).
//
// RFC 9728 — protected-resource metadata. MCP clients discover the real auth
// server (auth.doit.com) here.
app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
app.get("/.well-known/oauth-protected-resource/mcp", protectedResourceMetadata);
app.get("/.well-known/oauth-protected-resource/sse", protectedResourceMetadata);

export default app;
