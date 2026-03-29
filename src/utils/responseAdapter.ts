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

export function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (STRIP_PATTERNS.some((p) => p.test(key))) continue;
        if (typeof value === "string" && value.includes("mcp=true")) {
            cleaned[key] = value.replace(/[?&]mcp=true/g, "").replace(/[?&]sse=true/g, "");
        } else if (value && typeof value === "object" && !Array.isArray(value)) {
            cleaned[key] = sanitize(value as Record<string, unknown>);
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

/**
 * Summarize raw data into concise structuredContent.
 * Keep small — visible to model, counts toward context.
 */
export function summarize(toolName: string, data: unknown): Record<string, unknown> {
    if (Array.isArray(data)) {
        return { totalCount: data.length, items: data.slice(0, 10) };
    }
    if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        if ("rowCount" in d && "rows" in d) {
            return {
                rowCount: d.rowCount,
                rows: (d.rows as unknown[])?.slice(0, 10),
                columns: d.columns,
            };
        }
        if ("pageToken" in d && Array.isArray(d.data)) {
            return {
                totalCount: (d.data as unknown[]).length,
                items: (d.data as unknown[]).slice(0, 10),
                hasMore: !!d.pageToken,
                nextPageToken: d.pageToken,
            };
        }
    }
    return (data as Record<string, unknown>) ?? {};
}

/**
 * Generate human-readable narration. Indicates when results are paginated.
 */
export function narrate(toolName: string, data: unknown): string {
    const summary = summarize(toolName, data);
    const count = (summary.totalCount ?? summary.rowCount ?? 1) as number;
    const hasMore = (summary.hasMore as boolean | undefined) ?? false;
    const shown = Math.min(count, (summary.items as unknown[] | undefined)?.length ?? count);
    const pagination = hasMore || (shown < count) ? ` Showing first ${shown}; use pageToken to retrieve more.` : "";

    if (toolName === "run_query") {
        const rowCount = summary.rowCount as number;
        const rowShown = Math.min(rowCount, ((summary.rows as unknown[]) ?? []).length);
        const rowPage = rowShown < rowCount ? ` Showing first ${rowShown}; use pageToken to retrieve more.` : "";
        return `Analytics query returned ${rowCount} rows.${rowPage}`;
    }
    if (toolName === "get_anomalies") return `Found ${count} cost anomalies.${pagination}`;
    if (toolName === "list_budgets") return `Found ${count} budgets.${pagination}`;
    if (toolName === "list_invoices") return `Found ${count} invoices.${pagination}`;
    if (toolName === "list_tickets") return `Found ${count} support tickets.${pagination}`;
    if (toolName === "get_cloud_incidents") return `Found ${count} cloud platform incidents.${pagination}`;
    if (toolName === "validate_user") return `User validated successfully.`;
    if (toolName.startsWith("create_")) return `Successfully created ${toolName.replace("create_", "")}.`;
    if (toolName.startsWith("update_")) return `Successfully updated ${toolName.replace("update_", "")}.`;
    if (toolName.startsWith("list_")) return `Found ${count} ${toolName.replace("list_", "")}.${pagination}`;
    return `Operation completed.`;
}

/**
 * Main adapter. Wraps raw response into Apps SDK three-field format.
 *
 * - structuredContent: machine-readable summary (first 10 items for lists)
 * - content: human-readable narration with pagination hints
 * - _meta: protocol metadata only (toolName); rawData excluded per data minimization rules
 */
export function adaptToolResponse(toolName: string, rawResponse: unknown) {
    const cleaned =
        typeof rawResponse === "object" && rawResponse !== null
            ? sanitize(rawResponse as Record<string, unknown>)
            : rawResponse;
    return {
        structuredContent: summarize(toolName, cleaned),
        content: [{ type: "text" as const, text: narrate(toolName, cleaned) }],
        _meta: { toolName },
    };
}
