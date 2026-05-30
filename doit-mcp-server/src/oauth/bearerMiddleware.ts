import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { resolveAuthServerUrl, resolveMcpResourceUrl } from "../runtimeEnv";

const REQUIRED_SCOPE = "mcp:tools";
const ACCESS_TOKEN_KID = "mcp-access";

export type BearerEnv = {
  AUTH_SERVER_URL?: string;
  MCP_RESOURCE_URL?: string;
  GIT_SHA?: string;
};

export type OAuthBearerClaims = {
  authMethod: "oauth";
  userId: string;
  customerContext: string;
  scope: string;
  cid: string;
  flowId: string;
  jti: string;
  exp: number;
  // True when the auth.doit.com token marks the principal as a DoiT employee.
  // Gates the change_customer tool (see index.ts). Sourced from the `doit_employee`
  // claim — confirm the exact claim/scope name with the auth.doit.com team.
  isDoitEmployee: boolean;
};

export type BearerResult = OAuthBearerClaims;

let jwksRef: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksUrl: string | null = null;

const getJwks = (authServerUrl: string) => {
  const url = `${authServerUrl}/.well-known/jwks.json`;
  if (!jwksRef || jwksUrl !== url) {
    jwksRef = createRemoteJWKSet(new URL(url));
    jwksUrl = url;
  }
  return jwksRef;
};

const decodeKid = (token: string): string | null => {
  const segments = token.split(".");
  if (segments.length !== 3) return null;
  try {
    const headerJson = JSON.parse(
      atob(segments[0].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof headerJson.kid === "string" ? headerJson.kid : null;
  } catch {
    return null;
  }
};

type Verified =
  | { ok: true; payload: JWTPayload }
  | { ok: false; reason: "invalid" | "wrong_kid" };

const verifyOAuthToken = async (
  token: string,
  env: BearerEnv,
): Promise<Verified> => {
  const kid = decodeKid(token);
  if (kid !== ACCESS_TOKEN_KID) {
    return { ok: false, reason: "wrong_kid" };
  }
  const authServerUrl = resolveAuthServerUrl(env);
  try {
    const { payload } = await jwtVerify(token, getJwks(authServerUrl), {
      issuer: authServerUrl,
      audience: resolveMcpResourceUrl(env),
      algorithms: ["ES256"],
    });
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "invalid" };
  }
};

const handshakeCache = new Map<
  string,
  { exp: number; claims: OAuthBearerClaims }
>();
const HANDSHAKE_CACHE_MAX = 1024;

const cacheKey = (token: string, env: BearerEnv): string => {
  const sha = env.GIT_SHA ?? "dev";
  return `${sha}:${token}`;
};

const cacheGet = (key: string): OAuthBearerClaims | null => {
  const hit = handshakeCache.get(key);
  if (!hit) return null;
  if (hit.exp <= Math.floor(Date.now() / 1000)) {
    handshakeCache.delete(key);
    return null;
  }
  return hit.claims;
};

const cachePut = (key: string, claims: OAuthBearerClaims) => {
  if (handshakeCache.size >= HANDSHAKE_CACHE_MAX) {
    const firstKey = handshakeCache.keys().next().value;
    if (firstKey !== undefined) handshakeCache.delete(firstKey);
  }
  const ttlExp = Math.min(claims.exp, Math.floor(Date.now() / 1000) + 5 * 60);
  handshakeCache.set(key, { exp: ttlExp, claims });
};

const claimsFromPayload = (payload: JWTPayload): OAuthBearerClaims | null => {
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const customerContext =
    typeof payload.customer_context === "string"
      ? payload.customer_context
      : null;
  const scope = typeof payload.scope === "string" ? payload.scope : null;
  const cid = typeof payload.cid === "string" ? payload.cid : null;
  const flowId = typeof payload.flow_id === "string" ? payload.flow_id : null;
  const jti = typeof payload.jti === "string" ? payload.jti : null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const isDoitEmployee = payload.doit_employee === true;

  if (
    !sub ||
    customerContext === null ||
    !scope ||
    !cid ||
    !flowId ||
    !jti ||
    exp === null
  ) {
    return null;
  }
  if (!scope.split(/\s+/).includes(REQUIRED_SCOPE)) {
    return null;
  }
  return {
    authMethod: "oauth",
    userId: sub,
    customerContext,
    scope,
    cid,
    flowId,
    jti,
    exp,
    isDoitEmployee,
  };
};

export const verifyBearer = async (
  token: string,
  env: BearerEnv,
  options: { mode: "handshake" | "request" },
): Promise<BearerResult | null> => {
  const oauthCacheKey = cacheKey(token, env);
  if (options.mode === "handshake") {
    const cached = cacheGet(oauthCacheKey);
    if (cached) return cached;
  }

  // Only auth.doit.com-issued tokens are accepted. Anything else — wrong/missing
  // kid, bad signature, or missing claims — is rejected. Legacy opaque API keys
  // are no longer honored.
  const verified = await verifyOAuthToken(token, env);
  if (!verified.ok) return null;

  const claims = claimsFromPayload(verified.payload);
  if (!claims) return null;
  if (options.mode === "handshake") cachePut(oauthCacheKey, claims);
  return claims;
};

export const wwwAuthenticateHeaderForResource = (resourceUrl: string): string => {
  const base = resourceUrl.replace(/\/$/, "");
  return `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource", error="invalid_token"`;
};
