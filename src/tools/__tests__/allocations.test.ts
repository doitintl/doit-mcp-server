import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  handleListAllocationsRequest,
  handleGetAllocationRequest,
} from "../allocations.js";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
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
        "https://api.doit.com/analytics/v1/allocations?pageToken=next-page",
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
        "https://api.doit.com/analytics/v1/allocations",
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
        "https://api.doit.com/analytics/v1/allocations/allocation-123",
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
});
