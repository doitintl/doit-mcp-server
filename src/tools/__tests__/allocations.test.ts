import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  handleListAllocationsRequest,
  handleGetAllocationRequest,
  handleCreateAllocationRequest,
  handleUpdateAllocationRequest,
} from "../allocations.js";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
  DOIT_API_BASE,
} from "../../utils/util.js";

// Mock the utility functions
vi.mock("../../utils/util.js", () => ({
  createErrorResponse: vi.fn((msg) => ({
    content: [{ type: "text", text: msg }],
  })),
  createSuccessResponse: vi.fn((text) => ({
    content: [{ type: "text", text }],
  })),
  formatZodError: vi.fn((error) => `Formatted Zod Error: ${error.message}`),
  handleGeneralError: vi.fn((error, context) => ({
    content: [{ type: "text", text: `General Error: ${context}` }],
  })),
  makeDoitRequest: vi.fn(),
  DOIT_API_BASE: "https://api.doit.com",
}));

const ALLOCATIONS_URL = `${DOIT_API_BASE}/analytics/v1/allocations`;

describe("allocations", () => {
  const mockToken = "fake-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleListAllocationsRequest", () => {
    it("should call makeDoitRequest with correct parameters and return success response", async () => {
      const mockArgs = { pageToken: "next-page" };
      const mockApiResponse = {
        pageToken: "another-page",
        allocations: [
          {
            id: "allocation-1",
            name: "Test Allocation",
            owner: "test@example.com",
            type: "standard",
            allocationType: "single",
            createTime: 1678886400000,
            updateTime: 1678972800000,
            urlUI: "https://console.doit.com/allocations/allocation-1",
          },
        ],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleListAllocationsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        `${ALLOCATIONS_URL}?pageToken=next-page`,
        mockToken,
        {
          method: "GET",
        }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("allocation-1")
      );
    });

    it("should handle request without pageToken", async () => {
      const mockArgs = {};
      const mockApiResponse = {
        allocations: [
          {
            id: "allocation-1",
            name: "Test Allocation",
            owner: "test@example.com",
            type: "standard",
            allocationType: "single",
            createTime: 1678886400000,
            updateTime: 1678972800000,
            urlUI: "https://console.doit.com/allocations/allocation-1",
          },
        ],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleListAllocationsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        ALLOCATIONS_URL,
        mockToken,
        {
          method: "GET",
        }
      );
      expect(createSuccessResponse).toHaveBeenCalled();
    });

    it("should handle no allocations found", async () => {
      const mockArgs = {};
      const mockApiResponse = {
        allocations: [],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleListAllocationsRequest(mockArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith("No allocations found");
    });

    it("should handle API request failure", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleListAllocationsRequest(mockArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve allocations data"
      );
    });

    it("should handle makeDoitRequest throwing an error", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleListAllocationsRequest(mockArgs, mockToken);

      expect(handleGeneralError).toHaveBeenCalledWith(
        expect.any(Error),
        "making DoiT API request"
      );
    });
  });

  describe("handleGetAllocationRequest", () => {
    it("should call makeDoitRequest with correct parameters and return success response", async () => {
      const mockArgs = { id: "allocation-123" };
      const mockApiResponse = {
        id: "allocation-123",
        name: "Test Allocation",
        description: "A test allocation",
        type: "standard",
        allocationType: "single",
        createTime: 1678886400000,
        updateTime: 1678972800000,
        anomalyDetection: true,
        rule: {
          components: [
            {
              key: "project_id",
              type: "fixed",
              values: ["project-1", "project-2"],
              inverse_selection: false,
              include_null: false,
              mode: "is",
            },
          ],
          formula: "A AND B",
        },
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleGetAllocationRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        `${ALLOCATIONS_URL}/allocation-123`,
        mockToken,
        {
          method: "GET",
        }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("allocation-123")
      );
    });

    it("should handle missing allocation ID", async () => {
      const mockArgs = {};

      const response = await handleGetAllocationRequest(mockArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining("Formatted Zod Error")
      );
    });

    it("should handle API request failure", async () => {
      const mockArgs = { id: "allocation-123" };
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleGetAllocationRequest(mockArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve allocation data"
      );
    });

    it("should handle makeDoitRequest throwing an error", async () => {
      const mockArgs = { id: "allocation-123" };
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleGetAllocationRequest(mockArgs, mockToken);

      expect(handleGeneralError).toHaveBeenCalledWith(
        expect.any(Error),
        "making DoiT API request"
      );
    });

    it("should handle Zod validation errors", async () => {
      const mockArgs = { id: 123 }; // Invalid type (should be string)

      const response = await handleGetAllocationRequest(mockArgs, mockToken);

      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("Formatted Zod Error"),
          },
        ],
      });
    });
  });

  describe("handleCreateAllocationRequest", () => {
    const singleRuleArgs = {
      name: "Prod Web",
      rule: {
        components: [
          { key: "environment", type: "label" as const, values: ["prod"] },
        ],
        formula: "A",
      },
    };

    const groupArgs = {
      name: "Shared Infra",
      rules: [
        {
          name: "Team A",
          components: [
            { key: "team", type: "label" as const, values: ["team-a"] },
          ],
          formula: "A",
        },
        {
          name: "Team B",
          components: [
            { key: "team", type: "label" as const, values: ["team-b"] },
          ],
          formula: "A",
        },
      ],
      unallocatedCosts: "Other",
    };

    it("should send rule in body for single-rule allocation", async () => {
      const mockApiResponse = { id: "alloc-new-1", type: "single" };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      await handleCreateAllocationRequest(singleRuleArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        ALLOCATIONS_URL,
        mockToken,
        {
          method: "POST",
          body: {
            name: "Prod Web",
            rule: singleRuleArgs.rule,
          },
          customerContext: undefined,
        }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("alloc-new-1")
      );
    });

    it("should send rules + unallocatedCosts in body for group allocation", async () => {
      const mockApiResponse = { id: "alloc-new-2", type: "group" };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      await handleCreateAllocationRequest(groupArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        ALLOCATIONS_URL,
        mockToken,
        {
          method: "POST",
          body: {
            name: "Shared Infra",
            rules: groupArgs.rules,
            unallocatedCosts: "Other",
          },
          customerContext: undefined,
        }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("alloc-new-2")
      );
    });

    it("should return error when API returns null", async () => {
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      await handleCreateAllocationRequest(singleRuleArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to create allocation"
      );
    });

    it("should return validation error when both rule and rules are provided", async () => {
      const invalidArgs = {
        name: "Bad Allocation",
        rule: singleRuleArgs.rule,
        rules: groupArgs.rules,
        unallocatedCosts: "Other",
      };

      await handleCreateAllocationRequest(invalidArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining("Formatted Zod Error")
      );
      expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return validation error when neither rule nor rules is provided", async () => {
      const invalidArgs = { name: "Bad Allocation" };

      await handleCreateAllocationRequest(invalidArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining("Formatted Zod Error")
      );
      expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return validation error when rules is provided without unallocatedCosts", async () => {
      const invalidArgs = {
        name: "Bad Group",
        rules: groupArgs.rules,
      };

      await handleCreateAllocationRequest(invalidArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining("Formatted Zod Error")
      );
      expect(makeDoitRequest).not.toHaveBeenCalled();
    });
  });

  describe("handleUpdateAllocationRequest", () => {
    const singleRuleArgs = {
      id: "allocation-123",
      name: "Updated Allocation",
      rule: {
        components: [
          { key: "environment", type: "label" as const, values: ["staging"] },
        ],
        formula: "A",
      },
    };

    const groupArgs = {
      id: "allocation-456",
      name: "Updated Group",
      rules: [
        {
          name: "Team A",
          components: [
            { key: "team", type: "label" as const, values: ["team-a"] },
          ],
          formula: "A",
        },
        {
          name: "Team B",
          components: [
            { key: "team", type: "label" as const, values: ["team-b"] },
          ],
          formula: "A",
        },
      ],
      unallocatedCosts: "Other",
    };

    it("should send PATCH request with rule in body for single-rule allocation", async () => {
      const mockApiResponse = { id: "allocation-123", type: "single" };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      await handleUpdateAllocationRequest(singleRuleArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        `${ALLOCATIONS_URL}/allocation-123`,
        mockToken,
        {
          method: "PATCH",
          body: {
            name: "Updated Allocation",
            rule: singleRuleArgs.rule,
          },
          customerContext: undefined,
        }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("allocation-123")
      );
    });

    it("should send PATCH request with rules + unallocatedCosts for group allocation", async () => {
      const mockApiResponse = { id: "allocation-456", type: "group" };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      await handleUpdateAllocationRequest(groupArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        `${ALLOCATIONS_URL}/allocation-456`,
        mockToken,
        {
          method: "PATCH",
          body: {
            name: "Updated Group",
            rules: groupArgs.rules,
            unallocatedCosts: "Other",
          },
          customerContext: undefined,
        }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("allocation-456")
      );
    });

    it("should include description in body when provided", async () => {
      const argsWithDesc = {
        ...singleRuleArgs,
        description: "Updated description",
      };
      const mockApiResponse = { id: "allocation-123", type: "single" };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      await handleUpdateAllocationRequest(argsWithDesc, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        `${ALLOCATIONS_URL}/allocation-123`,
        mockToken,
        {
          method: "PATCH",
          body: {
            name: "Updated Allocation",
            description: "Updated description",
            rule: singleRuleArgs.rule,
          },
          customerContext: undefined,
        }
      );
    });

    it("should return error when API returns null", async () => {
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      await handleUpdateAllocationRequest(singleRuleArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update allocation")
      );
    });

    it("should return validation error when id is missing", async () => {
      const invalidArgs = {
        name: "No ID",
        rule: singleRuleArgs.rule,
      };

      await handleUpdateAllocationRequest(invalidArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining("Formatted Zod Error")
      );
      expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return validation error when both rule and rules are provided", async () => {
      const invalidArgs = {
        id: "allocation-123",
        name: "Bad Update",
        rule: singleRuleArgs.rule,
        rules: groupArgs.rules,
        unallocatedCosts: "Other",
      };

      await handleUpdateAllocationRequest(invalidArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining("Formatted Zod Error")
      );
      expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should handle makeDoitRequest throwing an error", async () => {
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      await handleUpdateAllocationRequest(singleRuleArgs, mockToken);

      expect(handleGeneralError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining("update allocation")
      );
    });
  });
});
