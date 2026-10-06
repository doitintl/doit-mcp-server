import { z } from "zod";
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

export const ALLOCATIONS_URL = `${DOIT_API_BASE}/analytics/v1/allocations`;

// Shared constants for allocation component types and modes
const ALLOCATION_COMPONENT_TYPES = [
    "datetime",
    "fixed",
    "optional",
    "label",
    "tag",
    "project_label",
    "system_label",
    "attribution",
    "allocation_rule",
    "gke",
    "gke_label",
] as const;

const ALLOCATION_COMPONENT_MODES = ["is", "contains", "starts_with", "ends_with", "regexp"] as const;

type AllocationComponentType = (typeof ALLOCATION_COMPONENT_TYPES)[number];
type AllocationComponentMode = (typeof ALLOCATION_COMPONENT_MODES)[number];

// Schema definitions
export const ListAllocationsArgumentsSchema = z.object({
    pageToken: z
        .string()
        .optional()
        .describe("Token for pagination, from a previous response; returns the next page of results."),
    name: z
        .string()
        .optional()
        .describe(
            "Partial name filter (case-insensitive). Returns only allocations on the returned page whose name contains this string."
        ),
});

export const GetAllocationArgumentsSchema = z
    .object({
        id: z.string().optional().describe("The ID of the allocation to retrieve."),
        name: z
            .string()
            .optional()
            .describe(
                "Case-insensitive substring search of only the first 200 allocations. Multiple matches return an ambiguity error listing names; id takes precedence."
            ),
    })
    .refine((d) => d.id || d.name, { message: "Either id or name must be provided." });

// Zod schema for an allocation component (matches AllocationComponent interface)
const AllocationComponentSchema = z.object({
    key: z
        .string()
        .describe(
            "Key of an existing dimension, label or tag. For type allocation_rule, use key allocation_rule and existing rule IDs as values"
        ),
    type: z.enum(ALLOCATION_COMPONENT_TYPES).describe("The type of the component"),
    values: z.array(z.string()).describe("Values to match against"),
    inverse_selection: z.boolean().optional().describe("If true, exclude matching values instead of including them"),
    include_null: z.boolean().optional().describe("If true, include resources with no value for this dimension"),
    mode: z
        .enum(ALLOCATION_COMPONENT_MODES)
        .describe(
            "Required matching mode; regexp requires exactly one pattern in values and a dimension that supports regular expressions"
        ),
});

// Schema for a single allocation rule (used with 'rule' param)
const SingleRuleInputSchema = z.object({
    components: z.array(AllocationComponentSchema).describe("Array of allocation components that define this rule"),
    formula: z
        .string()
        .describe(
            "Logical formula combining components by array order: A is the first component, B the second (e.g., 'A AND B')"
        ),
});

// Schema for a group allocation rule (used within 'rules' array)
const GroupRuleInputSchema = z.discriminatedUnion("action", [
    SingleRuleInputSchema.extend({
        action: z.literal("create").describe("Create a new rule and include it in the group; omit id."),
        name: z.string().min(1).describe("Required name for the new rule."),
        description: z.string().optional().describe("Description of the new rule."),
        id: z.never().optional().describe("Must be absent for create."),
    }),
    SingleRuleInputSchema.extend({
        action: z.literal("update").describe("Update an existing rule and include it in the group."),
        id: z.string().min(1).describe("Required ID of the existing rule to update."),
        name: z.string().min(1).optional().describe("New name for the updated rule; omit to preserve its name."),
        description: z.string().optional().describe("Description of the updated rule."),
    }),
    z.object({
        action: z.literal("select").describe("Include an existing rule unchanged; only id is needed."),
        id: z.string().min(1).describe("Required ID of the existing rule to select."),
    }),
]);

// Base object schema shared by create and update allocation
const AllocationBaseMutationSchema = z.object({
    name: z.string().min(1).describe("Human-readable name of the allocation"),
    description: z
        .string()
        .optional()
        .describe(
            "Description of the allocation. On update omission or an empty string preserves the stored description; the API does not support clearing it"
        ),
    rule: SingleRuleInputSchema.optional().describe(
        "A single allocation rule that defines one grouping. Provide this for a single-rule allocation. Mutually exclusive with 'rules'"
    ),
    rules: z
        .array(GroupRuleInputSchema)
        .min(2)
        .optional()
        .describe(
            "Ordered list of at least two group rules. create creates a rule, update edits a rule, select includes it unchanged. On update this replaces the entire list; include every rule to retain. Mutually exclusive with rule; allocation type cannot change"
        ),
    unallocatedCosts: z
        .string()
        .nullable()
        .optional()
        .describe(
            "Group-only label for unmatched costs. On update omission or null preserves the stored label; a string updates it independently of rules"
        ),
});

export const CreateAllocationArgumentsSchema = AllocationBaseMutationSchema.refine(
    (data) => Boolean(data.rule) !== Boolean(data.rules),
    { message: "Provide exactly one of 'rule' (single allocation) or 'rules' (group allocation)." }
).refine((data) => !data.rule || data.unallocatedCosts == null, {
    message: "unallocatedCosts is only supported for group allocations.",
});

export const UpdateAllocationArgumentsSchema = AllocationBaseMutationSchema.extend({
    id: z.string().min(1).describe("The ID of the allocation to update"),
    name: AllocationBaseMutationSchema.shape.name.optional().describe("New name; omit to keep the current name."),
})
    .refine((data) => !(data.rule && data.rules), {
        message: "Provide at most one of 'rule' or 'rules'; use the existing allocation's type.",
    })
    .refine((data) => !data.rule || data.unallocatedCosts == null, {
        message: "unallocatedCosts is only supported for group allocations.",
    });

// Interfaces
export interface AllocationComponent {
    key: string;
    type: AllocationComponentType;
    values: string[];
    inverse_selection?: boolean;
    include_null?: boolean;
    inverse?: boolean;
    includeNull?: boolean;
    caseInsensitive?: boolean;
    mode: AllocationComponentMode;
}

export interface AllocationRule {
    components: AllocationComponent[];
    formula: string;
}

export interface AllocationListItem {
    id: string;
    name: string;
    owner: string;
    type: string;
    allocationType: "single" | "multiple";
    createTime: number;
    updateTime: number;
    urlUI: string;
}

export interface AllocationGroupRule {
    id: string;
    name: string;
    owner: string;
    description: string;
    type: string;
    createTime: number;
    updateTime: number;
}

export interface AllocationDetails {
    id: string;
    name: string;
    description: string;
    type: string;
    allocationType: "single" | "multiple";
    createTime: number;
    updateTime: number;
    anomalyDetection?: boolean;
    rule?: AllocationRule;
    rules?: AllocationGroupRule[];
    unallocatedCosts?: string | null;
}

export interface AllocationsResponse {
    pageToken?: string | null;
    allocations: AllocationListItem[];
}

// Tool metadata
export const listAllocationsTool = {
    name: "list_allocations",
    title: "List allocations",
    coversEndpoint: "get:/analytics/v1/allocations",
    description:
        "Use this when the user wants to see their cost allocation rules or configurations. Returns a list of allocations. Returns pages of 40; pass the returned pageToken for another page (null means no next page). The case-insensitive partial name filter applies only to that returned page. Do NOT use this for cost queries (use run_query) or labels (use list_labels).",
    inputSchema: zodToMcpInputSchema(ListAllocationsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading allocations...",
        "openai/toolInvocation/invoked": "Allocations loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const getAllocationTool = {
    name: "get_allocation",
    title: "Get allocation",
    coversEndpoint: "get:/analytics/v1/allocations/{id}",
    description:
        "Use this when the user wants to view details of a specific cost allocation. Accepts either the allocation ID or a case-insensitive partial name. Name lookup searches only the first 200 allocations; multiple matches return an error listing names, and id takes precedence. Do NOT use this for listing all allocations (use list_allocations) or running queries (use run_query).",
    inputSchema: zodToMcpInputSchema(GetAllocationArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading allocation...",
        "openai/toolInvocation/invoked": "Allocation loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const createAllocationTool = {
    name: "create_allocation",
    title: "Create allocation",
    coversEndpoint: "post:/analytics/v1/allocations",
    description:
        "Use this when the user wants to create a new cost allocation rule. Changes apply immediately. Do NOT use this for viewing existing allocations (use list_allocations) or labels (use create_label).",
    inputSchema: zodToMcpInputSchema(CreateAllocationArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Creating allocation...",
        "openai/toolInvocation/invoked": "Allocation created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export const updateAllocationTool = {
    name: "update_allocation",
    title: "Update allocation",
    coversEndpoint: "patch:/analytics/v1/allocations/{id}",
    description:
        "Use this when the user wants to modify an existing cost allocation. Omitted fields are preserved. Use rule for an existing single allocation and rules for an existing group; the type cannot change. A supplied rules list replaces the entire group membership. Changes apply immediately. Do NOT use this for creating new allocations (use create_allocation) or viewing allocations (use list_allocations).",
    inputSchema: zodToMcpInputSchema(UpdateAllocationArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Updating allocation...",
        "openai/toolInvocation/invoked": "Allocation updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

// Handle list allocations request
export async function handleListAllocationsRequest(args: any, token: string) {
    try {
        const { pageToken, name } = ListAllocationsArgumentsSchema.parse(args);
        const { customerContext } = args;

        // Create API URL with query parameters
        const params = new URLSearchParams();
        if (pageToken && pageToken.length > 1) {
            params.append("pageToken", pageToken);
        }

        let allocationsUrl = ALLOCATIONS_URL;

        if (params.toString()) {
            allocationsUrl += `?${params.toString()}`;
        }

        try {
            const allocationsData = await makeDoitRequest<AllocationsResponse>(allocationsUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!allocationsData) {
                return createErrorResponse("Failed to retrieve allocations data");
            }

            let allocations = allocationsData.allocations || [];

            if (allocations.length === 0) {
                return createErrorResponse("No allocations found");
            }

            if (name) {
                const q = name.toLowerCase();
                allocations = allocations.filter((a) => a.name.toLowerCase().includes(q));
            }

            // Format the response
            const formattedAllocations = allocations.map((allocation) => ({
                id: allocation.id,
                name: allocation.name,
                owner: allocation.owner,
                type: allocation.type,
                allocationType: allocation.allocationType,
                createTime: allocation.createTime,
                updateTime: allocation.updateTime,
                urlUI: allocation.urlUI,
            }));

            const responseData = {
                pageToken: allocationsData.pageToken || null,
                allocations: formattedAllocations,
            };

            return createSuccessResponse(JSON.stringify(responseData, null, 2));
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling allocations request");
    }
}

// Handle create allocation request
export async function handleCreateAllocationRequest(args: any, token: string) {
    try {
        const parsed = CreateAllocationArgumentsSchema.parse(args);
        const { customerContext } = args;

        const allocationsUrl = ALLOCATIONS_URL;

        const requestBody: Record<string, any> = {
            name: parsed.name,
        };

        if (parsed.description !== undefined) {
            requestBody.description = parsed.description;
        }

        if (parsed.rules) {
            requestBody.rules = parsed.rules;
            requestBody.unallocatedCosts = parsed.unallocatedCosts;
        } else {
            requestBody.rule = parsed.rule;
        }

        try {
            const responseData = await makeDoitRequest<{
                id: string;
                type: string;
            }>(allocationsUrl, token, {
                method: "POST",
                body: requestBody,
                customerContext,
            });

            if (!responseData) {
                return createErrorResponse("Failed to create allocation");
            }

            return createSuccessResponse(JSON.stringify(responseData, null, 2));
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling create allocation request");
    }
}

// Handle update allocation request
export async function handleUpdateAllocationRequest(args: any, token: string) {
    try {
        const parsed = UpdateAllocationArgumentsSchema.parse(args);
        const { customerContext } = args;

        const allocationUrl = `${ALLOCATIONS_URL}/${encodeURIComponent(parsed.id)}`;

        const { id: _id, ...requestBody } = parsed;

        try {
            const responseData = await makeDoitRequest<{
                id: string;
                type: string;
            }>(allocationUrl, token, {
                method: "PATCH",
                body: requestBody,
                customerContext,
            });

            if (!responseData) {
                return createErrorResponse(`Failed to update allocation: ${parsed.id}`);
            }

            return createSuccessResponse(JSON.stringify(responseData, null, 2));
        } catch (error) {
            return handleGeneralError(error, `Error requesting DoiT API to update allocation: ${parsed.id}`);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling update allocation request");
    }
}

// Handle get allocation request
export async function handleGetAllocationRequest(args: any, token: string) {
    try {
        const parsed = GetAllocationArgumentsSchema.parse(args);
        const { customerContext } = args;
        let resolvedId = parsed.id;

        if (!resolvedId && parsed.name) {
            const listData = await makeDoitRequest<AllocationsResponse>(`${ALLOCATIONS_URL}?maxResults=200`, token, {
                method: "GET",
                customerContext,
            });
            const items = listData?.allocations ?? [];
            const result = matchByName(items, parsed.name);
            if ("error" in result) return createErrorResponse(result.error);
            // (multiple match case now handled as error by matchByName)
            resolvedId = result.resolved;
        }

        const allocationUrl = `${ALLOCATIONS_URL}/${encodeURIComponent(resolvedId as string)}`;

        try {
            const allocationData = await makeDoitRequest<AllocationDetails>(allocationUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!allocationData) {
                return createErrorResponse("Failed to retrieve allocation data");
            }

            // Format the response
            const formattedAllocation = {
                id: allocationData.id,
                name: allocationData.name,
                description: allocationData.description,
                type: allocationData.type,
                allocationType: allocationData.allocationType,
                createTime: allocationData.createTime,
                updateTime: allocationData.updateTime,
                anomalyDetection: allocationData.anomalyDetection,
                rule: allocationData.rule,
                rules: allocationData.rules,
                unallocatedCosts: allocationData.unallocatedCosts,
            };

            return createSuccessResponse(JSON.stringify(formattedAllocation, null, 2));
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling allocation request");
    }
}
