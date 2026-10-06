import { z } from "zod";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import { createErrorResponse, createSuccessResponse, handleGeneralError, makeDoitRequest } from "../utils/util.js";
import {
    CLOUD_PROVIDER_ALIASES,
    CustomTimeRangeSchema,
    normalizeConfig,
    type QueryResponse,
    REPORTS_BASE_URL,
} from "./reports.js";

// ── Shared helpers ───────────────────────────────────────────────────────────

const QUERY_VALIDATION_GUIDANCE =
    "Try using the full run_query tool for more control, or check dimension IDs with list_dimensions.";

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
        readOnly: true,
        body: { config },
        appendParams: true,
        customerContext,
    });

    if (!response?.result || response?.error) {
        return createErrorResponse(`Query failed: ${response?.error || "Unknown error"}. ${QUERY_VALIDATION_GUIDANCE}`);
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
        .describe(
            "Number of calendar months, 1–24 (default 1): N-1 complete months plus the current month-to-date. 1 means current month-to-date."
        ),
    topN: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .default(10)
        .describe(
            "Top dimension values ranked across the range (default 10, max 25). Each value can have a row per month; this is not a row cap."
        ),
});

export const costBreakdownTool = {
    name: "cost_breakdown",
    title: "Cost breakdown",
    coversEndpoint: null,
    description:
        "Use this when the user wants a simple cost breakdown by service, project, or cloud provider " +
        "(e.g. 'What are my top services by cost?', 'Which projects cost the most?'). " +
        "Selects the top-N groups by total cost across the range and returns monthly rows for each. The range includes the partial current month; months=1 means month-to-date. Output row order is not a cost ranking. " +
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
        return handleGeneralError(error, "handling cost_breakdown request", QUERY_VALIDATION_GUIDANCE);
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
        .describe(
            "Number of calendar months, 1–36 (default 6): N-1 complete months plus the partial current month-to-date."
        ),
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
        .describe(
            "When groupBy is set, select top-N groups by total cost across the range (default 5, max 25), not a row cap."
        ),
});

export const costTrendTool = {
    name: "cost_trend",
    title: "Cost trend",
    coversEndpoint: null,
    description:
        "Use this when the user wants to see monthly spend over time " +
        "(e.g. 'Show me my cost trend', 'How has my spend changed over the last 6 months?'). " +
        "Returns monthly cost data points, optionally broken down by service/project/cloud. The last point is the partial current month; months=1 means month-to-date. " +
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
        return handleGeneralError(error, "handling cost_trend request", QUERY_VALIDATION_GUIDANCE);
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
        .describe(
            "Period 1 covers N-1 full calendar months plus current month-to-date, 1–24 (default 3). It is not necessarily a calendar quarter."
        ),
    period2: CustomTimeRangeSchema.describe(
        "Comparison period as explicit inclusive UTC calendar dates in RFC3339 format."
    ),
    cloud: z
        .string()
        .optional()
        .describe('Filter to a specific cloud provider. Accepts aliases like "aws", "gcp", "azure".'),
    groupBy: GroupByEnum.optional()
        .default("service")
        .describe(
            'Grouping (default "service"): service = cloud service, project = project/account/subscription, cloud = cloud provider. Each period independently selects its top 10 groups.'
        ),
});

export const compareSpendTool = {
    name: "compare_spend",
    title: "Compare spend",
    coversEndpoint: null,
    description:
        "Use this when the user wants to compare spend between two time periods " +
        "(e.g. 'Compare the latest three months including this month with January through March'). " +
        "Period 1 is N-1 full calendar months plus current month-to-date; period 2 is an explicit date range. Returns two separate sets of monthly rows, each independently limited to its top 10 groups across that period. Groups can differ; no difference or percentage change is computed. " +
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
            timeRange: { mode: "custom" },
            customTimeRange: { from: period2.from, to: period2.to },
        });

        const [r1, r2] = await Promise.all([
            makeDoitRequest<QueryResponse>(QUERY_URL, token, {
                method: "POST",
                readOnly: true,
                body: { config: config1 },
                appendParams: true,
                customerContext,
            }),
            makeDoitRequest<QueryResponse>(QUERY_URL, token, {
                method: "POST",
                readOnly: true,
                body: { config: config2 },
                appendParams: true,
                customerContext,
            }),
        ]);

        if (!r1?.result || r1.error || !r2?.result || r2.error) {
            return createErrorResponse(
                `One or both queries failed. ${r1?.error || ""} ${r2?.error || ""}`.trim() ||
                    "Try using the full run_query tool for more control."
            );
        }

        return createSuccessResponse(
            JSON.stringify({
                period1: {
                    label: `Last ${period1Months} month${period1Months > 1 ? "s" : ""} including current month-to-date`,
                    rowCount: r1.result.rows.length,
                    rows: r1.result.rows,
                    columns: r1.result.schema,
                },
                period2: {
                    label: `${new Date(period2.from).toISOString().slice(0, 10)} to ${new Date(period2.to).toISOString().slice(0, 10)}`,
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
        return handleGeneralError(error, "handling compare_spend request", QUERY_VALIDATION_GUIDANCE);
    }
}
