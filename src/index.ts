#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import {
  cloudIncidentsTool,
  cloudIncidentTool,
  handleCloudIncidentsRequest,
  handleCloudIncidentRequest,
} from "./tools/cloudIncidents.js";
import {
  anomaliesTool,
  anomalyTool,
  handleAnomaliesRequest,
  handleAnomalyRequest,
} from "./tools/anomalies.js";
import {
  reportsTool,
  runQueryTool,
  handleReportsRequest,
  handleRunQueryRequest,
  getReportResultsTool,
  handleGetReportResultsRequest,
} from "./tools/reports.js";
import {
  validateUserTool,
  handleValidateUserRequest,
} from "./tools/validateUser.js";
import { dimensionsTool, handleDimensionsRequest } from "./tools/dimensions.js";
import { dimensionTool, handleDimensionRequest } from "./tools/dimension.js";
import {
  createErrorResponse,
  formatZodError,
  handleGeneralError,
} from "./utils/util.js";
import { executeToolHandler } from "./utils/toolsHandler.js";

import { prompts } from "./utils/prompts.js";
import {
  listTicketsTool,
  handleListTicketsRequest,
} from "./tools/tickets.js";
import {
  listInvoicesTool,
  handleListInvoicesRequest,
  getInvoiceTool,
  handleGetInvoiceRequest,
} from "./tools/invoices.js";
import {
  listAllocationsTool,
  handleListAllocationsRequest,
  getAllocationTool,
  handleGetAllocationRequest,
  createAllocationTool,
  handleCreateAllocationRequest,
  updateAllocationTool,
  handleUpdateAllocationRequest,
} from "./tools/allocations.js";
import { listAssetsTool, handleListAssetsRequest } from "./tools/assets.js";
import { SERVER_VERSION } from "./utils/consts.js";

dotenv.config();

function createServer() {
  const server = new Server(
    {
      name: "doit-mcp-server",
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        cloudIncidentsTool,
        cloudIncidentTool,
        anomaliesTool,
        anomalyTool,
        reportsTool,
        runQueryTool,
        getReportResultsTool,
        validateUserTool,
        dimensionsTool,
        dimensionTool,
        listTicketsTool,
        listInvoicesTool,
        getInvoiceTool,
        listAllocationsTool,
        getAllocationTool,
        createAllocationTool,
        updateAllocationTool,
        listAssetsTool,
      ],
    };
  });

  // Handle prompts listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: prompts.map((prompt) => ({
        text: prompt.text,
        name: prompt.name,
      })),
    };
  });

  // Handle resources listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const token = process.env.DOIT_API_KEY;
    if (!token) {
      return createErrorResponse("Unauthorized");
    }

    return await executeToolHandler(name, args, token);
  });

  // Handle initialize method
  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    return {
      protocolVersion: request?.params?.protocolVersion || "2024-11-05",
      serverInfo: {
        name: "doit-mcp-server",
        version: SERVER_VERSION,
      },
      capabilities: server["_capabilities"] || {},
    };
  });

  return server;
}

const server = createServer();

// Start the server
async function mainWithServer(customServer?: Server) {
  const transport = new StdioServerTransport();
  const srv = customServer || server;
  await srv.connect(transport);
  console.error("DoiT MCP Server running on stdio");
}

const main = mainWithServer;

if (
  process.env.NODE_ENV !== "test" &&
  process.env.VITEST_WORKER_ID === undefined
) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}

export {
  server,
  main,
  mainWithServer,
  createServer,
  handleCloudIncidentsRequest,
  handleCloudIncidentRequest,
  handleAnomaliesRequest,
  handleAnomalyRequest,
  handleReportsRequest,
  handleRunQueryRequest,
  handleGetReportResultsRequest,
  handleValidateUserRequest,
  handleDimensionsRequest,
  handleDimensionRequest,
  handleListTicketsRequest,
  createErrorResponse,
  formatZodError,
  handleGeneralError,
  handleListInvoicesRequest,
  handleGetInvoiceRequest,
  handleListAllocationsRequest,
  handleGetAllocationRequest,
  handleCreateAllocationRequest,
  handleUpdateAllocationRequest,
  handleListAssetsRequest,
};
