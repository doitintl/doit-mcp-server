import { z } from "zod";
import type {
    CloudDiagramCostSnapshot,
    CloudDiagramResourceRelationshipsResponse,
    FindCloudDiagramsResponse,
    GetCloudDiagramComponentsResponse,
    GetCloudDiagramsStatsResponse,
    ListCloudDiagramActivityGroupsResponse,
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
        .describe("Cloud resource IDs matched against cld_id or props.id; these are not diagram component IDs."),
});

export const findCloudDiagramsTool = {
    name: "find_cloud_diagrams",
    title: "Find cloud diagrams",
    coversEndpoint: "post:/clouddiagrams/v1/scheme/find",
    description:
        "Use this when the user wants to find architecture diagrams or cloud infrastructure diagrams. Matches cloud resource IDs (cld_id or props.id) and returns diagram viewer URLs and image URLs. Creates a sheet filter and queues image rendering. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
    inputSchema: zodToMcpInputSchema(FindCloudDiagramsArgumentsSchema),
    annotations: {
        readOnlyHint: false,
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
    title: "Get cloud diagram statistics",
    coversEndpoint: "get:/clouddiagrams/v1/scheme/stats",
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
    ss_id: z
        .string()
        .optional()
        .describe("Scope only the component and prop categories to this layer ID; scheme results remain unscoped."),
    from: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Pagination offset applied independently to each result category (default 0)."),
    size: z.number().int().min(1).optional().describe("Maximum number of results per category (default 20)."),
});

export const searchCloudDiagramsTool = {
    name: "search_cloud_diagrams",
    title: "Search cloud diagrams",
    coversEndpoint: "post:/clouddiagrams/v1/scheme/search",
    description:
        "Use this when the user wants to search their cloud infrastructure diagrams and components by name or property. Returns matching diagram layers (scheme), components, and components matched by property value (prop). ss_id scopes only component and prop results, not scheme results. from/size page each category independently. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
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
        .describe("Inclusive start date (YYYY-MM-DD, e.g. 2026-04-01)."),
    endDate: z
        .string()
        .regex(ISO_DATE, "endDate must be a calendar date in YYYY-MM-DD format, e.g. 2026-04-30")
        .describe("Inclusive end date (YYYY-MM-DD, e.g. 2026-04-30)."),
    interval: z
        .enum(["day", "week", "month"])
        .optional()
        .describe("Bucket granularity for the cost trend. Possible values: day, week, month (defaults to day)."),
});

export const getCloudDiagramCostSnapshotTool = {
    name: "get_cloud_diagram_cost_snapshot",
    title: "Get cloud diagram cost snapshot",
    coversEndpoint: "get:/clouddiagrams/v1/statussheet/{id}/costs",
    description:
        "Use this when the user wants a cost snapshot for a specific cloud infrastructure diagram layer over a time period — the API-reported total, trendingPct as a percentage (25 means 25%, null when no prior value is available), the top five resources and top five services by cost, and the last twelve trend buckets. Both dates are inclusive. Requires the diagram layer ID and a startDate/endDate (YYYY-MM-DD). Do NOT use this for account-wide cost analysis (use run_query) or budgets (use list_budgets).",
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
    title: "Get cloud diagram resource relationships",
    coversEndpoint: "get:/clouddiagrams/v1/statussheet/{id}/resources/{rid}/relationships",
    description:
        "Use this when the user wants to understand how a specific resource in a cloud infrastructure diagram is connected to other resources — its upstream/downstream edges and optional group membership (only when kind is group_members or both). Returns the anchor resource plus up to 200 relations with their type and hop distance; truncated is true when more than 200 relations exist. Requires the diagram layer ID and the resource ID. Do NOT use this for cost analysis (use get_cloud_diagram_cost_snapshot or run_query).",
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
    tags: z
        .array(z.string())
        .optional()
        .describe("Filter by snapshot tags; supplying non-empty tags restricts results to SNAPSHOT groups."),
});

export const listCloudDiagramActivityGroupsTool = {
    name: "list_cloud_diagram_activity_groups",
    title: "List cloud diagram activity groups",
    coversEndpoint: "get:/clouddiagrams/v1/activity",
    description:
        "Use this when the user wants the activity history of a cloud diagram layer. Without tags, returns ALARM, COMMIT, EVENT, and SNAPSHOT activity groups for the given layer (ss_id), ordered by timestamp descending; snapshot groups reference a snapshot and contain their individual activity records. Supplying non-empty tags restricts results to snapshots. Page with offset/limit and filter with tags. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
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
    title: "List cloud diagram node activities",
    coversEndpoint: "get:/clouddiagrams/v1/activity/node-activities",
    description:
        "Use this when the user wants the change history of a single component node in a cloud diagram layer. Returns individual activity records (NODE_CREATE/NODE_UPDATE/NODE_DELETE) for the given node (ss_id + nodeId), ordered by timestamp descending, each including user as the ID of the user who made the change. Page with offset/limit. Do NOT use this for cost analysis (use run_query) or incidents (use get_cloud_incidents).",
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

const MAX_COMPONENT_LAYERS = 5;

export const GetCloudDiagramComponentsArgumentsSchema = z.object({
    scheme_ids: z
        .array(z.string())
        .optional()
        .describe(
            "Select these diagram IDs. When combined with layer_ids, also returns the diagrams owning those layers."
        ),
    layer_ids: z
        .array(z.string())
        .optional()
        .describe(
            "Select these layer (statussheet) IDs and their owning diagrams. Component data is loaded only for selected layers, or resolved diagram layers when include_components is true."
        ),
    include_components: z
        .boolean()
        .optional()
        .describe(
            "Load component maps for up to five selected layers, or resolved diagram layers when layer_ids is omitted. Larger selections return an error; discover layer IDs with this option false, then request batches of at most five layer_ids. With no IDs, first discovers accessible application/infrastructure diagrams. Defaults to false. Component fields use API projections, not full resource properties."
        ),
    skip_empty: z
        .boolean()
        .optional()
        .describe(
            "Omit empty layers from each diagram's layer metadata; diagrams remain in the result. Defaults to false."
        ),
});

export const getCloudDiagramComponentsTool = {
    name: "get_cloud_diagram_components",
    title: "Get cloud diagram components",
    coversEndpoint: "post:/clouddiagrams/v1/scheme/get",
    description:
        "Use this when the user wants to discover all cloud infrastructure diagrams and their layers (statussheets), or to look up layer IDs needed for other diagram endpoints. With no filters, returns accessible application and infrastructure diagrams with layer metadata and no component data. Returns maps keyed by diagram and layer IDs. Selectors must belong to diagrams accessible to the authenticated customer and user. scheme_ids and the diagrams owning layer_ids are combined, not intersected. The layer IDs required by other diagram tools come from this tool. Optionally filter by diagram IDs (scheme_ids) or layer IDs (layer_ids), and set include_components=true to load projected component maps for up to five requested or resolved layers. Larger selections return an error before loading components; discover metadata first, then request batches of at most five layer_ids. Do NOT use this for cost analysis (use run_query) or diagram search (use search_cloud_diagrams).",
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

        // Empty arrays behave like omitted selectors; an empty DTO is the API's
        // discovery branch, which never loads components even with components=true.
        const schemes = scheme_ids?.length ? [...new Set(scheme_ids)] : undefined;
        const layers = layer_ids?.length ? [...new Set(layer_ids)] : undefined;
        const limitError = () =>
            createErrorResponse(
                `Component loading is limited to ${MAX_COMPONENT_LAYERS} layers per call. Discover metadata with include_components=false, then request batches of at most ${MAX_COMPONENT_LAYERS} layer_ids.`
            );
        if (include_components && layers && layers.length > MAX_COMPONENT_LAYERS) return limitError();

        // Only the empty DTO API branch scopes IDs to the authenticated tenant/user.
        // Include every diagram type for validation, without filtering empty layers.
        let accessibleLayerIds: Set<string> | undefined;
        if (schemes || layers) {
            const discoveryParams = new URLSearchParams({
                components: "false",
                type: "application,infrastructure,network,template",
            });
            const accessible = await makeDoitRequest<GetCloudDiagramComponentsResponse>(
                `${CLOUD_DIAGRAMS_SCHEME_GET_URL}?${discoveryParams}`,
                token,
                { method: "POST", body: {}, customerContext }
            );
            if (!accessible) return createErrorResponse("Failed to verify cloud diagram access");
            const accessibleDiagramIds = new Set(Object.keys(accessible.scheme ?? {}));
            accessibleLayerIds = new Set(
                Object.values(accessible.scheme ?? {}).flatMap((scheme) =>
                    (scheme.statussheet ?? []).map((sheet) => sheet.ssid ?? sheet._id)
                )
            );
            if (
                schemes?.some((id) => !accessibleDiagramIds.has(id)) ||
                layers?.some((id) => !accessibleLayerIds?.has(id))
            ) {
                return createErrorResponse(
                    "Requested diagrams or layers are not accessible to the authenticated customer and user"
                );
            }
        }

        const body: Record<string, unknown> = {};
        if (schemes) body.scheme = schemes;
        if (layers) body.statussheet = layers;

        const params = new URLSearchParams();
        // The populated DTO branch defaults to components=true, unlike discovery.
        params.set("components", String(Boolean(include_components && layers)));
        if (skip_empty) params.set("skip_empty", "true");
        const url = `${CLOUD_DIAGRAMS_SCHEME_GET_URL}?${params}`;

        let data = await makeDoitRequest<GetCloudDiagramComponentsResponse>(url, token, {
            method: "POST",
            body,
            customerContext,
        });
        if (!data) return createErrorResponse("Failed to retrieve cloud diagram components");

        if (include_components && !layers) {
            // Selecting a scheme does not select its statussheets in the API DTO.
            // Resolve their IDs from metadata, then explicitly request those sheets.
            const layerIds = [
                ...new Set(
                    Object.values(data.scheme ?? {}).flatMap((scheme) =>
                        (scheme.statussheet ?? []).map((sheet) => sheet.ssid ?? sheet._id)
                    )
                ),
            ];
            if (layerIds.some((id) => accessibleLayerIds && !accessibleLayerIds.has(id))) {
                return createErrorResponse(
                    "Requested diagrams or layers are not accessible to the authenticated customer and user"
                );
            }
            if (layerIds.length > MAX_COMPONENT_LAYERS) return limitError();
            if (layerIds.length > 0) {
                params.set("components", "true");
                const components = await makeDoitRequest<GetCloudDiagramComponentsResponse>(
                    `${CLOUD_DIAGRAMS_SCHEME_GET_URL}?${params}`,
                    token,
                    {
                        method: "POST",
                        body: { statussheet: layerIds },
                        customerContext,
                    }
                );
                if (!components) return createErrorResponse("Failed to retrieve cloud diagram components");
                data = { ...data, statussheet: components.statussheet };
            }
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get cloud diagram components request");
    }
}
