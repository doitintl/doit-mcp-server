import { z } from "zod";
import type { ResourcePermissionsResponse, UpdateResourcePermissionsRequest } from "../types/permissions.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const SHARING_BASE_URL = `${DOIT_API_BASE}/sharing/v1`;

export const RESOURCE_PERMISSION_TYPES = ["alerts", "budgets", "reports", "allocations"] as const;

// Schema and metadata for get resource permissions
export const GetResourcePermissionsArgumentsSchema = z.object({
    resourceType: z
        .enum(RESOURCE_PERMISSION_TYPES)
        .describe(
            "The type of resource to inspect sharing settings for. One of: alerts, budgets, reports, allocations."
        ),
    resourceId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1))
        .describe("The ID of the resource (alert, budget, report, or allocation) to retrieve permissions for."),
});

export const getResourcePermissionsTool = {
    name: "get_resource_permissions",
    description:
        "Use this when the user wants to see who a Cloud Analytics resource is shared with and at what access level. Returns the sharing settings (per-user roles and public visibility) for a specific alert, budget, report, or allocation. Requires resourceType (alerts, budgets, reports, or allocations) and resourceId. Do NOT use this to list the resources themselves (use list_alerts, list_budgets, list_reports, or list_allocations).",
    inputSchema: {
        type: "object",
        properties: {
            resourceType: {
                type: "string",
                enum: [...RESOURCE_PERMISSION_TYPES],
                description:
                    "The type of resource to inspect sharing settings for. One of: alerts, budgets, reports, allocations.",
            },
            resourceId: {
                type: "string",
                description:
                    "The ID of the resource (alert, budget, report, or allocation) to retrieve permissions for.",
            },
        },
        required: ["resourceType", "resourceId"],
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading resource permissions...",
        "openai/toolInvocation/invoked": "Resource permissions loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetResourcePermissionsRequest(args: any, token: string) {
    try {
        const { resourceType, resourceId } = GetResourcePermissionsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const url = `${SHARING_BASE_URL}/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`;

        const data = await makeDoitRequest<ResourcePermissionsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve resource permissions");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get resource permissions request");
    }
}

const ResourcePermissionRoleSchema = z.enum(["owner", "editor", "viewer"]);

export const UpdateResourcePermissionsArgumentsSchema = z.object({
    resourceType: z
        .enum(RESOURCE_PERMISSION_TYPES)
        .describe(
            "The type of resource to update sharing settings for. One of: alerts, budgets, reports, allocations."
        ),
    resourceId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1))
        .describe("The ID of the resource (alert, budget, report, or allocation) to update permissions for."),
    permissions: z
        .array(
            z.object({
                user: z.string().describe("Email address of the user."),
                role: ResourcePermissionRoleSchema.describe("Role to grant: owner, editor, or viewer."),
            })
        )
        .optional()
        .describe(
            "List of per-user permission entries to set. Each entry has a user (email) and a role (owner, editor, or viewer)."
        ),
    public: z
        .union([z.enum(["editor", "viewer"]), z.null()])
        .optional()
        .describe(
            "Public visibility level. Set to 'editor' or 'viewer' to share with all users, or null to make private."
        ),
});

export const updateResourcePermissionsTool = {
    name: "update_resource_permissions",
    description:
        "Use this when the user wants to change who a Cloud Analytics resource is shared with or update access levels. Updates the sharing settings (per-user roles and/or public visibility) for a specific alert, budget, report, or allocation. Requires resourceType and resourceId; at least one of permissions or public should be provided. Do NOT use this to view current permissions (use get_resource_permissions).",
    inputSchema: {
        type: "object",
        properties: {
            resourceType: {
                type: "string",
                enum: [...RESOURCE_PERMISSION_TYPES],
                description:
                    "The type of resource to update sharing settings for. One of: alerts, budgets, reports, allocations.",
            },
            resourceId: {
                type: "string",
                description: "The ID of the resource (alert, budget, report, or allocation) to update permissions for.",
            },
            permissions: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        user: { type: "string", description: "Email address of the user." },
                        role: {
                            type: "string",
                            enum: ["owner", "editor", "viewer"],
                            description: "Role to grant: owner, editor, or viewer.",
                        },
                    },
                    required: ["user", "role"],
                },
                description:
                    "List of per-user permission entries to set. Each entry has a user (email) and a role (owner, editor, or viewer).",
            },
            public: {
                type: ["string", "null"],
                enum: ["editor", "viewer", null],
                description:
                    "Public visibility level. Set to 'editor' or 'viewer' to share with all users, or null to make private.",
            },
        },
        required: ["resourceType", "resourceId"],
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Updating resource permissions...",
        "openai/toolInvocation/invoked": "Resource permissions updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["write_data"] }],
};

export async function handleUpdateResourcePermissionsRequest(args: any, token: string) {
    try {
        const {
            resourceType,
            resourceId,
            permissions,
            public: publicAccess,
        } = UpdateResourcePermissionsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const url = `${SHARING_BASE_URL}/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`;

        const body: UpdateResourcePermissionsRequest = {};
        if (permissions !== undefined) body.permissions = permissions;
        if (publicAccess !== undefined) body.public = publicAccess;

        const data = await makeDoitRequest<ResourcePermissionsResponse>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update resource permissions");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update resource permissions request");
    }
}
