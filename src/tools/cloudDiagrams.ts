import { z } from "zod";
import type {
    CloudDiagramCostSnapshot,
    CloudDiagramResourceRelationshipsResponse,
    FindCloudDiagramsResponse,
    GetCloudDiagramsStatsResponse,
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
export const CLOUD_DIAGRAMS_STATUSSHEET_URL = `${DOIT_API_BASE}/clouddiagrams/v1/statussheet`;

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
