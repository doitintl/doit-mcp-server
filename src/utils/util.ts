// Constants
export const DOIT_API_BASE = "https://api.doit.com";

// Response type definition
export type McpResponse = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "audio"; data: string; mimeType: string }
    | {
        type: "resource";
        resource:
          | { text: string; uri: string; mimeType?: string }
          | { uri: string; blob: string; mimeType?: string };
      }
  >;
};

/**
 * Creates a standardized error response
 * @param message Error message to display to the user
 * @returns Formatted error response object
 */
export function createErrorResponse(message: string): McpResponse {
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
export function createSuccessResponse(text: string): McpResponse {
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
export function appendUrlParameters(
  baseUrl: string,
  customerContext: string
): string {
  // Check if the URL already has query parameters
  const separator = baseUrl.includes("?") ? "&" : "?";
  let url = baseUrl;

  // Only add maxResults if it's not already in the URL
  if (!baseUrl.includes("maxResults=")) {
    url += `${separator}maxResults=40`;
  }

  if (customerContext && customerContext.length > 0) {
    // Use & as separator since we know the URL now has parameters
    url += `&customerContext=${customerContext}`;
  }

  return url;
}

/**
 * Helper function for making DoiT API requests
 * @param url The API endpoint URL
 * @param token The authentication token
 * @param options Additional request options
 * @param options.method HTTP method (GET, POST, etc.)
 * @param options.body Request body for POST/PUT requests
 * @param options.appendParams Whether to append URL parameters (maxResults and customerContext)
 * @returns The parsed JSON response or null on error
 */
export async function makeDoitRequest<T>(
  url: string,
  token: string,
  options: {
    method?: string;
    body?: any;
    appendParams?: boolean;
    customerContext?: string;
  } = {}
): Promise<T | null> {
  const {
    method = "GET",
    body = undefined,
    appendParams = true,
    customerContext = "",
  } = options;

  const headers = {
    Authorization: token,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (appendParams) {
    url = appendUrlParameters(url, customerContext);
  }

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    // Add body for non-GET requests if provided
    if (method !== "GET" && body !== undefined) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error making DoiT API ${method} request:`, error);
    return null;
  }
}
