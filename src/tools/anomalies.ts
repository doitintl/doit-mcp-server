import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
  DOIT_API_BASE,
} from "../utils/util.js";

// Schema definitions
export const AnomaliesArgumentsSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe(
      "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND."
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
}

// Tool metadata
export const anomaliesTool = {
  name: "get_anomalies",
  description: "List anomalies detected in cloud costs",
  inputSchema: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description:
          "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND.",
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
    const { filter } = AnomaliesArgumentsSchema.parse(args);

    // Start with the base URL
    let anomaliesUrl = `${DOIT_API_BASE}/anomalies/v1`;

    // Add filter parameter if provided
    if (filter) {
      anomaliesUrl += `?filter=${encodeURIComponent(filter)}`;
    }

    try {
      const anomaliesData = await makeDoitRequest<AnomaliesResponse>(
        anomaliesUrl,
        token
      );

      if (!anomaliesData) {
        return createErrorResponse("Failed to retrieve anomalies data");
      }

      let anomalies = anomaliesData.anomalies || [];
      const rowCount = anomaliesData.rowCount || 0;

      if (anomalies.length === 0) {
        return createErrorResponse("No anomalies found");
      }

      const formattedAnomalies = anomalies.map(formatAnomaly).slice(0, 20);

      // Create a descriptive message that includes filter information if provided
      let anomaliesText = `Found ${rowCount} anomalies`;
      if (filter) {
        anomaliesText += ` (filtered by: ${filter})`;
      }

      if (rowCount > 20) {
        anomaliesText += `. Showing first 20:`;
      } else {
        anomaliesText += `:`;
      }

      anomaliesText += `\n\n${formattedAnomalies.join("\n")}`;

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

    let anomalyUrl = `${DOIT_API_BASE}/anomalies/v1/${id}`;

    try {
      // Explicitly set appendParams to true to ensure URL parameters are added
      const anomalyData = await makeDoitRequest<Anomaly>(
        anomalyUrl,
        token,
        true
      );

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
