import { beforeEach, describe, expect, it, vi } from "vitest";
import { createErrorResponse, createSuccessResponse, handleGeneralError, makeDoitRequest } from "../../utils/util.js";
import { handleValidateUserRequest, parseValidatedUserResponse } from "../validateUser.js";

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
            vi.mocked(makeDoitRequest).mockResolvedValue(mockApiResponse);

            const response = await handleValidateUserRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/auth/v1/validate",
                mockToken,
                expect.objectContaining({
                    appendParams: true,
                    method: "GET",
                })
            );
            expect(createSuccessResponse).toHaveBeenCalledWith(
                JSON.stringify({
                    domain: "example.com",
                    email: "user@example.com",
                })
            );
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            domain: "example.com",
                            email: "user@example.com",
                        }),
                    },
                ],
            });
        });

        it("should handle API request failure", async () => {
            const mockArgs = {};
            vi.mocked(makeDoitRequest).mockResolvedValue(null);

            const response = await handleValidateUserRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/auth/v1/validate",
                mockToken,
                expect.objectContaining({
                    appendParams: true,
                    method: "GET",
                })
            );
            expect(createErrorResponse).toHaveBeenCalledWith("Failed to validate user");
            expect(response).toEqual({
                content: [{ type: "text", text: "Failed to validate user" }],
            });
        });

        it("should handle general errors", async () => {
            const mockArgs = {};
            vi.mocked(makeDoitRequest).mockRejectedValue(new Error("Network error"));

            const response = await handleValidateUserRequest(mockArgs, mockToken);

            expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), "making DoiT API request");
            expect(response).toEqual({
                content: [{ type: "text", text: "General Error: making DoiT API request" }],
            });
        });
    });

    describe("parseValidatedUserResponse", () => {
        it("should parse a successful JSON validate response", () => {
            const response = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            domain: "example.com",
                            email: "user@example.com",
                        }),
                    },
                ],
            };

            expect(parseValidatedUserResponse(response)).toEqual({
                domain: "example.com",
                email: "user@example.com",
            });
        });

        it("should reject validate errors", () => {
            const response = {
                content: [{ type: "text", text: "The customer context is not authorized" }],
                isError: true,
            };

            expect(() => parseValidatedUserResponse(response)).toThrow("Failed to validate user");
        });

        it("should reject malformed JSON", () => {
            const response = {
                content: [{ type: "text", text: "Domain: example.com\nEmail: user@example.com" }],
            };

            expect(() => parseValidatedUserResponse(response)).toThrow();
        });

        it("should reject JSON missing required fields", () => {
            const response = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            email: "user@example.com",
                        }),
                    },
                ],
            };

            expect(() => parseValidatedUserResponse(response)).toThrow(
                "Validate user response missing domain or email"
            );
        });

        it("should reject JSON with non-string required fields", () => {
            const response = {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            domain: 123,
                            email: "user@example.com",
                        }),
                    },
                ],
            };

            expect(() => parseValidatedUserResponse(response)).toThrow(
                "Validate user response missing domain or email"
            );
        });
    });
});
