import { jwtVerify } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { exchangeMcpTokenForUpstreamToken } from "../oauth/tokenExchange";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exchangeMcpTokenForUpstreamToken", () => {
  it("exchanges the MCP token through auth-service with service authentication", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "upstream-token",
          expires_in: 900,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeMcpTokenForUpstreamToken({
      mcpToken: "mcp-token",
      env: {
        AUTH_SERVER_URL: "http://auth.local",
        MCP_TOKEN_EXCHANGE_SECRET: "exchange-secret",
      },
    });

    expect(result).toEqual({ accessToken: "upstream-token", expiresIn: 900 });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://auth.local/api/auth/token");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );

    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:token-exchange",
    );
    expect(body.get("subject_token")).toBe("mcp-token");
    expect(body.get("audience")).toBe("cmp");
    expect(body.get("client_id")).toBe("mcp.doit.com");

    // The shared secret is no longer transmitted; we send a signed assertion instead.
    expect(body.get("client_secret")).toBeNull();
    expect(body.get("client_assertion_type")).toBe(
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );

    const assertion = body.get("client_assertion");
    expect(assertion).toBeTruthy();
    const { payload } = await jwtVerify(
      assertion as string,
      new TextEncoder().encode("exchange-secret"),
      {
        algorithms: ["HS256"],
        issuer: "mcp.doit.com",
        subject: "mcp.doit.com",
        audience: "http://auth.local/api/auth/token",
      },
    );
    expect(typeof payload.jti).toBe("string");
    expect(typeof payload.exp).toBe("number");
  });

  it("fails verification when the assertion is signed with a different secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "t", expires_in: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await exchangeMcpTokenForUpstreamToken({
      mcpToken: "mcp-token",
      env: {
        AUTH_SERVER_URL: "http://auth.local",
        MCP_TOKEN_EXCHANGE_SECRET: "exchange-secret",
      },
    });

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    const assertion = body.get("client_assertion") as string;
    await expect(
      jwtVerify(assertion, new TextEncoder().encode("wrong-secret")),
    ).rejects.toThrow();
  });

  it("routes the exchange through the CONSOLE_PROXY binding when bound", async () => {
    const globalFetchMock = vi.fn().mockRejectedValue(
      new Error("plain fetch must not be used when CONSOLE_PROXY is bound"),
    );
    vi.stubGlobal("fetch", globalFetchMock);

    const proxyFetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "upstream-token", expires_in: 900 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await exchangeMcpTokenForUpstreamToken({
      mcpToken: "mcp-token",
      env: {
        AUTH_SERVER_URL: "https://console.doit.com",
        MCP_TOKEN_EXCHANGE_SECRET: "exchange-secret",
        CONSOLE_PROXY: { fetch: proxyFetchMock as unknown as typeof fetch },
      },
    });

    expect(result).toEqual({ accessToken: "upstream-token", expiresIn: 900 });
    expect(proxyFetchMock).toHaveBeenCalledOnce();
    expect(globalFetchMock).not.toHaveBeenCalled();

    const [url, init] = proxyFetchMock.mock.calls[0];
    expect(url).toBe("https://console.doit.com/api/auth/token");
    expect(init.method).toBe("POST");

    // The client assertion audience stays on the issuer host — the auth-service
    // expects it regardless of which transport carried the request.
    const body = init.body as URLSearchParams;
    const assertion = body.get("client_assertion") as string;
    const { payload } = await jwtVerify(
      assertion,
      new TextEncoder().encode("exchange-secret"),
      {
        algorithms: ["HS256"],
        issuer: "mcp.doit.com",
        subject: "mcp.doit.com",
        audience: "https://console.doit.com/api/auth/token",
      },
    );
    expect(typeof payload.jti).toBe("string");
  });

  it("ignores CONSOLE_PROXY for non-production auth servers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "upstream-token", expires_in: 900 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const proxyFetchMock = vi.fn().mockRejectedValue(
      new Error("proxy must not be used outside production"),
    );

    const result = await exchangeMcpTokenForUpstreamToken({
      mcpToken: "mcp-token",
      env: {
        AUTH_SERVER_URL: "http://localhost:8080",
        MCP_TOKEN_EXCHANGE_SECRET: "exchange-secret",
        CONSOLE_PROXY: { fetch: proxyFetchMock as unknown as typeof fetch },
      },
    });

    expect(result).toEqual({ accessToken: "upstream-token", expiresIn: 900 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(proxyFetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the worker secret is missing", async () => {
    await expect(
      exchangeMcpTokenForUpstreamToken({
        mcpToken: "mcp-token",
        env: { AUTH_SERVER_URL: "http://auth.local" },
      }),
    ).rejects.toThrow("Failed to authenticate with the DoiT API");
  });
});
