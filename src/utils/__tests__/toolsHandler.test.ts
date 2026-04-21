import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryApprovalStore } from "../approval.js";
import { executeToolHandler } from "../toolsHandler.js";

// Mock the underlying HTTP layer so "running" a destructive tool never actually
// hits the DoiT API. We only want to assert that the approval gate keeps us from
// reaching the handler's API call on an un-confirmed destructive tool.
vi.mock("../util.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../util.js")>();
    return { ...actual, makeDoitRequest: vi.fn().mockResolvedValue({ ok: true }) };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("executeToolHandler approval gate", () => {
    const apiToken = "fake-api-token";
    const userKey = "stdio-local";

    // Args that pass create_budget's Zod schema (fixed type requires endPeriod,
    // collaborators must include an owner, exactly one of scope/scopes).
    const validBudgetArgs = {
        name: "demo",
        amount: 100,
        currency: "USD",
        type: "fixed",
        startPeriod: 1704067200000,
        endPeriod: 1706745600000,
        scope: ["allocation-1"],
        collaborators: [{ role: "owner", email: "t@example.com" }],
    } as const;

    it("destructive tools return approval_required without calling the API on the first call", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();

        const approvalStore = new MemoryApprovalStore();
        const response = await executeToolHandler("create_budget", validBudgetArgs, apiToken, {
            userKey,
            approvalStore,
        });

        expect(makeDoitRequest).not.toHaveBeenCalled();
        expect(response.isError).toBeFalsy();
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.status).toBe("approval_required");
        expect(parsed.approvalToken).toMatch(/^[0-9a-f-]{36}$/);
        expect(parsed.summary).toContain("Create budget");
    });

    it("confirm_action with a valid token runs the destructive tool", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "budget-new-1" });

        const approvalStore = new MemoryApprovalStore();
        const first = await executeToolHandler("create_budget", validBudgetArgs, apiToken, {
            userKey,
            approvalStore,
        });
        const { approvalToken } = JSON.parse(first.content[0].text);

        await executeToolHandler("confirm_action", { token: approvalToken }, apiToken, {
            userKey,
            approvalStore,
        });

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        const [url, tokenArg, opts] = (makeDoitRequest as any).mock.calls[0];
        expect(url).toContain("/budgets");
        expect(tokenArg).toBe(apiToken);
        expect(opts.method).toBe("POST");
    });

    it("two un-confirmed destructive calls mint two distinct tokens", async () => {
        const approvalStore = new MemoryApprovalStore();

        const r1 = await executeToolHandler("create_budget", validBudgetArgs, apiToken, { userKey, approvalStore });
        const r2 = await executeToolHandler("create_budget", validBudgetArgs, apiToken, { userKey, approvalStore });

        const t1 = JSON.parse(r1.content[0].text).approvalToken;
        const t2 = JSON.parse(r2.content[0].text).approvalToken;
        expect(t1).not.toBe(t2);
    });

    it("without userKey/approvalStore the gate is bypassed (opt-in enforcement)", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "budget-new-1" });

        await executeToolHandler("create_budget", validBudgetArgs, apiToken, {});

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
    });

    it("non-destructive tools pass through even with the gate enabled", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as any).mockResolvedValue({ budgets: [], rowCount: 0 });

        const approvalStore = new MemoryApprovalStore();
        const response = await executeToolHandler("list_budgets", {}, apiToken, { userKey, approvalStore });

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        expect(response.content[0].text).toContain("budgets");
    });
});
