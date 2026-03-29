/**
 * Fields to strip from all responses.
 * Guideline: "Do not include diagnostic, telemetry, or internal identifiers—such as
 * session IDs, trace IDs, request IDs, timestamps, or logging metadata—unless they are
 * strictly required to fulfill the user's query."
 * Also: never include access credentials or authentication secrets.
 */
const STRIP_PATTERNS = [
    // Internal identifier prefixes
    /^_trace/i,
    /^_request/i,
    /^x-/i,
    // Identifier types (exact forms and variants)
    /session[_-]?id/i,
    /trace[_-]?id/i,
    /request[_-]?id/i,
    /correlation[_-]?id/i,
    // Diagnostic timing / logging metadata
    /^requestTime/i,
    /^responseTime/i,
    /^serverTime/i,
    /^processingTime/i,
    /^latency/i,
    /^_ts$/i,
    // Credentials and secrets — must never appear in tool responses
    /password/i,
    /^secret/i,
    /api[_-]?key/i,
];

/**
 * Deep-sanitize a plain object, stripping banned keys and cleaning URL strings.
 * Arrays nested inside the object are sanitized element-by-element.
 */
export function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (STRIP_PATTERNS.some((p) => p.test(key))) continue;
        cleaned[key] = sanitizeValue(value);
    }
    return cleaned;
}

/**
 * Recursively sanitize any value (object, array, or primitive).
 */
function sanitizeValue(value: unknown): unknown {
    if (typeof value === "string" && value.includes("mcp=true")) {
        return value.replace(/[?&]mcp=true/g, "").replace(/[?&]sse=true/g, "");
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item));
    }
    if (value && typeof value === "object") {
        return sanitize(value as Record<string, unknown>);
    }
    return value;
}

/**
 * Extract the actual business data from an MCP tool result wrapper.
 *
 * Tool handlers return: { content: [{ type: "text", text: "...JSON..." }] }
 * This unwraps to the parsed JSON so summarize/narrate can work with real data.
 * Error responses ({ isError: true }) are returned as-is.
 */
function unwrapMcpResult(raw: unknown): unknown {
    if (Array.isArray(raw) || !raw || typeof raw !== "object") return raw;
    const resp = raw as Record<string, unknown>;
    if (resp.isError) return raw; // pass error responses through unchanged
    const contentArr = resp.content;
    if (!Array.isArray(contentArr) || contentArr.length === 0) return raw;
    const first = contentArr[0] as Record<string, unknown>;
    if (first?.type !== "text" || typeof first.text !== "string") return raw;
    try {
        return JSON.parse(first.text);
    } catch {
        return first.text; // plain-text response
    }
}

/**
 * Summarize data into concise structuredContent.
 *
 * Handles four response shapes from the DoiT API:
 *  1. Raw arrays: [{ ... }, ...]
 *  2. Analytics query: { rowCount, rows, columns }
 *  3. Paginated list: { [collectionKey]: [...], pageToken?, rowCount? }
 *  4. Single item or opaque object: returned as-is
 */
export function summarize(toolName: string, data: unknown): Record<string, unknown> {
    if (Array.isArray(data)) {
        return { totalCount: data.length, items: data.slice(0, 10) };
    }
    if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;

        // Analytics query result: { rowCount, rows, columns }
        if ("rowCount" in d && "rows" in d) {
            return {
                rowCount: d.rowCount,
                rows: (d.rows as unknown[])?.slice(0, 10),
                columns: d.columns,
            };
        }

        // Paginated DoiT list response: { [collectionKey]: [...], pageToken?, rowCount? }
        // Find the first array-valued property that is not "pageToken"
        const arrayKey = Object.keys(d).find((k) => k !== "pageToken" && Array.isArray(d[k]));
        if (arrayKey) {
            const items = d[arrayKey] as unknown[];
            return {
                totalCount: typeof d.rowCount === "number" ? d.rowCount : items.length,
                items: items.slice(0, 10),
                hasMore: !!d.pageToken,
                nextPageToken: d.pageToken ?? undefined,
            };
        }
    }
    return (data as Record<string, unknown>) ?? {};
}

/**
 * Generate human-readable narration. Includes pagination hint when results are truncated.
 */
export function narrate(toolName: string, data: unknown): string {
    const summary = summarize(toolName, data);
    const count = (summary.totalCount ?? summary.rowCount ?? 1) as number;
    const hasMore = (summary.hasMore as boolean | undefined) ?? false;
    const shown = Math.min(count, (summary.items as unknown[] | undefined)?.length ?? count);
    const moreHint = hasMore || shown < count ? ` Showing first ${shown}; use pageToken to retrieve more.` : "";

    if (toolName === "run_query") {
        const rowCount = (summary.rowCount as number) ?? 0;
        const rowShown = Math.min(rowCount, ((summary.rows as unknown[]) ?? []).length);
        const rowHint = rowShown < rowCount ? ` Showing first ${rowShown}; use pageToken to retrieve more.` : "";
        return `Analytics query returned ${rowCount} rows.${rowHint}`;
    }
    if (toolName === "get_anomalies") return `Found ${count} cost anomalies.${moreHint}`;
    if (toolName === "list_budgets") return `Found ${count} budgets.${moreHint}`;
    if (toolName === "list_invoices") return `Found ${count} invoices.${moreHint}`;
    if (toolName === "list_tickets") return `Found ${count} support tickets.${moreHint}`;
    if (toolName === "get_cloud_incidents") return `Found ${count} cloud platform incidents.${moreHint}`;
    if (toolName === "validate_user") return `User validated successfully.`;
    if (toolName.startsWith("create_")) return `Successfully created ${toolName.replace("create_", "")}.`;
    if (toolName.startsWith("update_")) return `Successfully updated ${toolName.replace("update_", "")}.`;
    if (toolName.startsWith("list_")) return `Found ${count} ${toolName.replace("list_", "")}.${moreHint}`;
    return `Operation completed.`;
}

const WIDGET_URI = "ui://doit/cloud-intelligence-v1.html";

/**
 * Main adapter. Wraps a raw tool result into the Apps SDK three-field format.
 *
 * - structuredContent: machine-readable summary (first 10 items for lists)
 * - content:           human-readable narration with pagination hints
 * - _meta:             protocol metadata; includes "ui/resourceUri" to trigger widget iframe
 */
export function adaptToolResponse(toolName: string, rawResponse: unknown) {
    // Unwrap the MCP tool result wrapper before sanitizing
    const data = unwrapMcpResult(rawResponse);
    const cleaned = Array.isArray(data) ? (sanitizeValue(data) as unknown[]) : sanitizeValue(data);
    return {
        structuredContent: summarize(toolName, cleaned),
        content: [{ type: "text" as const, text: narrate(toolName, cleaned) }],
        _meta: {
            toolName,
            "ui/resourceUri": WIDGET_URI,
        },
    };
}
