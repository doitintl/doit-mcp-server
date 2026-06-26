import { z } from "zod";
import type {
    FindCloudDiagramsResponse,
    GetCloudDiagramLayerSnapshotResponse,
    GetCloudDiagramsStatsResponse,
    ListCloudDiagramLayerSnapshotsResponse,
    SearchCloudDiagramsResponse,
} from "../types/cloudDiagrams.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const CLOUD_DIAGRAMS_BASE_URL = `${DOIT_API_BASE}/clouddiagrams/v1/scheme/find`;
export const CLOUD_DIAGRAMS_STATS_URL = `${DOIT_API_BASE}/clouddiagrams/v1/scheme/stats`;
export const CLOUD_DIAGRAMS_SEARCH_URL = `${DOIT_API_BASE}/clouddiagrams/v1/scheme/search`;
export const CLOUD_DIAGRAMS_LAYERS_URL = `${DOIT_API_BASE}/clouddiagrams/v1/layers`;

export const FindCloudDiagramsArgumentsSchema = z.object({
    resources: z
        .array(z.string())
        .min(1, "At least one resource ID is required.")
        .describe("Resource IDs to find diagrams for."),
});

export const findCloudDiagramsTool = {
    name: "find_cloud_diagrams",
    description:
        "Use this when the user wants to find architecture diagrams or cloud infrastructure diagrams. Returns matching diagram files. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
    inputSchema: zodToMcpInputSchema(FindCloudDiagramsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Finding diagrams...",
        "openai/toolInvocation/invoked": "Diagrams found",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleFindCloudDiagramsRequest(args: any, token: string) {
    try {
        const { resources } = FindCloudDiagramsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest<FindCloudDiagramsResponse>(CLOUD_DIAGRAMS_BASE_URL, token, {
            method: "POST",
            body: { resources },
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagrams");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling find cloud diagrams request");
    }
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const GetCloudDiagramsStatsArgumentsSchema = z.object({
    start: z
        .string()
        .regex(ISO_DATE_TIME, "start must be an RFC3339 date-time, e.g. 2026-04-01T00:00:00Z")
        .describe("Start of the period (RFC3339 date-time, e.g. 2026-04-01T00:00:00Z)."),
    end: z
        .string()
        .regex(ISO_DATE_TIME, "end must be an RFC3339 date-time, e.g. 2026-04-28T00:00:00Z")
        .describe("End of the period (RFC3339 date-time, e.g. 2026-04-28T00:00:00Z)."),
});

export const getCloudDiagramsStatsTool = {
    name: "get_cloud_diagrams_stats",
    description:
        "Use this when the user wants activity statistics for their cloud infrastructure diagrams over a time period — node create/update/delete change counts grouped by cloud service, plus each diagram's import/sync state. Useful for change auditing and drift detection. Requires a start and end RFC3339 date-time.",
    inputSchema: zodToMcpInputSchema(GetCloudDiagramsStatsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Fetching diagram stats...",
        "openai/toolInvocation/invoked": "Diagram stats retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetCloudDiagramsStatsRequest(args: any, token: string) {
    try {
        const { start, end } = GetCloudDiagramsStatsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("start", start);
        params.append("end", end);

        const url = `${CLOUD_DIAGRAMS_STATS_URL}?${params.toString()}`;

        const data = await makeDoitRequest<GetCloudDiagramsStatsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagrams stats");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get cloud diagrams stats request");
    }
}

export const SearchCloudDiagramsArgumentsSchema = z.object({
    query: z.string().min(1, "A search query string is required.").describe("Search query string."),
    ss_id: z.string().optional().describe("Limit search to components within this layer (layer ID)."),
    from: z.number().int().min(0).optional().describe("Pagination offset (default 0)."),
    size: z.number().int().min(1).optional().describe("Maximum number of results per category (default 20)."),
});

export const searchCloudDiagramsTool = {
    name: "search_cloud_diagrams",
    description:
        "Use this when the user wants to search their cloud infrastructure diagrams and components by name or property. Returns matching diagram layers (scheme), components, and components matched by property value (prop). Optionally scope to a single layer with ss_id and page with from/size. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
    inputSchema: zodToMcpInputSchema(SearchCloudDiagramsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Searching diagrams...",
        "openai/toolInvocation/invoked": "Diagram search complete",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleSearchCloudDiagramsRequest(args: any, token: string) {
    try {
        const { query, ss_id, from, size } = SearchCloudDiagramsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const body: Record<string, unknown> = { query };
        if (ss_id !== undefined) body.ss_id = ss_id;
        if (from !== undefined) body.from = from;
        if (size !== undefined) body.size = size;

        const data = await makeDoitRequest<SearchCloudDiagramsResponse>(CLOUD_DIAGRAMS_SEARCH_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to search cloud diagrams");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling search cloud diagrams request");
    }
}

export const ListCloudDiagramLayerSnapshotsArgumentsSchema = z.object({
    id: z.string().min(1, "A layer ID is required.").describe("Layer ID to list snapshots for."),
    offset: z.number().int().min(0).optional().describe("Number of snapshots to skip (default 0)."),
    limit: z.number().int().min(1).optional().describe("Maximum number of snapshots to return (default 10)."),
    sort: z.string().optional().describe('Sort expression, e.g. "-createdAt" for descending.'),
});

export const listCloudDiagramLayerSnapshotsTool = {
    name: "list_cloud_diagram_layer_snapshots",
    description:
        "Use this when the user wants the saved snapshots (version history) of a specific cloud diagram layer. Returns each snapshot's id, name, creation time, and the previous snapshot in the chain. Requires the layer ID; optionally page with offset/limit and order with sort.",
    inputSchema: zodToMcpInputSchema(ListCloudDiagramLayerSnapshotsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Listing layer snapshots...",
        "openai/toolInvocation/invoked": "Layer snapshots retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListCloudDiagramLayerSnapshotsRequest(args: any, token: string) {
    try {
        const { id, offset, limit, sort } = ListCloudDiagramLayerSnapshotsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        if (offset !== undefined) params.append("offset", offset.toString());
        if (limit !== undefined) params.append("limit", limit.toString());
        if (sort !== undefined) params.append("sort", sort);

        const queryString = params.toString();
        const url = `${CLOUD_DIAGRAMS_LAYERS_URL}/${encodeURIComponent(id)}/snapshots${
            queryString ? `?${queryString}` : ""
        }`;

        const data = await makeDoitRequest<ListCloudDiagramLayerSnapshotsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagram layer snapshots");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list cloud diagram layer snapshots request");
    }
}

export const GetCloudDiagramLayerSnapshotArgumentsSchema = z.object({
    id: z.string().min(1, "A layer ID is required.").describe("Layer ID the snapshot belongs to."),
    snapshot_id: z.string().min(1, "A snapshot ID is required.").describe("Snapshot ID to retrieve."),
});

export const getCloudDiagramLayerSnapshotTool = {
    name: "get_cloud_diagram_layer_snapshot",
    description:
        "Use this when the user wants a single saved snapshot of a cloud diagram layer by its snapshot ID. Returns the snapshot's id, name, creation time, and previous snapshot in the chain. Requires both the layer ID and the snapshot ID.",
    inputSchema: zodToMcpInputSchema(GetCloudDiagramLayerSnapshotArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Fetching layer snapshot...",
        "openai/toolInvocation/invoked": "Layer snapshot retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetCloudDiagramLayerSnapshotRequest(args: any, token: string) {
    try {
        const { id, snapshot_id } = GetCloudDiagramLayerSnapshotArgumentsSchema.parse(args);
        const { customerContext } = args;

        const url = `${CLOUD_DIAGRAMS_LAYERS_URL}/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(
            snapshot_id
        )}`;

        const data = await makeDoitRequest<GetCloudDiagramLayerSnapshotResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagram layer snapshot");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get cloud diagram layer snapshot request");
    }
}
