// Constants
export const DOIT_API_BASE = "https://api.doit.com";

/**
 * Creates a standardized error response
 * @param message Error message to display to the user
 * @returns Formatted error response object
 */
export function createErrorResponse(message: string) {
  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  };
}

/**
 * Creates a standardized success response
 * @param text Content text to display to the user
 * @returns Formatted success response object
 */
export function createSuccessResponse(text: string) {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

/**
 * Formats an error message from a ZodError
 * @param error The ZodError object
 * @returns Formatted error message string
 */
export function formatZodError(error: any): string {
  if (!error.errors) {
    return "Invalid arguments provided";
  }

  return `Invalid arguments: ${error.errors
    .map((e: any) => `${e.path.join(".")}: ${e.message}`)
    .join(", ")}`;
}

/**
 * Helper function to handle general errors
 * @param error The error object
 * @param context Additional context to include in the log message
 * @returns Standardized error response
 */
export function handleGeneralError(
  error: any,
  context: string
): ReturnType<typeof createErrorResponse> {
  console.error(`Error ${context}:`, error);
  return createErrorResponse("An error occurred while processing your request");
}

/**
 * Helper function to append customer context to URL if available
 * @param baseUrl The base URL to append parameters to
 * @returns URL with maxResults and optional customerContext parameters
 */
export function appendUrlParameters(baseUrl: string): string {
  // Check if the URL already has query parameters
  const separator = baseUrl.includes("?") ? "&" : "?";
  let url = `${baseUrl}${separator}maxResults=20`;
  const customerContext = process.env.CUSTOMER_CONTEXT;

  if (customerContext) {
    url += `&customerContext=${customerContext}`;
  }

  return url;
}

/**
 * Helper function for making DoiT API requests
 * @param url The API endpoint URL
 * @param token The authentication token
 * @param appendParams Whether to append URL parameters (maxResults and customerContext)
 * @returns The parsed JSON response or null on error
 */
export async function makeDoitRequest<T>(
  url: string,
  token: string,
  appendParams: boolean = true
): Promise<T | null> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Apply appendUrlParameters functionality if requested
  if (appendParams) {
    url = appendUrlParameters(url);
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making DoiT API request:", error);
    return null;
  }
}
