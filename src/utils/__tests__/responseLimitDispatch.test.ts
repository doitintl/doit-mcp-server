import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { GeneratedTool } from "../../tools/generated/types.js";
import { MemoryApprovalStore } from "../approval.js";
import { MAX_TOOL_RESULT_CHARS } from "../responseLimit.js";
import { executeToolHandler } from "../toolsHandler.js";
import { makeDoitRequest } from "../util.js";

vi.mock("../util.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../util.js")>()),
    makeDoitRequest: vi.fn(),
}));

const read: GeneratedTool = {
    name: "read_test_resource",
    title: "Read test resource",
    description: "Test read",
    zodSchema: z.object({}),
    metadata: {
        method: "get",
        pathTemplate: "/test",
        pathParams: [],
        queryParams: [],
        headerParams: [],
        bodyEncoding: "json",
        multipartFileFields: [],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};
const write: GeneratedTool = {
    ...read,
    name: "write_test_resource",
    metadata: { ...read.metadata, method: "post" },
    annotations: { ...read.annotations, readOnlyHint: false },
};
const remove: GeneratedTool = {
    ...write,
    name: "delete_test_resource",
    metadata: { ...read.metadata, method: "delete" },
    summary: () => "Delete test resource",
};
const generatedTools = new Map([read, write, remove].map((tool) => [tool.name, tool]));
const onResponseMetrics = vi.fn();
const options = { generatedTools, onResponseMetrics };

beforeEach(() => vi.clearAllMocks());

describe("size guard through actual tool dispatch", () => {
    it("preserves pre-execution errors when a converter drops their error flag", async () => {
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const failingSummary = {
                ...remove,
                summary: () => {
                    throw new Error("Invalid action summary");
                },
            };
            const response = await executeToolHandler(remove.name, {}, "key", {
                ...options,
                generatedTools: new Map([[remove.name, failingSummary]]),
                userKey: "user",
                approvalStore: new MemoryApprovalStore(),
                convertResponse: () => ({ content: [{ type: "text", text: "widget data" }] }),
            });
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("Invalid action summary");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        } finally {
            errorLog.mockRestore();
        }
    });

    it("rejects oversized reads without retrying the API", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue("x".repeat(MAX_TOOL_RESULT_CHARS));
        const response = await executeToolHandler(read.name, {}, "key", options);
        expect(response.isError).toBe(true);
        expect(makeDoitRequest).toHaveBeenCalledOnce();
        expect(onResponseMetrics).toHaveBeenCalledOnce();
    });

    it("checks final converted results even if raw API data was small", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue("small");
        const response = await executeToolHandler(read.name, {}, "key", {
            ...options,
            convertResponse: () => ({ content: [{ type: "text", text: "x".repeat(MAX_TOOL_RESULT_CHARS) }] }),
        });
        expect(response.isError).toBe(true);
    });

    it("keeps a small formatted result even when its source was large", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue("x".repeat(MAX_TOOL_RESULT_CHARS));
        const converted = { content: [{ type: "text", text: "Small summary" }] };
        expect(await executeToolHandler(read.name, {}, "key", { ...options, convertResponse: () => converted })).toBe(
            converted
        );
    });

    it("returns a success receipt for a completed generated POST", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue(
            JSON.stringify({ id: "w1", body: "x".repeat(MAX_TOOL_RESULT_CHARS) })
        );
        const response = await executeToolHandler(write.name, {}, "key", options);
        expect(response.isError).toBe(false);
        expect(JSON.parse(response.content[0].text)).toMatchObject({ status: "completed", identifiers: { id: "w1" } });
        expect(makeDoitRequest).toHaveBeenCalledOnce();
    });

    it("uses the underlying write outcome for confirm_action and executes only once", async () => {
        const approvalStore = new MemoryApprovalStore();
        const gated = { ...options, approvalStore, userKey: "user" };
        const pending = await executeToolHandler(remove.name, {}, "key", gated);
        expect(makeDoitRequest).not.toHaveBeenCalled();
        const { approvalToken } = JSON.parse(pending.content[0].text);
        vi.mocked(makeDoitRequest).mockResolvedValue("x".repeat(MAX_TOOL_RESULT_CHARS));
        const response = await executeToolHandler("confirm_action", { token: approvalToken }, "key", gated);
        expect(response.isError).toBe(false);
        expect(JSON.parse(response.content[0].text).status).toBe("completed");
        expect(makeDoitRequest).toHaveBeenCalledOnce();
        expect(onResponseMetrics).toHaveBeenLastCalledWith(
            expect.objectContaining({ toolName: remove.name, disposition: "success_receipt" })
        );
        const retry = await executeToolHandler("confirm_action", { token: approvalToken }, "key", gated);
        expect(retry.isError).toBe(true);
        expect(makeDoitRequest).toHaveBeenCalledOnce();
    });
});
