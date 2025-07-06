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
export const DimensionsArgumentsSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe(
      "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. The fields eligible for filtering are: type, label, key. use the filter parameter only if you know the exact value of the key, otherwise the filter should be empty."
    ),
  pageToken: z
    .string()
    .optional()
    .describe(
      "Token for pagination. Use this to get the next page of results."
    ),
});

// Interfaces
export interface Dimension {
  id: string;
  label: string;
  type: string;
}

export interface DimensionsResponse {
  pageToken: any;
  rowCount: number;
  dimensions: Dimension[];
}

// Tool metadata
export const dimensionsTool = {
  name: "list_dimensions",
  description:
    "Lists Cloud Analytics dimensions that your account has access to. Use this tool to get the dimensions that you can use in the run_query tool. Use filter to narrow down the results.",
  inputSchema: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description: `Filter string (optional) in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. The fields eligible for filtering are: type, label, key. 
          use the filter parameter only if you know the exact value of the key, otherwise the filter should be empty.`,
      },
      pageToken: {
        type: "string",
        description:
          "Token for pagination. Use this to get the next page of results.",
      },
    },
  },
};

// Format a dimension for display
export function formatDimension(dimension: Dimension): string {
  return [
    `ID: ${dimension.id}`,
    `Label: ${dimension.label}`,
    `Type: ${dimension.type}`,
    "-----------",
  ].join("\n");
}

// Handle the dimensions request
export async function handleDimensionsRequest(args: any, token: string) {
  try {
    // Validate arguments
    const { filter, pageToken } = DimensionsArgumentsSchema.parse(args);
    const { customerContext } = args;
    // Create API URL with query parameters
    const params = new URLSearchParams();
    if (filter) {
      params.append("filter", filter);
    }
    if (pageToken) {
      params.append("pageToken", pageToken);
    }

    params.append("maxResults", "300");

    let dimensionsUrl = `${DOIT_API_BASE}/analytics/v1/dimensions`;
    if (params.toString()) {
      dimensionsUrl += `?${params.toString()}`;
    }

    try {
      const dimensionsData = await makeDoitRequest<DimensionsResponse>(
        dimensionsUrl,
        token,
        { method: "GET", customerContext }
      );

      if (!dimensionsData) {
        return createErrorResponse("Failed to retrieve dimensions data");
      }

      const dimensions = dimensionsData.dimensions || [];
      const rowCount = dimensionsData.rowCount || 0;

      if (dimensions.length === 0) {
        return createErrorResponse(
          "No dimensions found, please check the filter parameter, try without filter if you don't know the exact value of the key"
        );
      }

      const formattedDimensions = dimensions.map(formatDimension);

      // Create a descriptive message that includes filter information if provided
      let dimensionsText = `Found ${rowCount} dimensions`;
      if (filter) {
        dimensionsText += ` (filtered by: ${filter})`;
      }
      dimensionsText += `:`;
      dimensionsText += `\n\n${formattedDimensions.join("\n")} \n\n${
        dimensionsData.pageToken
          ? `Page token: ${dimensionsData.pageToken}`
          : ""
      }`;

      return createSuccessResponse(dimensionsText);
    } catch (error) {
      return handleGeneralError(error, "making DoiT API request");
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(formatZodError(error));
    }
    return handleGeneralError(error, "handling dimensions request");
  }
}
