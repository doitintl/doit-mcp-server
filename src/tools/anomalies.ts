import { z } from "zod";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const ANOMALIES_BASE_URL = `${DOIT_API_BASE}/anomalies/v1`;

// Schema definitions
export const AnomaliesArgumentsSchema = z.object({
    pageToken: z.string().optional().describe("Token for pagination. Use this to get the next page of results."),
});

export const AnomalyArgumentsSchema = z.object({
    id: z.string(),
});

// Interfaces
export interface SKU {
    name: string;
    cost: number;
}

export interface Anomaly {
    id?: string;
    anomalyChartUrl?: string;
    billingAccount: string;
    attribution: string;
    costOfAnomaly: number;
    platform: string;
    scope: string;
    serviceName: string;
    top3SKUs: SKU[];
    severityLevel: string;
    timeFrame: string;
    startTime: number;
    status: string | null;
    endTime: number | null;
    acknowledged: boolean;
}

export interface AnomaliesResponse {
    rowCount: number;
    anomalies: Anomaly[];
    pageToken: string;
}

// Tool metadata
export const anomaliesTool = {
    name: "get_anomalies",
    description:
        "Use this when the user wants to check for unexpected cost spikes, billing anomalies, or unusual spending patterns. Returns recent anomalies with severity and impact. Do NOT use this for regular cost analysis (use run_query) or viewing alerts (use list_alerts).",
    inputSchema: {
        type: "object",
        properties: {
            pageToken: {
                type: "string",
                description: "Token for pagination. Use this to get the next page of results.",
            },
        },
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Checking for anomalies...",
        "openai/toolInvocation/invoked": "Anomaly check complete",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const anomalyTool = {
    name: "get_anomaly",
    description:
        "Use this when the user wants to view details of a specific cost anomaly by its ID. Returns full anomaly data including affected resources and cost impact. Do NOT use this for listing all anomalies (use get_anomalies).",
    inputSchema: {
        type: "object",
        properties: {
            id: {
                type: "string",
                description: "anomaly ID",
            },
        },
        required: ["id"],
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading anomaly details...",
        "openai/toolInvocation/invoked": "Anomaly details loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// Format anomaly data
export function formatAnomaly(anomaly: Anomaly): string {
    const startDate = new Date(anomaly.startTime).toLocaleString();
    const endDate = anomaly.endTime ? new Date(anomaly.endTime).toLocaleString() : "Ongoing";

    // Format the top SKUs
    const skusFormatted = anomaly.top3SKUs.map((sku) => `\n    - ${sku.name}: $${sku.cost.toFixed(2)}`).join("");

    return [
        anomaly.id ? `ID: ${anomaly.id}` : null,
        anomaly.anomalyChartUrl ? `Chart URL: ${anomaly.anomalyChartUrl}` : null,
        `Platform: ${anomaly.platform}`,
        `Service: ${anomaly.serviceName}`,
        `Scope: ${anomaly.scope}`,
        `Cost of Anomaly: $${anomaly.costOfAnomaly.toFixed(2)}`,
        `Severity: ${anomaly.severityLevel}`,
        `Time Frame: ${anomaly.timeFrame}`,
        `Started: ${startDate}`,
        `Ended: ${endDate}`,
        `Status: ${anomaly.status || "N/A"}`,
        `Acknowledged: ${anomaly.acknowledged ? "Yes" : "No"}`,
        `Top SKUs: ${skusFormatted}`,
        "-----------",
    ]
        .filter(Boolean)
        .join("\n");
}

// Handle anomalies request
export async function handleAnomaliesRequest(args: any, token: string) {
    try {
        const { pageToken } = AnomaliesArgumentsSchema.parse(args);
        const { customerContext } = args;

        // Create API URL with query parameters
        const params = new URLSearchParams();

        if (pageToken && pageToken.length > 1) {
            params.append("pageToken", pageToken);
        }
        params.append("maxResults", "20");

        let anomaliesUrl = ANOMALIES_BASE_URL;

        if (params.toString()) {
            anomaliesUrl += `?${params.toString()}`;
        }

        try {
            const anomaliesData = await makeDoitRequest<AnomaliesResponse>(anomaliesUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!anomaliesData) {
                return createErrorResponse("Failed to retrieve anomalies data");
            }

            const anomalies = anomaliesData.anomalies || [];
            const rowCount = anomaliesData.rowCount || 0;

            if (anomalies.length === 0) {
                return createErrorResponse("No anomalies found");
            }

            const formattedAnomalies = anomalies.map((anomaly) => ({
                platform: anomaly.platform || "",
                serviceName: anomaly.serviceName || "",
                scope: anomaly.scope || "",
                costOfAnomaly: anomaly.costOfAnomaly,
                severityLevel: anomaly.severityLevel || "",
                status: anomaly.status || null,
                startTime: anomaly.startTime ? new Date(anomaly.startTime).toISOString() : null,
                endTime: anomaly.endTime ? new Date(anomaly.endTime).toISOString() : null,
                top3SKUs: anomaly.top3SKUs && anomaly.top3SKUs.length > 0 ? anomaly.top3SKUs : null,
                id: anomaly.id || null,
                billingAccount: anomaly.billingAccount || "",
                attribution: anomaly.attribution || "",
                timeFrame: anomaly.timeFrame || "",
                acknowledged: anomaly.acknowledged,
            }));

            return createSuccessResponse(
                JSON.stringify({
                    rowCount,
                    anomalies: formattedAnomalies,
                    pageToken: anomaliesData.pageToken ?? null,
                })
            );
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling anomalies request");
    }
}

// Handle specific anomaly request
export async function handleAnomalyRequest(args: any, token: string) {
    try {
        const { id } = AnomalyArgumentsSchema.parse(args);
        const { customerContext } = args;
        const anomalyUrl = `${ANOMALIES_BASE_URL}/${id}`;

        try {
            // Explicitly set appendParams to true to ensure URL parameters are added
            const anomalyData = await makeDoitRequest<Anomaly>(anomalyUrl, token, {
                method: "GET",
                appendParams: true,
                customerContext,
            });

            if (!anomalyData) {
                return createErrorResponse(`Failed to retrieve anomaly with ID: ${id}`);
            }

            // The API response for a single anomaly doesn't include the id in the response
            // Let's add it for consistency in the formatted output
            const anomaly = { ...anomalyData, id };

            return createSuccessResponse(
                JSON.stringify({
                    id: anomaly.id,
                    billingAccount: anomaly.billingAccount,
                    attribution: anomaly.attribution,
                    costOfAnomaly: anomaly.costOfAnomaly,
                    platform: anomaly.platform,
                    scope: anomaly.scope,
                    serviceName: anomaly.serviceName,
                    top3SKUs: anomaly.top3SKUs,
                    severityLevel: anomaly.severityLevel,
                    timeFrame: anomaly.timeFrame,
                    startTime: anomaly.startTime ? new Date(anomaly.startTime).toISOString() : null,
                    endTime: anomaly.endTime ? new Date(anomaly.endTime).toISOString() : null,
                    status: anomaly.status,
                    acknowledged: anomaly.acknowledged,
                    anomalyChartUrl: anomaly.anomalyChartUrl,
                })
            );
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling anomaly request");
    }
}
