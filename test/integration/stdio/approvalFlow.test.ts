import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateTools } from "../../../src/tools/generated/generateTools.js";
import { loadGeneratedToolsSpec } from "../../../src/tools/generated/loadSpec.js";
import { COVERED_ENDPOINTS } from "../../../src/tools/handWrittenTools.js";
import { APPROVAL_GATED_DESCRIPTION } from "../../../src/utils/approval.js";
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

    it("lists confirm_action and describes the two-step flow on gated DELETE tools", async () => {
        const { client, cleanup: cleanupListed } = await createTestClient();
        try {
            const { tools } = await client.listTools();
            const confirm = tools.find((tool) => tool.name === "confirm_action");
            expect(confirm?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
            const gated = new Set(
                generateTools(loadGeneratedToolsSpec(), COVERED_ENDPOINTS)
                    .filter((tool) => tool.summary)
                    .map((tool) => tool.name)
            );
            expect(gated).toContain("delete_alert");
            for (const tool of tools) {
                expect(tool.description?.includes(APPROVAL_GATED_DESCRIPTION), tool.name).toBe(gated.has(tool.name));
            }
            expect(tools.filter((tool) => gated.has(tool.name))).toHaveLength(gated.size);
        } finally {
            await cleanupListed();
        }
    });

    it("confirms the saved target, not arguments sent with confirm_action", async () => {
        const staged = await rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });
        const { approvalToken } = JSON.parse(getTextContent(staged));

        const confirmed = await rawClient.callTool({
            name: "confirm_action",
            arguments: { token: approvalToken, id: "alert-other" } as Record<string, unknown>,
        });

        expect(deleteCalls).toEqual(["alert-1"]);
        expect(confirmed.isError).not.toBe(true);
    });

    it("returns the original DELETE error after confirmation", async () => {
        mswServer.use(
            http.delete("https://api.doit.com/analytics/v1/alerts/missing", () =>
                HttpResponse.json({ error: "alert not found" }, { status: 404 })
            )
        );
        const staged = await rawClient.callTool({ name: "delete_alert", arguments: { id: "missing" } });
        const { approvalToken } = JSON.parse(getTextContent(staged));

        const confirmed = await rawClient.callTool({ name: "confirm_action", arguments: { token: approvalToken } });

        expect(confirmed.isError).toBe(true);
        expect(getTextContent(confirmed)).toContain("404");
    });

    it("emits an approval_required envelope on the first call and does not hit the API", async () => {
        const result = await rawClient.callTool({ name: "delete_alert", arguments: { id: "alert-1" } });
        const body = JSON.parse(getTextContent(result));

        expect(body.status).toBe("approval_required");
        expect(body.approvalToken).toMatch(/^[0-9a-f-]{36}$/i);
        expect(body.summary).toBe(
            'Delete an alert (id="alert-1"). This cannot be undone: DELETE /analytics/v1/alerts/alert-1.'
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
