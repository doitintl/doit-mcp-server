import { SignJWT } from "jose";

import { resolveAuthServerUrl, shouldUseConsoleProxy } from "../runtimeEnv";

const TOKEN_EXCHANGE_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const LEGACY_CMP_UPSTREAM_AUDIENCE = "cmp";
const TOKEN_EXCHANGE_CLIENT_ID = "mcp.doit.com";
const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const CLIENT_ASSERTION_TTL_SECONDS = 60;

// Prove possession of the shared secret by signing a short-lived JWT (client_secret_jwt,
// RFC 7521/7523) instead of transmitting the secret on every request. The auth service
// verifies the signature with the same secret; `aud` is the token endpoint URL.
const buildClientAssertion = (
  secret: string,
  tokenEndpoint: string,
): Promise<string> =>
  new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(TOKEN_EXCHANGE_CLIENT_ID)
    .setSubject(TOKEN_EXCHANGE_CLIENT_ID)
    .setAudience(tokenEndpoint)
    .setIssuedAt()
    .setExpirationTime(`${CLIENT_ASSERTION_TTL_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(secret));

// Generic, client-safe message. Detailed causes (config, upstream status/body)
// are logged server-side only and never surfaced to the caller.
const UPSTREAM_AUTH_ERROR = "Failed to authenticate with the DoiT API";

export type TokenExchangeEnv = {
  AUTH_SERVER_URL?: string;
  MCP_TOKEN_EXCHANGE_SECRET?: string;
  // Service binding to the console-worker proxy (prod only). Same-zone subrequests
  // skip Workers, so a plain fetch of console.doit.com/api/auth/token would bypass
  // the console-worker route and land on the SPA; the binding executes the proxy
  // directly, which forwards to the auth backend. See BearerEnv.CONSOLE_PROXY.
  CONSOLE_PROXY?: { fetch: typeof fetch };
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
  const tokenEndpoint = `${authServerUrl}/api/auth/token`;
  const proxy = shouldUseConsoleProxy(env, authServerUrl)
    ? env.CONSOLE_PROXY
    : undefined;
  console.info("[mcp] upstream token exchange request", {
    authServerUrl,
    authServerUrlHasTrailingSlash: authServerUrl.endsWith("/"),
    tokenEndpoint,
    clientId: TOKEN_EXCHANGE_CLIENT_ID,
    clientAssertionAudience: tokenEndpoint,
    grantType: TOKEN_EXCHANGE_GRANT_TYPE,
    requestedTokenType: ACCESS_TOKEN_TYPE,
    upstreamAudience: LEGACY_CMP_UPSTREAM_AUDIENCE,
    hasExchangeSecret: true,
    viaConsoleProxy: Boolean(proxy),
    exchangeSecretLength: secret.length,
  });
  const clientAssertion = await buildClientAssertion(secret, tokenEndpoint);
  const body = new URLSearchParams({
    grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
    subject_token: mcpToken,
    subject_token_type: ACCESS_TOKEN_TYPE,
    requested_token_type: ACCESS_TOKEN_TYPE,
    audience: LEGACY_CMP_UPSTREAM_AUDIENCE,
    client_id: TOKEN_EXCHANGE_CLIENT_ID,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: clientAssertion,
  });

  const fetchImpl = proxy ? proxy.fetch.bind(proxy) : fetch;
  const response = await fetchImpl(tokenEndpoint, {
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
      tokenEndpoint,
      clientId: TOKEN_EXCHANGE_CLIENT_ID,
      upstreamAudience: LEGACY_CMP_UPSTREAM_AUDIENCE,
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

  console.info("[mcp] upstream token exchange succeeded", {
    tokenEndpoint,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : undefined,
  });

  return {
    accessToken: payload.access_token,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : 0,
  };
};
