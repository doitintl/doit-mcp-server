import { z } from "zod";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";
import {
    CLOUD_PROVIDER_ALIASES,
    normalizeConfig,
    REPORTS_BASE_URL,
    type QueryResponse,
} from "./reports.js";

// ── Shared helpers ───────────────────────────────────────────────────────────

const QUERY_URL = `${REPORTS_BASE_URL}/query`;

const DIMENSION_MAP: Record<string, string> = {
    service: "service_description",
    project: "project_id",
    cloud: "cloud_provider",
};

const GroupByEnum = z.enum(["service", "project", "cloud"]);

function resolveCloudAlias(cloud: string): string {
    return CLOUD_PROVIDER_ALIASES[cloud.toLowerCase()] ?? cloud;
}

/** Build a cloud_provider filter entry when the caller passes a cloud alias. */
function buildCloudFilter(cloud: string) {
    return {
        id: "cloud_provider",
        type: "fixed" as const,
        mode: "is" as const,
        values: [resolveCloudAlias(cloud)],
    };
}

/** Run a query config against the DoiT Analytics API. */
async function executeQuery(rawConfig: Record<string, unknown>, token: string, customerContext?: string) {
    const config = normalizeConfig(rawConfig);
    const response = await makeDoitRequest<QueryResponse>(QUERY_URL, token, {
        method: "POST",
        body: { config },
        appendParams: true,
        customerContext,
    });

    if (!response?.result || response?.error) {
        return createErrorResponse(
            `Query failed: ${response?.error || "Unknown error"}. ` +
                "Try using the full run_query tool for more control, or check dimension IDs with list_dimensions."
        );
    }

    return createSuccessResponse(
        JSON.stringify({
            rowCount: response.result.rows.length,
            rows: response.result.rows,
            columns: response.result.schema,
        })
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. cost_breakdown
// ═════════════════════════════════════════════════════════════════════════════

export const CostBreakdownArgumentsSchema = z.object({
    groupBy: GroupByEnum.describe(
        'Dimension to group costs by. "service" = cloud service, "project" = project/account/subscription, "cloud" = cloud provider.'
    ),
    cloud: z
        .string()
        .optional()
        .describe('Filter to a specific cloud provider. Accepts aliases like "aws", "gcp", "azure".'),
    months: z
        .number()
        .int()
        .min(1)
        .max(24)
        .optional()
        .default(1)
        .describe("How many months to look back (default 1). The current in-progress month is always included."),
    topN: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .default(10)
        .describe("Number of top results to return (default 10, max 25)."),
});

export const costBreakdownTool = {
    name: "cost_breakdown",
    description:
        "Use this when the user wants a simple cost breakdown by service, project, or cloud provider " +
        "(e.g. 'What are my top services by cost?', 'Which projects cost the most?'). " +
        "Returns the top-N items ranked by cost descending. " +
        "For complex multi-filter or multi-metric queries, use run_query instead.",
    inputSchema: zodToMcpInputSchema(CostBreakdownArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Running cost breakdown...",
        "openai/toolInvocation/invoked": "Cost breakdown ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleCostBreakdownRequest(args: any, token: string) {
    try {
        const { groupBy, cloud, months, topN } = CostBreakdownArgumentsSchema.parse(args);
        const { customerContext } = args;

        const dimensionId = DIMENSION_MAP[groupBy];

        const config: Record<string, unknown> = {
            dataSource: "billing",
            metrics: [{ type: "basic", value: "cost" }],
            timeInterval: "month",
            timeRange: {
                mode: "last",
                amount: months,
                unit: "month",
                includeCurrent: true,
            },
            group: [
                {
                    id: dimensionId,
                    type: "fixed",
                    limit: {
                        metric: { type: "basic", value: "cost" },
                        sort: "desc",
                        value: topN,
                    },
                },
            ],
        };

        if (cloud) {
            config.filters = [buildCloudFilter(cloud)];
        }

        return await executeQuery(config, token, customerContext);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(error.issues.map((i) => i.message).join("; "));
        }
        return handleGeneralError(error, "handling cost_breakdown request");
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. cost_trend
// ═════════════════════════════════════════════════════════════════════════════

export const CostTrendArgumentsSchema = z.object({
    months: z
        .number()
        .int()
        .min(1)
        .max(36)
        .optional()
        .default(6)
        .describe("How many months of history to include (default 6)."),
    cloud: z
        .string()
        .optional()
        .describe('Filter to a specific cloud provider. Accepts aliases like "aws", "gcp", "azure".'),
    groupBy: GroupByEnum.optional().describe(
        "Optional breakdown dimension. If omitted the trend is a single total line."
    ),
    topN: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .default(5)
        .describe("When groupBy is set, limit to top-N groups by cost (default 5)."),
});

export const costTrendTool = {
    name: "cost_trend",
    description:
        "Use this when the user wants to see monthly spend over time " +
        "(e.g. 'Show me my cost trend', 'How has my spend changed over the last 6 months?'). " +
        "Returns monthly cost data points, optionally broken down by service/project/cloud. " +
        "For daily granularity or custom time intervals, use run_query instead.",
    inputSchema: zodToMcpInputSchema(CostTrendArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading cost trend...",
        "openai/toolInvocation/invoked": "Cost trend ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleCostTrendRequest(args: any, token: string) {
    try {
        const { months, cloud, groupBy, topN } = CostTrendArgumentsSchema.parse(args);
        const { customerContext } = args;

        const group: Record<string, unknown>[] = [];

        if (groupBy) {
            const dimensionId = DIMENSION_MAP[groupBy];
            group.push({
                id: dimensionId,
                type: "fixed",
                limit: {
                    metric: { type: "basic", value: "cost" },
                    sort: "desc",
                    value: topN,
                },
            });
        }

        const config: Record<string, unknown> = {
            dataSource: "billing",
            metrics: [{ type: "basic", value: "cost" }],
            timeInterval: "month",
            timeRange: {
                mode: "last",
                amount: months,
                unit: "month",
                includeCurrent: true,
            },
        };

        if (group.length > 0) {
            config.group = group;
        }

        if (cloud) {
            config.filters = [buildCloudFilter(cloud)];
        }

        return await executeQuery(config, token, customerContext);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(error.issues.map((i) => i.message).join("; "));
        }
        return handleGeneralError(error, "handling cost_trend request");
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. compare_spend
// ═════════════════════════════════════════════════════════════════════════════

export const CompareSpendArgumentsSchema = z.object({
    period1Months: z
        .number()
        .int()
        .min(1)
        .max(24)
        .optional()
        .default(3)
        .describe("How many months to look back for period 1 (default 3). Includes the current month."),
    period2: z
        .object({
            from: z.string().describe("Start date in RFC3339 format (e.g. '2025-01-01T00:00:00Z')."),
            to: z.string().describe("End date in RFC3339 format (e.g. '2025-03-31T23:59:59Z')."),
        })
        .describe("The comparison period as an explicit date range."),
    cloud: z
        .string()
        .optional()
        .describe('Filter to a specific cloud provider. Accepts aliases like "aws", "gcp", "azure".'),
    groupBy: GroupByEnum.optional()
        .default("service")
        .describe('Dimension to group by (default "service").'),
});

export const compareSpendTool = {
    name: "compare_spend",
    description:
        "Use this when the user wants to compare spend between two time periods " +
        "(e.g. 'Compare my costs this quarter vs last quarter', 'How did January compare to February?'). " +
        "Period 1 is a rolling lookback; period 2 is an explicit date range. " +
        "For more than two periods or advanced comparative analysis, use run_query instead.",
    inputSchema: zodToMcpInputSchema(CompareSpendArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Comparing spend periods...",
        "openai/toolInvocation/invoked": "Spend comparison ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleCompareSpendRequest(args: any, token: string) {
    try {
        const { period1Months, period2, cloud, groupBy } = CompareSpendArgumentsSchema.parse(args);
        const { customerContext } = args;

        const dimensionId = DIMENSION_MAP[groupBy];
        const groupConfig = [
            {
                id: dimensionId,
                type: "fixed",
                limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 },
            },
        ];
        const filters = cloud ? [buildCloudFilter(cloud)] : undefined;

        // Run two queries in parallel — one for each period
        const baseConfig = {
            dataSource: "billing",
            metrics: [{ type: "basic", value: "cost" }],
            timeInterval: "month",
            group: groupConfig,
            ...(filters ? { filters } : {}),
        };

        const config1 = normalizeConfig({
            ...baseConfig,
            timeRange: { mode: "last", amount: period1Months, unit: "month", includeCurrent: true },
        });
        const config2 = normalizeConfig({
            ...baseConfig,
            timeRange: { mode: "custom", unit: "month", amount: 1, includeCurrent: false },
            customTimeRange: { from: period2.from, to: period2.to },
        });

        const [r1, r2] = await Promise.all([
            makeDoitRequest<QueryResponse>(QUERY_URL, token, { method: "POST", body: { config: config1 }, appendParams: true, customerContext }),
            makeDoitRequest<QueryResponse>(QUERY_URL, token, { method: "POST", body: { config: config2 }, appendParams: true, customerContext }),
        ]);

        if (!r1?.result || !r2?.result) {
            return createErrorResponse(
                `One or both queries failed. ${r1?.error || ""} ${r2?.error || ""}`.trim() ||
                "Try using the full run_query tool for more control."
            );
        }

        return createSuccessResponse(
            JSON.stringify({
                period1: {
                    label: `Last ${period1Months} month${period1Months > 1 ? "s" : ""}`,
                    rowCount: r1.result.rows.length,
                    rows: r1.result.rows,
                    columns: r1.result.schema,
                },
                period2: {
                    label: `${period2.from.slice(0, 10)} to ${period2.to.slice(0, 10)}`,
                    rowCount: r2.result.rows.length,
                    rows: r2.result.rows,
                    columns: r2.result.schema,
                },
            })
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(error.issues.map((i) => i.message).join("; "));
        }
        return handleGeneralError(error, "handling compare_spend request");
    }
}
