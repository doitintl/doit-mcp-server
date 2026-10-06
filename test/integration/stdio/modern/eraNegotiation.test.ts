import { Client, InMemoryTransport, SdkError, SdkErrorCode } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { createServer } from "../../../../src/server.js";
import { createModernTestClient, createRawConnection, MODERN_PROTOCOL_VERSION, modernEnvelope } from "./helpers.js";

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

    describe("against the shipped stdio entry (serveDoitStdio)", () => {
        it("a client pinned to 2026-07-28 connects in the modern era", async () => {
            const { client, cleanup } = await createModernTestClient();

            expect(client.getNegotiatedProtocolVersion()).toBe(MODERN_PROTOCOL_VERSION);
            expect(client.getProtocolEra()).toBe("modern");

            await cleanup();
        });

        it("a v2 client in 'auto' mode prefers the modern era", async () => {
            const { client, sent, cleanup } = await createModernTestClient({ mode: "auto" });

            expect(client.getNegotiatedProtocolVersion()).toBe(MODERN_PROTOCOL_VERSION);
            expect(sent.some((message) => "method" in message && message.method === "initialize")).toBe(false);

            await cleanup();
        });

        it("a v2 client in its default 'legacy' mode still gets the 2025-era initialize handshake", async () => {
            const { client, sent, cleanup } = await createModernTestClient({ mode: "legacy" });

            expect(client.getProtocolEra()).toBe("legacy");
            expect(client.getNegotiatedProtocolVersion()).toBe("2025-11-25");
            expect(client.getDiscoverResult()).toBeUndefined();
            expect(sent[0]).toMatchObject({ method: "initialize" });

            await cleanup();
        });

        // The era is chosen once per connection: after a modern request has pinned the
        // connection, a late `initialize` is refused rather than switching eras mid-stream.
        it("refuses initialize once a connection is pinned to the modern era", async () => {
            const connection = createRawConnection();

            const listTools = await connection.request(1, "tools/list", modernEnvelope());
            expect(listTools).toHaveProperty("result");

            const initialize = await connection.request(2, "initialize", {
                protocolVersion: "2025-11-25",
                capabilities: {},
                clientInfo: { name: "late-legacy-client", version: "1.0.0" },
            });
            expect(initialize).toMatchObject({ error: { code: -32022 } });

            await connection.close();
        });

        it("rejects a modern envelope claiming an unsupported protocol version", async () => {
            const connection = createRawConnection();
            const envelope = modernEnvelope();
            envelope._meta["io.modelcontextprotocol/protocolVersion"] = "2099-01-01";

            const response = await connection.request(1, "server/discover", envelope);
            expect(response).toMatchObject({
                error: { code: -32022, data: { supported: [MODERN_PROTOCOL_VERSION], requested: "2099-01-01" } },
            });

            await connection.close();
        });
    });
});
