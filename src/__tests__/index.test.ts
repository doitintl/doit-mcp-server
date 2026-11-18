import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serveDoitChannelOnlyStdio, serveDoitChannelStdio } from "../channel/serve.js";
import { exitOnFatalError, main, mainWithServer } from "../index.js";
import { serveDoitStdio } from "../stdio.js";

vi.mock("@modelcontextprotocol/server/stdio");
vi.mock("../stdio.js", () => ({ serveDoitStdio: vi.fn() }));
vi.mock("../channel/serve.js", () => ({ serveDoitChannelStdio: vi.fn(), serveDoitChannelOnlyStdio: vi.fn() }));
vi.mock("dotenv", () => ({ config: vi.fn() }));

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe("mainWithServer", () => {
    it("hand-wires a custom server to a new StdioServerTransport", async () => {
        const mockServer = { connect: vi.fn() };

        await mainWithServer(mockServer as any);

        expect(StdioServerTransport).toHaveBeenCalledOnce();
        expect(mockServer.connect).toHaveBeenCalledWith(expect.any(StdioServerTransport));
        expect(serveDoitStdio).not.toHaveBeenCalled();
    });

    it("serves every protocol era via serveDoitStdio when no server is provided", async () => {
        await mainWithServer();

        expect(serveDoitStdio).toHaveBeenCalledOnce();
        expect(StdioServerTransport).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith("DoiT MCP Server running on stdio");
    });

    it("does not enter channel mode unless DOIT_CHANNEL_EVENTS is set", async () => {
        await mainWithServer();

        expect(serveDoitChannelStdio).not.toHaveBeenCalled();
    });

    it("serves as a channel, not through serveDoitStdio, when DOIT_CHANNEL_EVENTS is set", async () => {
        vi.stubEnv("DOIT_CHANNEL_EVENTS", "anomalies");
        vi.stubEnv("DOIT_CHANNEL_POLL_SECONDS", "120");

        await mainWithServer();

        expect(serveDoitChannelStdio).toHaveBeenCalledWith({ events: ["anomalies"], pollIntervalMs: 120_000 });
        expect(serveDoitStdio).not.toHaveBeenCalled();
    });

    it("serves events only when DOIT_CHANNEL_ONLY is set", async () => {
        vi.stubEnv("DOIT_CHANNEL_ONLY", "true");
        vi.stubEnv("DOIT_CHANNEL_EVENTS", "incidents");

        await mainWithServer();

        expect(serveDoitChannelOnlyStdio).toHaveBeenCalledWith({ events: ["incidents"], pollIntervalMs: 300_000 });
        expect(serveDoitChannelStdio).not.toHaveBeenCalled();
        expect(serveDoitStdio).not.toHaveBeenCalled();
    });

    it("never falls back to the full server in channel-only mode, even with no event kinds", async () => {
        vi.stubEnv("DOIT_CHANNEL_ONLY", "1");
        vi.stubEnv("DOIT_CHANNEL_EVENTS", "");

        await mainWithServer();

        expect(serveDoitChannelOnlyStdio).toHaveBeenCalledWith(undefined);
        expect(serveDoitStdio).not.toHaveBeenCalled();
    });

    it("ignores DOIT_CHANNEL_EVENTS when a custom server is passed", async () => {
        vi.stubEnv("DOIT_CHANNEL_EVENTS", "anomalies");
        const mockServer = { connect: vi.fn() };

        await mainWithServer(mockServer as any);

        expect(mockServer.connect).toHaveBeenCalledOnce();
        expect(serveDoitChannelStdio).not.toHaveBeenCalled();
    });

    it("rejects, without reporting it is running, when the server fails to start", async () => {
        vi.mocked(serveDoitStdio).mockImplementation(() => {
            throw new Error("cannot serve");
        });

        await expect(mainWithServer()).rejects.toThrow("cannot serve");
        expect(console.error).not.toHaveBeenCalledWith("DoiT MCP Server running on stdio");
    });

    it("rejects when a custom server fails to connect", async () => {
        const mockServer = { connect: vi.fn().mockRejectedValue(new Error("connect failed")) };

        await expect(mainWithServer(mockServer as any)).rejects.toThrow("connect failed");
    });

    it("reports serveStdio's out-of-band errors on stderr", async () => {
        await mainWithServer();

        const { onerror } = vi.mocked(serveDoitStdio).mock.calls[0][0] ?? {};
        const error = new Error("boom");
        onerror?.(error);

        expect(console.error).toHaveBeenCalledWith("DoiT MCP Server stdio error:", error);
    });
});

describe("exitOnFatalError", () => {
    it("reports the error on stderr and exits with code 1", () => {
        const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
            throw new Error(`process.exit(${code})`);
        }) as never);
        const error = new Error("fatal");

        expect(() => exitOnFatalError(error)).toThrow("process.exit(1)");
        expect(console.error).toHaveBeenCalledWith("DoiT MCP Server failed:", error);
        expect(exit).toHaveBeenCalledWith(1);
    });
});

describe("main", () => {
    it("is an alias for mainWithServer", () => {
        expect(main).toBe(mainWithServer);
    });
});
