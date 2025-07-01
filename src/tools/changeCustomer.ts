import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
} from "../utils/util.js";

// Schema definition
export const ChangeCustomerArgumentsSchema = z.object({
  customerContext: z.string().describe("The new customer context to set"),
});

// Interfaces
export interface ChangeCustomerResponse {
  success: boolean;
  previousContext?: string;
  newContext: string;
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

    const previousContext = args.customerContext;

    // Update the customer context if callback is provided
    if (updateCustomerContext) {
      await updateCustomerContext(newContext);
    }

    // Create response
    const response: ChangeCustomerResponse = {
      success: true,
      previousContext,
      newContext,
      message: `Customer context successfully changed${
        previousContext ? ` from '${previousContext}'` : ""
      } to '${newContext}'`,
    };

    return createSuccessResponse(response.message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(formatZodError(error));
    }
    return handleGeneralError(error, "handling change customer request");
  }
}
