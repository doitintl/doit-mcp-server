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
    provider: string;
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
    easyWin?: boolean;
    easyWinDescription?: string;
    reportUrl?: string;
    cloudFlowTemplateId?: string;
    lastUpdated?: string;
}

export interface InsightsResponse {
    results: InsightResult[];
    pagination: { hasNextPage: boolean };
}

export interface ResourceResult {
    resourceId: string;
    resultType: string;
    account: string;
    provider: string;
    resourceType?: string;
    location?: string;
    resolved?: boolean;
    severity?: string;
    externalId?: string;
    externalUrl?: string;
    metadata?: Record<string, unknown>;
    result?: unknown;
}

// ── Zod schemas ─────────────────────────────────────────────────────────────

const InsightCategoryEnum = z.enum([
    "FinOps",
    "OperationalExcellence",
    "PerformanceEfficiency",
    "Reliability",
    "Security",
    "Sustainability",
]);

const InsightPriorityEnum = z.enum(["Low", "Medium", "High"]);

const InsightDisplayStatusEnum = z.enum(["actionable", "acknowledged", "in progress", "optimized", "dismissed"]);

export const ListInsightsArgumentsSchema = z.object({
    category: z
        .array(InsightCategoryEnum)
        .optional()
        .describe(
            "Filter by insight categories. Possible values: FinOps, OperationalExcellence, PerformanceEfficiency, Reliability, Security, Sustainability."
        ),
    priority: z
        .array(InsightPriorityEnum)
        .optional()
        .describe("Filter by priority levels. Possible values: Low, Medium, High."),
    displayStatus: z
        .array(InsightDisplayStatusEnum)
        .optional()
        .describe(
            "Filter by display status. Possible values: actionable, acknowledged, in progress, optimized, dismissed."
        ),
    provider: z.string().optional().describe("Filter by cloud provider."),
    easyWin: z.boolean().optional().describe("Filter for easy wins only."),
    searchTerm: z.string().optional().describe("Text search across insight titles and descriptions."),
    page: z.number().min(0).optional().describe("Page number for pagination (zero-based)."),
    pageSize: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Number of results per page (default 20, max 100)."),
});

export const GetInsightResourcesArgumentsSchema = z.object({
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

// ── Tool metadata ───────────────────────────────────────────────────────────

export const listOptimizationRecommendationsTool = {
    name: "list_optimization_recommendations",
    description:
        "Use this when the user asks about optimization, recommendations, insights, savings opportunities, " +
        "rightsizing, idle resources, security findings, or cost reduction suggestions. " +
        "Also use this when the user asks 'what insights are available?' or 'show me insights'. " +
        "This is the primary tool for 'what can I optimize?', 'how can I save money?', and 'what insights do I have?' questions. " +
        "Returns a prioritized list of actionable insights with estimated daily savings. " +
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
    description:
        "Use this when the user wants to see which specific resources are affected by an optimization " +
        "insight. Returns resource IDs, accounts, potential savings, and remediation details. Do NOT " +
        "use this for listing all insights (use list_insights).",
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

// ── Handlers ────────────────────────────────────────────────────────────────

export async function handleListInsightsRequest(args: any, token: string) {
    try {
        const { category, priority, displayStatus, provider, easyWin, searchTerm, page, pageSize } =
            ListInsightsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();

        if (category) {
            for (const c of category) {
                params.append("category", c);
            }
        }
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
            params.append("provider", provider);
        }
        if (easyWin !== undefined) {
            params.append("easyWin", String(easyWin));
        }
        if (searchTerm) {
            params.append("searchTerm", searchTerm);
        }
        if (page !== undefined) {
            params.append("page", String(page));
        }
        params.append("pageSize", String(pageSize));

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

            const results = data.results || [];

            if (results.length === 0) {
                return createSuccessResponse(
                    JSON.stringify({ results: [], pagination: data.pagination ?? { hasNextPage: false } })
                );
            }

            return createSuccessResponse(
                JSON.stringify({
                    results: results.map((r) => ({
                        key: r.key,
                        source: r.source,
                        title: r.title,
                        shortDescription: r.shortDescription,
                        provider: r.provider,
                        categories: r.categories,
                        displayStatus: r.displayStatus,
                        potentialDailySavings: r.summary?.potentialDailySavings ?? null,
                        tags: r.tags ?? [],
                        easyWin: r.easyWin ?? false,
                        lastUpdated: r.lastUpdated ?? null,
                    })),
                    pagination: data.pagination ?? { hasNextPage: false },
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
        const { source, key } = GetInsightResourcesArgumentsSchema.parse(args);
        const { customerContext } = args;

        const resourcesUrl = `${INSIGHTS_BASE_URL}/results/source/${encodeURIComponent(source)}/insight/${encodeURIComponent(key)}/resource-results`;

        try {
            const data = await makeDoitRequest<ResourceResult[]>(resourcesUrl, token, {
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
