import { z } from "zod";
import type { PlatformsResponse } from "../types/platforms.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const PLATFORMS_BASE_URL = `${DOIT_API_BASE}/support/v1/metadata/platforms`;

export const ListPlatformsArgumentsSchema = z.object({});

export const listPlatformsTool = {
    name: "list_platforms",
    description:
        "Use this when the user wants to see available cloud platforms in their DoiT account. Returns a list of platforms. Do NOT use this for cloud incidents (use get_cloud_incidents) or products (use list_products).",
    inputSchema: zodToMcpInputSchema(ListPlatformsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading platforms...",
        "openai/toolInvocation/invoked": "Platforms loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListPlatformsRequest(args: any, token: string) {
    try {
        ListPlatformsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<PlatformsResponse>(PLATFORMS_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve platforms");
        }

        const platforms = data.platforms || [];

        if (platforms.length === 0) {
            return createSuccessResponse("No platforms found.");
        }

        return createSuccessResponse(
            JSON.stringify({ platforms: platforms.map((p) => ({ id: p.id, displayName: p.displayName })) }, null, 2)
        );
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list platforms request");
    }
}
