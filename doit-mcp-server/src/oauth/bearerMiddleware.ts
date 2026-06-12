import {
  createRemoteJWKSet,
  customFetch,
  errors,
  jwtVerify,
  type JWTPayload,
} from "jose";
import {
  resolveAuthServerUrl,
  resolveMcpResourceUrl,
  shouldUseConsoleProxy,
} from "../runtimeEnv";

const REQUIRED_SCOPE = "mcp:tools";
const ACCESS_TOKEN_KID = "mcp-access";

export type BearerEnv = {
  AUTH_SERVER_URL?: string;
  MCP_RESOURCE_URL?: string;
  GIT_SHA?: string;
  // Service binding to the console-worker proxy (prod only). The worker shares
  // the `doit.com` zone with the issuer (console.doit.com), and Cloudflare skips
  // Workers on same-zone subrequests, so a plain fetch of the JWKS bypasses the
  // console-worker route and lands on the console SPA (HTML, not JSON). Invoking
  // the console-worker through a service binding executes it regardless of zone,
  // and it forwards the request to the auth backend by pathname. Unset in dev,
  // where the worker runs on *.workers.dev (cross-zone) and plain fetch works.
  CONSOLE_PROXY?: { fetch: typeof fetch };
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

export type BearerFailureReason =
  | "invalid_claims"
  | "invalid_token"
  | "verification_unavailable"
  | "wrong_kid";

export type BearerResult =
  | { ok: true; claims: OAuthBearerClaims }
  | { ok: false; reason: BearerFailureReason };

let jwksRef: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCacheKey: string | null = null;

// Fetches the JWKS through the CONSOLE_PROXY service binding when bound (prod —
// see the note on BearerEnv) and directly otherwise (dev). createRemoteJWKSet
// caches keys and handles rotation in both cases; the resolver is memoised per
// isolate (env bindings are stable across requests within an isolate).
const getJwks = (env: BearerEnv, authServerUrl: string) => {
  const url = `${authServerUrl}/.well-known/jwks.json`;
  const proxy = shouldUseConsoleProxy(env, authServerUrl)
    ? env.CONSOLE_PROXY
    : undefined;
  const key = `${proxy ? "proxy" : "direct"}:${url}`;
  if (!jwksRef || jwksCacheKey !== key) {
    jwksRef = createRemoteJWKSet(
      new URL(url),
      proxy ? { [customFetch]: proxy.fetch.bind(proxy) } : undefined,
    );
    jwksCacheKey = key;
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

// True only when the token is a JWT carrying the mcp-access kid (an auth.doit.com
// access token). The worker uses this to decide whether a bearer that failed OAuth
// verification should be retried as a legacy (opaque) DoiT API key — opaque keys
// are not JWTs, so this returns false for them.
export const hasMcpAccessKid = (token: string): boolean =>
  decodeKid(token) === ACCESS_TOKEN_KID;

type Verified =
  | { ok: true; payload: JWTPayload }
  | { ok: false; reason: Exclude<BearerFailureReason, "invalid_claims"> };

const isTokenVerificationError = (error: unknown): boolean =>
  error instanceof errors.JWTClaimValidationFailed ||
  error instanceof errors.JWTExpired ||
  error instanceof errors.JWTInvalid ||
  error instanceof errors.JWSInvalid ||
  error instanceof errors.JWSSignatureVerificationFailed ||
  error instanceof errors.JOSEAlgNotAllowed ||
  error instanceof errors.JOSENotSupported ||
  error instanceof errors.JWKSNoMatchingKey;

const classifyJwtVerifyFailure = (
  error: unknown,
): "invalid_token" | "verification_unavailable" => {
  if (isTokenVerificationError(error)) {
    return "invalid_token";
  }
  return "verification_unavailable";
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

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
    const { payload } = await jwtVerify(token, getJwks(env, authServerUrl), {
      issuer: authServerUrl,
      audience: resolveMcpResourceUrl(env),
      algorithms: ["ES256"],
    });
    return { ok: true, payload };
  } catch (err) {
    const reason = classifyJwtVerifyFailure(err);
    let actualAud: unknown;
    try {
      const seg = token.split(".")[1];
      actualAud = JSON.parse(atob(seg.replace(/-/g, "+").replace(/_/g, "/"))).aud;
    } catch {}
    console.error("[mcp] jwtVerify failed", {
      reason,
      errorCode: getErrorCode(err),
      message: getErrorMessage(err),
      audienceExpected: resolveMcpResourceUrl(env),
      actualAud,
    });
    return { ok: false, reason };
  }
};

const handshakeCache = new Map<
  string,
  { exp: number; claims: OAuthBearerClaims }
>();
const HANDSHAKE_CACHE_MAX = 1024;

const sha256Hex = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const cacheKey = async (token: string, env: BearerEnv): Promise<string> => {
  const sha = env.GIT_SHA ?? "dev";
  const tokenHash = await sha256Hex(token);
  return `${sha}:${tokenHash}`;
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
): Promise<BearerResult> => {
  const oauthCacheKey = await cacheKey(token, env);
  if (options.mode === "handshake") {
    const cached = cacheGet(oauthCacheKey);
    if (cached) return { ok: true, claims: cached };
  }

  // Only auth.doit.com-issued tokens are accepted. Anything else — wrong/missing
  // kid, bad signature, or missing claims — is rejected. Legacy opaque API keys
  // are no longer honored.
  const verified = await verifyOAuthToken(token, env);
  if (!verified.ok) return verified;

  const claims = claimsFromPayload(verified.payload);
  if (!claims) return { ok: false, reason: "invalid_claims" };
  if (options.mode === "handshake") cachePut(oauthCacheKey, claims);
  return { ok: true, claims };
};

export const wwwAuthenticateHeaderForResource = (resourceUrl: string): string => {
  const base = resourceUrl.replace(/\/$/, "");
  return `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource", error="invalid_token"`;
};
