import { describe, expect, it, vi } from "vitest";
import {
    getDurationMs,
    getMcpDiagnosticsMessage,
    getMcpTraceContext,
    getMcpTraceId,
    getMcpTraceIdFromHeaders,
    getRequestBodyDiagnostics,
    getRequestDiagnostics,
    getUserAgentFamily,
    installMcpMethodDiagnosticsFromHandlers,
    installMcpMethodDiagnosticsFromServer,
    withMcpTraceId,
} from "../../../doit-mcp-server/src/mcpDiagnostics.js";

function createLogger() {
    return {
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
    };
}

describe("installMcpMethodDiagnosticsFromHandlers", () => {
    it("logs method start and complete for wrapped handlers", async () => {
        const logger = createLogger();
        const originalHandler = vi.fn(async () => ({ tools: [] }));
        const handlers = new Map<string, any>([["tools/list", originalHandler]]);

        installMcpMethodDiagnosticsFromHandlers(handlers, logger);

        const wrappedHandler = handlers.get("tools/list");
        await wrappedHandler({ id: "request-1" }, { requestInfo: { headers: { "x-mcp-trace-id": "trace-ABC_123" } } });

        expect(originalHandler).toHaveBeenCalledTimes(1);
        expect(logger.log).toHaveBeenCalledWith("[mcp] method start: diagnostics-v1 traceId=trace-ABC_123", {
            traceId: "trace-ABC_123",
            jsonRpcMethod: "tools/list",
            requestIdType: "string",
        });
        expect(logger.log).toHaveBeenCalledWith(
            "[mcp] method complete: diagnostics-v1 traceId=trace-ABC_123",
            expect.objectContaining({
                traceId: "trace-ABC_123",
                durationMs: expect.any(Number),
                jsonRpcMethod: "tools/list",
                requestIdType: "string",
            })
        );
    });

    it("forwards all handler arguments to the original SDK handler", async () => {
        const logger = createLogger();
        const originalHandler = vi.fn(async () => ({ tools: [] }));
        const handlers = new Map<string, any>([["tools/list", originalHandler]]);
        const request = { id: "request-1" };
        const extra = { requestInfo: { headers: { "x-mcp-trace-id": "trace-ABC_123" } } };
        const cancellationToken = { cancelled: false };

        installMcpMethodDiagnosticsFromHandlers(handlers, logger);

        await handlers.get("tools/list")(request, extra, cancellationToken);

        expect(originalHandler).toHaveBeenCalledWith(request, extra, cancellationToken);
    });

    it("does not wrap a handler more than once", async () => {
        const logger = createLogger();
        const originalHandler = vi.fn(async () => ({ tools: [] }));
        const handlers = new Map<string, any>([["tools/list", originalHandler]]);

        installMcpMethodDiagnosticsFromHandlers(handlers, logger);
        const wrappedHandler = handlers.get("tools/list");
        installMcpMethodDiagnosticsFromHandlers(handlers, logger);

        expect(handlers.get("tools/list")).toBe(wrappedHandler);
        expect(logger.log).toHaveBeenCalledWith(
            "[mcp] method diagnostics installed: diagnostics-v1",
            expect.objectContaining({
                alreadyWrappedMethods: ["tools/list"],
            })
        );
    });

    it("logs when SDK handler internals are unavailable", () => {
        const logger = createLogger();

        installMcpMethodDiagnosticsFromHandlers({}, logger);

        expect(logger.warn).toHaveBeenCalledWith("[mcp] method diagnostics unavailable: diagnostics-v1");
    });

    it("does not wrap unsupported handler shapes", () => {
        const logger = createLogger();
        const handlers = new Map<string, any>([["tools/list", { handler: vi.fn() }]]);

        installMcpMethodDiagnosticsFromHandlers(handlers, logger);

        expect(handlers.get("tools/list")).toEqual({ handler: expect.any(Function) });
        expect(logger.log).toHaveBeenCalledWith(
            "[mcp] method diagnostics installed: diagnostics-v1",
            expect.objectContaining({
                installedMethods: [],
                unsupportedMethods: ["tools/list"],
            })
        );
    });

    it("extracts SDK handler internals from the server shape", async () => {
        const logger = createLogger();
        const originalHandler = vi.fn(async () => ({ tools: [] }));
        const handlers = new Map<string, any>([["tools/list", originalHandler]]);

        installMcpMethodDiagnosticsFromServer({ _requestHandlers: handlers }, logger);

        await handlers.get("tools/list")({ id: 1 }, {});

        expect(originalHandler).toHaveBeenCalledTimes(1);
        expect(logger.log).toHaveBeenCalledWith(
            "[mcp] method complete: diagnostics-v1",
            expect.objectContaining({
                jsonRpcMethod: "tools/list",
                requestIdType: "number",
            })
        );
    });
});

describe("MCP diagnostics trace helpers", () => {
    it("uses a valid inbound trace ID from request headers", () => {
        const request = new Request("https://mcp.example.com/mcp", {
            headers: { "x-mcp-trace-id": " trace-ABC_123 " },
        });

        expect(getMcpTraceId(request)).toBe("trace-ABC_123");
    });

    it("normalizes trace IDs from plain-object headers", () => {
        expect(getMcpTraceIdFromHeaders({ "x-mcp-trace-id": " trace-ABC_123 " })).toBe("trace-ABC_123");
    });

    it("reads plain-object trace headers case-insensitively", () => {
        expect(getMcpTraceIdFromHeaders({ "X-Mcp-Trace-Id": "trace-ABC_123" })).toBe("trace-ABC_123");
    });

    it("builds optional structured trace context", () => {
        expect(getMcpTraceContext("trace-ABC_123")).toEqual({ traceId: "trace-ABC_123" });
        expect(getMcpTraceContext()).toEqual({});
    });

    it("adds the trace header when the request body is still available", () => {
        const request = new Request("https://mcp.example.com/mcp", {
            body: "{}",
            method: "POST",
        });

        const tracedRequest = withMcpTraceId(request, "trace-ABC_123");

        expect(tracedRequest).not.toBe(request);
        expect(tracedRequest.headers.get("x-mcp-trace-id")).toBe("trace-ABC_123");
        expect(tracedRequest.bodyUsed).toBe(false);
    });

    it("does not reconstruct a request after its body has been consumed", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const request = new Request("https://mcp.example.com/mcp", {
            body: "{}",
            method: "POST",
        });
        await request.text();

        const tracedRequest = withMcpTraceId(request, "trace-ABC_123");

        expect(tracedRequest).toBe(request);
        expect(warnSpy).toHaveBeenCalledWith(
            "[mcp] trace propagation skipped because request body was already used: diagnostics-v1"
        );
        warnSpy.mockRestore();
    });

    it("sanitizes invalid trace IDs before embedding them in log messages", () => {
        expect(getMcpDiagnosticsMessage("route start", "bad\ntrace")).toBe(
            "[mcp] route start: diagnostics-v1 traceId=invalid"
        );
    });
});

describe("MCP request diagnostics", () => {
    it("classifies known user-agent families", () => {
        expect(getUserAgentFamily("Anthropic ClaudeAI")).toBe("claude");
        expect(getUserAgentFamily("OpenAI ChatGPT")).toBe("openai");
        expect(getUserAgentFamily("Cursor")).toBe("cursor");
        expect(getUserAgentFamily("node-fetch")).toBe("node");
        expect(getUserAgentFamily("python-httpx")).toBe("python");
        expect(getUserAgentFamily("CustomClient")).toBe("other");
        expect(getUserAgentFamily(null)).toBeUndefined();
    });

    it("builds safe request diagnostics without full headers", () => {
        const request = new Request("https://mcp.example.com/mcp", {
            headers: {
                accept: "application/json",
                authorization: "Bearer secret",
                "content-type": "application/json",
                "mcp-session-id": "session-1",
                "user-agent": "Claude",
            },
            method: "POST",
        });

        expect(getRequestDiagnostics(request, "/mcp")).toEqual({
            accept: "application/json",
            contentType: "application/json",
            hasAuthorization: true,
            hasMcpSessionId: true,
            method: "POST",
            pathname: "/mcp",
            userAgentFamily: "claude",
        });
    });

    it("skips request body inspection for POST routes", () => {
        const request = new Request("https://mcp.example.com/mcp", {
            body: "{}",
            method: "POST",
        });

        expect(getRequestBodyDiagnostics(request)).toEqual({
            requestBodyInspection: "skipped_to_preserve_forwarded_body",
        });
    });

    it("does not include body diagnostics for non-POST routes", () => {
        const request = new Request("https://mcp.example.com/sse", {
            method: "GET",
        });

        expect(getRequestBodyDiagnostics(request)).toEqual({});
    });

    it("measures elapsed duration", () => {
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1500);

        expect(getDurationMs(1200)).toBe(300);

        nowSpy.mockRestore();
    });
});
