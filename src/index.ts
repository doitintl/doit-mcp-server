#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import {
  createAllocationTool,
  getAllocationTool,
  handleCreateAllocationRequest,
  handleGetAllocationRequest,
  handleListAllocationsRequest,
  handleUpdateAllocationRequest,
  listAllocationsTool,
  updateAllocationTool,
} from "./tools/allocations.js";
import {
  anomaliesTool,
  anomalyTool,
  handleAnomaliesRequest,
  handleAnomalyRequest,
} from "./tools/anomalies.js";
import { handleListAssetsRequest, listAssetsTool } from "./tools/assets.js";
import {
  handleTriggerCloudFlowRequest,
  triggerCloudFlowTool,
} from "./tools/cloudflow.js";
import {
  cloudIncidentsTool,
  cloudIncidentTool,
  handleCloudIncidentRequest,
  handleCloudIncidentsRequest,
} from "./tools/cloudIncidents.js";
import { dimensionTool, handleDimensionRequest } from "./tools/dimension.js";
import { dimensionsTool, handleDimensionsRequest } from "./tools/dimensions.js";
import {
  getInvoiceTool,
  handleGetInvoiceRequest,
  handleListInvoicesRequest,
  listInvoicesTool,
} from "./tools/invoices.js";
import {
  getReportResultsTool,
  handleGetReportResultsRequest,
  handleReportsRequest,
  handleRunQueryRequest,
  reportsTool,
  runQueryTool,
} from "./tools/reports.js";
import {
  handleListTicketsRequest,
  listTicketsTool,
} from "./tools/tickets.js";
import {
  handleValidateUserRequest,
  validateUserTool,
} from "./tools/validateUser.js";
import {
  handleListAlertsRequest,
  listAlertsTool,
} from "./tools/alerts.js";
import { SERVER_VERSION } from "./utils/consts.js";
import { prompts } from "./utils/prompts.js";
import { executeToolHandler } from "./utils/toolsHandler.js";
import {
  createErrorResponse,
  formatZodError,
  handleGeneralError,
} from "./utils/util.js";

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
        listAlertsTool,
        triggerCloudFlowTool,
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
      // biome-ignore lint/complexity/useLiteralKeys: bracket notation bypasses private property TS check
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
<<<<<<< HEAD
  handleTriggerCloudFlowRequest,
=======
  handleListAlertsRequest,
>>>>>>> 0d7c55c (feat: add list alerts tool)
};
