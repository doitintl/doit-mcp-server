import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
} from "../../utils/util.js";
import { formatAsset, handleListAssetsRequest } from "../assets.js";

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

describe("assets", () => {
  describe("formatAsset", () => {
    it("should format an asset object correctly", () => {
      const mockAsset = {
        createTime: 1640995200,
        id: "asset-123",
        name: "Test Asset",
        quantity: 5,
        type: "billing_account",
        url: "https://console.cloud.google.com/billing/123",
      };

      const expected = `ID: asset-123
Name: Test Asset
Type: billing_account
Quantity: 5
URL: https://console.cloud.google.com/billing/123
Created: 2022-01-01T00:00:00.000Z
-----------`;

      expect(formatAsset(mockAsset)).toBe(expected);
    });
  });

  describe("handleListAssetsRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call makeDoitRequest with correct parameters and return success response", async () => {
      const mockArgs = { pageToken: "next-page" };
      const mockApiResponse = {
        assets: [
          {
            createTime: 1640995200,
            id: "asset-123",
            name: "Test Asset",
            quantity: 5,
            type: "billing_account",
            url: "https://console.cloud.google.com/billing/123",
          },
        ],
        pageToken: "another-page",
        rowCount: 1,
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleListAssetsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/billing/v1/assets?pageToken=next-page",
        mockToken,
        { method: "GET", customerContext: undefined }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("Found 1 assets:")
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("Found 1 assets:") },
        ],
      });
    });

    it("should handle no assets found", async () => {
      const mockArgs = {};
      const mockApiResponse = {
        assets: [],
        pageToken: "",
        rowCount: 0,
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleListAssetsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/billing/v1/assets",
        mockToken,
        { method: "GET", customerContext: undefined }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        "No assets found for this customer context."
      );
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: "No assets found for this customer context.",
          },
        ],
      });
    });

    it("should handle API request failure", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleListAssetsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/billing/v1/assets",
        mockToken,
        { method: "GET", customerContext: undefined }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve assets data"
      );
      expect(response).toEqual({
        content: [{ type: "text", text: "Failed to retrieve assets data" }],
      });
    });

    it("should handle ZodError for invalid arguments", async () => {
      const mockArgs = { pageToken: 123 }; // Invalid pageToken type
      const response = await handleListAssetsRequest(mockArgs, mockToken);

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

      const response = await handleListAssetsRequest(mockArgs, mockToken);

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

    it("should include page token in response when provided", async () => {
      const mockArgs = {};
      const mockApiResponse = {
        assets: [
          {
            createTime: 1640995200,
            id: "asset-123",
            name: "Test Asset",
            quantity: 5,
            type: "billing_account",
            url: "https://console.cloud.google.com/billing/123",
          },
        ],
        pageToken: "next-page-token",
        rowCount: 1,
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const _response = await handleListAssetsRequest(mockArgs, mockToken);

      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("Page token: next-page-token")
      );
    });
  });
});
