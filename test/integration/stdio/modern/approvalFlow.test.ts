import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mswServer } from "../../setup.js";
import { createModernTestClient, getTextContent } from "./helpers.js";

// The approval flow is carried entirely in tool results (an `approval_required` envelope,
// then a `confirm_action` call) — no server→client requests, which the 2026-07-28 era no
// longer has on the wire. These mirror ../approvalFlow.test.ts for a modern client.
describe("Write-gated tool approval flow (2026-07-28 client)", () => {
    let ctx: Awaited<ReturnType<typeof createModernTestClient>>;
    let deleteCalls: string[];

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        deleteCalls = [];
        mswServer.use(
            http.delete("https://api.doit.com/analytics/v1/alerts/:id", ({ params }) => {
                deleteCalls.push(String(params.id));
                return new HttpResponse(null, { status: 204 });
            })
        );
        ctx = await createModernTestClient();
    });

    afterEach(async () => {
        await ctx.cleanup();
        vi.restoreAllMocks();
    });

    it("emits an approval_required envelope on the first call and does not hit the API", async () => {
        const result = await ctx.rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });
        const body = JSON.parse(getTextContent(result as { content: Array<{ type: string; text?: string }> }));

        expect(body.status).toBe("approval_required");
        expect(body.approvalToken).toMatch(/^[0-9a-f-]{36}$/i);
        expect(body.next).toContain("confirm_action");
        expect(deleteCalls).toEqual([]);
    });

    it("confirm_action with the minted token executes the staged DELETE exactly once", async () => {
        const first = await ctx.rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });
        const { approvalToken } = JSON.parse(
            getTextContent(first as { content: Array<{ type: string; text?: string }> })
        );

        const second = await ctx.rawClient.callTool({ name: "confirm_action", arguments: { token: approvalToken } });
        const replay = await ctx.rawClient.callTool({ name: "confirm_action", arguments: { token: approvalToken } });

        expect(second.isError).not.toBe(true);
        expect(getTextContent(replay as { content: Array<{ type: string; text?: string }> })).toContain(
            "Approval token unknown or expired"
        );
        expect(deleteCalls).toEqual(["alert-1"]);
    });

    it("the auto-confirm helper completes a gated DELETE", async () => {
        const result = await ctx.client.callTool({ name: "delete_alert", arguments: { id: "alert-2" } });

        expect(result.isError).not.toBe(true);
        expect(deleteCalls).toEqual(["alert-2"]);
    });
});
