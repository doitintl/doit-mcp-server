import { afterEach, describe, expect, it, vi } from "vitest";

import { validateLegacyApiKey } from "../oauth/legacyApiKey";

// DoiT API keys are JWTs; decodeJWT only base64-decodes the claims (no signature
// check), so an unsigned token with the right payload is sufficient for these tests.
function makeKey(payload: Record<string, unknown>): string {
  const part = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(payload)}.sig`;
}

function validateResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateLegacyApiKey", () => {
  it("resolves a regular customer key scoped to its domain (not a DoiT employee)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        validateResponse({ domain: "acme.com", email: "user@acme.com" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const key = makeKey({ sub: "user@acme.com", DoitEmployee: false });
    const result = await validateLegacyApiKey(key);

    expect(result).toEqual({
      email: "user@acme.com",
      customerContext: "acme.com",
      isDoitEmployee: false,
    });
  });

  it("resolves a DoiT-employee key with the internal default context", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        validateResponse({ domain: "doit.com", email: "emp@doit.com" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const key = makeKey({ sub: "emp@doit.com", DoitEmployee: true });
    const result = await validateLegacyApiKey(key);

    expect(result).toEqual({
      email: "emp@doit.com",
      customerContext: "EE8CtpzYiKp0dVAESVrB",
      isDoitEmployee: true,
    });
  });

  it("returns null when the validated email does not match the JWT sub (anti-forgery)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        validateResponse({ domain: "acme.com", email: "someone-else@acme.com" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const key = makeKey({ sub: "user@acme.com", DoitEmployee: false });
    expect(await validateLegacyApiKey(key)).toBeNull();
  });

  it("returns null for a rejected key (non-ok validate response)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const key = makeKey({ sub: "user@acme.com", DoitEmployee: false });
    expect(await validateLegacyApiKey(key)).toBeNull();
  });

  it("returns null for an opaque (non-JWT) token without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await validateLegacyApiKey("not-a-jwt")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
