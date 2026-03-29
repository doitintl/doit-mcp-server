import { z } from "zod";
import type { UsersResponse } from "../types/users.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const USERS_BASE_URL = `${DOIT_API_BASE}/iam/v1/users`;

export const ListUsersArgumentsSchema = z.object({});

export const listUsersTool = {
    name: "list_users",
    description:
        "Use this when the user wants to see users in their DoiT organization or check who has access. Returns a list of users with roles. Do NOT use this for listing roles (use list_roles) or validating the current user (use validate_user).",
    inputSchema: zodToMcpInputSchema(ListUsersArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading users...",
        "openai/toolInvocation/invoked": "Users loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListUsersRequest(args: any, token: string) {
    try {
        ListUsersArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<UsersResponse>(USERS_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to retrieve users");

        return createSuccessResponse(JSON.stringify({ rowCount: data.rowCount, users: data.users }, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list users request");
    }
}
