import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
  DOIT_API_BASE,
} from "../utils/util.js";

// Schema definition
export const ValidateUserArgumentsSchema = z.object({});

// Interfaces
export interface ValidateUserResponse {
  domain: string;
  email: string;
}

// Tool metadata
export const validateUserTool = {
  name: "validate_user",
  description:
    "Validates the current API user and returns domain and email information",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

// Handle validate user request
export async function handleValidateUserRequest(args: any, token: string) {
  try {
    // Validate arguments (no arguments required for this endpoint)
    ValidateUserArgumentsSchema.parse(args);

    // Set up the URL for the validate endpoint
    const validateUrl = `${DOIT_API_BASE}/auth/v1/validate`;

    try {
      // Make the API request
      const userData = await makeDoitRequest<ValidateUserResponse>(
        validateUrl,
        token,
        false // No need to append additional parameters
      );

      if (!userData) {
        return createErrorResponse("Failed to validate user");
      }

      // Format the response
      const formattedResponse = `User validation successful:
Domain: ${userData.domain}
Email: ${userData.email}`;

      return createSuccessResponse(formattedResponse);
    } catch (error) {
      return handleGeneralError(error, "making DoiT API request");
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(formatZodError(error));
    }
    return handleGeneralError(error, "handling validate user request");
  }
}
