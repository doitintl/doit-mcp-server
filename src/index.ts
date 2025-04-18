#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
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
      `Filter fields explanation: ${gcp_global_resource_id}\n\n ${aws_global_resource_id}\n\n`,
      `Create a document (Artifacts) with a table to display the report results. include insights and recommendations if possible. (Do not generate code, only a document)`,
      `Before running a query, always check the filter fields explanation and dimensions.`,
      `Do not generate code, only a document.`,
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
