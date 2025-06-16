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
  let url = baseUrl;

  // Only add maxResults if it's not already in the URL
  if (!baseUrl.includes("maxResults=")) {
    url += `${separator}maxResults=40`;
  }

  const customerContext = process.env.CUSTOMER_CONTEXT;

  if (customerContext) {
    // Use & as separator since we know the URL now has parameters
    url += `&customerContext=${customerContext}`;
  }

  return url;
}

/**
 * Helper function to remove Bearer prefix from token if it exists
 * @param token The token string that may or may not have "Bearer " prefix
 * @returns The token string without the "Bearer " prefix
 */
export function removeBearerFromToken(token: string): string {
  if (!token) return token;

  const bearerPrefix = "Bearer ";
  if (token.startsWith(bearerPrefix)) {
    return token.substring(bearerPrefix.length);
  }

  return token;
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
  } = {}
): Promise<T | null> {
  const { method = "GET", body = undefined, appendParams = true } = options;

  const headers = {
    Authorization: `Bearer ${removeBearerFromToken(token)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (appendParams) {
    url = appendUrlParameters(url);
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

    // add mcp params to the url
    url += `&mcp=true`;

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

/**
 * Formats a timestamp (number) as a human-readable date string
 * @param timestamp The timestamp in milliseconds
 * @returns Formatted date string (e.g., '2024-04-27')
 */
export function formatDate(timestamp: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString().split("T")[0];
}
