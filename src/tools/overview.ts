import { z } from "zod";
import { createSuccessResponse, DOIT_API_BASE, handleGeneralError, makeDoitRequest } from "../utils/util.js";

export const CloudOverviewArgumentsSchema = z.object({});

const QUERY_URL = `${DOIT_API_BASE}/analytics/v1/reports/query`;
const ANOMALIES_URL = `${DOIT_API_BASE}/anomalies/v1?maxResults=5`;
const INCIDENTS_URL = `${DOIT_API_BASE}/core/v1/cloudincidents`;

// ── Tool metadata ──────────────────────────────────────────────────────────────

export const cloudOverviewTool = {
    name: "get_cloud_overview",
    description:
        "Use this when the user wants a high-level overview or dashboard of their entire cloud infrastructure. " +
        "Returns cost by cloud provider, top services per cloud, top projects per cloud, recent cost anomalies, " +
        "and recent cloud incidents — all in a single call. " +
        "Do NOT use this for detailed drill-downs (use run_query), single-provider analysis, or anomaly-only queries.",
    inputSchema: { type: "object", properties: {} },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Building cloud overview...",
        "openai/toolInvocation/invoked": "Cloud overview ready",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// ── Internal query builder ──────────────────────────────────────────────────

function runQuery(token: string, customerContext: string | undefined, config: unknown) {
    return makeDoitRequest<{ result: { schema: unknown[]; rows: unknown[][] } }>(QUERY_URL, token, {
        method: "POST",
        body: { config },
        appendParams: true,
        customerContext,
    });
}

const TIME_RANGE_30D = { mode: "last", amount: 30, unit: "day", includeCurrent: true };

// ── Handler ────────────────────────────────────────────────────────────────────

export async function handleCloudOverviewRequest(args: any, token: string) {
    try {
        const customerContext = args?.customerContext;

        const [cloudCostResult, servicesResult, projectsResult, anomaliesResult, incidentsResult] =
            await Promise.allSettled([
                // 1. Cost per cloud (last 30 days)
                runQuery(token, customerContext, {
                    dataSource: "billing",
                    metrics: [{ type: "basic", value: "cost" }],
                    timeRange: TIME_RANGE_30D,
                    group: [{ id: "cloud_provider", type: "fixed" }],
                }),

                // 2. Top 5 services per cloud (last 30 days)
                runQuery(token, customerContext, {
                    dataSource: "billing",
                    metrics: [{ type: "basic", value: "cost" }],
                    timeRange: TIME_RANGE_30D,
                    group: [
                        { id: "cloud_provider", type: "fixed" },
                        {
                            id: "service_description",
                            type: "fixed",
                            limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 5 },
                        },
                    ],
                }),

                // 3. Top 5 projects per cloud (last 30 days)
                runQuery(token, customerContext, {
                    dataSource: "billing",
                    metrics: [{ type: "basic", value: "cost" }],
                    timeRange: TIME_RANGE_30D,
                    group: [
                        { id: "cloud_provider", type: "fixed" },
                        {
                            id: "project_id",
                            type: "fixed",
                            limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 5 },
                        },
                    ],
                }),

                // 4. Recent anomalies (last 5)
                makeDoitRequest<{ rowCount: number; anomalies: unknown[] }>(ANOMALIES_URL, token, {
                    method: "GET",
                    customerContext,
                }),

                // 5. Recent cloud incidents (last 5)
                makeDoitRequest<{ incidents: unknown[] }>(`${INCIDENTS_URL}?maxResults=5`, token, {
                    method: "GET",
                    customerContext,
                }),
            ]);

        // Extract query results safely
        function extractQuery(r: PromiseSettledResult<any>) {
            if (r.status === "rejected" || !r.value?.result) return { columns: [], rows: [] };
            return {
                columns: r.value.result.schema ?? [],
                rows: r.value.result.rows ?? [],
            };
        }

        const costByCloud = extractQuery(cloudCostResult);
        const topServices = extractQuery(servicesResult);
        const topProjects = extractQuery(projectsResult);

        const anomalies =
            anomaliesResult.status === "fulfilled" && anomaliesResult.value?.anomalies
                ? (anomaliesResult.value.anomalies as unknown[]).slice(0, 5)
                : [];

        const incidents =
            incidentsResult.status === "fulfilled" && incidentsResult.value?.incidents
                ? (incidentsResult.value.incidents as unknown[]).slice(0, 5)
                : [];

        return createSuccessResponse(JSON.stringify({ costByCloud, topServices, topProjects, anomalies, incidents }));
    } catch (error) {
        return handleGeneralError(error, "handling cloud overview request");
    }
}
