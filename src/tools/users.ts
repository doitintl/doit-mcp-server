import { z } from "zod";
import type { UsersResponse } from "../types/users.js";
import { JOB_FUNCTION_VALUES, LANGUAGE_VALUES } from "../types/users.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatEnumValues,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const USERS_BASE_URL = `${DOIT_API_BASE}/iam/v1/users`;
export const USERS_INVITE_URL = `${USERS_BASE_URL}/invite`;

export const ListUsersArgumentsSchema = z.object({});

export const listUsersTool = {
    name: "list_users",
    description:
        "Use this when the user wants to see users in their DoiT organization or check who has access. Returns a list of users with roles. Do NOT use this for listing roles (use list_roles) or validating the current user (use validate_user).",
    inputSchema: zodToMcpInputSchema(ListUsersArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading users...",
        "openai/toolInvocation/invoked": "Users loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

const MUTABLE_FIELDS = [
    "firstName",
    "lastName",
    "jobFunction",
    "phone",
    "phoneExtension",
    "language",
    "roleId",
] as const;

const UpdateUserBaseSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "ID is required and cannot be empty."))
        .describe("The unique ID of the user to update."),
    firstName: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "First name cannot be empty or whitespace-only."))
        .optional()
        .describe("The user's first name."),
    lastName: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Last name cannot be empty or whitespace-only."))
        .optional()
        .describe("The user's last name."),
    jobFunction: z
        .enum(JOB_FUNCTION_VALUES)
        .optional()
        .describe(`The user's job function. Accepted values: ${formatEnumValues(JOB_FUNCTION_VALUES)}.`),
    phone: z
        .string()
        .optional()
        .describe(
            "The user's phone number including country calling code (e.g. +14155551234, +447911123456). Must start with a valid country calling code such as +1, +44, or +91."
        ),
    phoneExtension: z
        .string()
        .regex(/^[0-9]{1,15}$/, "Phone extension must contain only digits (up to 15 characters).")
        .optional()
        .describe("The user's phone extension. Digits only, up to 15 characters."),
    language: z
        .enum(LANGUAGE_VALUES)
        .optional()
        .describe(`The user's preferred language. Accepted values: ${formatEnumValues(LANGUAGE_VALUES)}.`),
    roleId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Role ID cannot be empty or whitespace-only."))
        .optional()
        .describe("The ID of the role to assign to the user."),
});

export const UpdateUserArgumentsSchema = UpdateUserBaseSchema.refine(
    (data) => MUTABLE_FIELDS.some((field) => data[field] !== undefined),
    {
        message:
            "At least one field to update must be provided (e.g. firstName, lastName, jobFunction, phone, phoneExtension, language, roleId).",
    }
);

export const updateUserTool = {
    name: "update_user",
    description: "Updates user information such as name, job function, phone, language, and role in the DoiT platform.",
    inputSchema: zodToMcpInputSchema(UpdateUserArgumentsSchema),
};

export const InviteUserArgumentsSchema = z.object({
    email: z.string().email().describe("The email address of the user to invite (required)."),
    roleId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Role ID cannot be empty or whitespace-only."))
        .optional()
        .describe("The ID of the role to assign to the invited user."),
    organizationId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Organization ID cannot be empty or whitespace-only."))
        .optional()
        .describe("The ID of the organization to assign the invited user to."),
});

export const inviteUserTool = {
    name: "invite_user",
    description: "Invites a new user to the organization by email, optionally assigning a role and organization.",
    inputSchema: zodToMcpInputSchema(InviteUserArgumentsSchema),
};

export async function handleUpdateUserRequest(args: any, token: string) {
    try {
        const parsed = UpdateUserArgumentsSchema.parse(args);
        const { customerContext } = args;
        const { id, ...body } = parsed;
        const url = `${USERS_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to update user");
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update user request");
    }
}

export async function handleInviteUserRequest(args: any, token: string) {
    try {
        const parsed = InviteUserArgumentsSchema.parse(args);
        const { customerContext } = args;
        const body = { ...parsed };

        const data = await makeDoitRequest(USERS_INVITE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to invite user");
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling invite user request");
    }
}

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
