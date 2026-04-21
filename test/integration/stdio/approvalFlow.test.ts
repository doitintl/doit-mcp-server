import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, getTextContent } from "../helpers.js";

// This suite intentionally uses `rawClient` to bypass the test helper's
// auto-confirm wrapper, so we can observe the two-phase approval envelope
// emitted by the server directly.
describe("Destructive-tool approval flow (stdio)", () => {
    let rawClient: { callTool: (p: { name: string; arguments: Record<string, unknown> }) => Promise<any> };
    let cleanup: () => Promise<void>;

    const budgetArgs = {
        name: "Gated Budget",
        amount: 100,
        currency: "USD",
        type: "recurring" as const,
        timeInterval: "month" as const,
        startPeriod: 1704067200000,
        scopes: [{ id: "cloud_provider", type: "fixed", mode: "is", values: ["amazon-web-services"] }],
        collaborators: [{ role: "owner", email: "t@example.com" }],
    };

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        ({ rawClient, cleanup } = await createTestClient());
    });

    afterEach(async () => {
        await cleanup();
        vi.restoreAllMocks();
    });

    it("emits an approval_required envelope on the first call to a destructive tool", async () => {
        const result = await rawClient.callTool({ name: "create_budget", arguments: budgetArgs });
        const body = JSON.parse(getTextContent(result));

        expect(body.status).toBe("approval_required");
        expect(body.approvalToken).toMatch(/^[0-9a-f-]{36}$/i);
        expect(body.summary).toContain("Create budget");
        expect(body.next).toContain("confirm_action");
    });

    it("confirm_action with the minted token executes the original destructive call", async () => {
        const first = await rawClient.callTool({ name: "create_budget", arguments: budgetArgs });
        const { approvalToken } = JSON.parse(getTextContent(first));

        const second = await rawClient.callTool({
            name: "confirm_action",
            arguments: { token: approvalToken },
        });
        const parsed = JSON.parse(getTextContent(second));
        expect(parsed.id).toBe("budget-new-1");
    });

    it("approval tokens are single-use — replaying a consumed token errors out", async () => {
        const first = await rawClient.callTool({ name: "create_budget", arguments: budgetArgs });
        const { approvalToken } = JSON.parse(getTextContent(first));

        await rawClient.callTool({ name: "confirm_action", arguments: { token: approvalToken } });
        const replay = await rawClient.callTool({
            name: "confirm_action",
            arguments: { token: approvalToken },
        });

        expect(getTextContent(replay)).toContain("Approval token unknown or expired");
    });

    it("confirm_action with an unknown token returns the canonical error", async () => {
        const result = await rawClient.callTool({
            name: "confirm_action",
            arguments: { token: "00000000-0000-0000-0000-000000000000" },
        });
        expect(getTextContent(result)).toContain("Approval token unknown or expired");
    });

    it("calling a destructive tool twice mints two distinct tokens (idempotent on LLM misbehavior)", async () => {
        const r1 = await rawClient.callTool({ name: "create_budget", arguments: budgetArgs });
        const r2 = await rawClient.callTool({ name: "create_budget", arguments: budgetArgs });

        const t1 = JSON.parse(getTextContent(r1)).approvalToken;
        const t2 = JSON.parse(getTextContent(r2)).approvalToken;
        expect(t1).not.toBe(t2);
    });
});
