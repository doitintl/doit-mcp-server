import { z } from "zod";
import type { ResourcePermissionsResponse, UpdateResourcePermissionsRequest } from "../types/permissions.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
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
    title: "Get resource permissions",
    coversEndpoint: "get:/sharing/v1/{resourceType}/{resourceId}",
    description:
        "Use this when the user wants to see who a Cloud Analytics resource is shared with and at what access level. Returns the sharing settings (per-user roles and public visibility) for a specific alert, budget, report, or allocation. Requires resourceType (alerts, budgets, reports, or allocations) and resourceId. Do NOT use this to list the resources themselves (use list_alerts, list_budgets, list_reports, or list_allocations).",
    inputSchema: zodToMcpInputSchema(GetResourcePermissionsArgumentsSchema),
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
                user: z
                    .string()
                    .describe("Email in an organization or DoiT domain; Slack/Teams addresses may only be viewers."),
                role: ResourcePermissionRoleSchema.describe("Role to grant: owner, editor, or viewer."),
            })
        )
        .min(1)
        .describe(
            "Required nonempty replacement list, not a merge. Include every permission to retain and exactly one owner."
        ),
    public: z
        .union([z.enum(["editor", "viewer"]), z.null()])
        .optional()
        .describe(
            "Public visibility: editor or viewer shares with all users in the organization. For reports, alerts and budgets, omission or null makes the resource private; omission does not preserve prior public access. Allocations require editor or viewer and reject omission/null."
        ),
});

export const updateResourcePermissionsTool = {
    name: "update_resource_permissions",
    title: "Update resource permissions",
    coversEndpoint: "put:/sharing/v1/{resourceType}/{resourceId}",
    description:
        "Use this when the user wants to change who a Cloud Analytics resource is shared with or update access levels. Replaces sharing settings with PUT for a specific alert, budget, custom report, or allocation. Requires resourceType, resourceId and a nonempty permissions list with exactly one owner. Read current permissions first and retain all intended entries. Only the current owner or a user with Ownership assignment permission may transfer ownership. Omitted public makes reports, alerts and budgets private; allocations reject omitted/null public. Do NOT use this to view current permissions (use get_resource_permissions).",
    inputSchema: zodToMcpInputSchema(UpdateResourcePermissionsArgumentsSchema),
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

        const body: UpdateResourcePermissionsRequest = { permissions };
        if (publicAccess !== undefined) body.public = publicAccess;

        const data = await makeDoitRequest<ResourcePermissionsResponse>(url, token, {
            method: "PUT",
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
