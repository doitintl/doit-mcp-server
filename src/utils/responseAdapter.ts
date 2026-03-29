/**
 * Fields to strip from all responses.
 * These cause review rejection if present in structuredContent or content.
 */
const STRIP_PATTERNS = [
    /^_trace/i,
    /^_request/i,
    /^x-/i,
    /session[_-]?id/i,
    /trace[_-]?id/i,
    /request[_-]?id/i,
    /correlation[_-]?id/i,
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
            };
        }
    }
    return (data as Record<string, unknown>) ?? {};
}

/**
 * Generate human-readable narration.
 */
export function narrate(toolName: string, data: unknown): string {
    const summary = summarize(toolName, data);
    const count = (summary.totalCount ?? summary.rowCount ?? 1) as number;
    if (toolName === "run_query") return `Analytics query returned ${count} rows of data.`;
    if (toolName === "get_anomalies") return `Found ${count} cost anomalies.`;
    if (toolName === "list_budgets") return `Found ${count} budgets.`;
    if (toolName === "list_invoices") return `Found ${count} invoices.`;
    if (toolName === "list_tickets") return `Found ${count} support tickets.`;
    if (toolName === "get_cloud_incidents") return `Found ${count} cloud platform incidents.`;
    if (toolName === "validate_user") return `User validated successfully.`;
    if (toolName.startsWith("create_")) return `Successfully created ${toolName.replace("create_", "")}.`;
    if (toolName.startsWith("update_")) return `Successfully updated ${toolName.replace("update_", "")}.`;
    if (toolName.startsWith("list_")) return `Found ${count} ${toolName.replace("list_", "")}.`;
    return `Operation completed.`;
}

/**
 * Main adapter. Wraps raw response into Apps SDK three-field format.
 */
export function adaptToolResponse(toolName: string, rawResponse: unknown) {
    const cleaned =
        typeof rawResponse === "object" && rawResponse !== null
            ? sanitize(rawResponse as Record<string, unknown>)
            : rawResponse;
    return {
        structuredContent: summarize(toolName, cleaned),
        content: [{ type: "text" as const, text: narrate(toolName, cleaned) }],
        _meta: { rawData: cleaned, toolName },
    };
}
