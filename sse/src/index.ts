import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import DoiT tool handlers
import {
  handleCloudIncidentsRequest,
  handleCloudIncidentRequest,
  CloudIncidentsArgumentsSchema,
  CloudIncidentArgumentsSchema,
} from "../../src/tools/cloudIncidents.js";
import {
  handleAnomaliesRequest,
  handleAnomalyRequest,
  AnomaliesArgumentsSchema,
  AnomalyArgumentsSchema,
} from "../../src/tools/anomalies.js";
import {
  handleReportsRequest,
  handleRunQueryRequest,
  handleGetReportResultsRequest,
  ReportsArgumentsSchema,
  RunQueryArgumentsSchema,
  GetReportResultsArgumentsSchema,
} from "../../src/tools/reports.js";
import {
  handleValidateUserRequest,
  ValidateUserArgumentsSchema,
} from "../../src/tools/validateUser.js";
import {
  handleDimensionsRequest,
  DimensionsArgumentsSchema,
} from "../../src/tools/dimensions.js";
import {
  handleDimensionRequest,
  DimensionArgumentsSchema,
} from "../../src/tools/dimension.js";
import {
  handleListTicketsRequest,
  handleCreateTicketRequest,
  ListTicketsArgumentsSchema,
  CreateTicketArgumentsSchema,
} from "../../src/tools/tickets.js";
import {
  handleListInvoicesRequest,
  handleGetInvoiceRequest,
  ListInvoicesArgumentsSchema,
  GetInvoiceArgumentsSchema,
} from "../../src/tools/invoices.js";
import {
  createErrorResponse,
  formatZodError,
  handleGeneralError,
  zodSchemaToMcpTool,
} from "../../src/utils/util.js";

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

    // Cloud Incidents tools
    this.server.tool(
      "get_cloud_incidents",
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
      "get_cloud_incident",
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
      "get_anomalies",
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
      "get_anomaly",
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
      "list_reports",
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
      "run_query",
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
      "get_report_results",
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
      "validate_user",
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
      "list_dimensions",
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
      "get_dimension",
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
      "list_tickets",
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
      "create_ticket",
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
      "list_invoices",
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
      "get_invoice",
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
