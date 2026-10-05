import { z } from "zod";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const INSIGHTS_BASE_URL = `${DOIT_API_BASE}/insights/v1`;

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface InsightResult {
    key: string;
    source: string;
    title: string;
    shortDescription: string;
    detailedDescriptionMdx?: string;
    cloudProvider: string;
    categories: string[];
    displayStatus: string;
    summary?: {
        potentialDailySavings?: number;
        operationalRisks?: number;
        performanceRisks?: number;
        reliabilityRisks?: number;
        securityRisks?: number;
        sustainabilityRisks?: number;
    };
    tags?: string[];
    easyWinDescription?: string;
    reportUrl?: string;
    cloudFlowTemplateId?: string;
    lastUpdated?: string;
}

export interface InsightsResponse {
    results: InsightResult[];
    pagination?: { rowCount: number; pageToken?: string | null };
}

export interface ResourceResult {
    resourceId: string;
    resultType: string;
    account: string;
    cloudProvider: string;
    resourceType?: string;
    location?: string;
    resolved?: boolean;
    severity?: string;
    externalId?: string;
    externalUrl?: string;
    metadata?: Record<string, unknown>;
    result?: unknown;
}

export interface ResourceResultsResponse {
    resourceResults: ResourceResult[];
    rowCount: number;
    pageToken?: string | null;
}

// ── Zod schemas ─────────────────────────────────────────────────────────────

const InsightCategoryEnum = z.enum([
    "FinOps",
    "OperationalExcellence",
    "Operational excellence",
    "PerformanceEfficiency",
    "Performance efficiency",
    "Reliability",
    "Security",
    "Sustainability",
]);

const InsightPriorityEnum = z.enum(["Low", "Medium", "High"]);

const InsightDisplayStatusEnum = z.enum(["actionable", "acknowledged", "in progress", "optimized", "dismissed"]);

export const ListInsightsArgumentsSchema = z.object({
    category: z
        .union([InsightCategoryEnum, z.array(InsightCategoryEnum).max(1)])
        .optional()
        .describe(
            "Filter by one category; a legacy one-element array is accepted. OperationalExcellence/Operational excellence and PerformanceEfficiency/Performance efficiency are filtered within each returned page because the API's category filter cannot match them. An empty page can still have a next cursor."
        ),
    priority: z
        .array(InsightPriorityEnum)
        .optional()
        .describe("Filter by priority levels. Possible values: Low, Medium, High."),
    displayStatus: z
        .array(InsightDisplayStatusEnum)
        .optional()
        .describe(
            "Filter by display status. Omitted means all statuses, including dismissed. Possible values: actionable, acknowledged, in progress, optimized, dismissed."
        ),
    provider: z
        .string()
        .optional()
        .describe("Filter by cloud provider (sent as cloudProvider to the API, e.g. aws, gcp, azure)."),
    easyWin: z
        .boolean()
        .optional()
        .describe("True selects easy wins; false selects only non-easy-wins; omit for both."),
    searchTerm: z.string().optional().describe("Case-insensitive substring search of insight titles only."),
    page: z
        .number()
        .int()
        .min(0)
        .max(0, "Numeric pages are unsupported; use pageToken from the previous response.")
        .optional()
        .describe("Deprecated: only 0 (first page) is accepted. Use pageToken for continuation."),
    pageToken: z
        .string()
        .min(1)
        .optional()
        .describe("Non-empty opaque cursor from the previous response. Omit for the first page."),
    maxResults: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Results per page, 1–500. Overrides pageSize; defaults to 20 for compatibility."),
    pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Deprecated alias for maxResults (default 20, max 100); maxResults takes precedence."),
});

export const GetInsightResourcesArgumentsSchema = z.object({
    pageToken: z.string().optional().describe("Opaque cursor returned by the previous resource page."),
    maxResults: z
        .number()
        .int()
        .min(1)
        .max(5000)
        .optional()
        .default(1000)
        .describe("Maximum resources per page, 1–5000; defaults to 1000."),
    source: z
        .string()
        .describe(
            "The source of the insight (e.g. 'aws-cost-optimization-hub', 'aws-trusted-advisor'). Use the 'source' field from list_optimization_recommendations."
        ),
    key: z
        .string()
        .describe(
            "The key of the insight (e.g. 'delete-ebs-volumes'). Use the 'key' field from list_optimization_recommendations."
        ),
});

export const GetInsightArgumentsSchema = z.object({
    source: z
        .string()
        .describe(
            "The source of the insight (e.g. 'aws-cost-optimization-hub', 'aws-trusted-advisor'). Use the 'source' field from list_optimization_recommendations."
        ),
    key: z
        .string()
        .describe(
            "The key of the insight (e.g. 'delete-ebs-volumes'). Use the 'key' field from list_optimization_recommendations."
        ),
});

// Only insights created via the public API can be created/updated; the API accepts a single
// source value ("public-api"). Kept as an enum with a default so callers rarely need to set it.
const InsightSourceEnum = z.enum(["public-api"]);

// Categories allowed when creating an insight via the public API (narrower than the read-side
// InsightCategoryEnum used for filtering).
const CreatableInsightCategoryEnum = z.enum(["FinOps", "Security"]);

// The full set of display statuses the API accepts on writes.
const InsightWriteStatusEnum = z.enum([
    "actionable",
    "acknowledged",
    "optimized",
    "dismissed",
    "in progress",
    "upgrade needed",
    "permissions needed",
]);

const InsightDismissalDetailsSchema = z.object({
    reason: z
        .enum([
            "not relevant",
            "not enough information",
            "not worth the effort",
            "inaccurate optimization opportunities",
        ])
        .optional()
        .describe("The reason the insight was dismissed."),
    comment: z.string().optional().describe("An optional free-text comment providing additional context."),
});

export const PostInsightResultArgumentsSchema = z.object({
    source: InsightSourceEnum.default("public-api").describe(
        "The source that owns the insight. Only 'public-api' insights can be managed via this endpoint; defaults to public-api."
    ),
    key: z
        .string()
        .describe("A unique key identifying the insight within the source. Used as both the path key and body key."),
    title: z.string().describe("The display title of the insight."),
    shortDescription: z.string().describe("A brief summary of the insight."),
    cloudProvider: z.string().describe("The cloud provider associated with the insight (e.g. 'aws', 'gcp', 'azure')."),
    categories: z
        .array(CreatableInsightCategoryEnum)
        .min(1)
        .describe("One or more categories this insight belongs to. Possible values: FinOps, Security."),
    detailedDescriptionMdx: z.string().optional().describe("A detailed description of the insight in MDX format."),
    reportUrl: z.string().optional().describe("URL to an external report related to this insight."),
    cloudFlowTemplateId: z
        .string()
        .optional()
        .describe("ID of a CloudFlow template that can automate the remediation of this insight."),
    easyWinDescription: z.string().optional().describe("A description of why this insight is considered an easy win."),
    status: InsightWriteStatusEnum.optional().describe("The display status of the insight."),
    dismissalDetails: InsightDismissalDetailsSchema.optional().describe(
        "Details for why the insight was dismissed (relevant when status is 'dismissed')."
    ),
});

export const UpdateInsightStatusArgumentsSchema = z
    .object({
        source: InsightSourceEnum.default("public-api").describe(
            "The source that owns the insight. Only 'public-api' insights can be managed via this endpoint; defaults to public-api."
        ),
        key: z.string().describe("The unique key identifying the insight to update."),
        status: InsightDisplayStatusEnum.describe(
            "The new display status of the insight. Possible values: actionable, acknowledged, optimized, dismissed, in progress."
        ),
        dismissalDetails: InsightDismissalDetailsSchema.optional().describe(
            "Details for why the insight was dismissed; reason is required when status is 'dismissed'."
        ),
    })
    .refine((data) => data.status !== "dismissed" || !!data.dismissalDetails?.reason, {
        message: "dismissalDetails.reason is required when status is dismissed",
        path: ["dismissalDetails", "reason"],
    });

// ── Tool metadata ───────────────────────────────────────────────────────────

export const listOptimizationRecommendationsTool = {
    name: "list_optimization_recommendations",
    title: "List optimization recommendations",
    coversEndpoint: "get:/insights/v1/results",
    description:
        "Use this when the user asks about optimization, recommendations, insights, savings opportunities, " +
        "rightsizing, idle resources, security findings, or cost reduction suggestions. " +
        "Also use this when the user asks 'what insights are available?' or 'show me insights'. " +
        "This is the primary tool for 'what can I optimize?', 'how can I save money?', and 'what insights do I have?' questions. " +
        "Returns insights ordered within each page by estimated daily savings, not priority. All statuses are included unless filtered, including dismissed. easyWin is derived from easyWinDescription when present, otherwise null. Follow pageToken for more results. " +
        "Do NOT use this for cost anomalies/spikes (use get_anomalies) or budget tracking (use list_budgets).",
    inputSchema: zodToMcpInputSchema(ListInsightsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading insights...",
        "openai/toolInvocation/invoked": "Insights ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const getInsightResourcesTool = {
    name: "get_insight_resources",
    title: "Get insight resources",
    coversEndpoint: "get:/insights/v1/results/source/{sourceID}/insight/{insightKey}/resource-results",
    description:
        "Use this when the user wants to see which specific resources are affected by an optimization " +
        "insight. Returns a page of resourceResults with rowCount and pageToken, resource IDs, accounts, savings or risk counts. There is no dedicated remediation field. Default page size is 1000; follow pageToken for more resources. Do NOT " +
        "use this for listing all insights (use list_optimization_recommendations).",
    inputSchema: zodToMcpInputSchema(GetInsightResourcesArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading insight resources...",
        "openai/toolInvocation/invoked": "Insight resources ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const getInsightTool = {
    name: "get_insight",
    title: "Get insight",
    coversEndpoint: "get:/insights/v1/results/source/{sourceID}/insight/{insightKey}",
    description:
        "Use this when the user wants the details and aggregate summary (savings, risk counts, status, " +
        "description) of a single optimization insight identified by its source and key. Returns the " +
        "insight metadata only — it does NOT include the individual affected resources (use " +
        "get_insight_resources for those) and is not for listing all insights (use " +
        "list_optimization_recommendations).",
    inputSchema: zodToMcpInputSchema(GetInsightArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading insight...",
        "openai/toolInvocation/invoked": "Insight ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const postInsightResultTool = {
    name: "post_insight_result",
    title: "Post insight result",
    coversEndpoint: "post:/insights/v1/results/source/{sourceID}/insight/{insightKey}",
    description:
        "Use this when the user wants to create a new custom insight or update an existing one's metadata " +
        "(title, description, categories, status, remediation links). Only insights owned by the " +
        "'public-api' source can be managed (the default source). Requires key, title, shortDescription, cloudProvider and categories on every call. This replaces insight metadata: omitted optional fields such as detailedDescriptionMdx, reportUrl, easyWinDescription and cloudFlowTemplateId are cleared. " +
        "Affected resources are managed separately (post_insight_resource_results). For a status-only change, use update_insight_status to preserve metadata despite that endpoint's deprecation.",
    inputSchema: zodToMcpInputSchema(PostInsightResultArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Saving insight...",
        "openai/toolInvocation/invoked": "Insight saved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export const updateInsightStatusTool = {
    name: "update_insight_status",
    title: "Update insight status",
    coversEndpoint: "put:/insights/v1/results/source/{sourceID}/insight/{insightKey}/status",
    description:
        "Use this when the user wants to change the display status of an existing insight (e.g. mark it " +
        "acknowledged, in progress, optimized, or dismissed). This endpoint is deprecated but remains the safe choice for status-only changes because it preserves optional insight metadata; post_insight_result replaces it. Only insights owned by the 'public-api' " +
        "source can be managed. When dismissing, dismissalDetails.reason is required; comment is optional. Do NOT " +
        "use this to edit an insight's title/description or create one (use post_insight_result).",
    inputSchema: zodToMcpInputSchema(UpdateInsightStatusArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Updating insight status...",
        "openai/toolInvocation/invoked": "Insight status updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

// ── Handlers ────────────────────────────────────────────────────────────────

export async function handleListInsightsRequest(args: any, token: string) {
    try {
        const { category, priority, displayStatus, provider, easyWin, searchTerm, pageToken, maxResults, pageSize } =
            ListInsightsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        const selectedCategory = typeof category === "string" ? category : category?.[0];
        const clientSideCategory =
            selectedCategory === "OperationalExcellence" || selectedCategory === "Operational excellence"
                ? "Operational excellence"
                : selectedCategory === "PerformanceEfficiency" || selectedCategory === "Performance efficiency"
                  ? "Performance efficiency"
                  : undefined;

        if (selectedCategory && !clientSideCategory) params.append("category", selectedCategory);
        if (priority) {
            for (const p of priority) {
                params.append("priority", p);
            }
        }
        if (displayStatus) {
            for (const s of displayStatus) {
                params.append("displayStatus", s);
            }
        }
        if (provider) {
            params.append("cloudProvider", provider);
        }
        if (easyWin !== undefined) {
            params.append("easyWin", String(easyWin));
        }
        if (searchTerm) {
            params.append("searchTerm", searchTerm);
        }
        if (pageToken) params.append("pageToken", pageToken);
        params.append("maxResults", String(maxResults ?? pageSize));

        let insightsUrl = `${INSIGHTS_BASE_URL}/results`;
        const queryString = params.toString();
        if (queryString) {
            insightsUrl += `?${queryString}`;
        }

        try {
            const data = await makeDoitRequest<InsightsResponse>(insightsUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!data) {
                return createErrorResponse("Failed to retrieve insights data");
            }

            const results = clientSideCategory
                ? (data.results ?? []).filter((result) => result.categories?.includes(clientSideCategory))
                : data.results || [];

            const formatted = results
                .map((r) => ({
                    key: r.key,
                    source: r.source,
                    title: r.title,
                    shortDescription: r.shortDescription,
                    provider: r.cloudProvider,
                    categories: (r.categories ?? []).join(", "),
                    displayStatus: r.displayStatus,
                    potentialDailySavings: r.summary?.potentialDailySavings ?? 0,
                    tags: r.tags ?? [],
                    easyWin: typeof r.easyWinDescription === "string" ? r.easyWinDescription !== "" : null,
                    easyWinDescription: r.easyWinDescription ?? null,
                    lastUpdated: r.lastUpdated ?? null,
                }))
                .sort((a, b) => b.potentialDailySavings - a.potentialDailySavings);

            return createSuccessResponse(
                JSON.stringify({
                    rowCount: formatted.length,
                    insights: formatted,
                    pageToken: data.pagination?.pageToken || null,
                })
            );
        } catch (error) {
            return handleGeneralError(error, "making DoiT Insights API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling list_insights request");
    }
}

export async function handleGetInsightResourcesRequest(args: any, token: string) {
    try {
        const { source, key, pageToken, maxResults } = GetInsightResourcesArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams({ maxResults: String(maxResults) });
        if (pageToken) params.set("pageToken", pageToken);
        const resourcesUrl = `${INSIGHTS_BASE_URL}/results/source/${encodeURIComponent(source)}/insight/${encodeURIComponent(key)}/resource-results?${params}`;

        try {
            const data = await makeDoitRequest<ResourceResultsResponse>(resourcesUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!data) {
                return createErrorResponse(`Failed to retrieve resources for insight ${key} (source: ${source})`);
            }

            return createSuccessResponse(JSON.stringify(data));
        } catch (error) {
            return handleGeneralError(error, "making DoiT Insights API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling get_insight_resources request");
    }
}

export async function handleGetInsightRequest(args: any, token: string) {
    try {
        const { source, key } = GetInsightArgumentsSchema.parse(args);
        const { customerContext } = args;

        const insightUrl = `${INSIGHTS_BASE_URL}/results/source/${encodeURIComponent(source)}/insight/${encodeURIComponent(key)}`;

        try {
            const data = await makeDoitRequest<InsightResult>(insightUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!data) {
                return createErrorResponse(`Failed to retrieve insight ${key} (source: ${source})`);
            }

            return createSuccessResponse(JSON.stringify(data, null, 2));
        } catch (error) {
            return handleGeneralError(error, "making DoiT Insights API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling get_insight request");
    }
}

export async function handlePostInsightResultRequest(args: any, token: string) {
    try {
        const {
            source,
            key,
            title,
            shortDescription,
            cloudProvider,
            categories,
            detailedDescriptionMdx,
            reportUrl,
            cloudFlowTemplateId,
            easyWinDescription,
            status,
            dismissalDetails,
        } = PostInsightResultArgumentsSchema.parse(args);
        const { customerContext } = args;

        const insightUrl = `${INSIGHTS_BASE_URL}/results/source/${encodeURIComponent(source)}/insight/${encodeURIComponent(key)}`;

        const body: Record<string, unknown> = {
            key,
            title,
            shortDescription,
            cloudProvider,
            categories,
        };
        if (detailedDescriptionMdx !== undefined) body.detailedDescriptionMdx = detailedDescriptionMdx;
        if (reportUrl !== undefined) body.reportUrl = reportUrl;
        if (cloudFlowTemplateId !== undefined) body.cloudFlowTemplateId = cloudFlowTemplateId;
        if (easyWinDescription !== undefined) body.easyWinDescription = easyWinDescription;
        if (status !== undefined) body.status = status;
        if (dismissalDetails !== undefined) body.dismissalDetails = dismissalDetails;

        try {
            const data = await makeDoitRequest<InsightResult>(insightUrl, token, {
                method: "POST",
                body,
                customerContext,
            });

            if (!data) {
                return createErrorResponse(`Failed to create or update insight ${key} (source: ${source})`);
            }

            return createSuccessResponse(JSON.stringify(data, null, 2));
        } catch (error) {
            return handleGeneralError(error, "making DoiT Insights API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling post_insight_result request");
    }
}

export async function handleUpdateInsightStatusRequest(args: any, token: string) {
    try {
        const { source, key, status, dismissalDetails } = UpdateInsightStatusArgumentsSchema.parse(args);
        const { customerContext } = args;

        const statusUrl = `${INSIGHTS_BASE_URL}/results/source/${encodeURIComponent(source)}/insight/${encodeURIComponent(key)}/status`;

        const body: Record<string, unknown> = { status };
        if (dismissalDetails !== undefined) body.dismissalDetails = dismissalDetails;

        try {
            // The API returns 204 No Content on success, so there is no body to parse.
            const data = await makeDoitRequest<Record<string, never>>(statusUrl, token, {
                method: "PUT",
                body,
                customerContext,
                parseResponse: false,
            });

            if (!data) {
                return createErrorResponse(`Failed to update status for insight ${key} (source: ${source})`);
            }

            return createSuccessResponse(JSON.stringify({ success: true, source, key, status }, null, 2));
        } catch (error) {
            return handleGeneralError(error, "making DoiT Insights API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling update_insight_status request");
    }
}
