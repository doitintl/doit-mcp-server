import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, getTextContent } from "../helpers.js";
import { mswServer } from "../setup.js";

// This suite intentionally uses `rawClient` to bypass the test helper's
// auto-confirm wrapper, so we can observe the two-phase approval envelope
// emitted by the server directly. `delete_alert` is a generated DELETE tool;
// every generated DELETE operation is write-gated (see generateTools.ts).
describe("Write-gated tool approval flow (stdio)", () => {
    let rawClient: { callTool: (p: { name: string; arguments: Record<string, unknown> }) => Promise<any> };
    let cleanup: () => Promise<void>;
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
        ({ rawClient, cleanup } = await createTestClient());
    });

    afterEach(async () => {
        await cleanup();
        vi.restoreAllMocks();
    });

    it("emits an approval_required envelope on the first call and does not hit the API", async () => {
        const result = await rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });
        const body = JSON.parse(getTextContent(result));

        expect(body.status).toBe("approval_required");
        expect(body.approvalToken).toMatch(/^[0-9a-f-]{36}$/i);
        expect(body.summary).toBe(
            'Delete an alert (id="alert-1"). This cannot be undone: DELETE /analytics/v1/alerts/{id}.'
        );
        expect(body.next).toContain("confirm_action");
        expect(deleteCalls).toEqual([]);
    });

    it("confirm_action with the minted token executes the staged DELETE", async () => {
        const first = await rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });
        const { approvalToken } = JSON.parse(getTextContent(first));

        const second = await rawClient.callTool({
            name: "confirm_action",
            arguments: { token: approvalToken },
        });

        expect(second.isError).not.toBe(true);
        expect(deleteCalls).toEqual(["alert-1"]);
    });

    it("approval tokens are single-use — replaying a consumed token errors out", async () => {
        const first = await rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });
        const { approvalToken } = JSON.parse(getTextContent(first));

        await rawClient.callTool({ name: "confirm_action", arguments: { token: approvalToken } });
        const replay = await rawClient.callTool({
            name: "confirm_action",
            arguments: { token: approvalToken },
        });

        expect(getTextContent(replay)).toContain("Approval token unknown or expired");
        expect(deleteCalls).toEqual(["alert-1"]);
    });

    it("confirm_action with an unknown token returns the canonical error", async () => {
        const result = await rawClient.callTool({
            name: "confirm_action",
            arguments: { token: "00000000-0000-0000-0000-000000000000" },
        });
        expect(getTextContent(result)).toContain("Approval token unknown or expired");
    });

    it("calling a write-gated tool twice mints two distinct tokens (idempotent on LLM misbehavior)", async () => {
        const r1 = await rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });
        const r2 = await rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });

        const t1 = JSON.parse(getTextContent(r1)).approvalToken;
        const t2 = JSON.parse(getTextContent(r2)).approvalToken;
        expect(t1).not.toBe(t2);
        expect(deleteCalls).toEqual([]);
    });

    it("the auto-confirm test helper transparently completes a gated DELETE", async () => {
        const { client, cleanup: cleanupWrapped } = await createTestClient();
        try {
            const result = await client.callTool({ name: "delete_alert", arguments: { id: "alert-2" } });
            expect(result.isError).not.toBe(true);
            expect(deleteCalls).toEqual(["alert-2"]);
        } finally {
            await cleanupWrapped();
        }
    });
});
