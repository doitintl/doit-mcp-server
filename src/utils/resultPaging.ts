// Splits results that exceed the MCP result size limit across tool calls. The next call refetches
// the same upstream page, resumes after the last returned record, and only exposes the upstream
// cursor once the page is done, so no record is skipped or repeated.
import { z } from "zod";
import {
    type ContinuationPayload,
    type ContinuationPosition,
    isContinuationToken,
    signContinuation,
    verifyContinuation,
} from "./continuation.js";
import { MAX_TOOL_RESULT_CHARS, measureToolResponse } from "./responseLimit.js";
import { createErrorResponse } from "./util.js";

export const RESULT_PAGE_TOKEN_DESCRIPTION =
    "Continuation token from a previous result of this tool that was split for size. Omit to start from the first record.";

export const RESULT_PAGE_TOKEN_SCHEMA = z.string().optional().describe(RESULT_PAGE_TOKEN_DESCRIPTION);

export const RESULT_PAGE_HEADROOM_CHARS = 2_000;
export const RESULT_PAGE_BUDGET_CHARS = MAX_TOOL_RESULT_CHARS - RESULT_PAGE_HEADROOM_CHARS;

export const INVALID_CONTINUATION_MESSAGE =
    "Invalid continuation pageToken: it was not issued by this server for this tool, or it was altered. Call the tool again without pageToken to start from the first record.";
export const FOREIGN_PAGE_TOKEN_MESSAGE =
    "This tool's endpoint has no paging of its own: pageToken must be a continuation token from a previous result of this tool. Call it without pageToken to start from the first record.";

type ToolLike = {
    name: string;
    annotations?: { readOnlyHint?: boolean };
    inputSchema?: Record<string, unknown>;
    resultPaged?: boolean;
};

function inputProperties(tool: ToolLike): Record<string, unknown> | undefined {
    const properties = (tool.inputSchema as { properties?: unknown } | undefined)?.properties;
    return properties && typeof properties === "object" ? (properties as Record<string, unknown>) : undefined;
}

/**
 * Tools that opted in with `resultPaged: true`. Paging is opt-in because only read-only list
 * tools can use it: a single-resource result has nothing to split, and a non-idempotent read
 * (ask_ava_sync) must not be re-run. The flag is ignored on tools that already page upstream.
 */
export function needsResultPageToken(tool: ToolLike): boolean {
    if (tool.resultPaged !== true || tool.annotations?.readOnlyHint !== true) return false;
    const properties = inputProperties(tool);
    return properties !== undefined && !("pageToken" in properties);
}

export function withResultPageToken<T>(schema: T): T {
    const object = schema as { shape?: Record<string, unknown>; extend?: (shape: Record<string, unknown>) => T };
    if (!object?.shape || typeof object.extend !== "function" || "pageToken" in object.shape) return schema;
    return object.extend({ pageToken: RESULT_PAGE_TOKEN_SCHEMA });
}

export function withResultPageTokenInputSchema<T extends ToolLike>(tool: T): T {
    if (!needsResultPageToken(tool)) return tool;
    const inputSchema = tool.inputSchema as Record<string, unknown>;
    return {
        ...tool,
        inputSchema: {
            ...inputSchema,
            properties: {
                ...(inputSchema.properties as Record<string, unknown>),
                pageToken: { type: "string", description: RESULT_PAGE_TOKEN_DESCRIPTION },
            },
        },
    };
}

export type ResultPagingOptions = {
    secret: string;
    /** `nextPageToken` (with `hasMore`) for a consumer that normalises list results. */
    cursorField?: "pageToken" | "nextPageToken";
};

export type ResolvedPagedCall = {
    args: Record<string, unknown>;
    originalArgs: Record<string, unknown>;
    upstreamPageToken?: string;
    position?: ContinuationPosition;
};

/**
 * Passes an upstream cursor through, or unpacks a continuation token into the call it continues.
 * The token's stored arguments replace the caller's, so the page is refetched with the same filters.
 */
export async function resolvePagedCall(
    toolName: string,
    args: Record<string, unknown>,
    acceptsUpstreamCursor: boolean,
    options: ResultPagingOptions
): Promise<ResolvedPagedCall | { error: ReturnType<typeof createErrorResponse> }> {
    const { pageToken, ...originalArgs } = args;
    if (pageToken === undefined || pageToken === null || pageToken === "") {
        return { args: originalArgs, originalArgs };
    }
    if (!isContinuationToken(pageToken)) {
        if (!acceptsUpstreamCursor) return { error: createErrorResponse(FOREIGN_PAGE_TOKEN_MESSAGE) };
        return { args, originalArgs, upstreamPageToken: typeof pageToken === "string" ? pageToken : undefined };
    }
    const payload = await verifyContinuation(pageToken, options.secret);
    if (!payload || payload.tool !== toolName) return { error: createErrorResponse(INVALID_CONTINUATION_MESSAGE) };
    return {
        args: payload.upstream ? { ...payload.args, pageToken: payload.upstream } : payload.args,
        originalArgs: payload.args,
        upstreamPageToken: payload.upstream ?? undefined,
        position: payload.position,
    };
}

type ToolResult = {
    content?: Array<{ type: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
    [key: string]: unknown;
};

type Located = { mode: "structured" | "text"; data: unknown };

function locateData(result: ToolResult): Located | undefined {
    if (!result || typeof result !== "object" || result.isError) return undefined;
    if (result.structuredContent && typeof result.structuredContent === "object") {
        return { mode: "structured", data: result.structuredContent };
    }
    const content = result.content;
    if (!Array.isArray(content) || content.length !== 1 || content[0]?.type !== "text") return undefined;
    try {
        return { mode: "text", data: JSON.parse(content[0].text ?? "") };
    } catch {
        return undefined;
    }
}

function rebuild(result: ToolResult, mode: Located["mode"], data: unknown): ToolResult {
    const text = JSON.stringify(data);
    return mode === "structured"
        ? { ...result, structuredContent: data as Record<string, unknown>, content: [{ type: "text", text }] }
        : { ...result, content: [{ type: "text", text }] };
}

/** Analytics results are never split: a partial chart is not a usable result. */
const EXCLUDED_ARRAY_KEYS = new Set(["rows", "columns", "schema"]);
/** Record maps keyed by id (cloud-diagram stats return `scheme`). */
const MAP_COLLECTION_KEYS = new Set(["scheme"]);
/** Upstream cursor fields a split part must not carry alongside the continuation token. */
const CURSOR_FIELDS = ["pageToken", "nextPageToken"] as const;
/** A top-level array is only treated as the record list when it is most of the result. */
const MIN_COLLECTION_SHARE = 0.5;

type Collection =
    | { key: string | null; kind: "array"; records: unknown[] }
    | { key: string; kind: "map"; entries: Array<[string, unknown]> };

export function findCollection(data: unknown): Collection | undefined {
    if (Array.isArray(data)) return { key: null, kind: "array", records: data };
    if (!data || typeof data !== "object") return undefined;
    const object = data as Record<string, unknown>;
    const total = JSON.stringify(object).length;
    let best: { key: string; records: unknown[]; size: number } | undefined;
    for (const [key, value] of Object.entries(object)) {
        if (!Array.isArray(value) || value.length === 0 || EXCLUDED_ARRAY_KEYS.has(key)) continue;
        const size = JSON.stringify(value).length;
        if (size / total >= MIN_COLLECTION_SHARE && (!best || size > best.size)) best = { key, records: value, size };
    }
    if (best) return { key: best.key, kind: "array", records: best.records };
    for (const key of MAP_COLLECTION_KEYS) {
        const value = object[key];
        if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0) {
            return { key, kind: "map", entries: Object.entries(value as Record<string, unknown>) };
        }
    }
    return undefined;
}

export function recordId(record: unknown): string | undefined {
    if (!record || typeof record !== "object") return undefined;
    const candidate = (record as { id?: unknown; _id?: unknown }).id ?? (record as { _id?: unknown })._id;
    return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : undefined;
}

function length(collection: Collection): number {
    return collection.kind === "array" ? collection.records.length : collection.entries.length;
}

function slice(collection: Collection, start: number, end?: number): Collection {
    return collection.kind === "array"
        ? { ...collection, records: collection.records.slice(start, end) }
        : { ...collection, entries: collection.entries.slice(start, end) };
}

export function applyPosition(collection: Collection, position: ContinuationPosition): Collection {
    const anchor = collection.kind === "map" ? position.afterKey : position.afterId;
    if (anchor !== undefined) {
        const index =
            collection.kind === "map"
                ? collection.entries.findIndex(([key]) => key === anchor)
                : collection.records.findIndex((record) => recordId(record) === anchor);
        if (index >= 0) return slice(collection, index + 1);
    }
    if (position.afterIndex === undefined || position.afterIndex < 0) return collection;
    // Records without ids resume after the index. A named anchor that is gone was most likely
    // deleted, so resume at its index: that repeats at most one record and never skips one.
    return slice(collection, anchor === undefined ? position.afterIndex + 1 : position.afterIndex);
}

/**
 * The position of the last of `count` records. `skipped` is how many records of the full
 * upstream page precede `collection`, so afterIndex stays absolute across continuations.
 */
export function positionAfter(collection: Collection, count: number, skipped = 0): ContinuationPosition {
    const afterIndex = skipped + count - 1;
    if (collection.kind === "map") return { afterKey: collection.entries[count - 1]?.[0], afterIndex };
    const id = recordId(collection.records[count - 1]);
    return id === undefined ? { afterIndex } : { afterId: id, afterIndex };
}

/** A root array becomes `{ items, rowCount }` so the cursor and split marker have somewhere to live. */
function withCollection(
    data: unknown,
    collection: Collection,
    extra: Record<string, unknown>
): Record<string, unknown> {
    const value = collection.kind === "array" ? collection.records : Object.fromEntries(collection.entries);
    if (collection.key === null) {
        return { items: value, rowCount: (data as unknown[]).length, ...extra };
    }
    const next: Record<string, unknown> = { ...(data as Record<string, unknown>), [collection.key]: value, ...extra };
    if (collection.kind === "array" && "itemCount" in next) next.itemCount = collection.records.length;
    return next;
}

export type FitOptions = {
    toolName: string;
    originalArgs: Record<string, unknown>;
    upstreamPageToken?: string;
    position?: ContinuationPosition;
    canContinue: boolean;
    cursorField: NonNullable<ResultPagingOptions["cursorField"]>;
    sign: (payload: ContinuationPayload) => Promise<string>;
    budgetChars?: number;
};

/**
 * Applies a continuation position, then splits the result if it exceeds the budget. Anything
 * without a record collection is returned as is, so the size guard still decides it.
 */
export async function fitResultPage<T extends ToolResult>(result: T, options: FitOptions): Promise<T> {
    const located = locateData(result);
    if (!located) return result;
    let collection = findCollection(located.data);
    if (!collection) return result;

    const { mode } = located;
    let data = located.data;
    let current: ToolResult = result;
    let skipped = 0;
    if (options.position) {
        const full = length(collection);
        collection = applyPosition(collection, options.position);
        skipped = full - length(collection);
        // A continued page that reaches its end is complete, unless the data still carries an
        // upstream cursor to the next API page. A further split overrides this.
        const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        const upstreamCursor = CURSOR_FIELDS.some((field) => typeof record[field] === "string" && record[field] !== "");
        const completion =
            options.cursorField === "nextPageToken" && !("hasMore" in record) && !upstreamCursor
                ? { hasMore: false }
                : {};
        data = withCollection(data, collection, completion);
        if (collection.key === null) collection = { ...collection, key: "items" };
        current = rebuild(result, mode, data);
    }

    // Results that fit the cap are never split; parts leave headroom for the transport envelope.
    const limit = options.budgetChars ?? MAX_TOOL_RESULT_CHARS;
    const budget = options.budgetChars ?? RESULT_PAGE_BUDGET_CHARS;
    const size = measureToolResponse(current)?.serializedChars ?? Number.POSITIVE_INFINITY;
    if (size <= limit || !options.canContinue) return current as T;

    const total = length(collection);
    const candidate = async (count: number): Promise<ToolResult> => {
        const token = await options.sign({
            v: 1,
            tool: options.toolName,
            args: options.originalArgs,
            upstream: options.upstreamPageToken ?? null,
            position: positionAfter(collection, count, skipped),
        });
        const split = withCollection(data, slice(collection, 0, count), {
            [options.cursorField]: token,
            pageSplit: { returnedRecords: count, remainingInResult: total - count },
        });
        // The token must be the only cursor: following an upstream one would skip the rest of this page.
        for (const field of CURSOR_FIELDS) if (field !== options.cursorField) delete split[field];
        if (options.cursorField === "nextPageToken" || "hasMore" in split) split.hasMore = true;
        return rebuild(current, mode, split);
    };

    // Size grows with the prefix length, so binary-search the largest prefix that fits.
    let low = 1;
    let high = total - 1;
    let best: ToolResult | undefined;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const attempt = await candidate(mid);
        if ((measureToolResponse(attempt)?.serializedChars ?? Number.POSITIVE_INFINITY) <= budget) {
            best = attempt;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    // Not even one record fits: leave the result to the size guard and its hint.
    return (best ?? current) as T;
}

export function continuationSigner(options: ResultPagingOptions): FitOptions["sign"] {
    return (payload) => signContinuation(payload, options.secret);
}
