// Server-side paging for results that exceed the MCP result size limit.
//
// Upstream pages are kept whole when they fit. When one does not, a size error loses the page
// and cutting it silently loses records. Instead the server returns the records that fit, marks
// the split, and issues a signed continuation token (continuation.ts). The next call fetches the
// same upstream page again, resumes after the last returned record, and only exposes the
// upstream's own next cursor once the page is done, so no record is skipped or repeated.
// Analytics results (`rows`) are never split: a partial chart is not a usable result, so they
// keep the size error and its narrowing hint.
//
// Both transports share this code through executeToolHandler (toolsHandler.ts): stdio results
// carry their data in `content[0].text`; a consumer that converts results for a widget carries it
// in `structuredContent` with `content[0].text` as a mirror. Each tool call has its own size
// limit, so paging across calls is sound; callers decide how many pages they need.
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
    "Continuation token from a previous result of this tool whose pageToken (or nextPageToken) was set because the complete result was larger than one MCP tool result can carry. The server returned the records that fit; this token continues after the last of them. Omit it to start from the first record.";

/** The argument added to read-only tools whose endpoints return everything in one response. */
export const RESULT_PAGE_TOKEN_SCHEMA = z.string().optional().describe(RESULT_PAGE_TOKEN_DESCRIPTION);

/** Space left under the size guard for the transport envelope. */
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
};

function inputProperties(tool: ToolLike): Record<string, unknown> | undefined {
    const properties = (tool.inputSchema as { properties?: unknown } | undefined)?.properties;
    return properties && typeof properties === "object" ? (properties as Record<string, unknown>) : undefined;
}

/**
 * Read-only tools whose own arguments have no pageToken: their endpoint returns every record
 * at once, so server-side paging is the only way through a large result. Tools whose input is
 * not a plain object schema (discriminated unions) are left alone.
 */
export function needsResultPageToken(tool: ToolLike): boolean {
    if (tool.annotations?.readOnlyHint !== true) return false;
    const properties = inputProperties(tool);
    return properties !== undefined && !("pageToken" in properties);
}

/** Adds the continuation argument to a zod object schema that lacks pageToken. */
export function withResultPageToken<T>(schema: T): T {
    const object = schema as { shape?: Record<string, unknown>; extend?: (shape: Record<string, unknown>) => T };
    if (!object?.shape || typeof object.extend !== "function" || "pageToken" in object.shape) return schema;
    return object.extend({ pageToken: RESULT_PAGE_TOKEN_SCHEMA });
}

/** The tool definition with the continuation argument in its JSON input schema, when it needs one. */
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

/** Transport-supplied settings for result paging. */
export type ResultPagingOptions = {
    /** Signs continuation tokens. stdio uses a random per-process secret; a hosted consumer its own. */
    secret: string;
    /**
     * The field that carries the cursor in this transport's results: `pageToken` for raw tool
     * output, `nextPageToken` (with `hasMore`) for a consumer that normalises list results.
     */
    cursorField?: "pageToken" | "nextPageToken";
};

export type ResolvedPagedCall = {
    /** Arguments dispatched to the tool; a continuation token is replaced by the upstream cursor it wraps. */
    args: Record<string, unknown>;
    /** The caller's arguments without any pageToken, carried in the next continuation token. */
    originalArgs: Record<string, unknown>;
    upstreamPageToken?: string;
    position?: ContinuationPosition;
};

/**
 * A pageToken is either the upstream API's cursor, passed through, or a continuation token,
 * which is verified and unpacked into the call it continues. The token's stored arguments
 * replace the caller's, so the continued page is fetched with the same filters and cursor that
 * produced its first part.
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

// ── Locating the record collection ─────────────────────────────────────────────────────────

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

/** Analytics and tabular shapes: a partial chart is not a result. */
const EXCLUDED_ARRAY_KEYS = new Set(["rows", "columns", "schema"]);
/** Record maps keyed by id (cloud-diagram discovery returns `scheme`). */
const MAP_COLLECTION_KEYS = new Set(["scheme"]);
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

/** Drops every record up to and including the one the previous result stopped at. */
export function applyPosition(collection: Collection, position: ContinuationPosition): Collection {
    if (collection.kind === "map") {
        if (position.afterKey === undefined) return collection;
        const index = collection.entries.findIndex(([key]) => key === position.afterKey);
        return index >= 0 ? slice(collection, index + 1) : collection;
    }
    if (position.afterId !== undefined) {
        const index = collection.records.findIndex((record) => recordId(record) === position.afterId);
        if (index >= 0) return slice(collection, index + 1);
    }
    if (position.afterIndex !== undefined && position.afterIndex >= 0) {
        return slice(collection, position.afterIndex + 1);
    }
    return collection;
}

/** The position of the last of `count` returned records, for the next token. */
export function positionAfter(collection: Collection, count: number): ContinuationPosition {
    if (collection.kind === "map") return { afterKey: collection.entries[count - 1]?.[0] };
    const last = collection.records[count - 1];
    const id = recordId(last);
    return id === undefined ? { afterIndex: count - 1 } : { afterId: id, afterIndex: count - 1 };
}

/**
 * The data with the collection replaced. A root array becomes `{ items, rowCount }` so the
 * cursor and split marker have somewhere to live; everything else keeps its shape.
 */
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
    /** Whether the tool can receive a continuation token back; otherwise the result is left alone. */
    canContinue: boolean;
    cursorField: NonNullable<ResultPagingOptions["cursorField"]>;
    sign: (payload: ContinuationPayload) => Promise<string>;
    budgetChars?: number;
};

/**
 * Applies a continuation position and splits the result when it exceeds the budget. Results
 * without a record collection, error results, and results that fit are returned as they are
 * (after position slicing), so the size guard still decides every other case.
 */
export async function fitResultPage<T extends ToolResult>(result: T, options: FitOptions): Promise<T> {
    const located = locateData(result);
    if (!located) return result;
    let collection = findCollection(located.data);
    if (!collection) return result;

    const { mode } = located;
    let data = located.data;
    let current: ToolResult = result;
    if (options.position) {
        collection = applyPosition(collection, options.position);
        // A continued page that reaches its end is complete; results with no hasMore of their
        // own say so explicitly when this transport uses it. A further split overrides this.
        const completion =
            options.cursorField === "nextPageToken" && !(data && typeof data === "object" && "hasMore" in data)
                ? { hasMore: false }
                : {};
        data = withCollection(data, collection, completion);
        // A root array has become { items, rowCount }; further slicing addresses it by key.
        if (collection.key === null) collection = { ...collection, key: "items" };
        current = rebuild(result, mode, data);
    }

    const budget = options.budgetChars ?? RESULT_PAGE_BUDGET_CHARS;
    const size = measureToolResponse(current)?.serializedChars ?? Number.POSITIVE_INFINITY;
    if (size <= budget || !options.canContinue) return current as T;

    const total = length(collection);
    const candidate = async (count: number): Promise<ToolResult> => {
        const token = await options.sign({
            v: 1,
            tool: options.toolName,
            args: options.originalArgs,
            upstream: options.upstreamPageToken ?? null,
            position: positionAfter(collection, count),
        });
        const split = withCollection(data, slice(collection, 0, count), {
            [options.cursorField]: token,
            ...(options.cursorField === "nextPageToken" ? { hasMore: true } : {}),
            // Stated as data, not as a response rule: the complete result was larger than one tool result.
            pageSplit: { returnedRecords: count, remainingInResult: total - count },
        });
        return rebuild(current, mode, split);
    };

    // Largest prefix that fits. Sizes grow with the prefix length, so binary search.
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
