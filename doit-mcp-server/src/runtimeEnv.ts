export type UiDomainProvider = "claude" | "openai" | "omit";
export type ConsoleProxyBinding = { fetch: typeof fetch };

export interface RuntimeEnvVars {
  WORKER_URL?: string;
  PUBLIC_URL?: string;
  PUBLIC_MCP_URL?: string;
  UI_DOMAIN_PROVIDER?: string;
  CLAUDE_UI_DOMAIN?: string;
  OPENAI_UI_DOMAIN?: string;
  MCP_RESOURCE_URL?: string;
  AUTH_SERVER_URL?: string;
  // Base URL for doer console-data endpoints (e.g. search_customers); falls back to
  // AUTH_SERVER_URL. Lets local dev point console tools at a local customers service.
  DOIT_CONSOLE_BASE?: string;
}

export type DoitWorkerEnv = Env & RuntimeEnvVars;

export const DEFAULT_MCP_RESOURCE_URL = "https://mcp.doit.com";

export function resolveMcpResourceUrl(
  env: { MCP_RESOURCE_URL?: string } | undefined,
): string {
  return env?.MCP_RESOURCE_URL ?? DEFAULT_MCP_RESOURCE_URL;
}

export const DEFAULT_AUTH_SERVER_URL = "https://console.doit.com";

export function resolveAuthServerUrl(
  env: { AUTH_SERVER_URL?: string } | undefined,
): string {
  return env?.AUTH_SERVER_URL ?? DEFAULT_AUTH_SERVER_URL;
}

export function shouldUseConsoleProxy(
  env: { CONSOLE_PROXY?: ConsoleProxyBinding } | undefined,
  authServerUrl: string,
): boolean {
  if (!env?.CONSOLE_PROXY) return false;
  try {
    return new URL(authServerUrl).origin === DEFAULT_AUTH_SERVER_URL;
  } catch {
    return false;
  }
}
