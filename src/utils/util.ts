import type { z } from "zod";

export const DOIT_API_BASE = process.env.DOIT_API_BASE || "https://api.doit.com";

/**
 * Debug levels for controlling log verbosity
 */
export enum DebugLevel {
  /** No debug output */
  OFF = 0,
  /** Basic debug information (default when debugging is enabled) */
  INFO = 1,
  /** Detailed debug information */
  VERBOSE = 2,
  /** Very detailed debug information including full request/response data */
  TRACE = 3,
}

/**
 * Parse and validate the DOIT_DEBUG_LEVEL environment variable
 * Supports: 0 (off), 1 (info), 2 (verbose), 3 (trace)
 */
const parseDebugLevel = (): DebugLevel => {
  const envValue = process.env.DOIT_DEBUG_LEVEL;
  if (!envValue) {
    return DebugLevel.OFF;
  }
  try {
    const numValue = parseInt(envValue, 10);
    if (Number.isNaN(numValue)) {
      return DebugLevel.OFF;
    }
    if (numValue <= 0) return DebugLevel.OFF;
    if (numValue >= 3) return DebugLevel.TRACE;
    return numValue as DebugLevel;
  } catch {
    return DebugLevel.OFF;
  }
};

const DOIT_DEBUG_LEVEL = parseDebugLevel();

/**
 * Logs a message to standard error when debug mode is enabled and the message level
 * is less than or equal to the configured debug level.
 * Standard output may be mixed with MCP server output.
 * @param message Message or data to log (will be stringified if not a string)
 * @param level Debug level for this message (default: INFO).
 * @param optionalArgs Optional additional arguments (logged after the message, like console.log)
 */
export function debugLog(
  message: unknown,
  level: DebugLevel = DebugLevel.INFO,
  ...optionalArgs: unknown[]
): void {
  if (DOIT_DEBUG_LEVEL < level) return;
  
  const levelName = DebugLevel[level];
  const text =
    typeof message === "string" ? message : JSON.stringify(message, null, 2);
  
  if (optionalArgs.length > 0) {
    console.error(`[doit-mcp debug:${levelName}]`, text, ...optionalArgs);
  } else {
    console.error(`[doit-mcp debug:${levelName}]`, text);
  }
}

/**
 * Generic function to convert a zod schema to MCP server tool format
 * @param schema The zod schema object (e.g., z.object({ ... }))
 * @returns Object with zod schema properties ready for MCP server tool
 */
export function zodSchemaToMcpTool<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
) {
  return schema.shape;
}

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
  const message =
    error instanceof Error ? error.message : String(error);
  return createErrorResponse(
    message || "An error occurred while processing your request"
  );
}

/**
 * Helper function to append customer context to URL if available
 * @param baseUrl The base URL to append parameters to
 * @returns URL with maxResults and optional customerContext parameters
 */
export function appendUrlParameters(
  baseUrl: string,
  customerContextId?: string
): string {
  // Check if the URL already has query parameters
  const separator = baseUrl.includes("?") ? "&" : "?";
  let url = baseUrl;

  // Only add maxResults if it's not already in the URL
  if (!baseUrl.includes("maxResults=")) {
    url += `${separator}maxResults=40`;
  }

  const customerContext = customerContextId || process.env.CUSTOMER_CONTEXT;

  if (customerContext) {
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
    customerContext,
  } = options;

  const headers = {
    Authorization: `Bearer ${token}`,
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
      debugLog("API request body: ", DebugLevel.TRACE, requestOptions.body);
    }

    // add mcp params to the url
    url += `&mcp=true`;

    if (!process.env.CUSTOMER_CONTEXT) {
      // request from the sse server
      url += `&sse=true`;
    }

    debugLog("API request URL: ", DebugLevel.VERBOSE, url);
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const bodyText = await response.text();
      let detail = bodyText;
      try {
        const parsed = JSON.parse(bodyText);
        detail =
          parsed.message ||
          parsed.error ||
          (typeof parsed.detail === "string"
            ? parsed.detail
            : JSON.stringify(parsed));
      } catch {
        // use bodyText as-is
      }
      throw new Error(
        `HTTP ${response.status}: ${detail || response.statusText}`
      );
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

/**
 * Decodes a JWT token without validation
 * @param token The JWT token string
 * @returns The decoded JWT object containing header, payload, and signature
 */
export function decodeJWT(token: string): {
  header: any;
  payload: any;
  signature: string;
} | null {
  try {
    // Split the token into its three parts
    const parts = token.split(".");

    if (parts.length !== 3) {
      console.error("Invalid JWT format: token must have 3 parts");
      return null;
    }

    // Decode header (first part)
    const header = JSON.parse(atob(parts[0]));

    // Decode payload (second part)
    const payload = JSON.parse(atob(parts[1]));

    // Keep signature as is (third part)
    const signature = parts[2];

    return {
      header,
      payload,
      signature,
    };
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
}
