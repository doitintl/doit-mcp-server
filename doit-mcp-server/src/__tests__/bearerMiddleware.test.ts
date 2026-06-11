import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  exportJWK,
  generateKeyPair,
  type JWK,
  SignJWT,
} from "jose";

import {
  hasMcpAccessKid,
  verifyBearer,
  wwwAuthenticateHeaderForResource,
} from "../oauth/bearerMiddleware";

const AUDIENCE = "https://mcp.doit.com";

let server: Server;
let issuer: string;
let publicJwk: JWK;
let privateKey: CryptoKey;
let rogueKey: CryptoKey;

beforeAll(async () => {
  const access = await generateKeyPair("ES256", { extractable: true });
  privateKey = access.privateKey;
  publicJwk = {
    ...(await exportJWK(access.publicKey)),
    kid: "mcp-access",
    alg: "ES256",
    use: "sig",
  };

  const rogue = await generateKeyPair("ES256", { extractable: true });
  rogueKey = rogue.privateKey;

  // Tiny HTTP server that serves the JWKS the middleware fetches.
  // We can't intercept jose's fetch via vi.stubGlobal because jose captures it at module load.
  await new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      if (req.url === "/.well-known/jwks.json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ keys: [publicJwk] }));
        return;
      }
      res.writeHead(404).end();
    }).listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      issuer = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const mintToken = async (
  signer: CryptoKey,
  overrides: Partial<{
    aud: string;
    iss: string;
    kid: string;
    sub: string;
    scope: string;
    customer_context: string;
    cid: string;
    flow_id: string;
    doit_employee: boolean;
    expSecondsFromNow: number;
  }> = {},
): Promise<string> => {
  const exp =
    Math.floor(Date.now() / 1000) + (overrides.expSecondsFromNow ?? 15 * 60);
  return new SignJWT({
    scope: overrides.scope ?? "mcp:tools",
    customer_context: overrides.customer_context ?? "customer-1",
    cid: overrides.cid ?? "client-jti-1",
    flow_id: overrides.flow_id ?? "flow-1",
    doit_employee: overrides.doit_employee ?? false,
  })
    .setProtectedHeader({
      alg: "ES256",
      kid: overrides.kid ?? "mcp-access",
      typ: "JWT",
    })
    .setSubject(overrides.sub ?? "user-1")
    .setAudience(overrides.aud ?? AUDIENCE)
    .setIssuer(overrides.iss ?? issuer)
    .setIssuedAt()
    .setExpirationTime(exp)
    .setJti(crypto.randomUUID())
    .sign(signer);
};

describe("verifyBearer (OAuth path)", () => {
  it("accepts a valid OAuth token and returns claims", async () => {
    const token = await mintToken(privateKey);
    const result = await verifyBearer(
      token,
      { AUTH_SERVER_URL: issuer },
      { mode: "request" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.authMethod).toBe("oauth");
      expect(result.claims.userId).toBe("user-1");
      expect(result.claims.customerContext).toBe("customer-1");
      expect(result.claims.cid).toBe("client-jti-1");
      expect(result.claims.flowId).toBe("flow-1");
      expect(result.claims.scope).toBe("mcp:tools");
    }
  });

  it("rejects a token signed by a different key under the same kid", async () => {
    const token = await mintToken(rogueKey);
    expect(
      await verifyBearer(
        token,
        { AUTH_SERVER_URL: issuer },
        { mode: "request" },
      ),
    ).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("rejects a token with the wrong audience", async () => {
    const token = await mintToken(privateKey, { aud: "https://other.example" });
    expect(
      await verifyBearer(
        token,
        { AUTH_SERVER_URL: issuer },
        { mode: "request" },
      ),
    ).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("accepts the configured MCP_RESOURCE_URL as the OAuth audience", async () => {
    const localAudience = "http://localhost:8787/";
    const token = await mintToken(privateKey, { aud: localAudience });
    const result = await verifyBearer(
      token,
      { AUTH_SERVER_URL: issuer, MCP_RESOURCE_URL: localAudience },
      { mode: "request" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.authMethod).toBe("oauth");
    }
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await mintToken(privateKey, { iss: "http://other-issuer" });
    expect(
      await verifyBearer(
        token,
        { AUTH_SERVER_URL: issuer },
        { mode: "request" },
      ),
    ).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("returns verification_unavailable when the JWKS endpoint is unavailable", async () => {
    const unavailableIssuer = `${issuer}/unavailable`;
    const token = await mintToken(privateKey, { iss: unavailableIssuer });

    const result = await verifyBearer(
      token,
      { AUTH_SERVER_URL: unavailableIssuer },
      { mode: "request" },
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "verification_unavailable",
    });
  });

  it("rejects an expired token", async () => {
    const token = await mintToken(privateKey, { expSecondsFromNow: -60 });
    expect(
      await verifyBearer(
        token,
        { AUTH_SERVER_URL: issuer },
        { mode: "request" },
      ),
    ).toMatchObject({ ok: false, reason: "invalid_token" });
  });

  it("rejects a token without mcp:tools scope", async () => {
    const token = await mintToken(privateKey, { scope: "mcp:read" });
    expect(
      await verifyBearer(
        token,
        { AUTH_SERVER_URL: issuer },
        { mode: "request" },
      ),
    ).toMatchObject({ ok: false, reason: "invalid_claims" });
  });
});

describe("verifyBearer (JWKS via CONSOLE_PROXY service binding)", () => {
  // A deliberately unreachable auth server: if verification fell back to a plain
  // fetch it would fail, so success here proves the proxy binding carried the JWKS.
  const offlineIssuer = "https://auth.invalid";

  const makeProxy = () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === `${offlineIssuer}/.well-known/jwks.json`) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    return { proxy: { fetch: fetchSpy as unknown as typeof fetch }, fetchSpy };
  };

  it("fetches the JWKS through the binding when CONSOLE_PROXY is set", async () => {
    const { proxy, fetchSpy } = makeProxy();
    const token = await mintToken(privateKey, { iss: offlineIssuer });
    const result = await verifyBearer(
      token,
      { AUTH_SERVER_URL: offlineIssuer, CONSOLE_PROXY: proxy },
      { mode: "request" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.authMethod).toBe("oauth");
      expect(result.claims.userId).toBe("user-1");
    }
    expect(fetchSpy).toHaveBeenCalledWith(
      `${offlineIssuer}/.well-known/jwks.json`,
      expect.anything(),
    );
  });

  it("rejects a token whose key is absent from the proxied JWKS", async () => {
    const { proxy } = makeProxy();
    const token = await mintToken(rogueKey, { iss: offlineIssuer });
    const result = await verifyBearer(
      token,
      { AUTH_SERVER_URL: offlineIssuer, CONSOLE_PROXY: proxy },
      { mode: "request" },
    );
    expect(result).toMatchObject({ ok: false, reason: "invalid_token" });
  });
});

describe("verifyBearer (non-OAuth tokens are rejected)", () => {
  it("rejects a token without the mcp-access kid", async () => {
    const token = await mintToken(privateKey, { kid: "some-other-kid" });
    const result = await verifyBearer(
      token,
      { AUTH_SERVER_URL: issuer },
      { mode: "request" },
    );
    expect(result).toMatchObject({ ok: false, reason: "wrong_kid" });
  });

  it("rejects a non-JWT (legacy opaque API key) token", async () => {
    const result = await verifyBearer(
      "doit-api-key-abc123",
      { AUTH_SERVER_URL: issuer },
      { mode: "request" },
    );
    expect(result).toMatchObject({ ok: false, reason: "wrong_kid" });
  });
});

describe("verifyBearer (DoiT employee claim)", () => {
  it("defaults isDoitEmployee to false when the claim is absent", async () => {
    const token = await mintToken(privateKey);
    const result = await verifyBearer(
      token,
      { AUTH_SERVER_URL: issuer },
      { mode: "request" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.authMethod).toBe("oauth");
      expect(result.claims.isDoitEmployee).toBe(false);
    }
  });

  it("sets isDoitEmployee when the doit_employee claim is true", async () => {
    const token = await mintToken(privateKey, { doit_employee: true });
    const result = await verifyBearer(
      token,
      { AUTH_SERVER_URL: issuer },
      { mode: "request" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.authMethod).toBe("oauth");
      expect(result.claims.isDoitEmployee).toBe(true);
    }
  });
});

describe("verifyBearer (handshake-mode caching)", () => {
  it("returns the same OAuth claims on repeated handshake-mode calls", async () => {
    const token = await mintToken(privateKey);
    const env = { AUTH_SERVER_URL: issuer, GIT_SHA: "test-sha" };
    const first = await verifyBearer(token, env, { mode: "handshake" });
    const second = await verifyBearer(token, env, { mode: "handshake" });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.claims.jti).toBe(first.claims.jti);
    }
  });
});

describe("wwwAuthenticateHeaderForResource", () => {
  it("returns RFC 9728 §5.3-shaped header", () => {
    expect(wwwAuthenticateHeaderForResource("https://mcp.doit.com")).toBe(
      'Bearer resource_metadata="https://mcp.doit.com/.well-known/oauth-protected-resource", error="invalid_token"',
    );
  });
});

describe("hasMcpAccessKid", () => {
  it("returns true for a JWT carrying the mcp-access kid", async () => {
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "mcp-access" })
      .sign(privateKey);
    expect(hasMcpAccessKid(jwt)).toBe(true);
  });

  it("returns false for a JWT with a different kid", async () => {
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "some-other-kid" })
      .sign(privateKey);
    expect(hasMcpAccessKid(jwt)).toBe(false);
  });

  it("returns false for an opaque (non-JWT) DoiT API key", () => {
    expect(hasMcpAccessKid("doit-opaque-api-key-abc123")).toBe(false);
  });
});
