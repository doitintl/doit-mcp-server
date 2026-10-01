#!/usr/bin/env node

import type { Server } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as dotenv from "dotenv";

// quiet: dotenv >=17 prints a banner to stdout, which corrupts the MCP JSON-RPC stream
dotenv.config({ quiet: true });

import { serveDoitStdio } from "./stdio.js";

/**
 * Starts the stdio MCP server.
 *
 * - No argument (the CLI path): serves every supported protocol era — 2025-era clients via
 *   `initialize` and 2026-07-28 clients via `server/discover` — see {@link serveDoitStdio}.
 * - A `Server` instance: hand-wires it with `customServer.connect(new StdioServerTransport())`,
 *   as before. That path only speaks the 2025-era protocol; a single instance cannot back
 *   era selection, because a modern `server/discover` probe followed by an `initialize`
 *   fallback needs a fresh instance per attempt. Kept for backward compatibility.
 */
export async function mainWithServer(customServer?: Server) {
    if (customServer) {
        await customServer.connect(new StdioServerTransport());
    } else {
        // serveStdio starts the transport itself and exposes no ready promise: a failed start
        // only reaches onerror. Capture the transport's start() promise and await it, so a
        // startup failure still rejects main() (→ "Fatal error in main()", exit code 1) as
        // `await server.connect(transport)` did.
        const transport = new StdioServerTransport();
        const start = transport.start.bind(transport);
        let started: Promise<void> | undefined;
        transport.start = () => {
            started = start();
            return started;
        };

        // onerror receives connection-level events only — transport I/O errors, unparseable
        // input lines, messages discarded before an era is negotiated, server-instance
        // build/close failures. Per-request failures (a throwing handler, an unknown tool or
        // prompt) are answered to the client and never reach it. stderr is safe here — stdout
        // carries the JSON-RPC stream.
        serveDoitStdio({ transport, onerror: (error) => console.error("DoiT MCP Server stdio error:", error) });
        // serveStdio (2.1.0 and 2.2.0) calls transport.start() synchronously. If a future SDK
        // starts it lazily, fail loudly here rather than silently losing the exit-1 contract.
        if (!started) {
            throw new Error("serveStdio did not start the stdio transport synchronously");
        }
        await started;
    }
    console.error("DoiT MCP Server running on stdio");
}

export const main = mainWithServer;

if (process.env.NODE_ENV !== "test" && process.env.VITEST_WORKER_ID === undefined) {
    main().catch((error) => {
        console.error("Fatal error in main():", error);
        process.exit(1);
    });
}
