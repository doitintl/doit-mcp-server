import { z } from "zod";
import type { FindCloudDiagramsResponse } from "../types/cloudDiagrams.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const CLOUD_DIAGRAMS_BASE_URL = `${DOIT_API_BASE}/clouddiagrams/v1/scheme/find`;

export const FindCloudDiagramsArgumentsSchema = z.object({
    resources: z
        .array(z.string())
        .min(1, "At least one resource ID is required.")
        .describe("Resource IDs to find diagrams for."),
});

export const findCloudDiagramsTool = {
    name: "find_cloud_diagrams",
    description:
        "Use this when the user wants to find architecture diagrams or cloud infrastructure diagrams. Returns matching diagram files. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
    inputSchema: zodToMcpInputSchema(FindCloudDiagramsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Finding diagrams...",
        "openai/toolInvocation/invoked": "Diagrams found",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleFindCloudDiagramsRequest(args: any, token: string) {
    try {
        const { resources } = FindCloudDiagramsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<FindCloudDiagramsResponse>(CLOUD_DIAGRAMS_BASE_URL, token, {
            method: "POST",
            body: { resources },
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagrams");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling find cloud diagrams request");
    }
}
