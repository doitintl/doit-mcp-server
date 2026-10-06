import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateTools } from "../../tools/generated/generateTools.js";
import { loadGeneratedToolsSpec } from "../../tools/generated/loadSpec.js";
import type { GeneratedTool } from "../../tools/generated/types.js";
import { COVERED_ENDPOINTS } from "../../tools/handWrittenTools.js";
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

    it("returns narrowing guidance for an oversized generated POST layer-components lookup", async () => {
        const tools = generateTools(loadGeneratedToolsSpec(), COVERED_ENDPOINTS);
        vi.mocked(makeDoitRequest).mockResolvedValue("x".repeat(MAX_TOOL_RESULT_CHARS));
        const response = await executeToolHandler(
            "get_statussheet_components",
            { id: "layer-1", node: ["node-1"] },
            "key",
            { ...options, generatedTools: new Map(tools.map((tool) => [tool.name, tool])) }
        );
        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("RESPONSE_TOO_LARGE");
        expect(response.content[0].text).toContain("fewer component IDs");
        expect(response.content[0].text).toContain("projection fields using the p parameter");
        expect(response.content[0].text).not.toContain("Do not repeat the write");
        expect(makeDoitRequest).toHaveBeenCalledOnce();
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/clouddiagrams/v1/statussheet/layer-1/get"),
            "key",
            expect.objectContaining({ method: "POST", body: { node: ["node-1"] } })
        );
        expect(onResponseMetrics).toHaveBeenCalledWith(
            expect.objectContaining({ toolName: "get_statussheet_components", disposition: "size_error" })
        );
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

    it("bounds an oversized write error without adapting it or reporting success", async () => {
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        const convertResponse = vi.fn(() => ({ content: [{ type: "text", text: "adapted success" }] }));
        try {
            vi.mocked(makeDoitRequest).mockRejectedValue(new Error(`HTTP 401: ${"x".repeat(MAX_TOOL_RESULT_CHARS)}`));
            const response = await executeToolHandler(write.name, {}, "key", { ...options, convertResponse });
            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("RESPONSE_TOO_LARGE");
            expect(response.content[0].text).toContain("The tool reported an error");
            expect(JSON.stringify(response).length).toBeLessThan(MAX_TOOL_RESULT_CHARS);
            expect(convertResponse).not.toHaveBeenCalled();
            expect(makeDoitRequest).toHaveBeenCalledOnce();
            expect(onResponseMetrics).toHaveBeenCalledWith(
                expect.objectContaining({ toolName: write.name, isError: true, disposition: "size_error" })
            );
        } finally {
            errorLog.mockRestore();
        }
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
