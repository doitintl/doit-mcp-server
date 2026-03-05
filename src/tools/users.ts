import { z } from "zod";
import type { UsersResponse } from "../types/users.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const USERS_BASE_URL = `${DOIT_API_BASE}/iam/v1/users`;

export const ListUsersArgumentsSchema = z.object({});

export const listUsersTool = {
    name: "list_users",
    description: "Returns a list of all users in the organization, including both active users and invited users.",
    inputSchema: zodToMcpInputSchema(ListUsersArgumentsSchema),
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
        return handleGeneralError(error, "handling list users request");
    }
}
