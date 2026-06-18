import { z } from "zod";
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
    "attribution_group",
    "gke",
    "gke_label",
    "organization_tag",
] as const;

const ALLOCATION_COMPONENT_MODES = ["is", "contains", "starts_with", "ends_with"] as const;

const GROUP_ALLOCATION_ACTIONS = ["create", "update", "select"] as const;

type AllocationComponentType = (typeof ALLOCATION_COMPONENT_TYPES)[number];
type AllocationComponentMode = (typeof ALLOCATION_COMPONENT_MODES)[number];

// Schema definitions
export const ListAllocationsArgumentsSchema = z.object({
    pageToken: z.string().optional().describe("Token for pagination. Use this to get the next page of results."),
    name: z
        .string()
        .optional()
        .describe("Partial name filter (case-insensitive). Returns only allocations whose name contains this string."),
});

export const GetAllocationArgumentsSchema = z
    .object({
        id: z.string().optional().describe("The ID of the allocation to retrieve."),
        name: z
            .string()
            .optional()
            .describe("Partial name match (case-insensitive). Used to find the allocation when ID is unknown."),
    })
    .refine((d) => d.id || d.name, { message: "Either id or name must be provided." });

// Zod schema for an allocation component (matches AllocationComponent interface)
const AllocationComponentSchema = z.object({
    key: z.string().describe("The dimension, label, or tag key"),
    type: z.enum(ALLOCATION_COMPONENT_TYPES).describe("The type of the component"),
    values: z.array(z.string()).describe("Values to match against"),
    inverse_selection: z.boolean().optional().describe("If true, exclude matching values instead of including them"),
    include_null: z.boolean().optional().describe("If true, include resources with no value for this dimension"),
    mode: z.enum(ALLOCATION_COMPONENT_MODES).describe("The matching mode for values. Defaults to 'is'"),
});

// Schema for a single allocation rule (used with 'rule' param)
const SingleRuleInputSchema = z.object({
    components: z.array(AllocationComponentSchema).describe("Array of allocation components that define this rule"),
    formula: z.string().describe("Logical formula combining components (e.g., 'A AND B')"),
});

// Schema for a group allocation rule (used within 'rules' array)
const GroupRuleInputSchema = SingleRuleInputSchema.extend({
    name: z.string().optional().describe("Name of the rule"),
    description: z.string().optional().describe("Description of the rule"),
    action: z
        .enum(GROUP_ALLOCATION_ACTIONS)
        .describe("Required action for this rule (e.g., 'create', 'update', 'select')"),
    id: z.string().optional().describe("Rule ID (for existing rules)"),
});

// Base object schema shared by create and update allocation
const AllocationBaseMutationSchema = z.object({
    name: z.string().describe("Human-readable name of the allocation"),
    description: z.string().optional().describe("Description of the allocation's purpose"),
    rule: SingleRuleInputSchema.optional().describe(
        "A single allocation rule that defines one grouping. Provide this for a single-rule allocation. Mutually exclusive with 'rules'"
    ),
    rules: z
        .array(GroupRuleInputSchema)
        .min(2)
        .optional()
        .describe(
            "Ordered list of allocation rules for a group allocation. Must include at least two rules. Mutually exclusive with 'rule'"
        ),
    unallocatedCosts: z
        .string()
        .nullable()
        .optional()
        .describe(
            "Custom label for values that do not fit into any allocation rule (required when using 'rules' for group allocations)"
        ),
});

// Refinements for the create allocation arguments schema to apply validations on the input
const createAllocationRefinements = <T extends z.ZodTypeAny>(schema: T) =>
    schema
        .refine((data: any) => (data.rule && !data.rules) || (!data.rule && data.rules), {
            message:
                "Provide either 'rule' (for a single-rule allocation) or 'rules' (for a group allocation), not both",
        })
        .refine((data: any) => !data.rules || data.unallocatedCosts !== undefined, {
            message: "'unallocatedCosts' is required when using 'rules' for a group allocation",
        });

// Refinements for the update allocation arguments schema to apply validations on the input
const updateAllocationRefinements = <T extends z.ZodTypeAny>(schema: T) =>
    schema
        .refine((data: any) => !(data.rule && data.rules), {
            message: "Provide at most one of 'rule' or 'rules', not both",
        })
        .refine((data: any) => !data.rules || data.unallocatedCosts !== undefined, {
            message: "'unallocatedCosts' is required when using 'rules' for a group allocation",
        });

export const CreateAllocationArgumentsSchema = createAllocationRefinements(
    AllocationBaseMutationSchema.extend({
        description: z.string().describe("Description of the allocation's purpose"),
    })
);

export const UpdateAllocationArgumentsSchema = updateAllocationRefinements(
    AllocationBaseMutationSchema.extend({
        id: z.string().describe("The ID of the allocation to update"),
    })
);

// Interfaces
export interface AllocationComponent {
    key: string;
    type: AllocationComponentType;
    values: string[];
    inverse_selection: boolean;
    include_null: boolean;
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

export interface AllocationDetails {
    id: string;
    name: string;
    description: string;
    type: string;
    allocationType: "single" | "multiple";
    createTime: number;
    updateTime: number;
    anomalyDetection: boolean;
    rule: AllocationRule;
}

export interface AllocationsResponse {
    pageToken?: string;
    allocations: AllocationListItem[];
}

// Tool metadata
export const listAllocationsTool = {
    name: "list_allocations",
    description:
        "Use this when the user wants to see their cost allocation rules or configurations. Returns a list of allocations. Supports partial name filtering. Do NOT use this for cost queries (use run_query) or labels (use list_labels).",
    inputSchema: {
        type: "object",
        properties: {
            pageToken: {
                type: "string",
                description: "Token for pagination. Use this to get the next page of results.",
            },
            name: {
                type: "string",
                description:
                    "Partial name filter (case-insensitive). Returns only allocations whose name contains this string.",
            },
        },
    },
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
    description:
        "Use this when the user wants to view details of a specific cost allocation. Accepts either the allocation ID or a partial name (case-insensitive). Do NOT use this for listing all allocations (use list_allocations) or running queries (use run_query).",
    inputSchema: {
        type: "object",
        properties: {
            id: {
                type: "string",
                description: "The ID of the allocation to retrieve.",
            },
            name: {
                type: "string",
                description: "Partial name match (case-insensitive). Used to find the allocation when ID is unknown.",
            },
        },
    },
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

// Schema for a single allocation component (used within 'components' array) of
// a single rule or a group rule
const componentObjectSchema = {
    type: "object",
    properties: {
        key: {
            type: "string",
            description: "Key of an existing dimension, label, or tag key",
        },
        type: {
            type: "string",
            enum: [...ALLOCATION_COMPONENT_TYPES],
            description: "The type of the component",
        },
        values: {
            type: "array",
            items: { type: "string" },
            description: "Values to match against",
        },
        inverse_selection: {
            type: "boolean",
            description: "If true, exclude matching values instead of including them",
        },
        include_null: {
            type: "boolean",
            description: "If true, include resources with no value for this dimension",
        },
        mode: {
            type: "string",
            enum: [...ALLOCATION_COMPONENT_MODES],
            description: "The matching mode for values",
        },
    },
    required: ["key", "type", "values", "mode"],
};

// Schema for a single allocation rule (used with 'rule' param)
const singleRuleObjectSchema = {
    type: "object",
    properties: {
        components: {
            type: "array",
            items: componentObjectSchema,
            description: "Array of allocation components that define this rule",
        },
        formula: {
            type: "string",
            description: "Logical formula combining components (e.g., 'A AND B')",
        },
    },
};

// Schema for a group allocation rule (used within 'rules' array)
const groupRuleObjectSchema = {
    type: "object",
    properties: {
        ...singleRuleObjectSchema.properties,
        name: {
            type: "string",
            description: "Name of the rule",
        },
        description: {
            type: "string",
            description: "Description of the rule",
        },
        action: {
            type: "string",
            enum: [...GROUP_ALLOCATION_ACTIONS],
            description: "Required action for this rule (e.g., 'create', 'update', 'select')",
        },
        id: {
            type: "string",
            description: "Rule ID (for existing rules), required for 'update' and 'select' actions",
        },
    },
};

// Schema for the input of the create allocation tool
const createAllocationInputSchema = {
    type: "object",
    properties: {
        name: {
            type: "string",
            description: "Human-readable name of the allocation",
        },
        description: {
            type: "string",
            description: "Description of the allocation's purpose",
        },
        rule: {
            ...singleRuleObjectSchema,
            description:
                "A single allocation rule that defines one grouping. Provide this for a single-rule allocation. Mutually exclusive with 'rules'",
        },
        rules: {
            type: "array",
            items: groupRuleObjectSchema,
            description:
                "Ordered list of allocation rules for a group allocation. Must include at least two rules. Mutually exclusive with 'rule'",
        },
        unallocatedCosts: {
            type: ["string", "null"],
            description:
                "Custom label for values that do not fit into any allocation rule (required when using 'rules' for group allocations)",
        },
    },
    required: ["name", "description"],
} as const;

export const createAllocationTool = {
    name: "create_allocation",
    description:
        "Use this when the user wants to create a new cost allocation rule. Ask the user to confirm the allocation parameters before executing. Do NOT use this for viewing existing allocations (use list_allocations) or labels (use create_label).",
    inputSchema: createAllocationInputSchema,
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

const updateAllocationInputSchema = {
    type: "object",
    properties: {
        id: {
            type: "string",
            description: "The ID of the allocation to update",
        },
        ...createAllocationInputSchema.properties,
    },
    required: ["id"],
} as const;

export const updateAllocationTool = {
    name: "update_allocation",
    description:
        "Use this when the user wants to modify an existing cost allocation. Ask the user to confirm changes before executing. Do NOT use this for creating new allocations (use create_allocation) or viewing allocations (use list_allocations).",
    inputSchema: updateAllocationInputSchema,
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

        if (parsed.description) {
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

        const requestBody: Record<string, any> = {
            name: parsed.name,
        };

        if (parsed.description) {
            requestBody.description = parsed.description;
        }

        if (parsed.rules) {
            requestBody.rules = parsed.rules;
            requestBody.unallocatedCosts = parsed.unallocatedCosts;
        } else if (parsed.rule) {
            requestBody.rule = parsed.rule;
        }

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
