import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SERVER_INSTRUCTIONS } from "../../../../src/docs/serverInstructions.js";
import { SERVER_NAME, SERVER_VERSION } from "../../../../src/utils/consts.js";
import { createModernTestClient, MODERN_PROTOCOL_VERSION } from "./helpers.js";

describe("2026-07-28 handshake", () => {
    let ctx: Awaited<ReturnType<typeof createModernTestClient>>;

    beforeEach(async () => {
        ctx = await createModernTestClient();
    });

    afterEach(async () => {
        await ctx.cleanup();
    });

    it("opens with server/discover and never sends initialize", () => {
        const methods = ctx.sent.map((message) => ("method" in message ? message.method : undefined));

        expect(methods[0]).toBe("server/discover");
        expect(methods).not.toContain("initialize");
        expect(methods).not.toContain("notifications/initialized");
    });

    it("carries the 2026-07-28 envelope on the opening request", () => {
        const opening = ctx.sent[0] as { params?: { _meta?: Record<string, unknown> } };

        expect(opening.params?._meta?.["io.modelcontextprotocol/protocolVersion"]).toBe(MODERN_PROTOCOL_VERSION);
    });

    it("negotiates the modern era at 2026-07-28", () => {
        expect(ctx.client.getNegotiatedProtocolVersion()).toBe(MODERN_PROTOCOL_VERSION);
        expect(ctx.client.getProtocolEra()).toBe("modern");
    });

    it("receives a DiscoverResult advertising 2026-07-28", () => {
        const discover = ctx.client.getDiscoverResult();

        expect(discover).toBeDefined();
        expect(discover?.supportedVersions).toContain(MODERN_PROTOCOL_VERSION);
    });

    it("receives the server instructions without an initialize result", () => {
        expect(ctx.client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    });

    it("receives the tools, prompts and resources capabilities", () => {
        const capabilities = ctx.client.getServerCapabilities();

        expect(capabilities?.tools).toBeDefined();
        expect(capabilities?.prompts).toBeDefined();
        expect(capabilities?.resources).toBeDefined();
    });

    it("identifies the server by name and version", () => {
        expect(ctx.client.getServerVersion()).toMatchObject({ name: SERVER_NAME, version: SERVER_VERSION });
    });

    it("stamps every later request with the per-request envelope", async () => {
        await ctx.client.listTools();

        const listTools = ctx.sent.find((message) => "method" in message && message.method === "tools/list") as
            | { params?: { _meta?: Record<string, unknown> } }
            | undefined;
        expect(listTools?.params?._meta?.["io.modelcontextprotocol/protocolVersion"]).toBe(MODERN_PROTOCOL_VERSION);
    });
});
