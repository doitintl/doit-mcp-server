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
import {
  listTicketsTool,
  handleListTicketsRequest,
  createTicketTool,
  handleCreateTicketRequest,
} from "./tools/tickets.js";
import {
  listInvoicesTool,
  handleListInvoicesRequest,
  getInvoiceTool,
  handleGetInvoiceRequest,
} from "./tools/invoices.js";

dotenv.config();

function createServer() {
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
        listTicketsTool,
        createTicketTool,
        listInvoicesTool,
        getInvoiceTool,
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
          name: "Generate Report Document",
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
          text: `To create a cost report, first check if you need specific dimensions with:\nlist_dimensions(filter: "type:fixed")\n\nThen check if there is similar reports with list_reports and get_report_results. when you understand the structure Then run a query like:\nrun_query({\n  config: {\n    dataSource: "billing",\n    metric: { type: "basic", value: "cost" },\n    timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },\n    group: [{ id: "service_description", type: "fixed", limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 } }]\n  }\n})`,
          name: "Generate Report Command",
        },
        {
          text: `Create a document (Artifacts) with a table to display the list of anomalies. Include the following columns: ID, Type, Status, Severity, Created At, and Description. Add insights and recommendations if available. (Do not generate code, only a document)`,
          name: "Generate Anomalies Document",
        },
        {
          text: `Use the list_dimensions tool to explore available dimensions. Select dimensions that best match your reporting needs. Combine multiple dimensions for more granular analysis, and always review the filter fields reference for optimal filtering.`,
          name: "Dimension Usage Guidance",
        },
        {
          text: `Before creating a ticket, ask the user if the ticket body is clear and if they want to add more details.`,
          name: "Create Ticket",
        },
        {
          text: `Create a document (Artifacts) with a table to display invoice details. Include the following columns: Invoice ID, Invoice Date, Due Date, Status, Total Amount, Balance Amount, Currency, and URL. For line items, create a separate table with columns: Description, Details, Price, Quantity, Type, and Currency. Add any relevant payment status or due date alerts. (Do not generate code, only a document)`,
          name: "Generate Invoice Details Document",
        },
        {
          text: `Tools results should use the Document artifact type if possible.`,
          name: "DoiT MCP Server tools output",
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
        case "list_tickets":
          return await handleListTicketsRequest(args, token);
        case "create_ticket":
          return await handleCreateTicketRequest(args, token);
        case "list_invoices":
          return await handleListInvoicesRequest(args, token);
        case "get_invoice":
          return await handleGetInvoiceRequest(args, token);
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
  handleCreateTicketRequest,
  createErrorResponse,
  formatZodError,
  handleGeneralError,
  handleListInvoicesRequest,
  handleGetInvoiceRequest,
};
