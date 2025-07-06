import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
  DOIT_API_BASE,
} from "../utils/util.js";

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

// Interfaces
export interface AllocationComponent {
  key: string;
  type:
    | "datetime"
    | "fixed"
    | "optional"
    | "label"
    | "tag"
    | "project_label"
    | "system_label"
    | "attribution"
    | "attribution_group"
    | "gke"
    | "gke_label";
  values: string[];
  inverse_selection: boolean;
  include_null: boolean;
  mode: "is" | "contains" | "starts_with" | "ends_with";
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
