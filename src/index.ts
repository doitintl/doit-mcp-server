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
        // onerror receives connection-level events only — transport I/O errors, unparseable
        // input lines, messages discarded before an era is negotiated, server-instance
        // build/close failures. Per-request failures (a throwing handler, an unknown tool or
        // prompt) are answered to the client and never reach it. stderr is safe here — stdout
        // carries the JSON-RPC stream.
        serveDoitStdio({ onerror: (error) => console.error("DoiT MCP Server stdio error:", error) });
    }
    console.error("DoiT MCP Server running on stdio");
}

export const main = mainWithServer;

/** Reports an unrecoverable error on stderr and exits non-zero, so MCP hosts see the failure. */
export function exitOnFatalError(error: unknown): never {
    console.error("DoiT MCP Server failed:", error);
    process.exit(1);
}

if (process.env.NODE_ENV !== "test" && process.env.VITEST_WORKER_ID === undefined) {
    // Anything that escapes after startup (including from inside the SDK) gets the same
    // message and exit code as a failed start, instead of Node's default crash output.
    process.on("uncaughtException", exitOnFatalError);
    process.on("unhandledRejection", exitOnFatalError);
    main().catch(exitOnFatalError);
}
