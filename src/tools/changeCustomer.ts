import { z } from "zod";
import { createErrorResponse, createSuccessResponse, formatZodError, handleGeneralError } from "../utils/util.js";
import { handleValidateUserRequest } from "./validateUser.js";

// Schema definition
export const ChangeCustomerArgumentsSchema = z.object({
    customerContext: z.string().describe("The new customer context to set"),
});

// Interfaces
export interface ChangeCustomerResponse {
    success: boolean;
    message: string;
}

// Tool metadata
export const changeCustomerTool = {
    name: "change_customer",
    description:
        "Changes the current customer context for subsequent API calls. This allows switching between different customer accounts or contexts, Example: EE8CtpzYiKp0dVAESVrB",
    inputSchema: {
        type: "object",
        properties: {
            customerContext: {
                type: "string",
                description: "The new customer context to set",
            },
        },
        required: ["customerContext"],
    },
};

// Handle change customer request
export async function handleChangeCustomerRequest(
    args: any,
    token: string,
    updateCustomerContext?: (newContext: string) => Promise<void> | void
) {
    try {
        // Validate arguments
        const validatedArgs = ChangeCustomerArgumentsSchema.parse(args);
        const { customerContext: newContext } = validatedArgs;
        if (!newContext) {
            return createErrorResponse("Customer context is required");
        }

        const _previousContext = args.customerContext;

        // Verify that the new context is valid
        const newCustomerDomain = await handleValidateUserRequest(
            { customerContext: newContext }, // Validate doers
            token
        );

        if (newCustomerDomain.content[0].text.toLowerCase().includes("failed")) {
            return createErrorResponse("Customer context is invalid. Please try again with a valid customer id.");
        }

        // Update the customer context if callback is provided
        if (updateCustomerContext) {
            await updateCustomerContext(newContext);
        }

        const domain = newCustomerDomain.content[0].text.split("Domain: ")[1];

        // Create response
        const response: ChangeCustomerResponse = {
            success: true,
            message: `Customer context successfully changed to '${domain}'`,
        };

        return createSuccessResponse(response.message);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling change customer request");
    }
}
