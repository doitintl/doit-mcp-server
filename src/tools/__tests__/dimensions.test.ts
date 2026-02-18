import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
} from "../../utils/util.js";
import { formatDimension, handleDimensionsRequest } from "../dimensions.js";

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

describe("dimensions", () => {
  describe("formatDimension", () => {
    it("should format a dimension object correctly", () => {
      const mockDimension = {
        id: "service_description",
        label: "Service Description",
        type: "fixed",
      };

      const expected = `ID: service_description
Label: Service Description
Type: fixed
-----------`;

      expect(formatDimension(mockDimension)).toBe(expected);
    });
  });

  describe("handleDimensionsRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call makeDoitRequest with correct parameters and return success response", async () => {
      const mockArgs = { filter: "type:fixed", pageToken: "next-page" };
      const mockApiResponse = {
        pageToken: "another-page",
        rowCount: 1,
        dimensions: [
          {
            id: "service_description",
            label: "Service Description",
            type: "fixed",
          },
        ],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleDimensionsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/analytics/v1/dimensions?filter=type%3Afixed&pageToken=next-page&maxResults=200",
        mockToken,
        { method: "GET", customerContext: undefined }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("Found 1 dimensions (filtered by: type:fixed)")
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("Found 1 dimensions") },
        ],
      });
    });

    it("should handle no dimensions found", async () => {
      const mockArgs = { filter: "type:invalid" };
      const mockApiResponse = {
        pageToken: "",
        rowCount: 0,
        dimensions: [],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleDimensionsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/analytics/v1/dimensions?filter=type%3Ainvalid&maxResults=200",
        mockToken,
        { method: "GET", customerContext: undefined }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "No dimensions found, please check the filter parameter, try without filter if you don't know the exact value of the key"
      );
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: "No dimensions found, please check the filter parameter, try without filter if you don't know the exact value of the key",
          },
        ],
      });
    });

    it("should handle API request failure", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleDimensionsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/analytics/v1/dimensions?maxResults=200",
        mockToken,
        { method: "GET", customerContext: undefined }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve dimensions data"
      );
      expect(response).toEqual({
        content: [{ type: "text", text: "Failed to retrieve dimensions data" }],
      });
    });

    it("should handle ZodError for invalid arguments", async () => {
      const mockArgs = { filter: 123 }; // Invalid filter type
      const response = await handleDimensionsRequest(mockArgs, mockToken);

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
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleDimensionsRequest(mockArgs, mockToken);

      expect(handleGeneralError).toHaveBeenCalledWith(
        expect.any(Error),
        "making DoiT API request"
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: "General Error: making DoiT API request" },
        ],
      });
    });
  });
});
