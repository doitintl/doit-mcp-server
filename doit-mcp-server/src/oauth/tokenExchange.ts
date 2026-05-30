import { resolveAuthServerUrl } from "../runtimeEnv";

const TOKEN_EXCHANGE_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const LEGACY_CMP_UPSTREAM_AUDIENCE = "cmp";
const TOKEN_EXCHANGE_CLIENT_ID = "mcp.doit.com";
// Generic, client-safe message. Detailed causes (config, upstream status/body)
// are logged server-side only and never surfaced to the caller.
const UPSTREAM_AUTH_ERROR = "Failed to authenticate with the DoiT API";

export type TokenExchangeEnv = {
  AUTH_SERVER_URL?: string;
  MCP_TOKEN_EXCHANGE_SECRET?: string;
};

export type UpstreamTokenExchangeResult = {
  accessToken: string;
  expiresIn: number;
};

export const exchangeMcpTokenForUpstreamToken = async ({
  mcpToken,
  env,
}: {
  mcpToken: string;
  env: TokenExchangeEnv;
}): Promise<UpstreamTokenExchangeResult> => {
  const secret = env.MCP_TOKEN_EXCHANGE_SECRET;
  if (!secret) {
    console.error(
      "[mcp] token exchange misconfigured: MCP_TOKEN_EXCHANGE_SECRET is not set",
    );
    throw new Error(UPSTREAM_AUTH_ERROR);
  }

  const authServerUrl = resolveAuthServerUrl(env);
  const body = new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
    subject_token: mcpToken,
    subject_token_type: ACCESS_TOKEN_TYPE,
    requested_token_type: ACCESS_TOKEN_TYPE,
    audience: LEGACY_CMP_UPSTREAM_AUDIENCE,
    client_id: TOKEN_EXCHANGE_CLIENT_ID,
    client_secret: secret,
  });

  const response = await fetch(`${authServerUrl}/api/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[mcp] upstream token exchange failed", {
      status: response.status,
      errorText,
    });
    throw new Error(UPSTREAM_AUTH_ERROR);
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };

  if (typeof payload.access_token !== "string") {
    console.error(
      "[mcp] upstream token exchange response did not include access_token",
    );
    throw new Error(UPSTREAM_AUTH_ERROR);
  }

  return {
    accessToken: payload.access_token,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : 0,
  };
};
