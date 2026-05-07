import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryApprovalStore } from "../approval.js";
import { executeToolHandler } from "../toolsHandler.js";

// Mock the underlying HTTP layer so tools never actually hit the DoiT API.
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

    it("create_ticket runs directly without approval gate (client handles confirmation)", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ticket-new-1" });

        const approvalStore = new MemoryApprovalStore();
        await executeToolHandler("create_ticket", validTicketArgs, apiToken, {
            userKey,
            approvalStore,
        });

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        const [url, tokenArg, opts] = (makeDoitRequest as any).mock.calls[0];
        expect(url).toContain("/tickets");
        expect(tokenArg).toBe(apiToken);
        expect(opts.method).toBe("POST");
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
