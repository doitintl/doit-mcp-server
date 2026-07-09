import { AsyncLocalStorage } from "node:async_hooks";
import { SERVER_VERSION } from "./consts.js";
import { DEMO_TOKEN, getDemoResponse } from "./demoData.js";

export const DOIT_API_BASE =
  process.env.DOIT_API_BASE || "https://api.doit.com";

let runtimeDoiTApiBase = DOIT_API_BASE;

export function configureDoiTApiBase(apiBase?: string): void {
  if (!apiBase) return;

  runtimeDoiTApiBase = apiBase.replace(/\/$/, "");
}

function applyRuntimeDoiTApiBase(url: string): string {
  if (runtimeDoiTApiBase === DOIT_API_BASE) {
    return url;
  }

  const parsedUrl = new URL(url);
  const parsedRuntimeBase = new URL(runtimeDoiTApiBase);

  parsedUrl.protocol = parsedRuntimeBase.protocol;
  parsedUrl.host = parsedRuntimeBase.host;

  return parsedUrl.toString();
}

// --- MCP tracking context ---
// Uses AsyncLocalStorage for request-scoped tracking. Module-level globals are unsafe in the
// SSE/Cloudflare path because Durable Object instances can share module scope on the same isolate.
// AsyncLocalStorage is supported via the nodejs_compat flag in wrangler.jsonc.

export interface TrackingContext {
  mcpTool?: string;
  mcpClient?: string;
  mcpClientVersion?: string;
  mcpProtocolVersion?: string;
}

const trackingStore = new AsyncLocalStorage<TrackingContext>();

export function runWithTracking<T>(ctx: TrackingContext, fn: () => T): T {
  return trackingStore.run(ctx, fn);
}

export function getTrackingContext(): TrackingContext | undefined {
  return trackingStore.getStore();
}

// --- Console request context ---
// A few tools (e.g. search_customers) call DoiT *console* endpoints (console.doit.com
// /api/...) rather than the public api.doit.com. In the Cloudflare worker those calls
// must go through the CONSOLE_PROXY service binding (a same-zone fetch of console.doit.com
// bypasses the console-worker route), so the worker sets this request-scoped env around
// tool execution. Outside the worker (stdio) the store is empty and makeConsoleRequest
// falls back to the DOIT_CONSOLE_BASE / AUTH_SERVER_URL env vars with a plain fetch.

export interface ConsoleRequestEnv {
  baseUrl: string;
  proxyFetch?: typeof fetch;
}

const consoleEnvStore = new AsyncLocalStorage<ConsoleRequestEnv>();

export function runWithConsoleEnv<T>(env: ConsoleRequestEnv, fn: () => T): T {
  return consoleEnvStore.run(env, fn);
}

export function getConsoleEnv(): ConsoleRequestEnv | undefined {
  return consoleEnvStore.getStore();
}

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
    isError: true,
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

  return `Invalid arguments: ${error.errors.map((e: any) => (e.path.length > 0 ? `${e.path.join(".")}: ${e.message}` : e.message)).join(", ")}`;
}

/**
 * Helper function to handle general errors
 * @param error The error object
 * @param context Additional context to include in the log message
 * @returns Standardized error response
 */
export function handleGeneralError(
  error: any,
  context: string,
): ReturnType<typeof createErrorResponse> {
  console.error(`Error ${context}:`, error);
  const message = error instanceof Error ? error.message : String(error);
  // For HTTP 401 errors, include a WWW-Authenticate challenge in _meta so ChatGPT
  // can trigger its native OAuth re-linking UI (MCP Apps SDK requirement).
  if (message.startsWith("HTTP 401")) {
    return {
      content: [{ type: "text", text: message || "Unauthorized" }],
      isError: true,
      // @ts-expect-error
      _meta: {
        "mcp/www_authenticate":
          'Bearer error="invalid_token", error_description="Token expired or invalid"',
      },
    };
  }
  return createErrorResponse(
    message || "An error occurred while processing your request",
  );
}

/**
 * Helper function to append customer context to URL if available
 * @param baseUrl The base URL to append parameters to
 * @returns URL with maxResults and optional customerContext parameters
 */
export function appendUrlParameters(
  baseUrl: string,
  customerContextId?: string,
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
 * Helper function for making DoiT API requests.
 * On most errors, logs the error and returns null.
 *
 * Exception: when `timeoutMs` is set and the request exceeds that duration, the function
 * re-throws a `DOMException` with `name === "TimeoutError"` instead of returning null.
 * Callers that pass `timeoutMs` must handle this case explicitly.
 *
 * @param url The API endpoint URL
 * @param token The authentication token
 * @param options Additional request options
 * @param options.method HTTP method (GET, POST, etc.)
 * @param options.body Request body for POST/PUT requests
 * @param options.appendParams Whether to append URL parameters (maxResults and customerContext)
 * @param options.timeoutMs If set, aborts the request after this many milliseconds and throws TimeoutError
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
    parseResponse?: boolean;
    timeoutMs?: number;
    /** Response parsing mode on success. Defaults to "json". Use "text" when the caller
     *  can't assume every response is JSON (e.g. an empty 204 body from a generated
     *  DELETE tool) — `.json()` on an empty body throws, which makeDoitRequest would
     *  otherwise swallow into a misleading `null`/failure result. */
    parseAs?: "json" | "text";
    /** Extra headers to send alongside the default Authorization/Accept/Content-Type
     *  headers (e.g. an OpenAPI operation's required header parameters). */
    headers?: Record<string, string>;
  } = {},
): Promise<T | null> {
  const {
    method = "GET",
    body = undefined,
    appendParams = true,
    customerContext,
    parseResponse = true,
    timeoutMs,
    parseAs = "json",
    headers: extraHeaders,
  } = options;

  const resolvedUrl = applyRuntimeDoiTApiBase(url);
  debugLog("Resolved DoiT API URL:", DebugLevel.TRACE, {
    inputUrl: url,
    resolvedUrl,
    isDemoToken: token === DEMO_TOKEN,
  });

  // Demo mode: return canned data without hitting the real API.
  // The auth flow in app.ts gates demo_key login behind the DEMO_MODE_ENABLED env var.
  // If the token is DEMO_TOKEN here, the user already passed that gate.
  if (token === DEMO_TOKEN) {
    if (!parseResponse) return {} as T;
    const demo = getDemoResponse(url, method, body);
    if (demo !== null) return demo as T;
    // No fixture for this endpoint — return empty success so the tool doesn't error.
    return {} as T;
  }

  // FormData bodies (generated multipart tools) must NOT get a JSON Content-Type or be
  // JSON.stringify'd — fetch sets the correct multipart boundary itself when the header
  // is left unset and the body is a FormData instance.
  const isFormDataBody =
    typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
    ...extraHeaders,
  };

  let requestUrl = appendParams
    ? appendUrlParameters(resolvedUrl, customerContext)
    : resolvedUrl;

  try {
    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (timeoutMs !== undefined) {
      requestOptions.signal = AbortSignal.timeout(timeoutMs);
    }

    // Add body for non-GET requests if provided
    if (method !== "GET" && body !== undefined) {
      requestOptions.body = isFormDataBody
        ? (body as FormData)
        : JSON.stringify(body);
      debugLog(
        "API request body: ",
        DebugLevel.TRACE,
        isFormDataBody ? "<FormData>" : requestOptions.body,
      );
    }

    // add mcp tracking params to the url
    requestUrl = appendTrackingParams(requestUrl);

    if (!process.env.CUSTOMER_CONTEXT) {
      // request from the sse server
      requestUrl += `&sse=true`;
    }

    debugLog("API request URL: ", DebugLevel.VERBOSE, requestUrl);
    const response = await fetch(requestUrl, requestOptions);

    if (!response.ok) {
      await throwHttpError(response);
    }
    if (!parseResponse) {
      return {} as T;
    }
    return (
      parseAs === "text" ? await response.text() : await response.json()
    ) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error(
        `DoiT API ${method} request timed out after ${timeoutMs}ms`,
      );
      throw error;
    }
    console.error(
      `Error making DoiT API ${method} request to ${requestUrl}:`,
      error,
    );
    return null;
  }
}

// appendTrackingParams appends the shared MCP tracking query params (mcp, mcpVersion, plus any
// mcpTool/mcpClient/mcpClientVersion/mcpProtocolVersion present in the tracking context) to a URL.
function appendTrackingParams(url: string): string {
  const tracking = getTrackingContext();
  const sep = url.includes("?") ? "&" : "?";
  let out = `${url}${sep}mcp=true&mcpVersion=${encodeURIComponent(SERVER_VERSION)}`;

  if (tracking?.mcpTool) {
    out += `&mcpTool=${encodeURIComponent(tracking.mcpTool)}`;
  }
  if (tracking?.mcpClient) {
    out += `&mcpClient=${encodeURIComponent(tracking.mcpClient)}`;
  }
  if (tracking?.mcpClientVersion) {
    out += `&mcpClientVersion=${encodeURIComponent(tracking.mcpClientVersion)}`;
  }
  if (tracking?.mcpProtocolVersion) {
    out += `&mcpProtocolVersion=${encodeURIComponent(tracking.mcpProtocolVersion)}`;
  }

  return out;
}

// throwHttpError reads a non-OK response body, extracts the most specific message available,
// and throws an Error carrying the HTTP status.
async function throwHttpError(response: Response): Promise<never> {
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

  throw new Error(`HTTP ${response.status}: ${detail || response.statusText}`);
}

function resolveConsoleBase(): { baseUrl: string; doFetch: typeof fetch } {
  const scoped = getConsoleEnv();
  if (scoped?.baseUrl) {
    return {
      baseUrl: scoped.baseUrl.replace(/\/$/, ""),
      doFetch: scoped.proxyFetch ?? fetch,
    };
  }

  const fallback =
    process.env.DOIT_CONSOLE_BASE ||
    process.env.AUTH_SERVER_URL ||
    "https://console.doit.com";

  return { baseUrl: fallback.replace(/\/$/, ""), doFetch: fetch };
}

/**
 * Calls a DoiT *console* endpoint (console.doit.com /api/...) rather than the public
 * api.doit.com that makeDoitRequest targets. In the worker it routes through the
 * CONSOLE_PROXY service binding (set via runWithConsoleEnv); elsewhere it uses the
 * DOIT_CONSOLE_BASE / AUTH_SERVER_URL env vars. It does NOT append a customerContext
 * (these endpoints are cross-customer) and, unlike makeDoitRequest, throws on HTTP and
 * network errors so callers can surface the upstream message (e.g. 403 for non-doers).
 */
export async function makeConsoleRequest<T>(
  path: string,
  token: string,
  options: { method?: string; body?: any; timeoutMs?: number } = {},
): Promise<T> {
  const { method = "GET", body = undefined, timeoutMs } = options;
  const { baseUrl, doFetch } = resolveConsoleBase();

  if (token === DEMO_TOKEN) {
    return {} as T;
  }

  let requestUrl = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  requestUrl = appendTrackingParams(requestUrl);

  const requestOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };

  if (timeoutMs !== undefined) {
    requestOptions.signal = AbortSignal.timeout(timeoutMs);
  }

  if (method !== "GET" && body !== undefined) {
    requestOptions.body = JSON.stringify(body);
  }

  debugLog("Console API request URL: ", DebugLevel.VERBOSE, requestUrl);
  const response = await doFetch(requestUrl, requestOptions);

  if (!response.ok) {
    await throwHttpError(response);
  }

  return (await response.json()) as T;
}

/**
 * Opens an SSE connection via POST and yields parsed events as they arrive.
 * Throws on non-2xx responses. The caller is responsible for consuming all
 * events or breaking early (the generator will cancel the reader on GC).
 */
const DATA_LINE_PREFIX = "data:";

export async function* makeDoitSSERequest(
  url: string,
  body: object,
  authToken: string,
): AsyncGenerator<{ data: string }> {
  const parsedUrl = new URL(applyRuntimeDoiTApiBase(url));

  const tracking = getTrackingContext();
  parsedUrl.searchParams.set("mcp", "true");
  parsedUrl.searchParams.set("mcpVersion", SERVER_VERSION);
  if (tracking?.mcpTool)
    parsedUrl.searchParams.set("mcpTool", tracking.mcpTool);
  if (tracking?.mcpClient)
    parsedUrl.searchParams.set("mcpClient", tracking.mcpClient);
  if (tracking?.mcpClientVersion)
    parsedUrl.searchParams.set("mcpClientVersion", tracking.mcpClientVersion);
  if (tracking?.mcpProtocolVersion)
    parsedUrl.searchParams.set(
      "mcpProtocolVersion",
      tracking.mcpProtocolVersion,
    );

  const requestUrl = parsedUrl.href;
  debugLog("SSE request URL:", DebugLevel.VERBOSE, requestUrl);

  const tenantId = process.env.TENANT_ID;
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(tenantId ? { "x-tenant-id": tenantId } : {}),
    },
    body: JSON.stringify(body),
  });

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
      `HTTP ${response.status}: ${detail || response.statusText}`,
    );
  }

  if (!response.body) throw new Error("SSE response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentData = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r\n|\r|\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line === "") {
          if (currentData) {
            yield { data: currentData };
          }
          currentData = "";
        } else if (line.startsWith(DATA_LINE_PREFIX)) {
          currentData = line.slice(DATA_LINE_PREFIX.length).replace(/^ /, "");
        }
      }
    }
    // flush any trailing event not terminated by a blank line
    if (currentData) {
      yield { data: currentData };
    }
  } finally {
    reader.cancel();
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
/**
 * Decode (but NOT verify) a JWT. Used only for extracting metadata labels
 * (email, DoitEmployee flag) during the OAuth authorization form flow.
 * The actual authentication is handled by the OAuthProvider; this function
 * is NOT a security boundary.
 */
export function decodeJWT(token: string): {
  header: any;
  payload: any;
  signature: string;
} | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    // JWT uses base64url encoding — convert to standard base64 before decoding
    const b64url = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/");

    const header = JSON.parse(atob(b64url(parts[0])));
    const payload = JSON.parse(atob(b64url(parts[1])));
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

export function formatEnumValues(
  values: readonly string[],
  separator = ", ",
): string {
  return values.join(separator);
}

/**
 * Converts a human-readable string to snake_case.
 * e.g. "Filter Fields Reference" → "filter_fields_reference"
 */
export function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Finds items whose `nameKey` field partially matches `query` (case-insensitive).
 *
 * Returns:
 *   { resolved: string }  — exactly one match; resolved is the item's `id`
 *   { error: string }     — no matches, or multiple matches (error lists the names so the LLM
 *                           can ask the user to be more specific)
 */
export function matchByName<T extends Record<string, any>>(
  items: T[],
  query: string,
  nameKey: string = "name",
  idKey: string = "id",
): { resolved: string } | { error: string } {
  const q = query.toLowerCase();
  const matches = items.filter((item) => {
    const val = item[nameKey];
    return typeof val === "string" && val.toLowerCase().includes(q);
  });
  if (matches.length === 0)
    return { error: `No items found matching "${query}".` };
  if (matches.length === 1) {
    const id = matches[0][idKey];
    if (!id)
      return {
        error: `Found "${matches[0][nameKey]}" but it has no ${idKey} field.`,
      };
    return { resolved: String(id) };
  }
  const names = matches.map((m) => `"${m[nameKey]}"`).join(", ");
  return {
    error: `Multiple items match "${query}": ${names}. Please provide a more specific name.`,
  };
}
