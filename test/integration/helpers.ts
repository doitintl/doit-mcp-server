import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { serveDoitStdio } from "../../src/stdio.js";

type ToolResult = { content: Array<{ type: string; text?: string }>; isError?: boolean };

/**
 * Creates an in-memory MCP client+server pair for integration tests.
 *
 * The returned `client.callTool` is wrapped so that write-gated tools which go
 * through the server's approval flow (confirm_action two-phase commit) appear
 * to behave as before from the test's perspective: the wrapper detects an
 * `approval_required` envelope, issues the follow-up `confirm_action` with the
 * minted token, and returns the final response. This keeps existing assertions
 * that inspect handler output (ids, names, validator errors) working unchanged.
 *
 * The two-phase shape itself is asserted explicitly in
 * test/integration/stdio/approvalFlow.test.ts using `rawClient`.
 *
 * The server side goes through `serveDoitStdio` — the same entry `main()` ships — with the
 * in-memory transport swapped in for process stdio. That makes this suite's v1 SDK client
 * (which only speaks the 2025-era `initialize` handshake) a backward-compatibility check of
 * the real era-selecting entry, not of a hand-wired `server.connect()`.
 */
export async function createTestClient() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const handle = serveDoitStdio({ transport: serverTransport });

    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    const originalCallTool = client.callTool.bind(client);

    const wrappedCallTool = async (params: Parameters<typeof client.callTool>[0]) => {
        const first = (await originalCallTool(params)) as ToolResult;
        if (params.name === "confirm_action") return first;

        const text = getTextContent(first);
        if (!text) return first;
        let parsed: { status?: string; approvalToken?: string } | undefined;
        try {
            parsed = JSON.parse(text);
        } catch {
            return first;
        }
        if (parsed?.status !== "approval_required" || !parsed?.approvalToken) {
            return first;
        }
        return (await originalCallTool({
            name: "confirm_action",
            arguments: { token: parsed.approvalToken },
        })) as ToolResult;
    };

    (client as unknown as { callTool: typeof wrappedCallTool }).callTool = wrappedCallTool;

    return {
        client,
        rawClient: { callTool: originalCallTool },
        cleanup: async () => {
            await client.close();
            await handle.close();
        },
    };
}

export function getTextContent(result: { content: Array<{ type: string; text?: string }> }): string {
    const textPart = result.content.find((c) => c.type === "text");
    return textPart?.text ?? "";
}
