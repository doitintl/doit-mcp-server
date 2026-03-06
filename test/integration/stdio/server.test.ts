import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SERVER_NAME, SERVER_VERSION } from "../../../src/utils/consts.js";
import { createTestClient } from "../helpers.js";

describe("MCP Server Integration", () => {
    let client: Client;
    let _server: Server;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        ({ client, _server, cleanup } = await createTestClient());
    });

    afterEach(async () => {
        await cleanup();
        vi.restoreAllMocks();
    });

    describe("initialization", () => {
        it("reports correct server name and version", async () => {
            const serverVersion = client.getServerVersion();
            expect(serverVersion).toBeDefined();
            expect(serverVersion?.name).toBe(SERVER_NAME);
            expect(serverVersion?.version).toBe(SERVER_VERSION);
        });

        it("advertises tools capability", async () => {
            const caps = client.getServerCapabilities();
            expect(caps).toBeDefined();
            expect(caps?.tools).toBeDefined();
        });

        it("advertises prompts capability", async () => {
            const caps = client.getServerCapabilities();
            expect(caps?.prompts).toBeDefined();
        });

        it("advertises resources capability", async () => {
            const caps = client.getServerCapabilities();
            expect(caps?.resources).toBeDefined();
        });
    });

    describe("resources/list", () => {
        it("returns an empty resources list", async () => {
            const result = await client.listResources();
            expect(result.resources).toEqual([]);
        });
    });

    describe("connection lifecycle", () => {
        it("can reconnect after cleanup", async () => {
            const result1 = await client.listTools();
            expect(result1.tools.length).toBeGreaterThan(0);

            await cleanup();

            ({ client, _server, cleanup } = await createTestClient());
            const result2 = await client.listTools();
            expect(result2.tools.length).toBe(result1.tools.length);
        });
    });
});
