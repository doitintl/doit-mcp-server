import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DOIT_API_BASE, makeDoitRequest } from "../../../utils/util.js";
import { handleGeneratedOperationRequest } from "../callOperation.js";
import type { GeneratedTool } from "../types.js";

vi.mock("../../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        makeDoitRequest: vi.fn(),
    };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

function buildTool(overrides: Partial<GeneratedTool> = {}): GeneratedTool {
    return {
        name: "get_widget",
        description: "Get a widget",
        zodSchema: z.object({ id: z.string(), pageToken: z.string().optional() }),
        metadata: {
            method: "get",
            pathTemplate: "/widgets/{id}",
            pathParams: ["id"],
            queryParams: ["pageToken"],
            headerParams: [],
            bodyEncoding: "json",
            multipartFileFields: [],
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: true,
        },
        securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
        ...overrides,
    };
}

describe("handleGeneratedOperationRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("substitutes path params and appends query params", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue("{}");

        await handleGeneratedOperationRequest(buildTool(), { id: "abc", pageToken: "p1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${DOIT_API_BASE}/widgets/abc?pageToken=p1`,
            mockToken,
            expect.objectContaining({
                method: "GET",
                appendParams: false,
                parseAs: "text",
            })
        );
    });

    it("appends customerContext as a query param when provided", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue("{}");

        await handleGeneratedOperationRequest(buildTool(), { id: "abc", customerContext: "cust-1" }, mockToken);

        const [url] = (makeDoitRequest as vi.Mock).mock.calls[0];
        expect(url).toContain("customerContext=cust-1");
    });

    it("sends leftover fields as a JSON body for non-GET operations", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue("{}");
        const tool = buildTool({
            metadata: {
                method: "post",
                pathTemplate: "/widgets",
                pathParams: [],
                queryParams: [],
                headerParams: [],
                bodyEncoding: "json",
                multipartFileFields: [],
            },
            zodSchema: z.object({ name: z.string() }),
        });

        await handleGeneratedOperationRequest(tool, { name: "test" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${DOIT_API_BASE}/widgets`,
            mockToken,
            expect.objectContaining({ method: "POST", body: { name: "test" } })
        );
    });

    it("sends header params as request headers and excludes them from the body", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue("{}");
        const tool = buildTool({
            zodSchema: z.object({ id: z.string(), "Idempotency-Key": z.string() }),
            metadata: {
                method: "post",
                pathTemplate: "/widgets/{id}/actions/resend",
                pathParams: ["id"],
                queryParams: [],
                headerParams: ["Idempotency-Key"],
                bodyEncoding: "json",
                multipartFileFields: [],
            },
        });

        await handleGeneratedOperationRequest(tool, { id: "abc", "Idempotency-Key": "key-1" }, mockToken);

        const [, , options] = (makeDoitRequest as vi.Mock).mock.calls[0];
        expect(options.headers).toEqual({ "Idempotency-Key": "key-1" });
        expect(options.body).toBeUndefined();
    });

    it("builds a multipart FormData body from base64 file fields", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue("{}");
        const tool = buildTool({
            zodSchema: z.object({ file: z.string(), name: z.string() }),
            metadata: {
                method: "post",
                pathTemplate: "/uploads",
                pathParams: [],
                queryParams: [],
                headerParams: [],
                bodyEncoding: "multipart",
                multipartFileFields: ["file"],
            },
        });

        await handleGeneratedOperationRequest(
            tool,
            { file: Buffer.from("hello").toString("base64"), name: "test.txt" },
            mockToken
        );

        const [, , options] = (makeDoitRequest as vi.Mock).mock.calls[0];
        expect(options.body).toBeInstanceOf(FormData);
    });

    it("returns a validation error response for invalid args without calling the API", async () => {
        const response = await handleGeneratedOperationRequest(buildTool(), {}, mockToken);

        expect(makeDoitRequest).not.toHaveBeenCalled();
        expect(response.isError).toBe(true);
    });

    it("surfaces a failure response when makeDoitRequest returns null", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(null);

        const response = await handleGeneratedOperationRequest(buildTool(), { id: "abc" }, mockToken);

        expect(response.isError).toBe(true);
    });
});
