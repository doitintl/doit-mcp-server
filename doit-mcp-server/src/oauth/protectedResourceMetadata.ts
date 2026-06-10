import type { Context } from "hono";
import { resolveAuthServerUrl, resolveMcpResourceUrl } from "../runtimeEnv";

export const protectedResourceMetadata = (c: Context) => {
  const env = c.env as
    | { AUTH_SERVER_URL?: string; MCP_RESOURCE_URL?: string }
    | undefined;
  const authServerUrl = resolveAuthServerUrl(env);
  const resource = resolveMcpResourceUrl(env);

  c.header("Cache-Control", "public, max-age=300");
  return c.json({
    resource,
    authorization_servers: [authServerUrl],
    scopes_supported: ["mcp:tools", "mcp:resources"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://help.doit.com/docs/mcp",
  });
};
