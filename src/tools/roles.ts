import { z } from "zod";
import type { RolesResponse } from "../types/roles.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const ROLES_BASE_URL = `${DOIT_API_BASE}/iam/v1/roles`;

export const ListRolesArgumentsSchema = z.object({});

export const listRolesTool = {
    name: "list_roles",
    description:
        "Use this when the user wants to see available roles in their DoiT organization. Returns a list of roles with permissions. Do NOT use this for listing users (use list_users) or organizations (use list_organizations).",
    inputSchema: zodToMcpInputSchema(ListRolesArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading roles...",
        "openai/toolInvocation/invoked": "Roles loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListRolesRequest(args: any, token: string) {
    try {
        ListRolesArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<RolesResponse>(ROLES_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to retrieve roles");

        return createSuccessResponse(JSON.stringify({ roles: data.roles }, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list roles request");
    }
}
