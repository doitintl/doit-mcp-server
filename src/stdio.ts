import { type ServeStdioOptions, type StdioServerHandle, serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

/**
 * Serves the DoiT MCP server over stdio to clients of every supported protocol era.
 *
 * `serveStdio` reads the connection's opening message and picks the era from it:
 * - an `initialize` request (or any message without a protocol-version envelope) opens a
 *   2025-era connection, served exactly as a hand-wired `server.connect(transport)` would;
 * - a request whose `_meta` envelope claims 2026-07-28 (normally `server/discover`) opens a
 *   modern connection, for which the SDK also answers `server/discover` with our
 *   capabilities and instructions.
 *
 * One instance from the factory is pinned per connection. The factory can run twice when a
 * client probes with `server/discover` and then falls back to `initialize` — the probe
 * instance is discarded — so it must build a fresh `Server` (and approval store) each call,
 * which `createServer()` does.
 *
 * `options.transport` overrides the default process-stdio transport (the integration tests
 * pass an in-memory one).
 */
export function serveDoitStdio(options?: ServeStdioOptions): StdioServerHandle {
    return serveStdio(() => createServer(), { legacy: "serve", ...options });
}
