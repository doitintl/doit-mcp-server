import type { Context } from "hono";

const DEFAULT_AUTH_SERVER_URL = "https://auth.doit.com";
const DEFAULT_RESOURCE = "https://mcp.doit.com";

export const protectedResourceMetadata = (c: Context) => {
  const env = c.env as
    | { AUTH_SERVER_URL?: string; MCP_RESOURCE_URL?: string }
    | undefined;
  const authServerUrl = env?.AUTH_SERVER_URL ?? DEFAULT_AUTH_SERVER_URL;
  const resource = env?.MCP_RESOURCE_URL ?? DEFAULT_RESOURCE;

  c.header("Cache-Control", "public, max-age=300");
  return c.json({
    resource,
    authorization_servers: [authServerUrl],
    scopes_supported: ["mcp:tools", "mcp:read"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://help.doit.com/docs/mcp",
  });
};
