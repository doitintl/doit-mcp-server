import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main, mainWithServer } from "../index.js";
import { server } from "../server.js";

vi.mock("@modelcontextprotocol/server/stdio");
vi.mock("../server.js", () => ({
    server: { connect: vi.fn() },
    createServer: vi.fn(),
}));
vi.mock("dotenv", () => ({ config: vi.fn() }));

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
});

describe("mainWithServer", () => {
    it("connects a custom server to a new StdioServerTransport", async () => {
        const mockServer = { connect: vi.fn() };

        await mainWithServer(mockServer as any);

        expect(StdioServerTransport).toHaveBeenCalledOnce();
        expect(mockServer.connect).toHaveBeenCalledWith(expect.any(StdioServerTransport));
    });

    it("falls back to the default server when no argument is provided", async () => {
        await mainWithServer();

        expect(StdioServerTransport).toHaveBeenCalled();
        expect((server as any).connect).toHaveBeenCalledWith(expect.any(StdioServerTransport));
    });
});

describe("main", () => {
    it("is an alias for mainWithServer", () => {
        expect(main).toBe(mainWithServer);
    });
});
