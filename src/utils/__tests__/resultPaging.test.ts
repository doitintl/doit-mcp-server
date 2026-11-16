import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { type ContinuationDraft, type ContinuationPosition, hashScope, signContinuation } from "../continuation.js";
import { MAX_TOOL_RESULT_CHARS, measureToolResponse } from "../responseLimit.js";
import {
    applyPosition,
    assertResultPagingScope,
    CONTINUATION_SCOPE_MESSAGE,
    continuationSigner,
    EXPIRED_CONTINUATION_MESSAGE,
    FOREIGN_PAGE_TOKEN_MESSAGE,
    findCollection,
    fitResultPage,
    INVALID_CONTINUATION_MESSAGE,
    MISSING_SCOPE_MESSAGE,
    needsResultPageToken,
    positionAfter,
    RESULT_PAGE_BUDGET_CHARS,
    resolvePagedCall,
    withResultPageToken,
    withResultPageTokenInputSchema,
} from "../resultPaging.js";
import { createSuccessResponse } from "../util.js";

// The fake signer embeds the payload so tests can read back the position a token carries.
const FAKE_PREFIX = "dci1.";
const sign = vi.fn(async (draft: ContinuationDraft) => `${FAKE_PREFIX}${JSON.stringify(draft)}`);
const tokenPayload = (token: unknown) => JSON.parse(String(token).slice(FAKE_PREFIX.length)) as ContinuationDraft;
const isFakeToken = (token: unknown) => typeof token === "string" && token.startsWith(FAKE_PREFIX);

const tickets = (count: number, bytes: number) =>
    Array.from({ length: count }, (_, i) => ({ id: i + 1, description: "x".repeat(bytes) }));
/** A stdio-shaped list result: JSON text with the API's own cursor field. */
const textResult = (data: unknown) => createSuccessResponse(JSON.stringify(data, null, 2));
/** A hosted-shaped result: normalised list in structuredContent, mirrored into content. */
const structuredResult = (structured: Record<string, unknown>) => ({
    structuredContent: structured,
    content: [{ type: "text", text: JSON.stringify(structured) }],
});
const parsed = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);

const textOptions = (overrides: Partial<Parameters<typeof fitResultPage>[1]> = {}) => ({
    toolName: "list_tickets",
    originalArgs: { pageSize: 40 },
    canContinue: true,
    cursorField: "pageToken" as const,
    sign,
    ...overrides,
});

describe("fitResultPage on stdio results", () => {
    it("returns a result that fits exactly as it is", async () => {
        const result = textResult({ rowCount: 5, pageToken: "", tickets: tickets(5, 100) });
        await expect(fitResultPage(result, textOptions())).resolves.toBe(result);
        expect(sign).not.toHaveBeenCalled();
    });

    it("splits an oversized page, withholds the upstream cursor, and marks the split", async () => {
        const result = textResult({ rowCount: 40, pageToken: "upstream-next", tickets: tickets(40, 5_000) });
        expect(measureToolResponse(result)?.serializedChars).toBeGreaterThan(MAX_TOOL_RESULT_CHARS);
        const fitted = await fitResultPage(result, textOptions());
        const page = parsed(fitted);
        expect(page.tickets.length).toBeGreaterThan(0);
        expect(page.tickets.length).toBeLessThan(40);
        expect(page).toMatchObject({
            rowCount: 40,
            pageToken: expect.stringMatching(/^dci1\./),
            pageSplit: { returnedRecords: page.tickets.length, remainingInResult: 40 - page.tickets.length },
        });
        expect(page).not.toHaveProperty("hasMore");
        expect(measureToolResponse(fitted)?.serializedChars).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS);
        expect(tokenPayload(page.pageToken)).toMatchObject({
            tool: "list_tickets",
            args: { pageSize: 40 },
            upstream: null,
            position: { afterId: String(page.tickets.length), afterIndex: page.tickets.length - 1 },
        });
    });

    it("walks a split page to completion with no gaps or repeats, then exposes the upstream cursor", async () => {
        const full = () => textResult({ rowCount: 40, pageToken: "upstream-next", tickets: tickets(40, 5_000) });
        const seen: number[] = [];
        let position: ContinuationPosition | undefined;
        let last: Record<string, any> | undefined;
        for (let calls = 0; calls < 10; calls += 1) {
            last = parsed(await fitResultPage(full(), textOptions({ position })));
            seen.push(...last.tickets.map((ticket: { id: number }) => ticket.id));
            if (!isFakeToken(last.pageToken)) break;
            position = tokenPayload(last.pageToken).position;
        }
        expect(seen).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
        expect(last).toMatchObject({ pageToken: "upstream-next" });
        expect(last).not.toHaveProperty("pageSplit");
    });

    it("drops an upstream nextPageToken from split parts and exposes it only on the last", async () => {
        // search_customers-shaped: takes pageToken, returns its cursor as nextPageToken.
        const full = () => textResult({ nextPageToken: "upstream-2", hasMore: true, customers: tickets(300, 1_500) });
        const seen: number[] = [];
        let position: ContinuationPosition | undefined;
        let last: Record<string, any> | undefined;
        for (let calls = 0; calls < 10; calls += 1) {
            last = parsed(await fitResultPage(full(), textOptions({ toolName: "search_customers", position })));
            seen.push(...last.customers.map((customer: { id: number }) => customer.id));
            if (!isFakeToken(last.pageToken)) break;
            expect(last).not.toHaveProperty("nextPageToken");
            expect(last.hasMore).toBe(true);
            position = tokenPayload(last.pageToken).position;
        }
        expect(seen).toEqual(Array.from({ length: 300 }, (_, i) => i + 1));
        expect(last).toMatchObject({ nextPageToken: "upstream-2" });
        expect(last).not.toHaveProperty("pageToken");
        expect(last).not.toHaveProperty("pageSplit");
    });

    it("turns a split root array into an items object so the cursor has a place", async () => {
        const diagrams = Array.from({ length: 60 }, (_, i) => ({ _id: `d-${i + 1}`, blob: "x".repeat(4_000) }));
        const fitted = await fitResultPage(textResult(diagrams), textOptions({ toolName: "get_cloud_diagrams_stats" }));
        const page = parsed(fitted);
        expect(page.items.length).toBeLessThan(60);
        expect(page).toMatchObject({ rowCount: 60, pageToken: expect.stringMatching(/^dci1\./) });
        expect(tokenPayload(page.pageToken).position).toEqual({
            afterId: `d-${page.items.length}`,
            afterIndex: page.items.length - 1,
        });
        const rest = parsed(
            await fitResultPage(
                textResult(diagrams),
                textOptions({ toolName: "get_cloud_diagrams_stats", position: tokenPayload(page.pageToken).position })
            )
        );
        expect(rest.items[0]._id).toBe(`d-${page.items.length + 1}`);
        expect(rest).not.toHaveProperty("pageToken");
    });

    it("never splits analytics rows, detail objects, or error results", async () => {
        const rows = Array.from({ length: 3_000 }, (_, i) => [`service-${i}`, "x".repeat(60), i]);
        const query = textResult({ rowCount: rows.length, rows, columns: [] });
        await expect(fitResultPage(query, textOptions({ toolName: "run_query" }))).resolves.toBe(query);

        const detail = textResult({ id: "t-1", description: "x".repeat(MAX_TOOL_RESULT_CHARS), tags: ["a", "b"] });
        await expect(fitResultPage(detail, textOptions({ toolName: "get_ticket" }))).resolves.toBe(detail);

        const error = { isError: true, content: [{ type: "text", text: "x".repeat(MAX_TOOL_RESULT_CHARS) }] };
        await expect(fitResultPage(error, textOptions())).resolves.toBe(error);
    });

    it("walks id-less records through three or more parts without repeating a window", async () => {
        const values = Array.from({ length: 200 }, (_, i) => ({ value: `v-${i + 1}`, cloud: "gcp" }));
        const full = () => textResult({ id: "label", type: "label", values });
        const seen: string[] = [];
        let position: ContinuationPosition | undefined;
        let parts = 0;
        for (; parts < 20; parts += 1) {
            const page = parsed(
                await fitResultPage(full(), textOptions({ toolName: "list_values", position, budgetChars: 2_500 }))
            );
            seen.push(...page.values.map((record: { value: string }) => record.value));
            if (!isFakeToken(page.pageToken)) break;
            position = tokenPayload(page.pageToken).position;
        }
        expect(parts).toBeGreaterThanOrEqual(3);
        expect(seen).toEqual(values.map((record) => record.value));
    });

    it("never splits a result that fits the cap, even inside the headroom band", async () => {
        const diagrams = Array.from({ length: 30 }, (_, i) => ({ _id: `d-${i + 1}`, blob: "x".repeat(4_600) }));
        const result = textResult(diagrams);
        const size = measureToolResponse(result)?.serializedChars ?? 0;
        expect(size).toBeGreaterThan(RESULT_PAGE_BUDGET_CHARS);
        expect(size).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS);
        await expect(fitResultPage(result, textOptions({ toolName: "get_cloud_diagrams_stats" }))).resolves.toBe(
            result
        );
    });

    it("leaves an oversized result to the size guard when the tool cannot take a token back", async () => {
        const result = textResult({ rowCount: 40, tickets: tickets(40, 5_000) });
        await expect(fitResultPage(result, textOptions({ canContinue: false }))).resolves.toBe(result);
    });

    it("leaves the result to the size guard when not even one record fits", async () => {
        const result = textResult({ rowCount: 2, tickets: tickets(2, MAX_TOOL_RESULT_CHARS) });
        await expect(fitResultPage(result, textOptions())).resolves.toBe(result);
    });
});

describe("fitResultPage on converted (hosted) results", () => {
    const options = (overrides: Partial<Parameters<typeof fitResultPage>[1]> = {}) =>
        textOptions({ cursorField: "nextPageToken", ...overrides });

    it("splits items, keeps content as a mirror, and uses nextPageToken with hasMore", async () => {
        const result = structuredResult({
            items: tickets(40, 5_000),
            itemCount: 40,
            rowCount: 40,
            hasMore: true,
            nextPageToken: "upstream-next",
            _toolName: "list_tickets",
        });
        const fitted = await fitResultPage(result, options());
        const page = fitted.structuredContent as Record<string, any>;
        expect(page.items.length).toBeLessThan(40);
        expect(page).toMatchObject({
            itemCount: page.items.length,
            rowCount: 40,
            hasMore: true,
            nextPageToken: expect.stringMatching(/^dci1\./),
            _toolName: "list_tickets",
            pageSplit: { returnedRecords: page.items.length, remainingInResult: 40 - page.items.length },
        });
        expect(JSON.parse(fitted.content[0].text)).toEqual(page);
    });

    it("drops an upstream pageToken a converter left in place", async () => {
        const result = structuredResult({
            items: tickets(40, 5_000),
            hasMore: true,
            nextPageToken: "upstream-next",
            pageToken: "upstream-next",
        });
        const page = (await fitResultPage(result, options())).structuredContent as Record<string, any>;
        expect(page.nextPageToken).toMatch(/^dci1\./);
        expect(page).not.toHaveProperty("pageToken");
    });

    it("marks a completed continuation of a cursorless list with hasMore: false", async () => {
        const result = structuredResult({ items: tickets(5, 10), itemCount: 5 });
        const fitted = await fitResultPage(result, options({ position: { afterId: "3", afterIndex: 2 } }));
        expect(fitted.structuredContent).toMatchObject({ itemCount: 2, hasMore: false });
        expect((fitted.structuredContent as any).items.map((t: { id: number }) => t.id)).toEqual([4, 5]);
    });

    it("splits a record map keyed by id in key order", async () => {
        const scheme = Object.fromEntries(
            Array.from({ length: 60 }, (_, i) => [`diagram-${i + 1}`, { name: `d${i + 1}`, blob: "x".repeat(4_000) }])
        );
        const result = structuredResult({ scheme });
        const fitted = await fitResultPage(result, options({ toolName: "get_cloud_diagram_components" }));
        const keys = Object.keys((fitted.structuredContent as any).scheme);
        expect(keys.length).toBeGreaterThan(0);
        expect(keys.length).toBeLessThan(60);
        expect(keys).toEqual(Object.keys(scheme).slice(0, keys.length));
        const token = (fitted.structuredContent as any).nextPageToken;
        expect(tokenPayload(token).position).toEqual({ afterKey: keys[keys.length - 1], afterIndex: keys.length - 1 });
        const rest = await fitResultPage(
            result,
            options({ toolName: "get_cloud_diagram_components", position: tokenPayload(token).position })
        );
        expect(Object.keys((rest.structuredContent as any).scheme)[0]).toBe(`diagram-${keys.length + 1}`);

        // The anchor diagram was deleted between parts: the map resumes by index instead of restarting.
        const { [keys[keys.length - 1]]: _gone, ...remaining } = scheme;
        const afterDeletion = await fitResultPage(
            structuredResult({ scheme: remaining }),
            options({ toolName: "get_cloud_diagram_components", position: tokenPayload(token).position })
        );
        expect(Object.keys((afterDeletion.structuredContent as any).scheme)[0]).toBe(`diagram-${keys.length + 1}`);
    });

    it("does not mark a continued list complete while it still carries an upstream cursor", async () => {
        const result = structuredResult({ things: tickets(5, 10), pageToken: "upstream-next" });
        const fitted = await fitResultPage(result, options({ position: { afterId: "3", afterIndex: 2 } }));
        expect(fitted.structuredContent).toMatchObject({ pageToken: "upstream-next" });
        expect(fitted.structuredContent).not.toHaveProperty("hasMore");
        expect((fitted.structuredContent as any).things.map((t: { id: number }) => t.id)).toEqual([4, 5]);
    });
});

describe("positions", () => {
    const records = [{ id: "a" }, { id: "b" }, { id: "c" }, { noId: true }];
    const found = findCollection({ items: records });
    if (!found) throw new Error("expected a collection");
    const collection = found;

    it("resumes at the index, never past it, when the anchor record was deleted", () => {
        const stale = { afterId: "b", afterIndex: 1 };
        const withoutB = { key: "items", kind: "array" as const, records: [{ id: "a" }, { id: "c" }, { id: "d" }] };
        const resumed = applyPosition(withoutB, stale);
        expect(resumed.kind === "array" && resumed.records.map((r: any) => r.id)).toEqual(["c", "d"]);
    });

    it("resumes after a record by id, and by index when the id is gone", () => {
        expect(applyPosition(collection, { afterId: "b", afterIndex: 1 })).toMatchObject({
            records: [{ id: "c" }, { noId: true }],
        });
        // A missing anchor resumes at its index (it was probably deleted), not past it.
        expect(applyPosition(collection, { afterId: "missing", afterIndex: 2 })).toMatchObject({
            records: [{ id: "c" }, { noId: true }],
        });
        expect(applyPosition(collection, { afterIndex: 3 })).toMatchObject({ records: [] });
    });

    it("describes the last returned record by id when it has one", () => {
        expect(positionAfter(collection, 2)).toEqual({ afterId: "b", afterIndex: 1 });
        expect(positionAfter(collection, 4)).toEqual({ afterIndex: 3 });
    });

    it("picks the array that makes up most of the result and ignores tabular keys", () => {
        expect(findCollection({ rowCount: 3, rows: [[1], [2], [3]], columns: [] })).toBeUndefined();
        expect(findCollection({ id: 1, tags: ["a"], description: "x".repeat(500) })).toBeUndefined();
        const users = Array.from({ length: 20 }, (_, i) => ({ id: i, email: `user-${i}@example.com` }));
        expect(findCollection({ users, rowCount: 20, pageToken: "" })).toMatchObject({ key: "users", kind: "array" });
        expect(findCollection([{ id: 1 }])).toMatchObject({ key: null, kind: "array" });
    });
});

describe("resolvePagedCall", () => {
    const paging = { secret: "s", scope: null };
    const inAnHour = Math.floor(Date.now() / 1000) + 3600;
    const stored: ContinuationDraft = {
        tool: "list_tickets",
        args: { pageSize: 5 },
        upstream: "page-2",
        position: { afterIndex: 3 },
    };
    const errorText = (resolved: unknown) => (resolved as any).error.content[0].text;

    it("passes an upstream cursor through for tools whose endpoint pages", async () => {
        await expect(
            resolvePagedCall("list_tickets", { pageToken: "abc", pageSize: 5 }, true, paging)
        ).resolves.toEqual({
            args: { pageToken: "abc", pageSize: 5 },
            originalArgs: { pageSize: 5 },
            upstreamPageToken: "abc",
        });
        await expect(resolvePagedCall("list_tickets", { pageSize: 5 }, true, paging)).resolves.toEqual({
            args: { pageSize: 5 },
            originalArgs: { pageSize: 5 },
        });
    });

    it("rejects a foreign pageToken on a tool whose endpoint cannot page", async () => {
        const resolved = await resolvePagedCall("get_cloud_diagrams_stats", { pageToken: "abc" }, false, paging);
        expect(resolved).toMatchObject({ error: { isError: true } });
        expect((resolved as any).error.content[0].text).toBe(FOREIGN_PAGE_TOKEN_MESSAGE);
    });

    it("unpacks a continuation token into the stored call and rejects tokens for other tools", async () => {
        const token = await signContinuation({ v: 2, ...stored, exp: inAnHour, scope: null }, paging.secret);
        await expect(
            resolvePagedCall("list_tickets", { pageToken: token, pageSize: 99 }, true, paging)
        ).resolves.toEqual({
            args: { pageSize: 5, pageToken: "page-2" },
            originalArgs: { pageSize: 5 },
            upstreamPageToken: "page-2",
            position: { afterIndex: 3 },
        });
        const crossed = await resolvePagedCall("list_reports", { pageToken: token }, true, paging);
        expect((crossed as any).error.content[0].text).toBe(INVALID_CONTINUATION_MESSAGE);
        const tampered = await resolvePagedCall("list_tickets", { pageToken: `${token}x` }, true, paging);
        expect((tampered as any).error.content[0].text).toBe(INVALID_CONTINUATION_MESSAGE);
    });

    it("refuses an expired token", async () => {
        const token = await signContinuation(
            { v: 2, ...stored, exp: Math.floor(Date.now() / 1000) - 1, scope: null },
            paging.secret
        );
        expect(errorText(await resolvePagedCall("list_tickets", { pageToken: token }, true, paging))).toBe(
            EXPIRED_CONTINUATION_MESSAGE
        );
    });

    it("honours a token only under the scope it was issued for", async () => {
        const issued = { ...paging, scope: "user-1\ncustomer-a" };
        const token = await continuationSigner(issued)(stored);
        await expect(resolvePagedCall("list_tickets", { pageToken: token }, true, issued)).resolves.toMatchObject({
            position: { afterIndex: 3 },
        });
        for (const other of [
            { ...paging, scope: "user-1\ncustomer-b" },
            { ...paging, scope: "user-2\ncustomer-a" },
            paging,
        ]) {
            expect(errorText(await resolvePagedCall("list_tickets", { pageToken: token }, true, other))).toBe(
                CONTINUATION_SCOPE_MESSAGE
            );
        }
        // An unscoped token is not accepted by a scoped consumer either.
        const unscoped = await continuationSigner(paging)(stored);
        expect(errorText(await resolvePagedCall("list_tickets", { pageToken: unscoped }, true, issued))).toBe(
            CONTINUATION_SCOPE_MESSAGE
        );
    });

    it("treats an undefined or empty scope as a configuration error, not as unscoped", async () => {
        const token = await continuationSigner(paging)(stored);
        for (const broken of [{ secret: "s" }, { secret: "s", scope: undefined }, { secret: "s", scope: "" }]) {
            const options = broken as unknown as typeof paging;
            expect(() => assertResultPagingScope(options), JSON.stringify(broken)).toThrow(MISSING_SCOPE_MESSAGE);
            await expect(continuationSigner(options)(stored)).rejects.toThrow(MISSING_SCOPE_MESSAGE);
            await expect(resolvePagedCall("list_tickets", { pageToken: token }, true, options)).rejects.toThrow(
                MISSING_SCOPE_MESSAGE
            );
        }
        expect(() => assertResultPagingScope(paging)).not.toThrow();
    });

    it("signs the digest of the scope and the configured lifetime, never the scope itself", async () => {
        const token = await continuationSigner({ ...paging, scope: "user-1\ncustomer-a", ttlSeconds: 120 })(stored);
        const body = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        expect(body).toMatchObject({ v: 2, tool: "list_tickets", scope: await hashScope("user-1\ncustomer-a") });
        expect(token).not.toContain("customer-a");
        expect(body.exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(110);
        expect(body.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(120);
    });
});

describe("schema augmentation", () => {
    const readOnly = {
        name: "list_things",
        resultPaged: true,
        annotations: { readOnlyHint: true },
        inputSchema: { type: "object", properties: { filter: { type: "string" } } },
    };

    it("adds pageToken only to opted-in read-only tools that have none", () => {
        expect(needsResultPageToken(readOnly)).toBe(true);
        expect(needsResultPageToken({ ...readOnly, resultPaged: false })).toBe(false);
        expect(needsResultPageToken({ ...readOnly, annotations: { readOnlyHint: false } })).toBe(false);
        expect(
            needsResultPageToken({ ...readOnly, inputSchema: { type: "object", properties: { pageToken: {} } } })
        ).toBe(false);
        expect(needsResultPageToken({ ...readOnly, inputSchema: { oneOf: [] } })).toBe(false);
        const augmented = withResultPageTokenInputSchema(readOnly);
        expect((augmented.inputSchema as any).properties.pageToken.description).toContain("Continuation token");
        expect((augmented.inputSchema as any).properties.filter).toEqual({ type: "string" });
        expect(readOnly.inputSchema.properties).not.toHaveProperty("pageToken");
    });

    it("extends zod object schemas and leaves others alone", () => {
        const schema = withResultPageToken(z.object({ filter: z.string().optional() }));
        expect(schema.shape).toHaveProperty("pageToken");
        expect(schema.parse({ filter: "a", pageToken: "dci1.x" })).toEqual({ filter: "a", pageToken: "dci1.x" });
        const union = z.discriminatedUnion("kind", [z.object({ kind: z.literal("a") })]);
        expect(withResultPageToken(union)).toBe(union);
        const native = z.object({ pageToken: z.string() });
        expect(withResultPageToken(native)).toBe(native);
    });
});
