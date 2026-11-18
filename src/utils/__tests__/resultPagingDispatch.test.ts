import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { GeneratedTool } from "../../tools/generated/types.js";
import { CONTINUATION_TOKEN_PREFIX } from "../continuation.js";
import { MAX_TOOL_RESULT_CHARS, measureToolResponse } from "../responseLimit.js";
import {
    FOREIGN_PAGE_TOKEN_MESSAGE,
    INVALID_CONTINUATION_MESSAGE,
    MISSING_SCOPE_MESSAGE,
    RESULT_PAGE_TOKEN_SCHEMA,
} from "../resultPaging.js";
import { executeToolHandler } from "../toolsHandler.js";
import { makeDoitRequest } from "../util.js";

vi.mock("../util.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../util.js")>()),
    makeDoitRequest: vi.fn(),
}));

/** A generated read tool whose endpoint has no paging: the generator adds the continuation token. */
const unpaged: GeneratedTool = {
    name: "list_test_records",
    title: "List test records",
    description: "Test list",
    zodSchema: z.object({ pageToken: RESULT_PAGE_TOKEN_SCHEMA }),
    metadata: {
        method: "get",
        pathTemplate: "/test/records",
        pathParams: [],
        queryParams: [],
        headerParams: [],
        bodyEncoding: "json",
        multipartFileFields: [],
        resultPaged: true,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};
/** A generated read tool whose endpoint pages itself. */
const paged: GeneratedTool = {
    ...unpaged,
    name: "list_test_pages",
    zodSchema: z.object({ pageToken: z.string().optional(), filter: z.string().optional() }),
    metadata: {
        ...unpaged.metadata,
        pathTemplate: "/test/pages",
        queryParams: ["pageToken", "filter"],
        resultPaged: undefined,
    },
};
const write: GeneratedTool = {
    ...unpaged,
    name: "create_test_record",
    zodSchema: z.object({}),
    metadata: { ...unpaged.metadata, method: "post", resultPaged: undefined },
    annotations: { ...unpaged.annotations, readOnlyHint: false },
};
const generatedTools = new Map([unpaged, paged, write].map((tool) => [tool.name, tool]));
const options = {
    generatedTools,
    onResponseMetrics: vi.fn(),
    resultPaging: { secret: "dispatch-secret", scope: null },
};

const records = (count: number, bytes = 1_500) =>
    Array.from({ length: count }, (_, i) => ({ id: `r-${i + 1}`, blob: "x".repeat(bytes) }));
const text = (response: any) => JSON.parse(response.content[0].text);

beforeEach(() => vi.clearAllMocks());

describe("result paging through actual tool dispatch", () => {
    it("splits an oversized unpaginated result and walks it to completion without gaps or repeats", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue(JSON.stringify(records(300)));
        const seen: string[] = [];
        let pageToken: string | undefined;
        let pages = 0;
        for (; pages < 10; pages += 1) {
            const response = await executeToolHandler(unpaged.name, pageToken ? { pageToken } : {}, "key", options);
            expect(response.isError, response.content?.[0]?.text).not.toBe(true);
            expect(measureToolResponse(response)?.serializedChars).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS);
            const page = text(response);
            seen.push(...page.items.map((record: { id: string }) => record.id));
            expect(page.rowCount).toBe(300);
            if (!page.pageToken) break;
            expect(page.pageToken.startsWith(CONTINUATION_TOKEN_PREFIX)).toBe(true);
            expect(page.pageSplit).toEqual({
                returnedRecords: page.items.length,
                remainingInResult: 300 - seen.length,
            });
            pageToken = page.pageToken;
        }
        expect(pages).toBeGreaterThan(0);
        expect(seen).toEqual(records(300).map((record) => record.id));
        // Every page re-fetched the same upstream resource with no pageToken sent upstream.
        for (const [url] of vi.mocked(makeDoitRequest).mock.calls) expect(url).not.toContain("pageToken");
    });

    it("withholds the upstream cursor until the split page is complete", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue(
            JSON.stringify({ rowCount: 120, pageToken: "upstream-page-2", records: records(120) })
        );
        const first = text(await executeToolHandler(paged.name, { filter: "a" }, "key", options));
        expect(first.pageToken.startsWith(CONTINUATION_TOKEN_PREFIX)).toBe(true);
        let page = first;
        while (page.pageToken?.startsWith(CONTINUATION_TOKEN_PREFIX)) {
            page = text(await executeToolHandler(paged.name, { pageToken: page.pageToken }, "key", options));
        }
        expect(page.pageToken).toBe("upstream-page-2");
        expect(page).not.toHaveProperty("pageSplit");
        // The stored filter was reused on every continuation; the upstream cursor was never sent for this page.
        for (const [url] of vi.mocked(makeDoitRequest).mock.calls) {
            expect(url).toContain("filter=a");
            expect(url).not.toContain("pageToken");
        }
    });

    it("sends an upstream cursor through unchanged for tools whose endpoint pages", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue(JSON.stringify({ rowCount: 1, records: records(1) }));
        await executeToolHandler(paged.name, { pageToken: "upstream-page-2" }, "key", options);
        expect(vi.mocked(makeDoitRequest).mock.calls[0][0]).toContain("pageToken=upstream-page-2");
    });

    it("rejects tampered, foreign and cross-tool tokens before calling the API", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue(JSON.stringify(records(300)));
        const first = text(await executeToolHandler(unpaged.name, {}, "key", options));
        vi.clearAllMocks();

        const tampered = await executeToolHandler(unpaged.name, { pageToken: `${first.pageToken}x` }, "key", options);
        expect(tampered.isError).toBe(true);
        expect(tampered.content[0].text).toBe(INVALID_CONTINUATION_MESSAGE);

        const crossed = await executeToolHandler(paged.name, { pageToken: first.pageToken }, "key", options);
        expect(crossed.isError).toBe(true);
        expect(crossed.content[0].text).toBe(INVALID_CONTINUATION_MESSAGE);

        const foreign = await executeToolHandler(unpaged.name, { pageToken: "not-ours" }, "key", options);
        expect(foreign.isError).toBe(true);
        expect(foreign.content[0].text).toBe(FOREIGN_PAGE_TOKEN_MESSAGE);
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("ignores a stray pageToken on a tool that has no such argument", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue(JSON.stringify({ id: "w-1" }));
        const response = await executeToolHandler(write.name, { pageToken: "stray" }, "key", options);
        expect(response.isError).not.toBe(true);
        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
    });

    it("keeps the size error and receipt behaviour for results that cannot be paged", async () => {
        // An oversized write still becomes a completion receipt, never a split.
        vi.mocked(makeDoitRequest).mockResolvedValue(
            JSON.stringify({ id: "w-1", blob: "x".repeat(MAX_TOOL_RESULT_CHARS) })
        );
        const receipt = await executeToolHandler(write.name, {}, "key", options);
        expect(receipt.isError).toBe(false);
        expect(text(receipt)).toMatchObject({ status: "completed", responseOmitted: true, identifiers: { id: "w-1" } });

        // An oversized read with no record collection keeps the size error.
        vi.mocked(makeDoitRequest).mockResolvedValue(
            JSON.stringify({ id: "d-1", blob: "x".repeat(MAX_TOOL_RESULT_CHARS) })
        );
        const error = await executeToolHandler(unpaged.name, {}, "key", options);
        expect(error.isError).toBe(true);
        expect(error.content[0].text).toContain("RESPONSE_TOO_LARGE");
    });

    it("uses the consumer's cursor field when a converter normalises the result", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue(JSON.stringify(records(300)));
        const convertResponse = (raw: any) => {
            const items = JSON.parse(raw.content[0].text);
            const structured = { items, itemCount: items.length, hasMore: false };
            return { structuredContent: structured, content: [{ type: "text", text: JSON.stringify(structured) }] };
        };
        const response = await executeToolHandler(unpaged.name, {}, "key", {
            ...options,
            convertResponse,
            resultPaging: { secret: "dispatch-secret", cursorField: "nextPageToken", scope: null },
        });
        expect(response.structuredContent).toMatchObject({
            itemCount: response.structuredContent.items.length,
            hasMore: true,
            nextPageToken: expect.stringMatching(/^dci1\./),
        });
        expect(response.structuredContent).not.toHaveProperty("pageToken");
        expect(text(response)).toEqual(response.structuredContent);
    });

    it("leaves results alone when paging is not configured", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue(JSON.stringify(records(300)));
        const response = await executeToolHandler(unpaged.name, {}, "key", {
            generatedTools,
            onResponseMetrics: vi.fn(),
        });
        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("RESPONSE_TOO_LARGE");
    });

    it("refuses to run when paging is configured without a scope, before calling the API", async () => {
        for (const scope of [undefined, ""]) {
            const resultPaging = { secret: "dispatch-secret", scope } as unknown as typeof options.resultPaging;
            await expect(executeToolHandler(unpaged.name, {}, "key", { ...options, resultPaging })).rejects.toThrow(
                MISSING_SCOPE_MESSAGE
            );
        }
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});
