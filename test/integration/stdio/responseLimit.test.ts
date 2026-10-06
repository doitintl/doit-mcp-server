import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOOL_RESULT_CHARS } from "../../../src/utils/responseLimit.js";
import { createTestClient } from "../helpers.js";
import { mswServer } from "../setup.js";
import { createModernTestClient, getTextContent } from "./modern/helpers.js";

describe.each([
    { era: "legacy", connect: createTestClient },
    { era: "modern", connect: createModernTestClient },
])("Response size limit ($era)", ({ connect }) => {
    let ctx: Awaited<ReturnType<typeof connect>>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        ctx = await connect();
    });

    afterEach(async () => {
        await ctx.cleanup();
        vi.restoreAllMocks();
    });

    it("delivers a bounded tool error for oversized reads", async () => {
        mswServer.use(
            http.get("https://api.doit.com/iam/v1/organizations", () =>
                HttpResponse.json({ organizations: [{ id: "org1", name: "x".repeat(MAX_TOOL_RESULT_CHARS) }] })
            )
        );
        const result = await ctx.client.callTool({ name: "list_organizations", arguments: {} });
        expect(result.isError).toBe(true);
        expect(getTextContent(result)).toContain("RESPONSE_TOO_LARGE");
        expect(JSON.stringify(result).length).toBeLessThan(MAX_TOOL_RESULT_CHARS);
    });

    it("delivers success after a confirmed write even when its body is oversized", async () => {
        const calls = vi.fn(() => HttpResponse.json({ id: "alert1", details: "x".repeat(MAX_TOOL_RESULT_CHARS) }));
        mswServer.use(http.delete("https://api.doit.com/analytics/v1/alerts/:id", calls));
        const result = await ctx.client.callTool({ name: "delete_alert", arguments: { id: "alert1" } });
        expect(result.isError).toBe(false);
        expect(JSON.parse(getTextContent(result))).toMatchObject({
            status: "completed",
            responseOmitted: true,
            identifiers: { id: "alert1" },
        });
        expect(calls).toHaveBeenCalledOnce();
        expect(JSON.stringify(result).length).toBeLessThan(MAX_TOOL_RESULT_CHARS);
    });
});
