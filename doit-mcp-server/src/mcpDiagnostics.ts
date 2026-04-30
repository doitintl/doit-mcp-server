export const MCP_TRACE_ID_HEADER = "x-mcp-trace-id";

// Accept common upstream trace formats such as W3C traceparent/OTel IDs, but
// bound and sanitize before embedding values in log messages.
const MCP_TRACE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;

const MCP_METHOD_DIAGNOSTICS = [
  "initialize",
  "prompts/list",
  "tools/call",
  "tools/list",
  "resources/list",
  "resources/read",
] as const;

const MCP_METHOD_DIAGNOSTICS_WRAPPED = "__mcpDiagnosticsWrapped__";
let didWarnSkippedTracePropagation = false;

type McpMethodDiagnosticsLogger = Pick<Console, "error" | "log" | "warn">;

type McpRequestHandler = {
  (...args: any[]): Promise<unknown>;
  [MCP_METHOD_DIAGNOSTICS_WRAPPED]?: boolean;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getDurationMs(startedAt: number): number {
  return Date.now() - startedAt;
}

export { getDurationMs };

export function getUserAgentFamily(
  userAgent: string | null
): string | undefined {
  if (!userAgent) {
    return undefined;
  }

  const normalized = userAgent.toLowerCase();
  if (normalized.includes("claude")) {
    return "claude";
  }
  if (normalized.includes("chatgpt") || normalized.includes("openai")) {
    return "openai";
  }
  if (normalized.includes("cursor")) {
    return "cursor";
  }
  // Runtime buckets are last-resort matches; add specific clients above them.
  if (normalized.includes("node")) {
    return "node";
  }
  if (normalized.includes("python")) {
    return "python";
  }
  return "other";
}

export function getRequestDiagnostics(req: Request, pathname: string) {
  return {
    method: req.method,
    pathname,
    hasAuthorization: Boolean(req.headers.get("authorization")),
    hasMcpSessionId: Boolean(req.headers.get("mcp-session-id")),
    contentType: req.headers.get("content-type") ?? undefined,
    accept: req.headers.get("accept") ?? undefined,
    userAgentFamily: getUserAgentFamily(req.headers.get("user-agent")),
  };
}

export function getRequestBodyDiagnostics(req: Request) {
  if (req.method !== "POST") {
    return {};
  }

  return {
    requestBodyInspection: "skipped_to_preserve_forwarded_body",
  };
}

function normalizeMcpTraceId(
  traceId: string | string[] | null | undefined
): string | undefined {
  const normalizedTraceId = (Array.isArray(traceId) ? traceId[0] : traceId)?.trim();
  return normalizedTraceId && MCP_TRACE_ID_PATTERN.test(normalizedTraceId)
    ? normalizedTraceId
    : undefined;
}

export function createMcpTraceId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

export function getMcpTraceId(req: Request): string {
  return normalizeMcpTraceId(req.headers.get(MCP_TRACE_ID_HEADER)) ?? createMcpTraceId();
}

/**
 * SDK transports expose requestInfo.headers as either Web Headers or a plain
 * object depending on the runtime/transport path.
 */
export function getMcpTraceIdFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined> | undefined
): string | undefined {
  const traceId =
    headers instanceof Headers
      ? headers.get(MCP_TRACE_ID_HEADER)
      : headers?.[MCP_TRACE_ID_HEADER];
  return normalizeMcpTraceId(traceId);
}

export function getMcpDiagnosticsMessage(
  event: string,
  traceId?: string
): string {
  if (!traceId) {
    return `[mcp] ${event}: diagnostics-v1`;
  }

  const safeTraceId = MCP_TRACE_ID_PATTERN.test(traceId) ? traceId : "invalid";
  return `[mcp] ${event}: diagnostics-v1 traceId=${safeTraceId}`;
}

export function withMcpTraceId(
  req: Request,
  traceId: string | undefined
): Request {
  if (!traceId) {
    return req;
  }
  if (req.bodyUsed) {
    if (!didWarnSkippedTracePropagation) {
      didWarnSkippedTracePropagation = true;
      console.warn(
        "[mcp] trace propagation skipped because request body was already used: diagnostics-v1"
      );
    }
    return req;
  }

  const headers = new Headers(req.headers);
  // Diagnostics correlation header; it may originate from the client, then gets
  // passed through OAuthProvider into handleMcpRequest.
  headers.set(MCP_TRACE_ID_HEADER, traceId);
  return new Request(req, { headers });
}

export function getJsonRpcIdType(id: unknown): string {
  return id === null ? "null" : typeof id;
}

export function installMcpMethodDiagnosticsFromHandlers(
  handlers: unknown,
  logger: McpMethodDiagnosticsLogger = console
) {
  // Intentionally hooks MCP SDK internals only when the expected handler Map is
  // present. Wrapping here observes parsed MCP methods without reading forwarded
  // HTTP bodies; if the SDK shape changes, we fail closed with a warning.
  if (!(handlers instanceof Map)) {
    logger.warn("[mcp] method diagnostics unavailable: diagnostics-v1");
    return;
  }

  const installedMethods: string[] = [];
  const missingMethods: string[] = [];
  const unsupportedMethods: string[] = [];
  const alreadyWrappedMethods: string[] = [];

  for (const method of MCP_METHOD_DIAGNOSTICS) {
    const handler = handlers.get(method) as McpRequestHandler | undefined;
    if (!handler) {
      missingMethods.push(method);
      continue;
    }
    if (typeof handler !== "function") {
      unsupportedMethods.push(method);
      continue;
    }
    if (handler[MCP_METHOD_DIAGNOSTICS_WRAPPED]) {
      alreadyWrappedMethods.push(method);
      continue;
    }

    const wrappedHandler: McpRequestHandler = async (...args) => {
      const [request, extra] = args;
      const traceId = getMcpTraceIdFromHeaders(extra?.requestInfo?.headers);
      const startedAt = Date.now();
      const context = {
        jsonRpcMethod: method,
        requestIdType: getJsonRpcIdType(request?.id),
      };

      logger.log(getMcpDiagnosticsMessage("method start", traceId), context);
      try {
        const result = await handler(...args);
        logger.log(getMcpDiagnosticsMessage("method complete", traceId), {
          ...context,
          durationMs: getDurationMs(startedAt),
        });
        return result;
      } catch (error) {
        logger.error(
          getMcpDiagnosticsMessage("method error", traceId),
          {
            ...context,
            durationMs: getDurationMs(startedAt),
            reason: getErrorMessage(error),
          },
          error
        );
        throw error;
      }
    };
    wrappedHandler[MCP_METHOD_DIAGNOSTICS_WRAPPED] = true;
    handlers.set(method, wrappedHandler);
    installedMethods.push(method);
  }

  logger.log(getMcpDiagnosticsMessage("method diagnostics installed"), {
    installedMethods,
    missingMethods,
    unsupportedMethods,
    alreadyWrappedMethods,
  });
}

export function installMcpMethodDiagnosticsFromServer(
  server: unknown,
  logger: McpMethodDiagnosticsLogger = console
) {
  if (!server || typeof server !== "object") {
    logger.warn("[mcp] method diagnostics unavailable: diagnostics-v1");
    return;
  }

  installMcpMethodDiagnosticsFromHandlers(
    (server as Record<string, unknown>)._requestHandlers,
    logger
  );
}
