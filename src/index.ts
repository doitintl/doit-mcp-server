#!/usr/bin/env node

import * as dotenv from "dotenv";
dotenv.config();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { server } from "./server.js";

export async function mainWithServer(customServer?: Server) {
  const transport = new StdioServerTransport();
  const srv = customServer || server;
  await srv.connect(transport);
  console.error("DoiT MCP Server running on stdio");
}

export const main = mainWithServer;

if (
  process.env.NODE_ENV !== "test" &&
  process.env.VITEST_WORKER_ID === undefined
) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}
