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
        // serveStdio reports transport and dispatch failures only through onerror; without
        // it they would be silent. stderr is safe here — stdout carries the JSON-RPC stream.
        serveDoitStdio({ onerror: (error) => console.error("DoiT MCP Server stdio error:", error) });
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
