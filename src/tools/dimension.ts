import { z } from "zod";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const DIMENSION_BASE_URL = `${DOIT_API_BASE}/analytics/v1/dimension`;

// Schema definitions
export const DimensionArgumentsSchema = z.object({
    type: z
        .enum([
            "datetime",
            "fixed",
            "optional",
            "label",
            "tag",
            "project_label",
            "system_label",
            "attribution",
            "attribution_group",
            "gke",
            "gke_label",
            "organization_tag",
        ])
        .describe("Dimension type"),
    id: z.string().describe("Dimension id"),
});

// Interfaces
export interface DimensionValue {
    value: string;
}

export interface DimensionResponse {
    id: string;
    label: string;
    type: string;
    values?: DimensionValue[];
}

// Tool metadata
export const dimensionTool = {
    name: "get_dimension",
    description:
        "Use this to look up the valid filter values for a specific dimension before calling run_query — for example, call get_dimension({type: 'fixed', id: 'cloud_provider'}) to get the exact provider IDs available for this customer. Also use this when the user wants to view dimension details. Do NOT use this for listing all dimensions (use list_dimensions) or running queries (use run_query).",
    inputSchema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: [
                    "datetime",
                    "fixed",
                    "optional",
                    "label",
                    "tag",
                    "project_label",
                    "system_label",
                    "attribution",
                    "attribution_group",
                    "gke",
                    "gke_label",
                    "organization_tag",
                ],
                description: "Dimension type",
            },
            id: {
                type: "string",
                description: "Dimension id",
            },
        },
        required: ["type", "id"],
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading dimension...",
        "openai/toolInvocation/invoked": "Dimension loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// Format the dimension values if they exist
function formatDimensionValues(values?: DimensionValue[]): string {
    if (!values || values.length === 0) {
        return "No values available";
    }

    return values.map((val, index) => `  ${index + 1}. ${val.value}`).join("\n");
}

// Format the dimension for display
export function formatDimension(dimension: DimensionResponse): string {
    const formattedOutput = [`ID: ${dimension.id}`, `Label: ${dimension.label}`, `Type: ${dimension.type}`];

    if (dimension.values && dimension.values.length > 0) {
        formattedOutput.push(`Values:\n${formatDimensionValues(dimension.values)}`);
    }

    return formattedOutput.join("\n");
}

// Handle the dimension request
export async function handleDimensionRequest(args: any, token: string) {
    try {
        // Validate arguments
        const { type, id } = DimensionArgumentsSchema.parse(args);

        // Create API URL for retrieving a specific dimension
        const dimensionUrl = `${DIMENSION_BASE_URL}?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;

        try {
            const dimensionData = await makeDoitRequest<DimensionResponse>(dimensionUrl, token, {
                method: "GET",
                appendParams: true,
            });

            if (!dimensionData) {
                return createErrorResponse(`Failed to retrieve dimension with type: ${type} and id: ${id}`);
            }

            return createSuccessResponse(JSON.stringify(dimensionData));
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request for dimension");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling dimension request");
    }
}
