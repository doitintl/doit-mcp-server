import { beforeEach, describe, expect, it, vi } from "vitest";
import { createErrorResponse, createSuccessResponse, formatZodError, handleGeneralError } from "../../utils/util.js";
import { ChangeCustomerArgumentsSchema, handleChangeCustomerRequest } from "../changeCustomer.js";
import { handleValidateUserRequest } from "../validateUser.js";

// Mock the utility functions
vi.mock("../../utils/util.js", () => ({
    createErrorResponse: vi.fn((message) => ({
        content: [{ type: "text", text: message }],
    })),
    createSuccessResponse: vi.fn((text) => ({
        content: [{ type: "text", text }],
    })),
    formatZodError: vi.fn((error) => `Validation error: ${error.message}`),
    handleGeneralError: vi.fn((error, context) => ({
        content: [{ type: "text", text: `Error in ${context}: ${error.message}` }],
    })),
    DOIT_API_BASE: "https://api.doit.com",
}));

// Mock the validateUser function
vi.mock("../validateUser.js", async () => {
    const actual = await vi.importActual<typeof import("../validateUser.js")>("../validateUser.js");
    return {
        ...actual,
        handleValidateUserRequest: vi.fn(),
    };
});

describe("changeCustomer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(handleValidateUserRequest).mockResolvedValue({
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

    describe("ChangeCustomerArgumentsSchema", () => {
        it("should validate valid arguments", () => {
            const validArgs = {
                customerContext: "new-customer-123",
            };

            const result = ChangeCustomerArgumentsSchema.parse(validArgs);
            expect(result).toEqual(validArgs);
        });

        it("should reject invalid arguments", () => {
            const invalidArgs = {
                // missing customerContext
            };

            expect(() => ChangeCustomerArgumentsSchema.parse(invalidArgs)).toThrow();
        });

        it("should reject non-string customerContext", () => {
            const invalidArgs = {
                customerContext: 123,
            };

            expect(() => ChangeCustomerArgumentsSchema.parse(invalidArgs)).toThrow();
        });
    });

    describe("handleChangeCustomerRequest", () => {
        it("should successfully change customer context", async () => {
            const args = {
                customerContext: "old-customer",
            };
            const newContext = "new-customer-123";
            const token = "mock-token";
            const updateCallback = vi.fn();

            const _result = await handleChangeCustomerRequest(
                { ...args, customerContext: newContext },
                token,
                updateCallback
            );

            expect(updateCallback).toHaveBeenCalledWith(newContext);
            expect(createSuccessResponse).toHaveBeenCalledWith(
                "Customer context successfully changed to 'example.com'"
            );
        });

        it("should handle missing previous context", async () => {
            const args = {};
            const newContext = "new-customer-123";
            const token = "mock-token";
            const updateCallback = vi.fn();

            const _result = await handleChangeCustomerRequest(
                { ...args, customerContext: newContext },
                token,
                updateCallback
            );

            expect(updateCallback).toHaveBeenCalledWith(newContext);
            expect(createSuccessResponse).toHaveBeenCalledWith(
                "Customer context successfully changed to 'example.com'"
            );
        });

        it("should work without update callback", async () => {
            const args = {
                customerContext: "old-customer",
            };
            const newContext = "new-customer-123";
            const token = "mock-token";

            const _result = await handleChangeCustomerRequest({ ...args, customerContext: newContext }, token);

            expect(createSuccessResponse).toHaveBeenCalledWith(
                "Customer context successfully changed to 'example.com'"
            );
        });

        it("should reject an invalid customer context when validation returns an error", async () => {
            vi.mocked(handleValidateUserRequest).mockResolvedValue({
                content: [{ type: "text", text: "The customer context is not authorized" }],
                isError: true,
            } as any);
            const newContext = "new-customer-123";
            const token = "mock-token";
            const updateCallback = vi.fn();

            await handleChangeCustomerRequest({ customerContext: newContext }, token, updateCallback);

            expect(updateCallback).not.toHaveBeenCalled();
            expect(createErrorResponse).toHaveBeenCalledWith(
                "Customer context is invalid. Please try again with a valid customer id."
            );
        });

        it("should handle validation errors", async () => {
            const invalidArgs = {
                customerContext: 123, // invalid type
            };
            const token = "mock-token";

            const _result = await handleChangeCustomerRequest(invalidArgs, token);

            expect(createErrorResponse).toHaveBeenCalled();
            expect(formatZodError).toHaveBeenCalled();
        });

        it("should handle general errors", async () => {
            // Mock ChangeCustomerArgumentsSchema.parse to throw a non-Zod error
            const originalParse = ChangeCustomerArgumentsSchema.parse;
            vi.spyOn(ChangeCustomerArgumentsSchema, "parse").mockImplementation(() => {
                throw new Error("Unexpected error");
            });

            const args = {
                customerContext: "new-customer-123",
            };
            const token = "mock-token";

            const _result = await handleChangeCustomerRequest(args, token);

            expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), "handling change customer request");

            // Restore original implementation
            ChangeCustomerArgumentsSchema.parse = originalParse;
        });
    });
});
