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
    expect(body.get("client_secret")).toBe("exchange-secret");
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
