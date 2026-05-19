import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryApprovalStore } from "../approval.js";
import { executeToolHandler } from "../toolsHandler.js";

// Mock the underlying HTTP layer so "running" a write-gated tool never actually
// hits the DoiT API. We only want to assert that the approval gate keeps us from
// reaching the handler's API call on an un-confirmed write-gated tool.
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

    // Args that pass create_ticket's Zod schema (all six ticket fields required).
    const validTicketArgs = {
        ticket: {
            body: "Need help with billing.",
            created: "2026-04-22T00:00:00Z",
            platform: "amazon_web_services",
            product: "billing",
            severity: "high",
            subject: "Billing question",
        },
    } as const;

    it("write-gated tools return approval_required without calling the API on the first call", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();

        const approvalStore = new MemoryApprovalStore();
        const response = await executeToolHandler("create_ticket", validTicketArgs, apiToken, {
            userKey,
            approvalStore,
        });

        expect(makeDoitRequest).not.toHaveBeenCalled();
        expect(response.isError).toBeFalsy();
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.status).toBe("approval_required");
        expect(parsed.summary).toContain("Create support ticket");
        // New per-tool userPrompt contract: the question references "the above details"
        // rather than restating the multi-line summary. See createTicketTool.summary.
        expect(parsed.userPrompt).toBe("Are you sure you want to create the support ticket with the above details?");
        // The envelope must not leak any token to the LLM — that's the whole point of
        // routing confirm_action via `userKey` lookups instead of a token argument.
        expect(parsed.approvalToken).toBeUndefined();
    });

    it("confirm_action (no args) runs the write-gated tool staged for this user", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ticket-new-1" });

        const approvalStore = new MemoryApprovalStore();
        await executeToolHandler("create_ticket", validTicketArgs, apiToken, {
            userKey,
            approvalStore,
        });

        await executeToolHandler("confirm_action", {}, apiToken, {
            userKey,
            approvalStore,
        });

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        const [url, tokenArg, opts] = (makeDoitRequest as any).mock.calls[0];
        expect(url).toContain("/tickets");
        expect(tokenArg).toBe(apiToken);
        expect(opts.method).toBe("POST");
    });

    it("a second un-confirmed write-gated call for the same user evicts the first", async () => {
        const approvalStore = new MemoryApprovalStore();

        // First staging — different subject so we can tell which one wins.
        await executeToolHandler(
            "create_ticket",
            { ticket: { ...validTicketArgs.ticket, subject: "first" } },
            apiToken,
            { userKey, approvalStore }
        );
        await executeToolHandler(
            "create_ticket",
            { ticket: { ...validTicketArgs.ticket, subject: "second" } },
            apiToken,
            { userKey, approvalStore }
        );

        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ticket-new-1" });

        await executeToolHandler("confirm_action", {}, apiToken, { userKey, approvalStore });

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        const [, , opts] = (makeDoitRequest as any).mock.calls[0];
        // The handler passes `body` to makeDoitRequest as an object — the JSON
        // stringification happens inside makeDoitRequest (which is mocked here),
        // so the captured value is still the structured payload.
        expect(opts.body.ticket.subject).toBe("second");
    });

    it("without userKey/approvalStore the gate is bypassed (opt-in enforcement)", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ticket-new-1" });

        await executeToolHandler("create_ticket", validTicketArgs, apiToken, {});

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
    });

    it("non-gated tools pass through even with the gate enabled", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as any).mockResolvedValue({ budgets: [], rowCount: 0 });

        const approvalStore = new MemoryApprovalStore();
        const response = await executeToolHandler("list_budgets", {}, apiToken, { userKey, approvalStore });

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        expect(response.content[0].text).toContain("budgets");
    });
});
