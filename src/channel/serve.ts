import type { Server } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createServer } from "../server.js";
import type { ChannelConfig } from "./config.js";
import { type ChannelEvent, ChannelPoller } from "./poller.js";
import { CHANNEL_NOTIFICATION_METHOD } from "./protocol.js";
import { type ChannelSource, sourcesFor } from "./sources.js";

export type ServeChannelOptions = {
    /** Defaults to process stdio. Tests pass an in-memory transport. */
    transport?: Parameters<Server["connect"]>[0];
    /** Defaults to the sources for `config.events`. */
    sources?: ChannelSource[];
    getToken?: () => string | undefined;
    log?: (message: string) => void;
};

export type ChannelServerHandle = {
    server: Server;
    poller: ChannelPoller;
    close(): Promise<void>;
};

/**
 * Serves the DoiT MCP server as a Claude Code channel: the full tool, prompt and resource
 * surface plus `notifications/claude/channel` events for the configured event kinds.
 *
 * Unlike {@link serveDoitStdio}, this hand-wires ONE server to the transport, so the
 * connection speaks the 2025-era protocol only. That is deliberate: Claude Code does not
 * register a channel on a 2026-07-28 connection. A `server/discover` probe is answered with
 * `-32601 Method not found`, and Claude Code then opens with `initialize`. See
 * docs/protocol-compatibility.md ("Channel mode").
 *
 * Polling starts when the client completes `initialize` and stops when the connection closes.
 */
export async function serveDoitChannelStdio(
    config: ChannelConfig,
    options: ServeChannelOptions = {}
): Promise<ChannelServerHandle> {
    const log = options.log ?? ((message: string) => console.error(message));
    const server = createServer({ channel: true });

    const emit = (event: ChannelEvent) =>
        // The method is outside the SDK's typed notification union; experimental methods are
        // sent as-is.
        server.notification({ method: CHANNEL_NOTIFICATION_METHOD, params: event } as never);

    const poller = new ChannelPoller({
        sources: options.sources ?? sourcesFor(config.events),
        intervalMs: config.pollIntervalMs,
        emit,
        getToken: options.getToken,
        log,
    });

    server.oninitialized = () => poller.start();
    server.onclose = () => poller.stop();

    await server.connect(options.transport ?? new StdioServerTransport());
    log(
        `DoiT channel: enabled for ${config.events.join(", ")}; polling every ${Math.round(config.pollIntervalMs / 1000)}s once the client initializes.`
    );

    return {
        server,
        poller,
        close: async () => {
            poller.stop();
            await server.close();
        },
    };
}
