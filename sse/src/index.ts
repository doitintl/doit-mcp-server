import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import DoiT tool handlers
import {
  handleCloudIncidentsRequest,
  handleCloudIncidentRequest,
  CloudIncidentsArgumentsSchema,
  CloudIncidentArgumentsSchema,
  cloudIncidentTool,
  cloudIncidentsTool,
} from "../../src/tools/cloudIncidents.js";
import {
  handleAnomaliesRequest,
  handleAnomalyRequest,
  AnomaliesArgumentsSchema,
  AnomalyArgumentsSchema,
  anomaliesTool,
  anomalyTool,
} from "../../src/tools/anomalies.js";
import {
  handleReportsRequest,
  handleRunQueryRequest,
  handleGetReportResultsRequest,
  ReportsArgumentsSchema,
  RunQueryArgumentsSchema,
  GetReportResultsArgumentsSchema,
  reportsTool,
  runQueryTool,
  getReportResultsTool,
} from "../../src/tools/reports.js";
import {
  handleValidateUserRequest,
  ValidateUserArgumentsSchema,
  validateUserTool,
} from "../../src/tools/validateUser.js";
import {
  handleDimensionsRequest,
  DimensionsArgumentsSchema,
  dimensionsTool,
} from "../../src/tools/dimensions.js";
import {
  handleDimensionRequest,
  DimensionArgumentsSchema,
  dimensionTool,
} from "../../src/tools/dimension.js";
import {
  handleListTicketsRequest,
  handleCreateTicketRequest,
  ListTicketsArgumentsSchema,
  CreateTicketArgumentsSchema,
  listTicketsTool,
  createTicketTool,
} from "../../src/tools/tickets.js";
import {
  handleListInvoicesRequest,
  handleGetInvoiceRequest,
  ListInvoicesArgumentsSchema,
  GetInvoiceArgumentsSchema,
  listInvoicesTool,
  getInvoiceTool,
} from "../../src/tools/invoices.js";
import {
  createErrorResponse,
  formatZodError,
  handleGeneralError,
  zodSchemaToMcpTool,
} from "../../src/utils/util.js";
import { prompts } from "../../src/utils/prompts.js";

type Props = {
  bearerToken: string;
  customerContext: string | null;
};

type State = null;

// Define CORS options
const corsOptions = {
  origin: "*", // Allow all origins - adjust as needed for security
  methods: "GET, POST, PUT, DELETE, OPTIONS",
  headers: "Content-Type, Authorization, X-Requested-With",
  maxAge: 86400, // 24 hours
};

// Helper function to create CORS headers
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": corsOptions.origin,
    "Access-Control-Allow-Methods": corsOptions.methods,
    "Access-Control-Allow-Headers": corsOptions.headers,
    "Access-Control-Max-Age": corsOptions.maxAge.toString(),
  };
}

// Helper function to convert DoiT handler response to MCP format
function convertToMcpResponse(doitResponse: any) {
  if (doitResponse.content && Array.isArray(doitResponse.content)) {
    return doitResponse;
  }
  // If it's a simple response, wrap it
  return {
    content: [{ type: "text", text: JSON.stringify(doitResponse) }],
  };
}

// Helper function to extract token from request
function getTokenFromRequest(request: Request): string {
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    // Handle different authorization header formats
    if (authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    } else if (authHeader.startsWith("Token ")) {
      return authHeader.substring(6);
    } else {
      // Assume the entire header value is the token
      return authHeader;
    }
  }

  // Fallback to environment variable
  const envToken = process.env.DOIT_API_KEY;
  if (!envToken) {
    throw new Error(
      "getTokenFromRequest - No DoiT API token found. Please provide Authorization header or set DOIT_API_KEY environment variable."
    );
  }
  return envToken;
}

// Define our MCP agent with DoiT tools
export class DoitMCP extends McpAgent<Env, State, Props> {
  server = new McpServer({
    name: "DoiT MCP Server",
    version: "1.0.0",
  });

  // Helper method to get the current token
  private getToken(): string {
    return this.props.bearerToken;
  }

  async init() {
    if (this.props.customerContext) {
      process.env.CUSTOMER_CONTEXT = this.props.customerContext;
    }

    // Register prompts
    prompts.forEach((prompt) => {
      this.server.prompt(prompt.name, prompt.description, async () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: prompt.text,
            },
          },
        ],
      }));
    });

    // Cloud Incidents tools
    this.server.tool(
      cloudIncidentsTool.name,
      cloudIncidentsTool.description,
      zodSchemaToMcpTool(CloudIncidentsArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleCloudIncidentsRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling cloud incidents request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    this.server.tool(
      cloudIncidentTool.name,
      cloudIncidentTool.description,
      zodSchemaToMcpTool(CloudIncidentArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleCloudIncidentRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling cloud incident request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    // Anomalies tools
    this.server.tool(
      anomaliesTool.name,
      anomaliesTool.description,
      zodSchemaToMcpTool(AnomaliesArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleAnomaliesRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling anomalies request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    this.server.tool(
      anomalyTool.name,
      anomalyTool.description,
      zodSchemaToMcpTool(AnomalyArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleAnomalyRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling anomaly request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    // Reports tools
    this.server.tool(
      reportsTool.name,
      reportsTool.description,
      zodSchemaToMcpTool(ReportsArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleReportsRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling reports request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    this.server.tool(
      runQueryTool.name,
      runQueryTool.description,
      zodSchemaToMcpTool(RunQueryArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleRunQueryRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling run query request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    this.server.tool(
      getReportResultsTool.name,
      getReportResultsTool.description,
      zodSchemaToMcpTool(GetReportResultsArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleGetReportResultsRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling get report results request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    // Validation tool
    this.server.tool(
      validateUserTool.name,
      validateUserTool.description,
      zodSchemaToMcpTool(ValidateUserArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleValidateUserRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling validate user request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    // Dimensions tools
    this.server.tool(
      dimensionsTool.name,
      dimensionsTool.description,
      zodSchemaToMcpTool(DimensionsArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleDimensionsRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling dimensions request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    this.server.tool(
      dimensionTool.name,
      dimensionTool.description,
      zodSchemaToMcpTool(DimensionArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleDimensionRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling dimension request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    // Tickets tools
    this.server.tool(
      listTicketsTool.name,
      listTicketsTool.description,
      zodSchemaToMcpTool(ListTicketsArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleListTicketsRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling list tickets request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    this.server.tool(
      createTicketTool.name,
      createTicketTool.description,
      zodSchemaToMcpTool(CreateTicketArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleCreateTicketRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling create ticket request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    // Invoices tools
    this.server.tool(
      listInvoicesTool.name,
      listInvoicesTool.description,
      zodSchemaToMcpTool(ListInvoicesArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleListInvoicesRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling list invoices request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );

    this.server.tool(
      getInvoiceTool.name,
      getInvoiceTool.description,
      zodSchemaToMcpTool(GetInvoiceArgumentsSchema),
      async (args) => {
        try {
          const token = this.getToken();
          const result = await handleGetInvoiceRequest(args, token);
          return convertToMcpResponse(result);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorResult = createErrorResponse(formatZodError(error));
            return convertToMcpResponse(errorResult);
          }
          const errorResult = handleGeneralError(
            error,
            "handling get invoice request"
          );
          return convertToMcpResponse(errorResult);
        }
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle preflight OPTIONS requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(),
      });
    }

    // Extract token from request and set it in environment variable
    try {
      const token = getTokenFromRequest(request);
      ctx.props = {
        bearerToken: token,
        customerContext: url.searchParams.get("customerContext") || null,
      };
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    }

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return DoitMCP.serveSSE("/sse", { corsOptions }).fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return DoitMCP.serve("/mcp", { corsOptions }).fetch(request, env, ctx);
    }

    return new Response("Not found", {
      status: 404,
      headers: getCorsHeaders(),
    });
  },
};
