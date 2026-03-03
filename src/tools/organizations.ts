import { z } from "zod";
import type { OrganizationsResponse } from "../types/organizations.js";
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
    description: "Returns a list of organizations from DoiT API that are accessible to the authenticated user.",
    inputSchema: {
        type: "object",
        properties: {},
    },
};

export async function handleListOrganizationsRequest(args: any, token: string) {
    try {
        ListOrganizationsArgumentsSchema.parse(args);
        const { customerContext } = args;

        try {
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
            return handleGeneralError(error, "calling list organizations API");
        }
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list organizations request");
    }
}
