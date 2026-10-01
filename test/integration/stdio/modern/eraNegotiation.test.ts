import { Client, InMemoryTransport, SdkError, SdkErrorCode } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { createServer } from "../../../../src/server.js";

const MODERN_PROTOCOL_VERSION = "2026-07-28";

describe("protocol era negotiation", () => {
    // Documents *why* the stdio entry uses `serveStdio`: a `Server` wired by hand with
    // `server.connect(transport)` only speaks the 2025 era (`initialize`), so it answers the
    // 2026-07-28 `server/discover` opening with -32601 and a client pinned to 2026-07-28 —
    // which has no `initialize` fallback — cannot connect at all.
    it("a hand-wired server rejects a client pinned to 2026-07-28", async () => {
        const server = createServer();
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await server.connect(serverTransport);

        const client = new Client(
            { name: "modern-test-client", version: "1.0.0" },
            { versionNegotiation: { mode: { pin: MODERN_PROTOCOL_VERSION } } }
        );

        const error = await client.connect(clientTransport).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(SdkError);
        expect((error as SdkError).code).toBe(SdkErrorCode.EraNegotiationFailed);

        await server.close();
    });
});
