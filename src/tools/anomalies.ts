import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  DOIT_API_BASE,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
} from "../utils/util.js";

// Schema definitions
export const AnomaliesArgumentsSchema = z.object({
  pageToken: z
    .string()
    .optional()
    .describe(
      "Token for pagination. Use this to get the next page of results."
    ),
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
  description: "List anomalies detected in cloud costs",
  inputSchema: {
    type: "object",
    properties: {
      pageToken: {
        type: "string",
        description:
          "Token for pagination. Use this to get the next page of results.",
      },
    },
  },
};

export const anomalyTool = {
  name: "get_anomaly",
  description: "Get a specific anomaly by ID",
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
};

// Format anomaly data
export function formatAnomaly(anomaly: Anomaly): string {
  const startDate = new Date(anomaly.startTime).toLocaleString();
  const endDate = anomaly.endTime
    ? new Date(anomaly.endTime).toLocaleString()
    : "Ongoing";

  // Format the top SKUs
  const skusFormatted = anomaly.top3SKUs
    .map((sku) => `\n    - ${sku.name}: $${sku.cost.toFixed(2)}`)
    .join("");

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

    let anomaliesUrl = `${DOIT_API_BASE}/anomalies/v1`;

    if (params.toString()) {
      anomaliesUrl += `?${params.toString()}`;
    }

    try {
      const anomaliesData = await makeDoitRequest<AnomaliesResponse>(
        anomaliesUrl,
        token,
        { method: "GET", customerContext }
      );

      if (!anomaliesData) {
        return createErrorResponse("Failed to retrieve anomalies data");
      }

      const anomalies = anomaliesData.anomalies || [];
      const rowCount = anomaliesData.rowCount || 0;

      if (anomalies.length === 0) {
        return createErrorResponse("No anomalies found");
      }

      // Map anomalies to the required format
      const formattedAnomalies = anomalies.map((anomaly) => ({
        id: anomaly.id || null,
        billingAccount: anomaly.billingAccount || "",
        attribution: anomaly.attribution || "",
        costOfAnomaly: anomaly.costOfAnomaly,
        platform: anomaly.platform || "",
        scope: anomaly.scope || "",
        serviceName: anomaly.serviceName || "",
        top3SKUs:
          anomaly.top3SKUs && anomaly.top3SKUs.length > 0
            ? anomaly.top3SKUs
            : null,
        severityLevel: anomaly.severityLevel || "",
        timeFrame: anomaly.timeFrame || "",
        startTime: anomaly.startTime
          ? new Date(anomaly.startTime).toISOString()
          : null,
        status: anomaly.status || null,
        endTime: anomaly.endTime
          ? new Date(anomaly.endTime).toISOString()
          : null,
        acknowledged: anomaly.acknowledged,
      }));

      let anomaliesText = `Found ${rowCount} anomalies`;

      anomaliesText += `:\n\n${formattedAnomalies
        .map((a) => JSON.stringify(a, null, 2))
        .join("\n")}\n\n${
        anomaliesData.pageToken ? `Page token: ${anomaliesData.pageToken}` : ""
      }`;

      return createSuccessResponse(anomaliesText);
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
    const anomalyUrl = `${DOIT_API_BASE}/anomalies/v1/${id}`;

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

      const formattedAnomaly = formatAnomaly(anomaly);
      return createSuccessResponse(`Anomaly details:\n\n${formattedAnomaly}`);
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
