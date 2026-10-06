/**
 * Claude's hosted clients document an approximate 150,000-character result limit.
 * Count the entire serialized MCP result (including duplicated structured content
 * and metadata) and leave space for the transport envelope. This is deliberately
 * conservative; it is not a token limit or a bound on upstream API downloads.
 */
export const MAX_TOOL_RESULT_CHARS = 140_000;

export interface ResponseSize {
    textChars: number;
    serializedChars: number;
    serializedBytes: number;
}

export interface ToolResponseMetrics {
    event: "mcp_tool_response";
    toolName: string;
    client?: string;
    durationMs: number;
    limitChars: number;
    original: ResponseSize | null;
    returned: ResponseSize | null;
    exceededLimit: boolean;
    serializationFailed: boolean;
    isError: boolean;
    disposition: "unchanged" | "size_error" | "success_receipt";
}

export interface ResponseLimitContext {
    toolName: string;
    /** Only a completed handler may be classified as a write. */
    operation: "read" | "write" | "not_executed";
    client?: string;
    durationMs: number;
    /** Before transport-specific formatting, for error state and receipt IDs. */
    sourceResponse?: unknown;
    onMetrics?: (metrics: ToolResponseMetrics) => void;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

export function measureToolResponse(response: unknown): ResponseSize | null {
    try {
        const serialized = JSON.stringify(response);
        if (serialized === undefined) return null;
        const content = asObject(response)?.content;
        const textChars = Array.isArray(content)
            ? content.reduce((total, item) => total + (typeof item?.text === "string" ? item.text.length : 0), 0)
            : 0;
        return {
            textChars,
            serializedChars: serialized.length,
            serializedBytes: new TextEncoder().encode(serialized).byteLength,
        };
    } catch {
        return null;
    }
}

/** Extract bounded identifiers only, never copy arbitrary output into a receipt. */
function receiptIdentifiers(response: unknown): Record<string, string | number> {
    const result = asObject(response);
    let data = asObject(result?.structuredContent);
    if (!data && Array.isArray(result?.content)) {
        const text = result.content.find((item) => item?.type === "text" && typeof item.text === "string")?.text;
        try {
            data = asObject(JSON.parse(text));
        } catch {
            // Plain text results need not contain an identifier.
        }
    }
    const identifiers: Record<string, string | number> = {};
    for (const key of ["id", "operationId", "reportId", "ticketId", "budgetId", "flowId", "customerId"]) {
        const value = data?.[key];
        if (
            (typeof value === "string" && value.length <= 256) ||
            (typeof value === "number" && Number.isFinite(value))
        ) {
            identifiers[key] = value;
        }
    }
    return identifiers;
}

function recoveryHint(toolName: string): string {
    switch (toolName) {
        case "run_query":
            return "Use a shorter time range or fewer groups in the query configuration.";
        case "list_assets":
            return "Use a smaller maxResults value or a narrower filter.";
        case "get_report_results":
            return "Use run_query with a narrower configuration, or retrieve the complete report in DoiT Console.";
        case "get_statussheet_components":
            return "Request fewer component IDs or fewer projection fields using the p parameter.";
        default:
            return "Use narrower filters or a smaller page where the tool supports them; otherwise retrieve the data in DoiT Console.";
    }
}

/**
 * Final boundary guard. Never slices JSON, removes arbitrary rows, advances a
 * cursor, or retries an operation. Tool-specific pagination belongs upstream.
 */
export function finalizeToolResponse(response: any, context: ResponseLimitContext): any {
    const source = context.sourceResponse ?? response;
    const sourceIsError = asObject(source)?.isError === true;
    // A formatter must not turn a tool error into a successful result.
    const candidate = sourceIsError && asObject(response)?.isError !== true ? source : response;
    const original = measureToolResponse(candidate);
    const exceededLimit = original !== null && original.serializedChars > MAX_TOOL_RESULT_CHARS;
    let returned = candidate;
    let disposition: ToolResponseMetrics["disposition"] = "unchanged";

    if (exceededLimit || original === null) {
        const reason = original === null ? "RESPONSE_SERIALIZATION_FAILED" : "RESPONSE_TOO_LARGE";
        if (context.operation === "write" && !sourceIsError && asObject(candidate)?.isError !== true) {
            disposition = "success_receipt";
            returned = {
                isError: false,
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            status: "completed",
                            responseOmitted: true,
                            reason,
                            identifiers: receiptIdentifiers(source),
                            message:
                                "The tool reported success. The full response could not be returned. Do not repeat the write; use a read tool or DoiT Console to inspect the result.",
                        }),
                    },
                ],
            };
        } else {
            disposition = "size_error";
            const hint =
                sourceIsError || asObject(candidate)?.isError === true
                    ? "The tool reported an error; the full error response was omitted. Verify the current state before retrying."
                    : context.operation === "not_executed"
                      ? "The action was not executed. Reduce the request size and try again."
                      : `No result data was returned. ${recoveryHint(context.toolName)}`;
            returned = {
                isError: true,
                content: [{ type: "text", text: `${reason}: ${hint}` }],
            };
        }
    }

    // Re-measure the actual outgoing result, including the fallback. These fixed
    // receipts are bounded by their field allowlist and never contain raw bodies.
    const returnedSize = disposition === "unchanged" ? original : measureToolResponse(returned);
    const metrics: ToolResponseMetrics = {
        event: "mcp_tool_response",
        toolName: context.toolName.slice(0, 128),
        client: context.client?.slice(0, 128),
        durationMs: context.durationMs,
        limitChars: MAX_TOOL_RESULT_CHARS,
        original,
        returned: returnedSize,
        exceededLimit,
        serializationFailed: original === null,
        isError: returned?.isError === true,
        disposition,
    };
    try {
        if (context.onMetrics) context.onMetrics(metrics);
        else console.error(JSON.stringify(metrics)); // stdout is the stdio MCP transport
    } catch {
        // Observability must never turn a completed write into a retryable failure.
    }
    return returned;
}
