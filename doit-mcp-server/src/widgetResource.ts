import type { RuntimeEnvVars, UiDomainProvider } from "./runtimeEnv.js";

export const DEFAULT_WIDGET_FETCH_ORIGIN = "https://mcp.doit.com";
export const WIDGET_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
type WebCryptoApi = (typeof import("node:crypto"))["webcrypto"];

function requireAbsoluteUrl(
  value: string,
  envName: "WORKER_URL" | "PUBLIC_MCP_URL"
): string {
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(
      `[widget] ${envName} must be an absolute URL. Received ${JSON.stringify(value)}.`
    );
  }
}

export interface ResolveUiDomainArgs {
  mcpClient?: string;
  sessionProvider?: UiDomainProvider;
  widgetFetchOrigin: string;
  publicMcpUrl: string;
  env: Pick<
    RuntimeEnvVars,
    "UI_DOMAIN_PROVIDER" | "CLAUDE_UI_DOMAIN" | "OPENAI_UI_DOMAIN"
  >;
}

export interface BuildWidgetResourceContentArgs extends ResolveUiDomainArgs {
  widgetUri: string;
}

export interface WidgetResourceContent {
  uri: string;
  mimeType: string;
  text: string;
  _meta: Record<string, unknown>;
}

export function resolveWidgetFetchOrigin(
  env: Pick<RuntimeEnvVars, "WORKER_URL">
): string {
  return env.WORKER_URL
    ? requireAbsoluteUrl(env.WORKER_URL, "WORKER_URL")
    : DEFAULT_WIDGET_FETCH_ORIGIN;
}

export function resolvePublicMcpUrl(
  env: Pick<RuntimeEnvVars, "PUBLIC_MCP_URL">,
  widgetFetchOrigin: string
): string {
  // Claude-compatible hashes must use the exact public MCP endpoint string,
  // so config can override the /sse fallback when the host-facing URL differs.
  if (env.PUBLIC_MCP_URL) {
    return requireAbsoluteUrl(env.PUBLIC_MCP_URL, "PUBLIC_MCP_URL");
  }

  return new URL("/sse", requireAbsoluteUrl(widgetFetchOrigin, "WORKER_URL")).toString();
}

/**
 * Generates the tiny loader stub cached by ChatGPT as widget HTML.
 * The stub fetches the real widget from GET /widget on every render, so
 * future widget updates require zero ChatGPT app re-registrations.
 */
export function buildWidgetStub(widgetFetchOrigin: string): string {
  const widgetUrl = new URL("/widget", widgetFetchOrigin).toString();
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>*{box-sizing:border-box}body{margin:0;padding:0;font-family:system-ui,sans-serif}</style>
</head>
<body>
<div id="app"><p style="padding:16px;color:#888;font-size:0.8125rem">Loading…</p></div>
<script type="module">
(async()=>{
  try{
    const html=await fetch(${JSON.stringify(widgetUrl)},{cache:"no-store"}).then(r=>{if(!r.ok)throw r;return r.text()});
    const doc=new DOMParser().parseFromString(html,"text/html");
    for(const e of doc.querySelectorAll("style"))document.head.appendChild(document.adoptNode(e));
    document.getElementById("app").textContent='';
    for(const s of doc.querySelectorAll("script")){
      const n=document.createElement("script");
      if(s.type)n.type=s.type;
      n.textContent=s.textContent;
      document.head.appendChild(n);
    }
  }catch(err){
    document.getElementById("app").innerHTML='<p style="padding:16px;color:#888;font-size:0.8125rem">Widget unavailable — check MCP server connectivity.</p>';
    console.error("[doit-widget] load failed",err);
  }
})();
</script>
</body>
</html>`;
}

export async function computeClaudeDomain(serverUrl: string): Promise<string> {
  const data = new TextEncoder().encode(serverUrl);
  const runtimeCrypto = (globalThis as typeof globalThis & {
    crypto?: WebCryptoApi;
  }).crypto;
  const cryptoApi = runtimeCrypto ?? (await import("node:crypto")).webcrypto;
  const hashBuffer = await cryptoApi.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `${hashHex.slice(0, 32)}.claudemcpcontent.com`;
}

function getConfiguredProvider(
  value?: RuntimeEnvVars["UI_DOMAIN_PROVIDER"]
): UiDomainProvider | undefined {
  if (!value) return undefined;

  const normalized = value.toLowerCase();
  if (normalized === "claude" || normalized === "openai" || normalized === "omit") {
    return normalized;
  }

  return undefined;
}

function isClaudeLikeClient(client: string): boolean {
  return (
    client.includes("claude") ||
    client.includes("cowork") ||
    client.includes("anthropic")
  );
}

function isOpenAiLikeClient(client: string): boolean {
  return client.includes("chatgpt") || client.includes("openai");
}

export function classifyUiDomainProvider(mcpClient?: string): UiDomainProvider {
  const client = mcpClient?.toLowerCase() ?? "";

  if (isClaudeLikeClient(client)) {
    return "claude";
  }

  if (isOpenAiLikeClient(client)) {
    return "openai";
  }

  return "omit";
}

function toOrigin(urlOrOrigin: string): string {
  try {
    return new URL(urlOrOrigin).origin;
  } catch {
    return urlOrOrigin;
  }
}

function getOpenAiDomain(
  widgetFetchOrigin: string,
  env: Pick<RuntimeEnvVars, "OPENAI_UI_DOMAIN">
): string {
  return env.OPENAI_UI_DOMAIN ?? toOrigin(widgetFetchOrigin);
}

async function resolveProviderUiDomain(
  provider: UiDomainProvider,
  args: Pick<
    ResolveUiDomainArgs,
    "widgetFetchOrigin" | "publicMcpUrl" | "env"
  >
): Promise<{ provider: UiDomainProvider; uiDomain?: string }> {
  if (provider === "claude") {
    return {
      provider: "claude",
      uiDomain:
        args.env.CLAUDE_UI_DOMAIN ?? (await computeClaudeDomain(args.publicMcpUrl)),
    };
  }

  if (provider === "openai") {
    return {
      provider: "openai",
      uiDomain: getOpenAiDomain(args.widgetFetchOrigin, args.env),
    };
  }

  return { provider: "omit" };
}

export async function resolveUiDomain(
  args: ResolveUiDomainArgs
): Promise<{ provider: UiDomainProvider; uiDomain?: string }> {
  const configuredProvider = getConfiguredProvider(args.env.UI_DOMAIN_PROVIDER);
  const hasCurrentClient = Boolean(args.mcpClient?.trim());

  if (configuredProvider) {
    return resolveProviderUiDomain(configuredProvider, args);
  }

  const runtimeProvider = classifyUiDomainProvider(args.mcpClient);
  if (runtimeProvider !== "omit") {
    return resolveProviderUiDomain(runtimeProvider, args);
  }

  if (!hasCurrentClient && args.sessionProvider && args.sessionProvider !== "omit") {
    return resolveProviderUiDomain(args.sessionProvider, args);
  }

  return { provider: "omit" };
}

export function buildWidgetConnectDomains(
  widgetFetchOrigin: string,
  publicMcpUrl?: string
): string[] {
  return Array.from(
    new Set([
      "https://api.doit.com",
      "https://mcp.doit.com",
      toOrigin(widgetFetchOrigin),
      ...(publicMcpUrl ? [toOrigin(publicMcpUrl)] : []),
    ])
  );
}

export function buildFallbackWidgetResourceContent(
  widgetUri: string
): WidgetResourceContent {
  return {
    uri: widgetUri,
    mimeType: WIDGET_RESOURCE_MIME_TYPE,
    text: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<p style="padding:16px;color:#888;font-size:0.8125rem;font-family:system-ui,sans-serif">
Widget unavailable — MCP tools are still available.
</p>
</body>
</html>`,
    _meta: {
      ui: {
        // Intentionally omit ui.domain so strict clients cannot reject the fallback.
        csp: {
          connectDomains: ["https://api.doit.com", "https://mcp.doit.com"],
        },
      },
    },
  };
}

export async function buildWidgetResourceContent(
  args: BuildWidgetResourceContentArgs
): Promise<WidgetResourceContent> {
  const { provider, uiDomain } = await resolveUiDomain(args);

  const uiMeta: {
    csp: { connectDomains: string[] };
    domain?: string;
  } = {
    csp: {
      connectDomains: buildWidgetConnectDomains(
        args.widgetFetchOrigin,
        args.publicMcpUrl
      ),
    },
  };

  if (uiDomain) {
    uiMeta.domain = uiDomain;
  }

  const resourceMeta: Record<string, unknown> = {
    ui: uiMeta,
  };

  if (provider === "openai" && uiDomain) {
    resourceMeta["openai/widgetDomain"] = uiDomain;
  }

  return {
    uri: args.widgetUri,
    mimeType: WIDGET_RESOURCE_MIME_TYPE,
    text: buildWidgetStub(args.widgetFetchOrigin),
    _meta: resourceMeta,
  };
}
