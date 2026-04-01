import { z } from "zod";
import type { OrganizationsResponse } from "../types/organizations.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const ORGANIZATIONS_BASE_URL = `${DOIT_API_BASE}/iam/v1/organizations`;

export const ListOrganizationsArgumentsSchema = z.object({}); // for consistency in future changes and other tools

export const listOrganizationsTool = {
    name: "list_organizations",
    description:
        "Use this when the user wants to see the organizations in their DoiT account. Returns a list of organizations. Do NOT use this for listing users (use list_users) or platforms (use list_platforms).",
    inputSchema: zodToMcpInputSchema(ListOrganizationsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading organizations...",
        "openai/toolInvocation/invoked": "Organizations loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListOrganizationsRequest(args: any, token: string) {
    try {
        ListOrganizationsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<OrganizationsResponse>(ORGANIZATIONS_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve organizations");
        }

        const organizations = data.organizations || [];

        if (organizations.length === 0) {
            return createSuccessResponse("No organizations found.");
        }

        return createSuccessResponse(
            JSON.stringify({ organizations: organizations.map((org) => ({ id: org.id, name: org.name })) }, null, 2)
        );
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list organizations request");
    }
}
