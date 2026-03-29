import { z } from "zod";
import {
    AGGREGATION_VALUES,
    DATA_SOURCE_VALUES,
    DIMENSION_TYPE_VALUES,
    DISPLAY_VALUES,
    FILTER_MODE_VALUES,
    LAYOUT_VALUES,
    METRIC_FILTER_OPERATOR_VALUES,
    METRIC_TYPE_VALUES,
    ORIGIN_TYPE_VALUES,
    REPORT_CURRENCY_VALUES,
    SECONDARY_TIME_UNIT_VALUES,
    SORT_VALUES,
    SPLIT_MODE_VALUES,
    TIME_INTERVAL_VALUES,
    TIME_RANGE_MODE_VALUES,
    TIME_UNIT_VALUES,
} from "../types/reports.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatEnumValues,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const REPORTS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/reports`;

// Schema definitions
export const ReportsArgumentsSchema = z.object({
    filter: z
        .string()
        .optional()
        .describe(
            "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. Example: 'type:billing|owner:john@example.com'"
        ),
    pageToken: z.string().optional().describe("Token for pagination. Use this to get the next page of results."),
});

// Get Report Results Schema Definition
export const GetReportResultsArgumentsSchema = z.object({
    id: z.string().describe("The ID of the report to retrieve results for"),
});

const createDocumentPrompt =
    "**IMPORTANT**: Create a document (Artifacts) with a table to display the report results. include insights and recommendations if possible. (Do not generate code, only a document)";

// Interfaces
export interface Report {
    id: string;
    reportName: string;
    owner: string;
    type: string;
    createTime: number;
    updateTime: number;
    urlUI: string;
}

export interface ReportsResponse {
    pageToken: any;
    rowCount: number;
    reports: Report[];
}

export interface QueryResult {
    schema: Array<{
        name: string;
        type: string;
    }>;
    rows: Array<Array<any>>;
    cacheHit: boolean;
}

export interface QueryResponse {
    result: QueryResult;
    error?: string;
}

// Get Report Results Interface
export interface ReportResultSchema {
    name: string;
    type: string;
}

export interface ReportResult {
    schema: ReportResultSchema[];
    mlFeatures?: string[];
    rows: Array<Array<any>>;
    forecastRows?: Array<Array<any>>;
}

export interface GetReportResultsResponse {
    id: string;
    reportName: string;
    owner: string;
    type: string;
    createTime: number;
    updateTime: number;
    urlUI: string;
    result: ReportResult;
}

// Tool metadata
export const reportsTool = {
    name: "list_reports",
    description:
        "Use this when the user wants to see their saved Cloud Analytics reports or browse available reports. Returns a paginated list of reports with their IDs and metadata. Do NOT use this for running queries (use run_query) or getting report results (use get_report_results).",
    inputSchema: {
        type: "object",
        properties: {
            filter: {
                type: "string",
                description:
                    "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. Possible filter keys: reportName, owner, type, updateTime, use the filter property only if you know for sure the value is a valid filter key, do not guess it.",
            },
            pageToken: {
                type: "string",
                description: "Token for pagination. Use this to get the next page of results.",
            },
        },
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading reports...",
        "openai/toolInvocation/invoked": "Reports loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const getReportResultsTool = {
    name: "get_report_results",
    description:
        "Use this when the user wants to retrieve the data results of a specific saved report by its ID. Returns rows and columns of report data. Do NOT use this for listing all reports (use list_reports) or running ad-hoc queries (use run_query).",
    inputSchema: {
        type: "object",
        properties: {
            id: {
                type: "string",
                description: "The ID of the report to retrieve results for",
            },
        },
        required: ["id"],
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Fetching report data...",
        "openai/toolInvocation/invoked": "Report data ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// ─── Report Config Sub-Schemas ────────────────────────────────────────────────

const ExternalMetricSchema = z.object({
    type: z.enum(METRIC_TYPE_VALUES).describe(`Metric type. Accepted values: ${formatEnumValues(METRIC_TYPE_VALUES)}.`),
    value: z
        .string()
        .describe(
            "For basic metrics: 'cost', 'usage', or 'savings'. For extended metrics: e.g. 'amortized_cost'. For custom metrics: the custom metric ID."
        ),
});

const ReportDimensionSchema = z.object({
    id: z.string().describe("Dimension identifier. Use the dimension tool to get valid IDs."),
    type: z
        .enum(DIMENSION_TYPE_VALUES)
        .describe(`Dimension type. Accepted values: ${formatEnumValues(DIMENSION_TYPE_VALUES)}.`),
});

const TimeSettingsSchema = z
    .object({
        mode: z
            .enum(TIME_RANGE_MODE_VALUES)
            .describe(
                `Time range mode. Accepted values: ${formatEnumValues(TIME_RANGE_MODE_VALUES)}. Use 'custom' with customTimeRange for specific dates.`
            ),
        amount: z
            .number()
            .int()
            .min(0)
            .max(5000)
            .optional()
            .describe("Number of time units (0–5000). Required when mode is 'last'."),
        unit: z
            .enum(TIME_UNIT_VALUES)
            .optional()
            .describe(
                `Time unit. Accepted values: ${formatEnumValues(TIME_UNIT_VALUES)}. Required when mode is 'last'.`
            ),
        includeCurrent: z.boolean().optional().describe("Whether to include the current (in-progress) period."),
        customTimeRange: z
            .object({
                from: z.string().describe("Start date in RFC3339 format."),
                to: z.string().describe("End date in RFC3339 format."),
            })
            .optional()
            .describe("Custom date range. Required when mode is 'custom'."),
    })
    .superRefine((value, ctx) => {
        if (value.mode === "last") {
            if (value.amount == null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["amount"],
                    message: "amount is required when mode is 'last'.",
                });
            }
            if (value.unit == null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["unit"],
                    message: "unit is required when mode is 'last'.",
                });
            }
        }
        if (value.mode === "custom" && !value.customTimeRange) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["customTimeRange"],
                message: "customTimeRange is required when mode is 'custom'.",
            });
        }
    });

const TimeSettingsSecondarySchema = z.object({
    amount: z.number().int().min(0).optional().describe("Number of periods to shift back (non-negative)."),
    unit: z
        .enum(SECONDARY_TIME_UNIT_VALUES)
        .optional()
        .describe(`Time unit for shifting. Accepted values: ${formatEnumValues(SECONDARY_TIME_UNIT_VALUES)}.`),
    includeCurrent: z
        .boolean()
        .optional()
        .describe(
            "When true, selects complete previous periods (e.g. full previous year). When false, shifts dates by amount."
        ),
    customTimeRange: z
        .object({
            from: z.string().describe("Start date in RFC3339 format."),
            to: z.string().describe("End date in RFC3339 format."),
        })
        .optional()
        .describe("Custom date range for the secondary time range."),
});

const ExternalConfigFilterSchema = z.object({
    id: z.string().describe("The field to filter on. Use the dimension tool to get valid IDs."),
    type: z
        .enum(DIMENSION_TYPE_VALUES)
        .describe(`Dimension type of the filter field. Accepted values: ${formatEnumValues(DIMENSION_TYPE_VALUES)}.`),
    mode: z
        .enum(FILTER_MODE_VALUES)
        .describe(`Filter match mode. Accepted values: ${formatEnumValues(FILTER_MODE_VALUES)}.`),
    inverse: z.boolean().optional().describe("Set to true to exclude the matched values (negation)."),
    values: z.array(z.string()).optional().describe("Values to filter on."),
});

const ExternalConfigMetricFilterSchema = z.object({
    metric: ExternalMetricSchema.describe("The metric to filter on."),
    operator: z
        .enum(METRIC_FILTER_OPERATOR_VALUES)
        .describe(
            `Comparison operator. Accepted values: ${formatEnumValues(METRIC_FILTER_OPERATOR_VALUES)}. gt (>), lt (<), lte (<=), gte (>=), b (between), nb (not between), e (equals), ne (not equals).`
        ),
    values: z.array(z.number()).describe("Values to compare against."),
});

const LimitSchema = z.object({
    metric: ExternalMetricSchema.describe("Metric used for ranking."),
    sort: z
        .enum(SORT_VALUES)
        .describe(`Sort order for the limit ranking. Accepted values: ${formatEnumValues(SORT_VALUES)}.`),
    value: z.number().int().describe("Number of items to show."),
});

const GroupSchema = z.object({
    id: z.string().describe("Dimension ID for the group-by row. Use the dimension tool to get valid IDs."),
    type: z
        .enum(DIMENSION_TYPE_VALUES)
        .describe(`Dimension type. Accepted values: ${formatEnumValues(DIMENSION_TYPE_VALUES)}.`),
    limit: LimitSchema.optional().describe("Limit to top/bottom N results."),
});

const AdvancedAnalysisSchema = z.object({
    forecast: z.boolean().optional().describe("Include a cost forecast."),
    notTrending: z.boolean().optional().describe("Highlight rows that are not trending."),
    trendingDown: z.boolean().optional().describe("Highlight rows trending down."),
    trendingUp: z.boolean().optional().describe("Highlight rows trending up."),
});

const ExternalSplitTargetSchema = z.object({
    id: z.string().describe("Target ID."),
    type: z
        .enum(DIMENSION_TYPE_VALUES)
        .describe(
            `Target type. Accepted values: ${formatEnumValues(DIMENSION_TYPE_VALUES)}. Must match the split type unless split type is 'attribution_group', in which case target type must be 'attribution'.`
        ),
    value: z
        .number()
        .optional()
        .describe("Percent as float (e.g. 0.3 for 30%). Required only when split mode is 'custom'."),
});

const ExternalSplitSchema = z
    .object({
        id: z.string().describe("ID of the field to split."),
        type: z
            .enum(DIMENSION_TYPE_VALUES)
            .describe(`Type of the split. Accepted values: ${formatEnumValues(DIMENSION_TYPE_VALUES)}.`),
        mode: z
            .enum(SPLIT_MODE_VALUES)
            .describe(`Split mode. Accepted values: ${formatEnumValues(SPLIT_MODE_VALUES)}.`),
        includeOrigin: z.boolean().optional().describe("Whether to include the origin in the split results."),
        origin: z
            .object({
                id: z.string().describe("Origin ID."),
                type: z
                    .enum(ORIGIN_TYPE_VALUES)
                    .describe(`Origin type. Accepted values: ${formatEnumValues(ORIGIN_TYPE_VALUES)}.`),
            })
            .optional()
            .describe("Origin info for cost splitting."),
        targets: z.array(ExternalSplitTargetSchema).optional().describe("Targets for the split."),
    })
    .superRefine((data, ctx) => {
        if (data.mode === "custom") {
            if (!data.targets || data.targets.length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["targets"],
                    message: "Targets are required when split mode is 'custom'.",
                });
                return;
            }
            data.targets.forEach((target, index) => {
                if (target.value === undefined) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["targets", index, "value"],
                        message: "Target value is required when split mode is 'custom'.",
                    });
                }
            });
        }
    });

export const ReportConfigSchema = z
    .object({
        dataSource: z
            .enum(DATA_SOURCE_VALUES)
            .optional()
            .describe(`Data source for the report. Accepted values: ${formatEnumValues(DATA_SOURCE_VALUES)}.`),
        metrics: z
            .array(ExternalMetricSchema)
            .max(4)
            .optional()
            .describe("List of metrics to apply (max 4). Preferred over the deprecated 'metric' field."),
        metric: ExternalMetricSchema.optional().describe("Deprecated: use 'metrics' instead."),
        metricFilter: ExternalConfigMetricFilterSchema.optional().describe(
            "Filter to limit report rows by metric value."
        ),
        aggregation: z
            .enum(AGGREGATION_VALUES)
            .optional()
            .describe(`How to aggregate data values. Accepted values: ${formatEnumValues(AGGREGATION_VALUES)}.`),
        advancedAnalysis: AdvancedAnalysisSchema.optional().describe("Advanced analysis options."),
        timeInterval: z
            .enum(TIME_INTERVAL_VALUES)
            .optional()
            .describe(`Time interval for grouping data. Accepted values: ${formatEnumValues(TIME_INTERVAL_VALUES)}.`),
        dimensions: z
            .array(ReportDimensionSchema)
            .optional()
            .describe("Dimensions to break down data by (columns in table view)."),
        timeRange: TimeSettingsSchema.optional().describe("Time range for the report. Preferred over customTimeRange."),
        secondaryTimeRange: TimeSettingsSecondarySchema.optional().describe(
            "Secondary time range for comparative reports."
        ),
        customTimeRange: z
            .object({
                from: z.string().describe("Start timestamp in RFC3339 format. Example: '2024-03-10T23:00:00Z'."),
                to: z.string().describe("End timestamp in RFC3339 format. Example: '2024-03-12T23:00:00Z'."),
            })
            .optional()
            .describe("Custom time range. Only use when timeRange mode is 'custom'."),
        includePromotionalCredits: z
            .boolean()
            .optional()
            .describe("Include promotional credits. Requires timeInterval of 'month', 'quarter', or 'year'."),
        includeSubtotals: z
            .boolean()
            .optional()
            .describe("Include subgroup totals. No effect when reading via API. Defaults to false."),
        filters: z.array(ExternalConfigFilterSchema).optional().describe("Filters to apply to the report."),
        group: z.array(GroupSchema).optional().describe("Dimensions that define rows in the report (group-by)."),
        layout: z
            .enum(LAYOUT_VALUES)
            .optional()
            .describe(`Report layout / visualization type. Accepted values: ${formatEnumValues(LAYOUT_VALUES)}.`),
        displayValues: z
            .enum(DISPLAY_VALUES)
            .optional()
            .describe(
                `How to display values in comparative reports. Accepted values: ${formatEnumValues(DISPLAY_VALUES)}.`
            ),
        currency: z
            .enum(REPORT_CURRENCY_VALUES)
            .optional()
            .describe(
                `Currency code for monetary values. Accepted values: ${formatEnumValues(REPORT_CURRENCY_VALUES)}.`
            ),
        sortGroups: z
            .enum(SORT_VALUES)
            .optional()
            .describe(
                `Sort order for groups. Accepted values: ${formatEnumValues(SORT_VALUES)}. Defaults to 'asc'. No effect when reading via API.`
            ),
        sortDimensions: z
            .enum(SORT_VALUES)
            .optional()
            .describe(
                `Sort order for dimensions. Accepted values: ${formatEnumValues(SORT_VALUES)}. Defaults to 'desc'. No effect when reading via API.`
            ),
        splits: z.array(ExternalSplitSchema).optional().describe("Cost splits to apply to the report."),
    })
    .superRefine((data, ctx) => {
        if (data.metric && data.metrics && data.metrics.length > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["metrics"],
                message: "Specify either 'metrics' or the deprecated 'metric', but not both.",
            });
        }
    });

// ──────────────────────────────────────────────────────────────────────────────

// Run Query Schema Definition
export const RunQueryArgumentsSchema = z.object({
    config: ReportConfigSchema.describe(
        "Configuration for the query. Use the dimension tool to look up valid dimension IDs."
    ),
});

export const runQueryTool = {
    name: "run_query",
    description: `Use this when the user wants to analyze cloud costs, generate a cost breakdown, view spending trends, or run a custom analytics query across their cloud providers. Accepts a structured config with data source, metrics, dimensions, time range, and filters. Do NOT use this for listing saved reports (use list_reports), checking anomalies (use get_anomalies), or viewing budgets (use list_budgets).
    Fields that are not populated will use their default values if needed.
    To limit the number of rows returned per group, set the \`limit.value\` field inside each \`config.group[]\` entry (maximum 25).
    Use the dimension tool or allocation tool before running the query to get the list of dimensions and their types or allocations.
    If possible, use \`timeRange\` instead of \`customTimeRange\` when no specific dates are given.
    Example for cost report:
    {
      "config": {
        "dataSource": "billing",
        "metric": {"type": "basic", "value": "cost"},
        "timeRange": {"mode": "last", "amount": 1, "unit": "month", "includeCurrent": true},
        "group": [{"id": "service_description", "type": "fixed", "limit": {"metric": {"type": "basic", "value": "cost"}, "sort": "desc", "value": 10}}]
      }
    }`,
    inputSchema: zodToMcpInputSchema(RunQueryArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Running analytics query...",
        "openai/toolInvocation/invoked": "Analytics results ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// Create Report Schema Definition
export const CreateReportArgumentsSchema = z.object({
    name: z.string().min(1).describe("The name of the report (required, non-empty)."),
    description: z.string().optional().describe("A brief description of the report."),
    labels: z.array(z.string()).optional().describe("Optional list of label IDs to assign to the report."),
    config: ReportConfigSchema.describe(
        "Configuration for the report. Use the dimension tool to look up valid dimension IDs."
    ),
});

export interface CreateReportResponse {
    id: string;
    name: string;
    description?: string;
    type: string;
    config: Record<string, any>;
    labels?: string[];
}

export const createReportTool = {
    name: "create_report",
    description:
        "Use this when the user wants to save a new Cloud Analytics report with a specific configuration. Ask the user to confirm the report parameters before executing. Do NOT use this for one-time queries without saving (use run_query).",
    inputSchema: zodToMcpInputSchema(CreateReportArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Creating report...",
        "openai/toolInvocation/invoked": "Report created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

// Update Report Schema Definition
export const UpdateReportArgumentsSchema = z.object({
    id: z.string().min(1).describe("The ID of the report to update (required)."),
    name: z.string().min(1).optional().describe("Report name."),
    description: z.string().optional().describe("Report description."),
    labels: z.array(z.string()).optional().describe("Array of label IDs to assign to the report."),
    config: ReportConfigSchema.optional().describe(
        "Configuration for the report. Only specified fields will be updated. Use the dimension tool to look up valid dimension IDs."
    ),
});

export const updateReportTool = {
    name: "update_report",
    description:
        "Use this when the user wants to modify an existing saved Cloud Analytics report. Supports partial updates. Ask the user to confirm changes before executing. Do NOT use this for running ad-hoc queries (use run_query).",
    inputSchema: zodToMcpInputSchema(UpdateReportArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Updating report...",
        "openai/toolInvocation/invoked": "Report updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

// Format a report for display
export function formatReport(report: Report): string {
    const createDate = new Date(report.createTime).toLocaleString();
    const updateDate = new Date(report.updateTime).toLocaleString();

    return [
        `ID: ${report.id}`,
        `Name: ${report.reportName}`,
        `Owner: ${report.owner}`,
        `Type: ${report.type}`,
        `Created: ${createDate}`,
        `Updated: ${updateDate}`,
        `URL: ${report.urlUI}`,
        "-----------",
    ].join("\n");
}

// Format query result for display
export function formatQueryResult(queryResult: QueryResult): string {
    const { schema, rows, cacheHit } = queryResult;

    // Format schema information
    const schemaInfo = schema.map((field) => `${field.name} (${field.type})`).join(", ");

    const results = [
        `Query Results:`,
        `Schema: ${schemaInfo}`,
        `Cache Hit: ${cacheHit}`,
        `Rows (${rows.length} total):`,
        rows,
    ].join("\n");

    return results;
}

// Handle the reports request
export async function handleReportsRequest(args: any, token: string) {
    try {
        // Validate arguments
        const { filter, pageToken } = ReportsArgumentsSchema.parse(args);
        const { customerContext } = args;

        // Create API URL with query parameters
        const params = new URLSearchParams();
        if (filter) {
            params.append("filter", filter);
        }
        if (pageToken) {
            params.append("pageToken", pageToken);
        }

        let reportsUrl = REPORTS_BASE_URL;
        if (params.toString()) {
            reportsUrl += `?${params.toString()}`;
        }

        try {
            const reportsData = await makeDoitRequest<ReportsResponse>(reportsUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!reportsData) {
                return createErrorResponse(
                    "Failed to retrieve reports data, please check the filter parameter, try without filter if you don't know the exact value of the key"
                );
            }

            const reports = reportsData.reports || [];
            const rowCount = reportsData.rowCount || 0;

            if (reports.length === 0) {
                return createErrorResponse("No reports found");
            }

            const formattedReports = reports.map(formatReport);

            // Create a descriptive message that includes filter information if provided
            let reportsText = `Found ${rowCount} reports`;
            if (filter) {
                reportsText += ` (filtered by: ${filter})`;
            }
            reportsText += `:`;
            reportsText += `\n\n${formattedReports.join("\n")} \n\n${
                reportsData.pageToken ? `Page token: ${reportsData.pageToken}` : ""
            }`;

            return createSuccessResponse(reportsText);
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling reports request");
    }
}

// Handle the run query request
export async function handleRunQueryRequest(args: any, token: string) {
    try {
        // Validate arguments
        const { config } = RunQueryArgumentsSchema.parse(args);
        const { customerContext } = args;
        // Create API URL for the query endpoint
        const queryUrl = `${REPORTS_BASE_URL}/query`;

        try {
            // Use enhanced makeDoitRequest for POST request
            const queryResponse = await makeDoitRequest<QueryResponse>(queryUrl, token, {
                method: "POST",
                body: { config },
                appendParams: true,
                customerContext,
            });

            if (!queryResponse || !queryResponse.result || queryResponse?.error) {
                return createErrorResponse(
                    `Failed to run query. Try one of the following:
  1. Use 'list_dimensions' with a filter like 'filter:type:fixed' to get relevant dimensions or 'list_allocations' to get relevant allocations
  2. Check the specific error from the API: ${queryResponse?.error || "Unknown error"}
  3. For a cost report, you need at least: metric, timeRange, and dataSource fields`
                );
            }

            const formattedResult = formatQueryResult(queryResponse.result);

            return createSuccessResponse(formattedResult);
        } catch (error) {
            return handleGeneralError(error, "making DoiT API query request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling run query request");
    }
}

// Format report results for display
export function formatReportResults(report: GetReportResultsResponse): string {
    const createDate = new Date(report.createTime).toLocaleString();
    const updateDate = new Date(report.updateTime).toLocaleString();
    const schemaInfo = report.result.schema.map((field) => `${field.name} (${field.type})`).join(", ");

    const mlFeatures = report.result.mlFeatures ? `\nML Features: ${report.result.mlFeatures.join(", ")}` : "";

    const reportResults = [
        `Report Details:`,
        `ID: ${report.id}`,
        `Name: ${report.reportName}`,
        `Owner: ${report.owner}`,
        `Type: ${report.type}`,
        `Created: ${createDate}`,
        `Updated: ${updateDate}`,
        `URL: ${report.urlUI}`,
        `\nResults:`,
        `Schema: ${schemaInfo}`,
        mlFeatures,
        `Rows: ${report.result.rows.map((row) => row.join(", ")).join("\n")}`,
        report.result.forecastRows
            ? `Forecast Rows: ${report.result.forecastRows.map((row) => row.join(", ")).join("\n")}`
            : "",
        "-----------",
    ]
        .filter(Boolean)
        .join(`\n\n`);

    return `${reportResults}\n\n${createDocumentPrompt}`;
}

// Handle create report request
export async function handleCreateReportRequest(args: any, token: string) {
    try {
        const parsed = CreateReportArgumentsSchema.parse(args);
        const { customerContext } = args;

        const body = { ...parsed };

        const data = await makeDoitRequest<CreateReportResponse>(REPORTS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to create report");

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create report request");
    }
}

// Handle get report results request
export async function handleGetReportResultsRequest(args: any, token: string) {
    try {
        // Validate arguments
        const { id } = GetReportResultsArgumentsSchema.parse(args);
        const { customerContext } = args;
        // Create API URL
        const reportUrl = `${REPORTS_BASE_URL}/${encodeURIComponent(id)}`;

        try {
            const reportData = await makeDoitRequest<GetReportResultsResponse>(reportUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!reportData) {
                return createErrorResponse("Failed to retrieve report results");
            }

            const formattedResult = formatReportResults(reportData);
            return createSuccessResponse(formattedResult);
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request for report results");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling get report results request");
    }
}

// Handle update report request
export async function handleUpdateReportRequest(args: any, token: string) {
    try {
        const parsed = UpdateReportArgumentsSchema.parse(args);
        const { customerContext } = args;

        const { id, ...body } = parsed;
        const url = `${REPORTS_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest<CreateReportResponse>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to update report");

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update report request");
    }
}
