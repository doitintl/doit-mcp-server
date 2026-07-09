import { z } from "zod";
import type { Folder, FoldersResponse } from "../types/folders.js";
import { DEFAULT_MAX_RESULTS } from "../utils/consts.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
    matchByName,
} from "../utils/util.js";

export const FOLDERS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/folders`;

export const DEFAULT_MAX_RESULTS_FOLDERS = DEFAULT_MAX_RESULTS;

// Schema and metadata for list folders
export const ListFoldersArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(
            `The maximum number of results to return in a single page. Defaults to ${DEFAULT_MAX_RESULTS_FOLDERS}.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Page token, returned by a previous call, to request the next page of results."),
});

export const listFoldersTool = {
    name: "list_folders",
    coversEndpoint: "get:/analytics/v1/folders",
    description:
        "Use this when the user wants to see their Cloud Analytics folders, which organize reports and allocations into a hierarchy. Returns a list of folders with their metadata. Do NOT use this for listing reports (use list_reports) or labels (use list_labels).",
    inputSchema: zodToMcpInputSchema(ListFoldersArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading folders...",
        "openai/toolInvocation/invoked": "Folders loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListFoldersRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken } = ListFoldersArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_FOLDERS);
        if (pageToken) params.append("pageToken", pageToken);

        const url = `${FOLDERS_BASE_URL}?${params}`;

        const data = await makeDoitRequest<FoldersResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve folders");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list folders request");
    }
}

// Schema and metadata for get folder
export const GetFolderArgumentsSchema = z
    .object({
        id: z
            .string()
            .transform((val) => val.trim())
            .pipe(z.string().min(1))
            .optional()
            .describe("The ID of the folder to retrieve."),
        name: z
            .string()
            .optional()
            .describe("Partial name match (case-insensitive). Used to find the folder when ID is unknown."),
    })
    .refine((d) => d.id || d.name, { message: "Either id or name must be provided." });

export const getFolderTool = {
    name: "get_folder",
    coversEndpoint: "get:/analytics/v1/folders/{id}",
    description:
        "Use this when the user wants to view details of a specific Cloud Analytics folder. Accepts either the folder ID or a partial name (case-insensitive). Do NOT use this for listing all folders (use list_folders) or viewing reports (use get_report_config).",
    inputSchema: {
        type: "object",
        properties: {
            id: { type: "string", description: "The ID of the folder to retrieve." },
            name: {
                type: "string",
                description: "Partial name match (case-insensitive). Used to find the folder when ID is unknown.",
            },
        },
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading folder...",
        "openai/toolInvocation/invoked": "Folder loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetFolderRequest(args: any, token: string) {
    try {
        const parsed = GetFolderArgumentsSchema.parse(args);
        const { customerContext } = args;
        let resolvedId = parsed.id;

        if (!resolvedId && parsed.name) {
            const listData = await makeDoitRequest<FoldersResponse>(`${FOLDERS_BASE_URL}?maxResults=200`, token, {
                method: "GET",
                customerContext,
            });
            const items = listData?.folders ?? [];
            const result = matchByName(items, parsed.name);
            if ("error" in result) return createErrorResponse(result.error);
            resolvedId = result.resolved;
        }

        const url = `${FOLDERS_BASE_URL}/${encodeURIComponent(resolvedId as string)}`;
        const data = await makeDoitRequest<Folder>(url, token, { method: "GET", customerContext });
        if (!data) {
            return createErrorResponse("Failed to retrieve folder");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get folder request");
    }
}

// Schema and metadata for create folder
export const CreateFolderArgumentsSchema = z.object({
    name: z.string().min(1).describe("The name of the folder (required, non-empty)."),
    description: z.string().optional().describe("An optional description for the folder."),
    parentFolderId: z
        .string()
        .optional()
        .describe('The ID of the parent folder. Omit or set to "root" to create at the top level.'),
});

export const createFolderTool = {
    name: "create_folder",
    coversEndpoint: "post:/analytics/v1/folders",
    description:
        "Use this when the user wants to create a new Cloud Analytics folder to organize reports and allocations. Ask the user to confirm the folder details before executing. Do NOT use this for creating reports (use create_report) or labels (use create_label).",
    inputSchema: zodToMcpInputSchema(CreateFolderArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Creating folder...",
        "openai/toolInvocation/invoked": "Folder created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleCreateFolderRequest(args: any, token: string) {
    try {
        const parsed = CreateFolderArgumentsSchema.parse(args);
        const { customerContext } = args;
        const body = { ...parsed };

        const data = await makeDoitRequest<Folder>(FOLDERS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create folder");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create folder request");
    }
}

// Schema and metadata for update folder
export const UpdateFolderArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Folder ID is required and cannot be empty."))
        .describe("The ID of the folder to update (required)."),
    name: z.string().min(1).optional().describe("New name for the folder."),
    description: z.string().nullable().optional().describe("New description for the folder. Set to null to clear."),
    parentFolderId: z
        .string()
        .optional()
        .describe('The ID of the new parent folder, or "root" to move to the top level.'),
});

export const updateFolderTool = {
    name: "update_folder",
    coversEndpoint: "patch:/analytics/v1/folders/{id}",
    description:
        "Use this when the user wants to rename, re-describe, or move (reparent) an existing Cloud Analytics folder. Ask the user to confirm changes before executing. Note: if a sibling folder at the target parent already has the same name, the folder will be auto-renamed by the API. Do NOT use this for creating new folders (use create_folder) or updating reports (use update_report).",
    inputSchema: zodToMcpInputSchema(UpdateFolderArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Updating folder...",
        "openai/toolInvocation/invoked": "Folder updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleUpdateFolderRequest(args: any, token: string) {
    try {
        const parsed = UpdateFolderArgumentsSchema.parse(args);
        const { customerContext } = args;
        const { id, ...body } = parsed;
        const url = `${FOLDERS_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest<Folder>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update folder");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update folder request");
    }
}
