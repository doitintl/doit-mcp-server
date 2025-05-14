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

import {
  aws_global_resource_id,
  gcp_global_resource_id,
} from "./utils/filterFields.js";

dotenv.config();

// Create server instance
const server = new Server(
  {
    name: "doit-mcp-server",
    version: "1.0.0",
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
    ],
  };
});

// Handle prompts listing
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        text: `Filter fields explanation: ${gcp_global_resource_id}\n\n ${aws_global_resource_id}\n\n`,
        name: "Filter Fields Reference",
      },
      {
        text: `Create a document (Artifacts) with a table to display the report results. include insights and recommendations if possible. (Do not generate code, only a document)`,
        name: "Report Display Instructions",
      },
      {
        text: `Before running a query, always check the filter fields explanation and dimensions.`,
        name: "Query Best Practice",
      },
      {
        text: `Do not generate code, only a document.`,
        name: "Document Output Reminder",
      },
      {
        text: `To create a cost report, first check if you need specific dimensions with:
list_dimensions(filter: "type:fixed")

Then run a query like:
run_query({
  config: {
    dataSource: "billing",
    metric: { type: "basic", value: "cost" },
    timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },
    group: [{ id: "service_description", type: "fixed", limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 } }]
  }
})`,
        name: "Cost Report Example",
      },
    ],
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

  try {
    switch (name) {
      case "get_cloud_incidents":
        return await handleCloudIncidentsRequest(args, token);
      case "get_cloud_incident":
        return await handleCloudIncidentRequest(args, token);
      case "get_anomalies":
        return await handleAnomaliesRequest(args, token);
      case "get_anomaly":
        return await handleAnomalyRequest(args, token);
      case "list_reports":
        return await handleReportsRequest(args, token);
      case "run_query":
        return await handleRunQueryRequest(args, token);
      case "get_report_results":
        return await handleGetReportResultsRequest(args, token);
      case "validate_user":
        return await handleValidateUserRequest(args, token);
      case "list_dimensions":
        return await handleDimensionsRequest(args, token);
      case "get_dimension":
        return await handleDimensionRequest(args, token);
      default:
        return createErrorResponse(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(formatZodError(error));
    }
    return handleGeneralError(error, "handling tool request");
  }
});

// Handle initialize method
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  return {
    protocolVersion: request?.params?.protocolVersion || "2024-11-05",
    serverInfo: {
      name: "doit-mcp-server",
      version: "1.0.0",
    },
    capabilities: server["_capabilities"] || {},
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DoiT MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
