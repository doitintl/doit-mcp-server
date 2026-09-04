import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOUDFLOW_AUTHORING_GUIDE } from "../../../src/docs/cloudflowGuidance.js";
import { SERVER_INSTRUCTIONS } from "../../../src/docs/serverInstructions.js";
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

        // src/server.ts registers its own InitializeRequestSchema handler, replacing the SDK's,
        // so the `instructions` constructor option is only delivered if that handler echoes it.
        // Asserting it through a real client is the only check that catches the omission.
        it("delivers server instructions to the client", async () => {
            expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
        });
    });

    describe("resources/list", () => {
        it("lists the CloudFlow authoring guide", async () => {
            const result = await client.listResources();

            expect(result.resources).toEqual([
                {
                    uri: "doit://docs/cloudflow-authoring",
                    name: "CloudFlow authoring guide",
                    description: "Runtime contracts for authoring, repairing and verifying CloudFlow flows.",
                    mimeType: "text/markdown",
                },
            ]);
        });
    });

    describe("resources/read", () => {
        it("returns the whole guide as markdown", async () => {
            const result = await client.readResource({ uri: "doit://docs/cloudflow-authoring" });

            expect(result.contents).toEqual([
                {
                    uri: "doit://docs/cloudflow-authoring",
                    mimeType: "text/markdown",
                    text: CLOUDFLOW_AUTHORING_GUIDE,
                },
            ]);
        });

        it("rejects an unknown resource URI", async () => {
            await expect(client.readResource({ uri: "doit://docs/nope" })).rejects.toThrow(
                /Unknown resource: doit:\/\/docs\/nope/
            );
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
