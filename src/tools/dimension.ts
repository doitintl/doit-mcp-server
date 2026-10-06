import { z } from "zod";
import { DIMENSION_TYPE_VALUES } from "../types/reports.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
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
        .enum(DIMENSION_TYPE_VALUES)
        .describe(
            "Dimension type paired with id; use the type returned by list_dimensions. Includes allocation and allocation_rule and legacy attribution types."
        ),
    id: z
        .string()
        .describe(
            "Dimension identifier paired with type, from list_dimensions. For allocation, use the group ID; for allocation_rule, use 'allocation_rule' (the dimension key, not an individual rule ID)."
        ),
});

// Interfaces
export interface DimensionValue {
    value: string;
    cloud?: string;
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
    title: "Get dimension values",
    coversEndpoint: "get:/analytics/v1/dimension",
    description:
        "Use this when the valid filter values for a specific dimension are needed, such as for a run_query filter, or when the user wants to view dimension details. Returns id, label, type and all available value/cloud pairs in one response, without pagination. For example, get_dimension({type: 'fixed', id: 'cloud_provider'}) returns the exact provider IDs available for this customer. Do NOT use this for listing all dimensions (use list_dimensions) or running queries (use run_query).",
    inputSchema: zodToMcpInputSchema(DimensionArgumentsSchema),
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
        const { customerContext } = args;

        // Create API URL for retrieving a specific dimension
        // The dimension endpoint still stores allocation metadata under its legacy keys.
        const apiType = type === "allocation" ? "attribution_group" : type === "allocation_rule" ? "attribution" : type;
        const apiId = type === "allocation_rule" && id === "allocation_rule" ? "attribution" : id;
        const dimensionUrl = `${DIMENSION_BASE_URL}?type=${encodeURIComponent(apiType)}&id=${encodeURIComponent(apiId)}`;

        try {
            const dimensionData = await makeDoitRequest<DimensionResponse>(dimensionUrl, token, {
                method: "GET",
                appendParams: true,
                customerContext,
            });

            if (!dimensionData) {
                return createErrorResponse(`Failed to retrieve dimension with type: ${type} and id: ${id}`);
            }

            const result =
                type === "allocation" || type === "allocation_rule" ? { ...dimensionData, type, id } : dimensionData;
            return createSuccessResponse(JSON.stringify(result));
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
