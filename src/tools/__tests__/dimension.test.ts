import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
} from "../../utils/util.js";
import {
  formatDimension,
  handleDimensionRequest,
} from "../dimension.js";

// Mock the utility functions
vi.mock("../../utils/util.js", () => ({
  createErrorResponse: vi.fn((msg) => ({
    content: [{ type: "text", text: msg }],
  })),
  createSuccessResponse: vi.fn((text) => ({
    content: [{ type: "text", text }],
  })),
  formatZodError: vi.fn((error) => `Formatted Zod Error: ${error.message}`),
  handleGeneralError: vi.fn((_error, context) => ({
    content: [{ type: "text", text: `General Error: ${context}` }],
  })),
  makeDoitRequest: vi.fn(),
  DOIT_API_BASE: "https://api.doit.com",
}));

describe("dimension", () => {
  describe("formatDimension", () => {
    it("should format a dimension object with values correctly", () => {
      const mockDimension = {
        id: "service_description",
        label: "Service Description",
        type: "fixed",
        values: [{ value: "Compute Engine" }, { value: "Cloud Storage" }],
      };

      const expected = `ID: service_description
Label: Service Description
Type: fixed
Values:
  1. Compute Engine
  2. Cloud Storage`;

      expect(formatDimension(mockDimension)).toBe(expected);
    });

    it("should format a dimension object without values correctly", () => {
      const mockDimension = {
        id: "datetime",
        label: "Datetime",
        type: "datetime",
        values: [],
      };

      const expected = `ID: datetime
Label: Datetime
Type: datetime`;

      expect(formatDimension(mockDimension)).toBe(expected);
    });

    it("should handle missing values property", () => {
      const mockDimension = {
        id: "datetime",
        label: "Datetime",
        type: "datetime",
      };

      const expected = `ID: datetime
Label: Datetime
Type: datetime`;

      expect(formatDimension(mockDimension)).toBe(expected);
    });
  });

  describe("handleDimensionRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call makeDoitRequest with correct parameters and return success response", async () => {
      const mockArgs = { type: "fixed", id: "service_description" };
      const mockApiResponse = {
        id: "service_description",
        label: "Service Description",
        type: "fixed",
        values: [{ value: "Compute Engine" }],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleDimensionRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/analytics/v1/dimension?type=fixed&id=service_description",
        mockToken,
        { appendParams: true, method: "GET" }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("ID: service_description")
      );
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("ID: service_description"),
          },
        ],
      });
    });

    it("should handle API request failure", async () => {
      const mockArgs = { type: "fixed", id: "service_description" };
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleDimensionRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/analytics/v1/dimension?type=fixed&id=service_description",
        mockToken,
        { appendParams: true, method: "GET" }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve dimension with type: fixed and id: service_description"
      );
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: "Failed to retrieve dimension with type: fixed and id: service_description",
          },
        ],
      });
    });

    it("should handle ZodError for invalid arguments", async () => {
      const mockArgs = { type: "invalid-type", id: "service_description" }; // Invalid type enum
      const response = await handleDimensionRequest(mockArgs, mockToken);

      expect(formatZodError).toHaveBeenCalled();
      expect(createErrorResponse).toHaveBeenCalled();
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("Formatted Zod Error:"),
          },
        ],
      });
    });

    it("should handle general errors", async () => {
      const mockArgs = { type: "fixed", id: "service_description" };
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleDimensionRequest(mockArgs, mockToken);

      expect(handleGeneralError).toHaveBeenCalledWith(
        expect.any(Error),
        "making DoiT API request for dimension"
      );
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: "General Error: making DoiT API request for dimension",
          },
        ],
      });
    });
  });
});
