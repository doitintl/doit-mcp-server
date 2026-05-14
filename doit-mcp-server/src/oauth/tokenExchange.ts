const DEFAULT_AUTH_SERVER_URL = "https://auth.doit.com";
const TOKEN_EXCHANGE_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const LEGACY_CMP_UPSTREAM_AUDIENCE = "cmp";
const TOKEN_EXCHANGE_CLIENT_ID = "mcp.doit.com";

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
    throw new Error("MCP_TOKEN_EXCHANGE_SECRET is not configured");
  }

  const authServerUrl = env.AUTH_SERVER_URL ?? DEFAULT_AUTH_SERVER_URL;
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
    throw new Error(
      `MCP upstream token exchange failed: ${response.status} ${errorText}`,
    );
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };

  if (typeof payload.access_token !== "string") {
    throw new Error(
      "MCP upstream token exchange response did not include access_token",
    );
  }

  return {
    accessToken: payload.access_token,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : 0,
  };
};
