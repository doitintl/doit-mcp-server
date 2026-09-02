import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { GeneratedTool } from "../../tools/generated/types.js";
import { MemoryApprovalStore } from "../approval.js";
import { executeToolHandler } from "../toolsHandler.js";
import { makeDoitRequest } from "../util.js";

// Mock the underlying HTTP layer so "running" a write-gated tool never actually
// hits the DoiT API. We only want to assert that the approval gate keeps us from
// reaching the handler's API call on an un-confirmed write-gated tool.
vi.mock("../util.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../util.js")>();
    return { ...actual, makeDoitRequest: vi.fn().mockResolvedValue({ ok: true }) };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(makeDoitRequest).mockClear();
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

    const deleteWidgetTool: GeneratedTool = {
        name: "delete_widget",
        description: "Deletes a widget.",
        zodSchema: z.object({ id: z.string(), customerContext: z.string().optional() }),
        metadata: {
            method: "delete",
            pathTemplate: "/widgets/{id}",
            pathParams: ["id"],
            queryParams: ["customerContext"],
            headerParams: [],
            bodyEncoding: "json",
            multipartFileFields: [],
        },
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
        securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
        summary: (args) => `Delete a widget (id=${JSON.stringify(String(args.id))}).`,
    };
    const createWidgetTool: GeneratedTool = {
        ...deleteWidgetTool,
        name: "create_widget",
        metadata: { ...deleteWidgetTool.metadata, method: "post", pathTemplate: "/widgets", pathParams: [] },
        summary: undefined,
    };
    const generatedTools = new Map<string, GeneratedTool>([
        [deleteWidgetTool.name, deleteWidgetTool],
        [createWidgetTool.name, createWidgetTool],
    ]);

    it("generated DELETE tools return approval_required without calling the API on the first call", async () => {
        const approvalStore = new MemoryApprovalStore();
        const response = await executeToolHandler("delete_widget", { id: "w-1" }, apiToken, {
            userKey,
            approvalStore,
            generatedTools,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.status).toBe("approval_required");
        expect(parsed.approvalToken).toMatch(/^[0-9a-f-]{36}$/);
        expect(parsed.summary).toBe('Delete a widget (id="w-1").');
        expect(makeDoitRequest).not.toHaveBeenCalled();
        expect(approvalStore.size()).toBe(1);
    });

    it("confirm_action with a valid token runs the staged DELETE exactly once", async () => {
        const approvalStore = new MemoryApprovalStore();
        const first = await executeToolHandler("delete_widget", { id: "w-1" }, apiToken, {
            userKey,
            approvalStore,
            generatedTools,
        });
        const { approvalToken } = JSON.parse(first.content[0].text);

        await executeToolHandler("confirm_action", { token: approvalToken }, apiToken, {
            userKey,
            approvalStore,
            generatedTools,
        });

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/widgets/w-1"),
            apiToken,
            expect.objectContaining({ method: "DELETE" })
        );
        expect(approvalStore.size()).toBe(0);
    });

    it("two un-confirmed DELETE calls mint two distinct tokens", async () => {
        const approvalStore = new MemoryApprovalStore();
        const r1 = await executeToolHandler("delete_widget", { id: "w-1" }, apiToken, {
            userKey,
            approvalStore,
            generatedTools,
        });
        const r2 = await executeToolHandler("delete_widget", { id: "w-1" }, apiToken, {
            userKey,
            approvalStore,
            generatedTools,
        });

        const t1 = JSON.parse(r1.content[0].text).approvalToken;
        const t2 = JSON.parse(r2.content[0].text).approvalToken;
        expect(t1).not.toBe(t2);
        expect(approvalStore.size()).toBe(2);
    });

    it("generated non-DELETE tools run directly without an approval envelope", async () => {
        const approvalStore = new MemoryApprovalStore();
        const response = await executeToolHandler("create_widget", { id: "w-1" }, apiToken, {
            userKey,
            approvalStore,
            generatedTools,
        });

        expect(String(response.content[0].text)).not.toContain("approval_required");
        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/widgets"),
            apiToken,
            expect.objectContaining({ method: "POST" })
        );
        expect(approvalStore.size()).toBe(0);
    });

    it("without userKey/approvalStore the gate is bypassed (opt-in enforcement)", async () => {
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ticket-new-1" });

        await executeToolHandler("create_ticket", validTicketArgs, apiToken, {});

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
    });

    it("confirm_action with an unknown token returns a clean error (no throw)", async () => {
        // `confirm_action` is no longer advertised in the tool list (see src/server.ts
        // and the remote Worker in the separate private repo), but a misbehaving client with cached
        // metadata could still send the call. Verify it returns the canonical
        // "Approval token unknown or expired" error instead of throwing, and never
        // reaches the DoiT API.
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();

        const approvalStore = new MemoryApprovalStore();
        const response = await executeToolHandler(
            "confirm_action",
            { token: "00000000-0000-0000-0000-000000000000" },
            apiToken,
            { userKey, approvalStore }
        );

        expect(makeDoitRequest).not.toHaveBeenCalled();
        expect(response.content[0].text).toContain("Approval token unknown or expired");
    });

    it("create_ticket runs directly — hand-written writes are not gated by default", async () => {
        // Locks in the disabled-approval behavior: even with both userKey and approvalStore
        // supplied (i.e. the gate would fire if `create_ticket` were registered), we expect
        // the handler to call the DoiT API directly and return the API response — not an
        // `approval_required` envelope. Re-enabling the WRITE_GATED_SUMMARIES entry in
        // `src/utils/toolsHandler.ts` should make this test fail; that's intentional.
        const { makeDoitRequest } = await import("../util.js");
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
        (makeDoitRequest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "ticket-new-1" });

        const approvalStore = new MemoryApprovalStore();
        const response = await executeToolHandler("create_ticket", validTicketArgs, apiToken, {
            userKey,
            approvalStore,
        });

        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.status).not.toBe("approval_required");
        expect(parsed.approvalToken).toBeUndefined();
        expect(approvalStore.size()).toBe(0);
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
