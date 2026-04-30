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

const MCP_METHOD_DIAGNOSTICS_WRAPPED = Symbol("mcpMethodDiagnosticsWrapped");

type McpMethodDiagnosticsLogger = Pick<Console, "error" | "log" | "warn">;

type McpRequestHandler = {
  (request: any, extra: any): Promise<unknown>;
  [MCP_METHOD_DIAGNOSTICS_WRAPPED]?: boolean;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getDurationMs(startedAt: number): number {
  return Date.now() - startedAt;
}

export function createMcpTraceId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

export function getMcpTraceId(req: Request): string {
  const traceId = req.headers.get(MCP_TRACE_ID_HEADER)?.trim();
  return traceId && MCP_TRACE_ID_PATTERN.test(traceId)
    ? traceId
    : createMcpTraceId();
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
      ? headers.get(MCP_TRACE_ID_HEADER)?.trim()
      : headers?.[MCP_TRACE_ID_HEADER];
  const normalizedTraceId = Array.isArray(traceId) ? traceId[0] : traceId;
  return normalizedTraceId && MCP_TRACE_ID_PATTERN.test(normalizedTraceId)
    ? normalizedTraceId
    : undefined;
}

export function getMcpDiagnosticsMessage(
  event: string,
  traceId?: string
): string {
  return traceId
    ? `[mcp] ${event}: diagnostics-v1 traceId=${traceId}`
    : `[mcp] ${event}: diagnostics-v1`;
}

export function withMcpTraceId(
  req: Request,
  traceId: string | undefined
): Request {
  if (!traceId) {
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
  // Intentionally hooks @modelcontextprotocol/sdk@1.28.0 internals. The SDK
  // stores schema-validating request handlers in this Map, so wrapping here
  // observes parsed MCP methods without reading forwarded HTTP bodies.
  if (!(handlers instanceof Map)) {
    logger.warn("[mcp] method diagnostics unavailable: diagnostics-v1");
    return;
  }

  const installedMethods: string[] = [];
  const missingMethods: string[] = [];
  const alreadyWrappedMethods: string[] = [];

  for (const method of MCP_METHOD_DIAGNOSTICS) {
    const handler = handlers.get(method) as McpRequestHandler | undefined;
    if (!handler) {
      missingMethods.push(method);
      continue;
    }
    if (handler[MCP_METHOD_DIAGNOSTICS_WRAPPED]) {
      alreadyWrappedMethods.push(method);
      continue;
    }

    const wrappedHandler: McpRequestHandler = async (request, extra) => {
      const traceId = getMcpTraceIdFromHeaders(extra?.requestInfo?.headers);
      const startedAt = Date.now();
      const context = {
        jsonRpcMethod: method,
        requestIdType: getJsonRpcIdType(request?.id),
      };

      logger.log(getMcpDiagnosticsMessage("method start", traceId), context);
      try {
        const result = await handler(request, extra);
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
