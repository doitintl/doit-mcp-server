import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient } from "../../helpers.js";
import { mswServer } from "../../setup.js";
import { createModernTestClient, MODERN_CLIENT_INFO, MODERN_PROTOCOL_VERSION } from "./helpers.js";

// Every DoiT API call carries the MCP client identity and protocol version as query params
// (see appendTrackingParams in src/utils/util.ts). The two eras source them differently —
// the 2026-07-28 per-request `_meta` envelope vs. the 2025-era `initialize` handshake — so
// this asserts what actually reaches the API for each.
describe("tracking params on outgoing DoiT API requests", () => {
    let requestedUrls: URL[];
    const recordRequest = ({ request }: { request: Request }) => {
        requestedUrls.push(new URL(request.url));
    };

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        requestedUrls = [];
        mswServer.events.on("request:start", recordRequest);
    });

    afterEach(() => {
        mswServer.events.removeListener("request:start", recordRequest);
        vi.restoreAllMocks();
    });

    const trackingParams = () => {
        const url = requestedUrls.find((u) => u.pathname === "/iam/v1/organizations");
        expect(url, "list_organizations should call the DoiT API").toBeDefined();
        return Object.fromEntries(
            ["mcp", "mcpTool", "mcpClient", "mcpClientVersion", "mcpProtocolVersion"].map((key) => [
                key,
                url?.searchParams.get(key),
            ])
        );
    };

    it("reports the 2026-07-28 client from its request envelope", async () => {
        const { client, cleanup } = await createModernTestClient();
        await client.callTool({ name: "list_organizations", arguments: {} });
        await cleanup();

        expect(trackingParams()).toEqual({
            mcp: "true",
            mcpTool: "list_organizations",
            mcpClient: MODERN_CLIENT_INFO.name,
            mcpClientVersion: MODERN_CLIENT_INFO.version,
            mcpProtocolVersion: MODERN_PROTOCOL_VERSION,
        });
    });

    it("reports the 2025-era (v1 SDK) client from its initialize handshake", async () => {
        const { client, cleanup } = await createTestClient();
        await client.callTool({ name: "list_organizations", arguments: {} });
        await cleanup();

        expect(trackingParams()).toEqual({
            mcp: "true",
            mcpTool: "list_organizations",
            mcpClient: "test-client",
            mcpClientVersion: "1.0.0",
            mcpProtocolVersion: "2025-11-25",
        });
    });
});
