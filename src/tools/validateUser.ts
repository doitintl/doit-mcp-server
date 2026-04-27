import { z } from "zod";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const VALIDATE_USER_BASE_URL = `${DOIT_API_BASE}/auth/v1/validate`;

// Schema definition
export const ValidateUserArgumentsSchema = z.object({});

// Interfaces
export interface ValidateUserResponse {
    domain: string;
    email: string;
}

export interface ValidateUserToolResponse {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}

/**
 * Parse the result of `handleValidateUserRequest` into typed user data.
 * Throws on `isError`, empty content, malformed JSON, or missing/invalid fields.
 * Use this anywhere internal control flow depends on validate-user data.
 */
export function parseValidatedUserResponse(response: ValidateUserToolResponse): ValidateUserResponse {
    if (response.isError) {
        throw new Error("Failed to validate user");
    }

    const text = response.content[0]?.text;
    if (!text) {
        throw new Error("Validate user response is empty");
    }

    const parsed = JSON.parse(text) as { domain?: unknown; email?: unknown };
    if (typeof parsed.domain !== "string" || !parsed.domain || typeof parsed.email !== "string" || !parsed.email) {
        throw new Error("Validate user response missing domain or email");
    }

    return {
        domain: parsed.domain,
        email: parsed.email,
    };
}

// Tool metadata
export const validateUserTool = {
    name: "validate_user",
    description:
        "Use this ONLY when the user explicitly asks to verify their account connection or check who they are logged in as. Do NOT call this proactively before other tool calls — the OAuth token already guarantees the user is authenticated. Do NOT use this for listing users in the organization (use list_users).",
    inputSchema: {
        type: "object",
        properties: {},
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Validating user...",
        "openai/toolInvocation/invoked": "User validated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// Handle validate user request
export async function handleValidateUserRequest(args: any, token: string) {
    try {
        // Validate arguments (no arguments required for this endpoint)
        ValidateUserArgumentsSchema.parse(args);
        const customerContext = args.customerContext;

        // Set up the URL for the validate endpoint
        const validateUrl = VALIDATE_USER_BASE_URL;

        try {
            // Make the API request
            const userData = await makeDoitRequest<ValidateUserResponse>(validateUrl, token, {
                method: "GET",
                appendParams: true,
                customerContext,
            });

            if (!userData) {
                return createErrorResponse("Failed to validate user");
            }

            return createSuccessResponse(
                JSON.stringify({
                    domain: userData.domain,
                    email: userData.email,
                })
            );
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
