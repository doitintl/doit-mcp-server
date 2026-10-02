import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../server.js";
import { serveDoitStdio } from "../stdio.js";

vi.mock("@modelcontextprotocol/server/stdio");
vi.mock("../server.js", () => ({ createServer: vi.fn() }));

afterEach(() => {
    vi.resetAllMocks();
});

describe("serveDoitStdio", () => {
    it("serves 2025-era openings instead of rejecting them", () => {
        serveDoitStdio();

        expect(serveStdio).toHaveBeenCalledWith(expect.any(Function), { legacy: "serve" });
    });

    it("builds a fresh server for every connection attempt", () => {
        const first = { id: 1 };
        const second = { id: 2 };
        vi.mocked(createServer)
            .mockReturnValueOnce(first as any)
            .mockReturnValueOnce(second as any);

        serveDoitStdio();
        const factory = vi.mocked(serveStdio).mock.calls[0][0];

        expect(factory({ era: "modern" } as any)).toBe(first);
        expect(factory({ era: "legacy" } as any)).toBe(second);
        expect(createServer).toHaveBeenCalledTimes(2);
    });

    it("passes caller options through, e.g. a custom transport", () => {
        const transport = { start: vi.fn() } as any;
        const onerror = vi.fn();

        serveDoitStdio({ transport, onerror });

        expect(serveStdio).toHaveBeenCalledWith(expect.any(Function), { legacy: "serve", transport, onerror });
    });

    it("returns serveStdio's handle", () => {
        const handle = { close: vi.fn() };
        vi.mocked(serveStdio).mockReturnValue(handle);

        expect(serveDoitStdio()).toBe(handle);
    });
});
