import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main, mainWithServer } from "../index.js";
import { serveDoitStdio } from "../stdio.js";

vi.mock("@modelcontextprotocol/server/stdio");
vi.mock("../stdio.js", () => ({ serveDoitStdio: vi.fn() }));
vi.mock("dotenv", () => ({ config: vi.fn() }));

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Like the real serveStdio: start the transport synchronously, swallow start failures.
    vi.mocked(StdioServerTransport.prototype.start).mockResolvedValue();
    vi.mocked(serveDoitStdio).mockImplementation((options) => {
        void options?.transport?.start().catch(() => {});
        return { close: vi.fn() };
    });
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
        expect(serveDoitStdio).toHaveBeenCalledWith(
            expect.objectContaining({ transport: expect.any(StdioServerTransport) })
        );
    });

    // serveStdio swallows a failed transport start (it only reaches onerror), so
    // mainWithServer awaits the transport's own start() to keep main()'s exit-1 contract.
    it("rejects when the stdio transport fails to start", async () => {
        vi.mocked(StdioServerTransport.prototype.start).mockRejectedValue(new Error("stdin unavailable"));

        await expect(mainWithServer()).rejects.toThrow("stdin unavailable");
        expect(console.error).not.toHaveBeenCalledWith("DoiT MCP Server running on stdio");
    });

    it("fails loudly if serveStdio stops starting the transport synchronously", async () => {
        vi.mocked(serveDoitStdio).mockImplementation(() => ({ close: vi.fn() }));

        await expect(mainWithServer()).rejects.toThrow("did not start the stdio transport synchronously");
    });

    it("waits for the transport to start before reporting it is running", async () => {
        let resolveStart!: () => void;
        vi.mocked(StdioServerTransport.prototype.start).mockReturnValue(
            new Promise<void>((resolve) => {
                resolveStart = resolve;
            })
        );

        const running = mainWithServer();
        await Promise.resolve();
        expect(console.error).not.toHaveBeenCalledWith("DoiT MCP Server running on stdio");

        resolveStart();
        await running;
        expect(console.error).toHaveBeenCalledWith("DoiT MCP Server running on stdio");
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
