import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
  DOIT_API_BASE,
} from "../utils/util.js";

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
] as const;

const ALLOCATION_COMPONENT_MODES = [
  "is",
  "contains",
  "starts_with",
  "ends_with",
] as const;

type AllocationComponentType = (typeof ALLOCATION_COMPONENT_TYPES)[number];
type AllocationComponentMode = (typeof ALLOCATION_COMPONENT_MODES)[number];

// Schema definitions
export const ListAllocationsArgumentsSchema = z.object({
  pageToken: z
    .string()
    .optional()
    .describe(
      "Token for pagination. Use this to get the next page of results."
    ),
});

export const GetAllocationArgumentsSchema = z.object({
  id: z.string().describe("The ID of the allocation to retrieve"),
});

// Zod schema for an allocation component (matches AllocationComponent interface)
const AllocationComponentSchema = z.object({
  key: z.string().describe("The dimension, label, or tag key"),
  type: z.enum(ALLOCATION_COMPONENT_TYPES).describe("The type of the component"),
  values: z.array(z.string()).describe("Values to match against"),
  inverse_selection: z
    .boolean()
    .optional()
    .describe("If true, exclude matching values instead of including them"),
  include_null: z
    .boolean()
    .optional()
    .describe("If true, include resources with no value for this dimension"),
  mode: z
    .enum(ALLOCATION_COMPONENT_MODES)
    .optional()
    .describe("The matching mode for values. Defaults to 'is'"),
});

// Schema for a single allocation rule (used with 'rule' param)
const SingleRuleInputSchema = z.object({
  components: z
    .array(AllocationComponentSchema)
    .describe("Array of allocation components that define this rule"),
  formula: z
    .string()
    .optional()
    .describe("Logical formula combining components (e.g., 'A AND B')"),
});

// Schema for a group allocation rule (used within 'rules' array)
const GroupRuleInputSchema = SingleRuleInputSchema.extend({
  name: z.string().optional().describe("Name of the rule"),
  description: z.string().optional().describe("Description of the rule"),
  action: z
    .enum(["create"])
    .optional()
    .describe("Action for this rule (e.g., 'create')"),
  id: z.string().optional().describe("Rule ID (for existing rules)"),
});

export const CreateAllocationArgumentsSchema = z
  .object({
    name: z.string().describe("Human-readable name of the allocation"),
    description: z
      .string()
      .optional()
      .describe("Optional description of the allocation's purpose"),
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
  })
  .refine((data) => (data.rule && !data.rules) || (!data.rule && data.rules), {
    message:
      "Provide either 'rule' (for a single-rule allocation) or 'rules' (for a group allocation), not both",
  })
  .refine(
    (data) => !data.rules || data.unallocatedCosts !== undefined,
    {
      message:
        "'unallocatedCosts' is required when creating a group allocation with 'rules'",
    }
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
  description: `List allocations for the report or run_query configuration that your account has access to from the DoiT API.
    Allocations in the DoiT Cloud Intelligence Platform are a powerful feature that allows you to group and attribute cloud costs to specific business units, teams, projects, or any other logical grouping relevant to your organization.`,
  inputSchema: {
    type: "object",
    properties: {
      pageToken: {
        type: "string",
        description:
          "Token for pagination. Use this to get the next page of results.",
      },
    },
  },
};

export const getAllocationTool = {
  name: "get_allocation",
  description: "Get a specific allocation by ID from the DoiT API",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The ID of the allocation to retrieve",
      },
    },
    required: ["id"],
  },
};

const componentObjectSchema = {
  type: "object",
  properties: {
    key: {
      type: "string",
      description: "The dimension, label, or tag key",
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
      description:
        "If true, exclude matching values instead of including them",
    },
    include_null: {
      type: "boolean",
      description:
        "If true, include resources with no value for this dimension",
    },
    mode: {
      type: "string",
      enum: [...ALLOCATION_COMPONENT_MODES],
      description: "The matching mode for values",
    },
  },
  required: ["key", "type", "values"],
};

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
      description:
        "Logical formula combining components (e.g., 'A AND B')",
    },
  },
};

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
      enum: ["create"],
      description: "Action for this rule (e.g., 'create')",
    },
    id: {
      type: "string",
      description: "Rule ID (for existing rules)",
    },
  },
};

const createAllocationInputSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Human-readable name of the allocation",
    },
    description: {
      type: "string",
      description: "Optional description of the allocation's purpose",
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
  required: ["name"],
} as const;

export const createAllocationTool = {
  name: "create_allocation",
  description: `Create a new allocation in the DoiT Cloud Intelligence Platform.
    Allocations let you group and segment cloud costs using allocation rules.
    For a single-rule allocation, provide 'rule' (a single rule object).
    For a group allocation, provide 'rules' (an array of at least two rules) and 'unallocatedCosts' (a label for unmatched costs).`,
  inputSchema: createAllocationInputSchema,
};

// Handle list allocations request
export async function handleListAllocationsRequest(args: any, token: string) {
  try {
    const { pageToken } = ListAllocationsArgumentsSchema.parse(args);
    const { customerContext } = args;

    // Create API URL with query parameters
    const params = new URLSearchParams();
    if (pageToken && pageToken.length > 1) {
      params.append("pageToken", pageToken);
    }

    let allocationsUrl = `${DOIT_API_BASE}/analytics/v1/allocations`;

    if (params.toString()) {
      allocationsUrl += `?${params.toString()}`;
    }

    try {
      const allocationsData = await makeDoitRequest<AllocationsResponse>(
        allocationsUrl,
        token,
        { method: "GET", customerContext }
      );

      if (!allocationsData) {
        return createErrorResponse("Failed to retrieve allocations data");
      }

      const allocations = allocationsData.allocations || [];

      if (allocations.length === 0) {
        return createErrorResponse("No allocations found");
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
export async function handleCreateAllocationRequest(
  args: any,
  token: string
) {
  try {
    const parsed = CreateAllocationArgumentsSchema.parse(args);
    const { customerContext } = args;

    const allocationsUrl = `${DOIT_API_BASE}/analytics/v1/allocations`;

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

      return createSuccessResponse(
        JSON.stringify(responseData, null, 2)
      );
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

// Handle get allocation request
export async function handleGetAllocationRequest(args: any, token: string) {
  try {
    const { id } = GetAllocationArgumentsSchema.parse(args);
    const { customerContext } = args;

    if (!id) {
      return createErrorResponse("Allocation ID is required");
    }

    const allocationUrl = `${DOIT_API_BASE}/analytics/v1/allocations/${encodeURIComponent(
      id
    )}`;

    try {
      const allocationData = await makeDoitRequest<AllocationDetails>(
        allocationUrl,
        token,
        { method: "GET", customerContext }
      );

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

      return createSuccessResponse(
        JSON.stringify(formattedAllocation, null, 2)
      );
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
