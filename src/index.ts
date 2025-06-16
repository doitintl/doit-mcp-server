#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
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

function getPrompts() {
  return [
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
      text: `Tools results should use the Document artifact type if possible. You must never use the code artifact type or to analyze the results of a tool with code/javascript.`,
      name: "DoiT MCP Server tools output",
    },
  ];
}

function getTools() {
  return [
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
  ];
}

async function handleToolCall(name: string, args: any, token: string) {
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
}

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
      tools: getTools(),
    };
  });

  // Handle prompts listing
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: getPrompts(),
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
    // Use environment variable for stdio transport
    const token = process.env.DOIT_API_KEY;
    if (!token) {
      return createErrorResponse("Unauthorized");
    }

    try {
      return await handleToolCall(name, args, token);
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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    transport: "stdio" as "stdio" | "sse",
    port: 3000,
    host: "localhost",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--transport":
        if (args[i + 1] === "sse" || args[i + 1] === "stdio") {
          result.transport = args[i + 1] as "stdio" | "sse";
          i++;
        }
        break;
      case "--port":
        const port = parseInt(args[i + 1]);
        if (!isNaN(port)) {
          result.port = port;
          i++;
        }
        break;
      case "--host":
        result.host = args[i + 1];
        i++;
        break;
    }
  }

  return result;
}

// HTTP/SSE Server implementation
async function startHttpSseServer(port: number, host: string) {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Session-ID"],
      credentials: false,
    })
  );
  app.use(express.json({ limit: "10mb" }));

  // Store active SSE connections
  const sseConnections = new Map<string, express.Response>();

  // SSE endpoint
  app.get("/sse", (req, res) => {
    const sessionId = randomUUID();
    const customerId = req.query.customerContext;

    if (customerId && typeof customerId === "string") {
      process.env.CUSTOMER_CONTEXT = customerId;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Send endpoint info
    res.write(`event: endpoint\n`);
    res.write(
      `data: http://${host}:${port}/message?sessionId=${sessionId}\n\n`
    );

    // Store connection
    sseConnections.set(sessionId, res);

    // Keep-alive
    const keepAlive = setInterval(() => {
      if (sseConnections.has(sessionId)) {
        res.write(`event: ping\n`);
        res.write(`data: ${Date.now()}\n\n`);
      } else {
        clearInterval(keepAlive);
      }
    }, 15000);

    req.on("close", () => {
      sseConnections.delete(sessionId);
      clearInterval(keepAlive);
    });
  });

  // Message endpoint
  const messageHandler: express.RequestHandler = async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const sseConnection = sseConnections.get(sessionId);

    if (!sseConnection) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid session ID" },
        id: null,
      });
      return;
    }

    // Check authorization header for DoiT API key
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized: Missing API key in Authorization header",
        },
        id: req.body?.id || null,
      });
      return;
    }

    try {
      const message = req.body;
      // Process message through direct handler implementations
      let response: any = null;

      if (message.method === "initialize") {
        response = {
          protocolVersion: message?.params?.protocolVersion || "2024-11-05",
          serverInfo: {
            name: "doit-mcp-server",
            version: "1.0.0",
          },
          capabilities: {
            tools: {},
            prompts: {},
            resources: {},
          },
        };
      } else if (message.method === "tools/list") {
        response = {
          tools: getTools(),
        };
      } else if (message.method === "tools/call") {
        // Handle tool calls with API key from header
        const { name, arguments: args } = message.params;

        const token = authHeader;

        try {
          response = await handleToolCall(name, args, token);
        } catch (error) {
          if (error instanceof z.ZodError) {
            response = createErrorResponse(formatZodError(error));
          } else {
            response = handleGeneralError(error, "handling tool request");
          }
        }
      } else if (message.method === "prompts/list") {
        response = {
          prompts: getPrompts(),
        };
      } else if (message.method === "resources/list") {
        response = {
          resources: [],
        };
      }

      if (response) {
        const jsonrpcResponse = {
          jsonrpc: "2.0",
          id: message.id,
          result: response,
        };
        sseConnection.write(`event: message\n`);
        sseConnection.write(`data: ${JSON.stringify(jsonrpcResponse)}\n\n`);
      }

      res.status(202).send();
    } catch (error) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: req.body.id || null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      };

      if (sseConnection) {
        sseConnection.write(`event: message\n`);
        sseConnection.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      }

      res.status(500).json(errorResponse);
    }
  };

  app.post("/message", messageHandler);

  // Health endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", transport: "http-sse" });
  });

  return new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      console.error(
        `DoiT MCP Server running on HTTP/SSE at http://${host}:${port}`
      );
      console.error(`SSE endpoint: http://${host}:${port}/sse`);
      console.error(`Message endpoint: http://${host}:${port}/message`);
      resolve();
    });
  });
}

// Start the server
async function mainWithServer(customServer?: Server) {
  const args = parseArgs();
  const srv = customServer || server;

  if (args.transport === "sse") {
    await startHttpSseServer(args.port, args.host);
  } else {
    const transport = new StdioServerTransport();
    await srv.connect(transport);
    console.error("DoiT MCP Server running on stdio");
  }
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
