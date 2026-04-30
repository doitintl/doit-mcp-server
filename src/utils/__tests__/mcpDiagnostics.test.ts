import { describe, expect, it, vi } from "vitest";
import {
    installMcpMethodDiagnosticsFromHandlers,
    installMcpMethodDiagnosticsFromServer,
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
            jsonRpcMethod: "tools/list",
            requestIdType: "string",
        });
        expect(logger.log).toHaveBeenCalledWith(
            "[mcp] method complete: diagnostics-v1 traceId=trace-ABC_123",
            expect.objectContaining({
                durationMs: expect.any(Number),
                jsonRpcMethod: "tools/list",
                requestIdType: "string",
            })
        );
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
