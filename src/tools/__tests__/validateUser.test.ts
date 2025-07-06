import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { handleValidateUserRequest } from "../validateUser.js";
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

describe("validateUser", () => {
  describe("handleValidateUserRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call makeDoitRequest with correct parameters and return success response", async () => {
      const mockArgs = {}; // No arguments expected
      const mockApiResponse = {
        domain: "example.com",
        email: "user@example.com",
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleValidateUserRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/auth/v1/validate",
        mockToken,
        { appendParams: true, method: "GET" }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        "User validation successful:\nDomain: example.com (the domain of the user, make it bold)\nEmail: user@example.com"
      );
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: "User validation successful:\nDomain: example.com (the domain of the user, make it bold)\nEmail: user@example.com",
          },
        ],
      });
    });

    it("should handle API request failure", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleValidateUserRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/auth/v1/validate",
        mockToken,
        { appendParams: true, method: "GET" }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to validate user"
      );
      expect(response).toEqual({
        content: [{ type: "text", text: "Failed to validate user" }],
      });
    });

    it("should handle general errors", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleValidateUserRequest(mockArgs, mockToken);

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
