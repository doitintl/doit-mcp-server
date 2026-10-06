import {
    Client,
    InMemoryTransport,
    type JSONRPCMessage,
    type JSONRPCResponse,
    type VersionNegotiationMode,
} from "@modelcontextprotocol/client";
import { serveDoitStdio } from "../../../../src/stdio.js";

export const MODERN_PROTOCOL_VERSION = "2026-07-28";
export const MODERN_CLIENT_INFO = { name: "modern-test-client", version: "2.0.0" };

type ToolResult = { content: Array<{ type: string; text?: string }>; isError?: boolean };

/**
 * Wraps a transport so every message the client sends is recorded, letting tests assert on
 * the actual protocol traffic (e.g. that a modern client never sends `initialize`).
 */
function recordOutbound(transport: InMemoryTransport): JSONRPCMessage[] {
    const sent: JSONRPCMessage[] = [];
    const send = transport.send.bind(transport);
    transport.send = async (message, options) => {
        sent.push(message);
        return send(message, options);
    };
    return sent;
}

/**
 * Connects a v2 SDK client to the shipped stdio entry (`serveDoitStdio`) over an in-memory
 * transport — the 2026-07-28 counterpart of ../../helpers.ts `createTestClient()`.
 *
 * `mode` defaults to pinning 2026-07-28, which has no `initialize` fallback: if the server
 * could not serve the modern era, `connect()` would throw rather than silently downgrade.
 *
 * As in the v1 helper, `client.callTool` auto-confirms `approval_required` envelopes
 * (two-phase `confirm_action`); `rawClient.callTool` is the unwrapped original.
 */
export async function createModernTestClient({
    mode = { pin: MODERN_PROTOCOL_VERSION },
}: {
    mode?: VersionNegotiationMode;
} = {}) {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const handle = serveDoitStdio({ transport: serverTransport });
    const sent = recordOutbound(clientTransport);

    const client = new Client(MODERN_CLIENT_INFO, { versionNegotiation: { mode } });
    await client.connect(clientTransport);

    const originalCallTool = client.callTool.bind(client);
    const wrappedCallTool = async (params: Parameters<typeof client.callTool>[0]) => {
        const first = (await originalCallTool(params)) as ToolResult;
        if (params.name === "confirm_action") return first;

        let parsed: { status?: string; approvalToken?: string } | undefined;
        try {
            parsed = JSON.parse(getTextContent(first));
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
        sent,
        cleanup: async () => {
            await client.close();
            await handle.close();
        },
    };
}

/**
 * A client-less JSON-RPC connection to the shipped stdio entry, for asserting wire-level
 * behaviour no SDK client would produce on its own (e.g. `initialize` after a modern opening).
 */
export function createRawConnection() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const handle = serveDoitStdio({ transport: serverTransport });
    const pending = new Map<string | number, (response: JSONRPCResponse) => void>();
    clientTransport.onmessage = (message) => {
        if ("id" in message && message.id !== undefined && ("result" in message || "error" in message)) {
            pending.get(message.id)?.(message as JSONRPCResponse);
            pending.delete(message.id);
        }
    };
    const started = clientTransport.start();

    return {
        request: async (id: number, method: string, params: Record<string, unknown> = {}) => {
            await started;
            const response = new Promise<JSONRPCResponse>((resolve) => pending.set(id, resolve));
            await clientTransport.send({ jsonrpc: "2.0", id, method, params });
            return response;
        },
        close: async () => {
            await clientTransport.close();
            await handle.close();
        },
    };
}

/** The per-request `_meta` envelope every 2026-07-28 request must carry. */
export function modernEnvelope() {
    return {
        _meta: {
            "io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientCapabilities": {},
            "io.modelcontextprotocol/clientInfo": MODERN_CLIENT_INFO,
        },
    };
}

export function getTextContent(result: { content: Array<{ type: string; text?: string }> }): string {
    return result.content.find((c) => c.type === "text")?.text ?? "";
}
