import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOUDFLOW_AUTHORING_GUIDE } from "../../../../src/docs/cloudflowGuidance.js";
import { prompts } from "../../../../src/prompts/index.js";
import { createTestClient } from "../../helpers.js";
import { createModernTestClient } from "./helpers.js";

const GUIDE_URI = "doit://docs/cloudflow-authoring";

describe("MCP Prompts and Resources Integration (2026-07-28 client)", () => {
    let modern: Awaited<ReturnType<typeof createModernTestClient>>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        modern = await createModernTestClient();
    });

    afterEach(async () => {
        await modern.cleanup();
        vi.restoreAllMocks();
    });

    describe("prompts", () => {
        it("lists every registered prompt", async () => {
            const result = await modern.client.listPrompts();

            expect(result.prompts.map((prompt) => prompt.name).sort()).toEqual(
                prompts.map((prompt) => prompt.name).sort()
            );
        });

        it("retrieves a prompt by name", async () => {
            const result = await modern.client.getPrompt({ name: "generate_report_command" });

            expect(result.description).toBeTruthy();
            expect(result.messages[0]).toMatchObject({ role: "user", content: { type: "text" } });
        });

        it("substitutes prompt arguments", async () => {
            const result = await modern.client.getPrompt({
                name: "trigger_cloudflow_flow",
                arguments: { flowID: "flow-abc" },
            });
            const last = result.messages[result.messages.length - 1];

            expect(last.content.type === "text" ? last.content.text : "").toContain("flow-abc");
        });

        it("rejects an unknown prompt", async () => {
            await expect(modern.client.getPrompt({ name: "nonexistent_prompt" })).rejects.toThrow(
                /Invalid prompt name: nonexistent_prompt/
            );
        });
    });

    describe("resources", () => {
        it("lists the CloudFlow authoring guide", async () => {
            const result = await modern.client.listResources();

            expect(result.resources).toEqual([
                {
                    uri: GUIDE_URI,
                    name: "CloudFlow authoring guide",
                    description: "Runtime contracts for authoring, repairing and verifying CloudFlow flows.",
                    mimeType: "text/markdown",
                },
            ]);
        });

        it("returns the whole guide as markdown", async () => {
            const result = await modern.client.readResource({ uri: GUIDE_URI });

            expect(result.contents).toEqual([
                { uri: GUIDE_URI, mimeType: "text/markdown", text: CLOUDFLOW_AUTHORING_GUIDE },
            ]);
        });

        it("rejects an unknown resource URI", async () => {
            await expect(modern.client.readResource({ uri: "doit://docs/nope" })).rejects.toThrow(
                /Unknown resource: doit:\/\/docs\/nope/
            );
        });
    });

    describe("parity with the 2025-era (v1 SDK) client", () => {
        let legacy: Awaited<ReturnType<typeof createTestClient>>;

        beforeEach(async () => {
            legacy = await createTestClient();
        });

        afterEach(async () => {
            await legacy.cleanup();
        });

        it("prompts/list is identical", async () => {
            const [legacyResult, modernResult] = await Promise.all([
                legacy.client.listPrompts(),
                modern.client.listPrompts(),
            ]);

            expect(modernResult.prompts).toEqual(legacyResult.prompts);
        });

        it.each(prompts.map((prompt) => prompt.name))("prompts/get %s returns identical messages", async (name) => {
            const [legacyResult, modernResult] = await Promise.all([
                legacy.client.getPrompt({ name }),
                modern.client.getPrompt({ name }),
            ]);

            expect(modernResult.description).toEqual(legacyResult.description);
            expect(modernResult.messages).toEqual(legacyResult.messages);
        });

        it("resources/list and resources/read are identical", async () => {
            const [legacyList, modernList, legacyRead, modernRead] = await Promise.all([
                legacy.client.listResources(),
                modern.client.listResources(),
                legacy.client.readResource({ uri: GUIDE_URI }),
                modern.client.readResource({ uri: GUIDE_URI }),
            ]);

            expect(modernList.resources).toEqual(legacyList.resources);
            expect(modernRead.contents).toEqual(legacyRead.contents);
        });
    });
});
