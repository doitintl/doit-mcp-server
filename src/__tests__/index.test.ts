import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main, mainWithServer } from "../index.js";
import { serveDoitStdio } from "../stdio.js";

vi.mock("@modelcontextprotocol/server/stdio");
vi.mock("../stdio.js", () => ({ serveDoitStdio: vi.fn() }));
vi.mock("dotenv", () => ({ config: vi.fn() }));

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
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
    });

    it("reports serveStdio's out-of-band errors on stderr", async () => {
        await mainWithServer();

        const { onerror } = vi.mocked(serveDoitStdio).mock.calls[0][0] ?? {};
        const error = new Error("boom");
        onerror?.(error);

        expect(console.error).toHaveBeenCalledWith("DoiT MCP Server stdio error:", error);
    });
});

describe("main", () => {
    it("is an alias for mainWithServer", () => {
        expect(main).toBe(mainWithServer);
    });
});
