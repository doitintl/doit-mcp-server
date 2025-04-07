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
      "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. The fields eligible for filtering are: type, label, key."
    ),
});

// Interfaces
export interface Dimension {
  id: string;
  label: string;
  type: string;
}

export interface DimensionsResponse {
  rowCount: number;
  dimensions: Dimension[];
}

// Tool metadata
export const dimensionsTool = {
  name: "list_dimensions",
  description:
    "Lists Cloud Analytics dimensions that your account has access to",
  inputSchema: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description:
          "Filter string in format 'key:value|key:value'. Multiple values for same key are treated as OR, different keys as AND. The fields eligible for filtering are: type, label, key.",
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
    const { filter } = DimensionsArgumentsSchema.parse(args);

    // Create API URL
    let dimensionsUrl = `${DOIT_API_BASE}/analytics/v1/dimensions`;

    // Add filter parameter if provided
    if (filter) {
      dimensionsUrl += `?filter=${encodeURIComponent(filter)}`;
    }

    try {
      const dimensionsData = await makeDoitRequest<DimensionsResponse>(
        dimensionsUrl,
        token
      );

      if (!dimensionsData) {
        return createErrorResponse("Failed to retrieve dimensions data");
      }

      const dimensions = dimensionsData.dimensions || [];
      const rowCount = dimensionsData.rowCount || 0;

      if (dimensions.length === 0) {
        return createErrorResponse("No dimensions found");
      }

      const formattedDimensions = dimensions.map(formatDimension);

      // Create a descriptive message that includes filter information if provided
      let dimensionsText = `Found ${rowCount} dimensions`;
      if (filter) {
        dimensionsText += ` (filtered by: ${filter})`;
      }
      dimensionsText += `:`;
      dimensionsText += `\n\n${formattedDimensions.join("\n")}`;

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
