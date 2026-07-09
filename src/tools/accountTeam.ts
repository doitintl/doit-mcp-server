import { z } from "zod";
import type { AccountTeamResponse } from "../types/accountTeam.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const ACCOUNT_TEAM_BASE_URL = `${DOIT_API_BASE}/customers/v1/accountTeam`;

export const ListAccountTeamArgumentsSchema = z.object({});

export const listAccountTeamTool = {
    name: "list_account_team",
    coversEndpoint: { method: "get", path: "/customers/v1/accountTeam" },
    description:
        "Use this when the user wants to know who their DoiT account team / account managers are. Returns the list of account managers assigned to the customer, including name, email, role, and Calendly scheduling link. Do NOT use this for listing platform users (use list_users) or organizations (use list_organizations).",
    inputSchema: zodToMcpInputSchema(ListAccountTeamArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading account team...",
        "openai/toolInvocation/invoked": "Account team loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListAccountTeamRequest(args: any, token: string) {
    try {
        ListAccountTeamArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<AccountTeamResponse>(ACCOUNT_TEAM_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve account team");
        }

        const accountManagers = data.accountManagers || [];

        if (accountManagers.length === 0) {
            return createSuccessResponse("No account team members found.");
        }

        return createSuccessResponse(JSON.stringify({ accountManagers }, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list account team request");
    }
}
