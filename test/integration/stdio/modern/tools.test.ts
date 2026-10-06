import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatedTools } from "../../../../src/tools/generated/registry.js";
import { HAND_WRITTEN_TOOLS } from "../../../../src/tools/handWrittenTools.js";
import { createTestClient } from "../../helpers.js";
import { mswServer } from "../../setup.js";
import { createModernTestClient, getTextContent } from "./helpers.js";

describe("MCP Tools Integration (2026-07-28 client)", () => {
    let modern: Awaited<ReturnType<typeof createModernTestClient>>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        modern = await createModernTestClient();
    });

    afterEach(async () => {
        await modern.cleanup();
        vi.restoreAllMocks();
    });

    describe("tools/list", () => {
        it("returns customer-visible hand-written and generated tools for a customer key", async () => {
            const { tools } = await modern.client.listTools();

            const expectedNames = [
                ...HAND_WRITTEN_TOOLS.filter((tool) => tool.name !== "search_customers").map((tool) => tool.name),
                ...generatedTools.map((tool) => tool.name),
            ].sort();
            expect(tools.map((tool) => tool.name).sort()).toEqual(expectedNames);
        });

        it("each tool has a name, description, and object inputSchema", async () => {
            const { tools } = await modern.client.listTools();

            for (const tool of tools) {
                expect(tool.name).toBeTruthy();
                expect(tool.description).toBeTruthy();
                expect(tool.inputSchema.type).toBe("object");
            }
        });

        it("keeps tool titles and annotations through the 2026 Tool schema", async () => {
            const { tools } = await modern.client.listTools();
            const confirmAction = tools.find((tool) => tool.name === "confirm_action");

            expect(confirmAction).toMatchObject({
                title: "Confirm pending action",
                annotations: { readOnlyHint: false, destructiveHint: true },
            });

            const expectedTitles = new Map<string, string | undefined>([
                // HandWrittenTool only types `name`/`coversEndpoint`; the objects carry `title`.
                ...HAND_WRITTEN_TOOLS.map((tool) => [tool.name, (tool as { title?: string }).title] as const),
                ...generatedTools.map((tool) => [tool.name, tool.title] as const),
            ]);
            for (const tool of tools) {
                expect(tool.title, tool.name).toBe(expectedTitles.get(tool.name));
            }
        });
    });

    describe("tools/call", () => {
        it("returns organizations from the mock API", async () => {
            const result = await modern.client.callTool({ name: "list_organizations", arguments: {} });
            const parsed = JSON.parse(getTextContent(result));

            expect(parsed.organizations.map((org: { id: string }) => org.id)).toEqual(["org-1", "org-2"]);
        });

        it("returns roles from the mock API", async () => {
            const result = await modern.client.callTool({ name: "list_roles", arguments: {} });
            const parsed = JSON.parse(getTextContent(result));

            expect(parsed.roles.map((role: { name: string }) => role.name)).toEqual(["Admin", "Viewer"]);
        });

        it("returns an error for an unknown tool", async () => {
            const result = await modern.client.callTool({ name: "nonexistent_tool", arguments: {} });

            expect(getTextContent(result)).toContain("Unknown tool");
        });

        it("returns Unauthorized when DOIT_API_KEY is unset", async () => {
            const savedKey = process.env.DOIT_API_KEY;
            delete process.env.DOIT_API_KEY;
            try {
                const result = await modern.client.callTool({ name: "list_organizations", arguments: {} });
                expect(getTextContent(result)).toContain("Unauthorized");
            } finally {
                process.env.DOIT_API_KEY = savedKey;
            }
        });

        it("returns an error when the API fails", async () => {
            mswServer.use(
                http.get("https://api.doit.com/iam/v1/organizations", () => new HttpResponse(null, { status: 500 }))
            );

            const result = await modern.client.callTool({ name: "list_organizations", arguments: {} });

            expect(result.isError).toBe(true);
            expect(getTextContent(result)).toContain("HTTP 500: The API is temporarily unavailable");
        });

        it("returns a validation error for missing required arguments", async () => {
            const result = await modern.client.callTool({ name: "get_cloud_incident", arguments: {} });

            expect(getTextContent(result).toLowerCase()).toContain("either id or title must be provided");
        });
    });

    // The strongest compatibility claim: the same requests through a 2025-era v1 client and a
    // 2026-07-28 v2 client get the same answers from the shipped entry.
    describe("parity with the 2025-era (v1 SDK) client", () => {
        let legacy: Awaited<ReturnType<typeof createTestClient>>;

        beforeEach(async () => {
            legacy = await createTestClient();
        });

        afterEach(async () => {
            await legacy.cleanup();
        });

        it("tools/list advertises the same spec fields for every tool", async () => {
            const pick = (tools: Array<Record<string, unknown>>) =>
                tools.map(({ name, title, description, inputSchema, annotations }) => ({
                    name,
                    title,
                    description,
                    inputSchema,
                    annotations,
                }));

            const [legacyTools, modernTools] = await Promise.all([
                legacy.client.listTools(),
                modern.client.listTools(),
            ]);

            expect(pick(modernTools.tools)).toEqual(pick(legacyTools.tools));
        });

        it.each([
            ["list_organizations", {}],
            ["list_roles", {}],
            ["nonexistent_tool", {}],
            ["get_cloud_incident", {}],
        ])("tools/call %s returns identical content", async (name, args) => {
            const [legacyResult, modernResult] = await Promise.all([
                legacy.client.callTool({ name, arguments: args }),
                modern.client.callTool({ name, arguments: args }),
            ]);

            expect(modernResult.content).toEqual(legacyResult.content);
            expect(modernResult.isError).toEqual(legacyResult.isError);
        });
    });
});
