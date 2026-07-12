import { z } from "zod";
import type {
    CloudDiagramCostSnapshot,
    CloudDiagramLayerSnapshot,
    CloudDiagramResourceRelationshipsResponse,
    FindCloudDiagramsResponse,
    GetCloudDiagramComponentsResponse,
    GetCloudDiagramsStatsResponse,
    ListCloudDiagramActivityGroupsResponse,
    ListCloudDiagramLayerSnapshotsResponse,
    ListCloudDiagramNodeActivitiesResponse,
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
export const CLOUD_DIAGRAMS_SCHEME_GET_URL = `${DOIT_API_BASE}/clouddiagrams/v1/scheme/get`;
export const CLOUD_DIAGRAMS_STATUSSHEET_URL = `${DOIT_API_BASE}/clouddiagrams/v1/statussheet`;
export const CLOUD_DIAGRAMS_ACTIVITY_URL = `${DOIT_API_BASE}/clouddiagrams/v1/activity`;
export const CLOUD_DIAGRAMS_NODE_ACTIVITIES_URL = `${DOIT_API_BASE}/clouddiagrams/v1/activity/node-activities`;

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const GetCloudDiagramCostSnapshotArgumentsSchema = z.object({
    layerId: z
        .string()
        .min(1, "A diagram layer ID is required.")
        .describe("The diagram layer (statussheet) ID to get a cost snapshot for."),
    startDate: z
        .string()
        .regex(ISO_DATE, "startDate must be a calendar date in YYYY-MM-DD format, e.g. 2026-04-01")
        .describe("Start of the period (calendar date, YYYY-MM-DD, e.g. 2026-04-01)."),
    endDate: z
        .string()
        .regex(ISO_DATE, "endDate must be a calendar date in YYYY-MM-DD format, e.g. 2026-04-30")
        .describe("End of the period (calendar date, YYYY-MM-DD, e.g. 2026-04-30)."),
    interval: z
        .enum(["day", "week", "month"])
        .optional()
        .describe("Bucket granularity for the cost trend. Possible values: day, week, month (defaults to day)."),
});

export const getCloudDiagramCostSnapshotTool = {
    name: "get_cloud_diagram_cost_snapshot",
    description:
        "Use this when the user wants a cost snapshot for a specific cloud infrastructure diagram layer over a time period — total spend, period-over-period trend percentage, the top resources and services by cost, and a cost trend over time. Requires the diagram layer ID and a startDate/endDate (YYYY-MM-DD). Do NOT use this for account-wide cost analysis (use run_query) or budgets (use list_budgets).",
    inputSchema: zodToMcpInputSchema(GetCloudDiagramCostSnapshotArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Fetching diagram cost snapshot...",
        "openai/toolInvocation/invoked": "Diagram cost snapshot retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetCloudDiagramCostSnapshotRequest(args: any, token: string) {
    try {
        const { layerId, startDate, endDate, interval } = GetCloudDiagramCostSnapshotArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("startDate", startDate);
        params.append("endDate", endDate);
        if (interval !== undefined) params.append("interval", interval);

        const url = `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/${encodeURIComponent(layerId)}/costs?${params.toString()}`;

        const data = await makeDoitRequest<CloudDiagramCostSnapshot>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagram cost snapshot");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get cloud diagram cost snapshot request");
    }
}

export const GetCloudDiagramResourceRelationshipsArgumentsSchema = z.object({
    layerId: z
        .string()
        .min(1, "A diagram layer ID is required.")
        .describe("The diagram layer (statussheet) ID that contains the resource."),
    resourceId: z
        .string()
        .min(1, "A resource ID is required.")
        .describe("The ID of the resource (node, element, or group) to map relationships for."),
    direction: z
        .enum(["downstream", "upstream", "both"])
        .optional()
        .describe(
            "Relationship direction to traverse. Possible values: downstream, upstream, both (defaults to both)."
        ),
    depth: z
        .enum(["direct", "transitive"])
        .optional()
        .describe("How far to traverse. Possible values: direct, transitive (defaults to direct)."),
    kind: z
        .enum(["edges", "group_members", "both"])
        .optional()
        .describe(
            "Which relationship kinds to include. Possible values: edges, group_members, both (defaults to edges)."
        ),
});

export const getCloudDiagramResourceRelationshipsTool = {
    name: "get_cloud_diagram_resource_relationships",
    description:
        "Use this when the user wants to understand how a specific resource in a cloud infrastructure diagram is connected to other resources — its upstream/downstream edges and group membership. Returns the anchor resource plus related resources with their relation type and hop distance. Requires the diagram layer ID and the resource ID. Do NOT use this for cost analysis (use get_cloud_diagram_cost_snapshot or run_query).",
    inputSchema: zodToMcpInputSchema(GetCloudDiagramResourceRelationshipsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Mapping resource relationships...",
        "openai/toolInvocation/invoked": "Resource relationships retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetCloudDiagramResourceRelationshipsRequest(args: any, token: string) {
    try {
        const { layerId, resourceId, direction, depth, kind } =
            GetCloudDiagramResourceRelationshipsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        if (direction !== undefined) params.append("direction", direction);
        if (depth !== undefined) params.append("depth", depth);
        if (kind !== undefined) params.append("kind", kind);

        let url = `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/${encodeURIComponent(layerId)}/resources/${encodeURIComponent(resourceId)}/relationships`;
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const data = await makeDoitRequest<CloudDiagramResourceRelationshipsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagram resource relationships");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get cloud diagram resource relationships request");
    }
}

export const ListCloudDiagramActivityGroupsArgumentsSchema = z.object({
    ss_id: z.string().min(1, "A layer ID (ss_id) is required.").describe("Layer ID to list activity groups for."),
    limit: z.number().int().min(1).optional().describe("Maximum number of groups to return (default 10)."),
    offset: z.number().int().min(0).optional().describe("Number of groups to skip (default 0)."),
    tags: z.array(z.string()).optional().describe("Filter activity groups by tags."),
});

export const listCloudDiagramActivityGroupsTool = {
    name: "list_cloud_diagram_activity_groups",
    description:
        "Use this when the user wants the change history of a cloud diagram layer grouped by snapshot. Returns snapshot activity groups for the given layer (ss_id), ordered by timestamp descending; each group references a snapshot and contains the individual activity records (node/link/group/attachment create/update/delete) that belong to it. Page with offset/limit and filter with tags. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
    inputSchema: zodToMcpInputSchema(ListCloudDiagramActivityGroupsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Fetching activity groups...",
        "openai/toolInvocation/invoked": "Activity groups retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListCloudDiagramActivityGroupsRequest(args: any, token: string) {
    try {
        const { ss_id, limit, offset, tags } = ListCloudDiagramActivityGroupsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("ss_id", ss_id);
        if (limit !== undefined) params.append("limit", String(limit));
        if (offset !== undefined) params.append("offset", String(offset));
        if (tags !== undefined) {
            for (const tag of tags) params.append("tags", tag);
        }

        const url = `${CLOUD_DIAGRAMS_ACTIVITY_URL}?${params.toString()}`;

        const data = await makeDoitRequest<ListCloudDiagramActivityGroupsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagram activity groups");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list cloud diagram activity groups request");
    }
}

export const ListCloudDiagramNodeActivitiesArgumentsSchema = z.object({
    ss_id: z.string().min(1, "A layer ID (ss_id) is required.").describe("Layer ID the node belongs to."),
    nodeId: z.string().min(1, "A node component ID (nodeId) is required.").describe("Node component ID."),
    limit: z.number().int().min(1).optional().describe("Maximum number of records to return (default 50)."),
    offset: z.number().int().min(0).optional().describe("Number of records to skip (default 0)."),
});

export const listCloudDiagramNodeActivitiesTool = {
    name: "list_cloud_diagram_node_activities",
    description:
        "Use this when the user wants the change history of a single component node in a cloud diagram layer. Returns individual activity records (NODE_CREATE/NODE_UPDATE/NODE_DELETE) for the given node (ss_id + nodeId), ordered by timestamp descending, each including the user who made the change. Page with offset/limit. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
    inputSchema: zodToMcpInputSchema(ListCloudDiagramNodeActivitiesArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Fetching node activities...",
        "openai/toolInvocation/invoked": "Node activities retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListCloudDiagramNodeActivitiesRequest(args: any, token: string) {
    try {
        const { ss_id, nodeId, limit, offset } = ListCloudDiagramNodeActivitiesArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("ss_id", ss_id);
        params.append("nodeId", nodeId);
        if (limit !== undefined) params.append("limit", String(limit));
        if (offset !== undefined) params.append("offset", String(offset));

        const url = `${CLOUD_DIAGRAMS_NODE_ACTIVITIES_URL}?${params.toString()}`;

        const data = await makeDoitRequest<ListCloudDiagramNodeActivitiesResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagram node activities");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list cloud diagram node activities request");
    }
}

export const GetCloudDiagramComponentsArgumentsSchema = z.object({
    scheme_ids: z.array(z.string()).optional().describe("Filter to specific diagram IDs. Omit to return all diagrams."),
    layer_ids: z
        .array(z.string())
        .optional()
        .describe("Filter to specific layer (statussheet) IDs. Omit to return all layers."),
    include_components: z
        .boolean()
        .optional()
        .describe(
            "Include component data (nodes, elements, groups, links, etc.) in the response. Defaults to false for lighter responses. Enable when you need component IDs for other diagram endpoints."
        ),
    skip_empty: z.boolean().optional().describe("Exclude layers that have no components. Defaults to false."),
});

export const getCloudDiagramComponentsTool = {
    name: "get_cloud_diagram_components",
    description:
        "Use this when the user wants to discover all cloud infrastructure diagrams and their layers (statussheets), or to look up layer IDs needed for other diagram endpoints. Returns all diagrams with their connected layers and optionally their component data. This is the primary discovery endpoint — use it before calling endpoints that require a layer ID. Optionally filter by diagram IDs (scheme_ids) or layer IDs (layer_ids), and set include_components=true to get full component lists. Do NOT use this for cost analysis (use run_query) or diagram search (use search_cloud_diagrams).",
    inputSchema: zodToMcpInputSchema(GetCloudDiagramComponentsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Fetching diagram components...",
        "openai/toolInvocation/invoked": "Diagram components retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetCloudDiagramComponentsRequest(args: any, token: string) {
    try {
        const { scheme_ids, layer_ids, include_components, skip_empty } =
            GetCloudDiagramComponentsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        if (include_components) params.append("components", "true");
        if (skip_empty) params.append("skip_empty", "true");

        const query = params.toString();
        const url = query ? `${CLOUD_DIAGRAMS_SCHEME_GET_URL}?${query}` : CLOUD_DIAGRAMS_SCHEME_GET_URL;

        const body: Record<string, unknown> = {};
        if (scheme_ids !== undefined) body.scheme_ids = scheme_ids;
        if (layer_ids !== undefined) body.layer_ids = layer_ids;

        const data = await makeDoitRequest<GetCloudDiagramComponentsResponse>(url, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve cloud diagram components");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get cloud diagram components request");
    }
}

export const ListCloudDiagramLayerSnapshotsArgumentsSchema = z.object({
    layerId: z
        .string()
        .min(1, "A diagram layer ID is required.")
        .describe("The diagram layer (statussheet) ID to list snapshots for."),
    limit: z.number().int().min(1).optional().describe("Maximum number of snapshots to return (default 10)."),
    offset: z.number().int().min(0).optional().describe("Number of snapshots to skip (default 0)."),
    sort: z
        .string()
        .optional()
        .describe('Sort expression, e.g. "-createdAt" for newest first or "createdAt" for oldest first.'),
});

export const listCloudDiagramLayerSnapshotsTool = {
    name: "list_cloud_diagram_layer_snapshots",
    description:
        'Use this when the user wants the saved snapshots (version history checkpoints) of a cloud infrastructure diagram layer. Returns the snapshots for the given layer ID, each with its snapshot ID, name, creation timestamp, and the previous snapshot in the chain (prevState). Page with offset/limit and order with sort (e.g. "-createdAt"). Use a snapshot ID with get_cloud_diagram_layer_snapshot for details. Do NOT use this for change activity (use list_cloud_diagram_activity_groups) or cost analysis (use get_cloud_diagram_cost_snapshot).',
    inputSchema: zodToMcpInputSchema(ListCloudDiagramLayerSnapshotsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Fetching layer snapshots...",
        "openai/toolInvocation/invoked": "Layer snapshots retrieved",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListCloudDiagramLayerSnapshotsRequest(args: any, token: string) {
    try {
        const { layerId, limit, offset, sort } = ListCloudDiagramLayerSnapshotsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        if (limit !== undefined) params.append("limit", String(limit));
        if (offset !== undefined) params.append("offset", String(offset));
        if (sort !== undefined) params.append("sort", sort);

        let url = `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/${encodeURIComponent(layerId)}/snapshots`;
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

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
    layerId: z
        .string()
        .min(1, "A diagram layer ID is required.")
        .describe("The diagram layer (statussheet) ID that contains the snapshot."),
    snapshotId: z.string().min(1, "A snapshot ID is required.").describe("The snapshot ID to retrieve."),
});

export const getCloudDiagramLayerSnapshotTool = {
    name: "get_cloud_diagram_layer_snapshot",
    description:
        "Use this when the user wants the details of a single saved snapshot of a cloud infrastructure diagram layer. Returns the snapshot's ID, name, creation timestamp, and the previous snapshot in the chain (prevState). Requires the diagram layer ID and the snapshot ID (use list_cloud_diagram_layer_snapshots to discover snapshot IDs). Do NOT use this for change activity (use list_cloud_diagram_activity_groups) or cost analysis (use get_cloud_diagram_cost_snapshot).",
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
        const { layerId, snapshotId } = GetCloudDiagramLayerSnapshotArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("snapshot_id", snapshotId);

        const url = `${CLOUD_DIAGRAMS_STATUSSHEET_URL}/${encodeURIComponent(layerId)}/snapshot?${params.toString()}`;

        const data = await makeDoitRequest<CloudDiagramLayerSnapshot>(url, token, {
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
