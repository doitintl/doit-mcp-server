import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport as LegacyInMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serveDoitStdio } from "../../../../src/stdio.js";
import { mswServer } from "../../setup.js";
import { MODERN_PROTOCOL_VERSION } from "./helpers.js";

// `main()` logs everything serveStdio passes to `onerror` on stderr (src/index.ts). That
// channel is for connection-level events only. Request-level failures must be answered to
// the client and must never reach it, so tool arguments are never echoed to stderr.
type AnyClient = Pick<Client, "callTool" | "getPrompt" | "readResource">;

const SECRET = "SECRET-ARGUMENT-VALUE";

const failingRequests: Array<[string, (client: AnyClient) => Promise<unknown>]> = [
    ["a tool whose API call fails", (c) => c.callTool({ name: "list_organizations", arguments: { secret: SECRET } })],
    ["a tool with invalid arguments", (c) => c.callTool({ name: "get_cloud_incident", arguments: { secret: SECRET } })],
    ["an unknown tool", (c) => c.callTool({ name: "nonexistent_tool", arguments: { secret: SECRET } })],
    ["an unknown prompt", (c) => c.getPrompt({ name: SECRET })],
    ["an unknown resource", (c) => c.readResource({ uri: `doit://${SECRET}` })],
];

async function connectModern(onerror: (error: Error) => void) {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const handle = serveDoitStdio({ transport: serverTransport, onerror });
    const client = new Client(
        { name: "error-reporting-client", version: "1.0.0" },
        { versionNegotiation: { mode: { pin: MODERN_PROTOCOL_VERSION } } }
    );
    await client.connect(clientTransport);
    return { client: client as AnyClient, close: () => client.close().then(() => handle.close()) };
}

async function connectLegacy(onerror: (error: Error) => void) {
    const [clientTransport, serverTransport] = LegacyInMemoryTransport.createLinkedPair();
    const handle = serveDoitStdio({ transport: serverTransport, onerror });
    const client = new LegacyClient({ name: "error-reporting-client", version: "1.0.0" });
    await client.connect(clientTransport);
    return { client: client as unknown as AnyClient, close: () => client.close().then(() => handle.close()) };
}

describe.each([
    ["2026-07-28", connectModern],
    ["2025-era (v1 SDK)", connectLegacy],
])("onerror for a %s client", (_era, connect) => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mswServer.use(
            http.get("https://api.doit.com/iam/v1/organizations", () => new HttpResponse(null, { status: 500 }))
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each(failingRequests)("is not called for %s", async (_label, send) => {
        const onerror = vi.fn();
        const { client, close } = await connect(onerror);

        // Rejected requests (prompt/resource) still count as answered: the client got an error.
        await send(client).catch(() => {});
        await close();

        expect(onerror).not.toHaveBeenCalled();
    });
});

// Control: proves the assertions above can fail. A JSON-RPC response arriving before the
// connection has negotiated an era is a connection-level event, and it does reach onerror.
it("onerror is called for a connection-level event (control)", async () => {
    const onerror = vi.fn();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const handle = serveDoitStdio({ transport: serverTransport, onerror });
    await clientTransport.start();

    await clientTransport.send({ jsonrpc: "2.0", id: 1, result: {} });
    await vi.waitFor(() => expect(onerror).toHaveBeenCalledOnce());
    expect(onerror.mock.calls[0][0].message).toContain("before the connection negotiated an era");

    await clientTransport.close();
    await handle.close();
});
