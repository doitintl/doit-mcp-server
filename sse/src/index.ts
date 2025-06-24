import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import DoiT tool handlers
import {
  CloudIncidentsArgumentsSchema,
  CloudIncidentArgumentsSchema,
  cloudIncidentTool,
  cloudIncidentsTool,
} from "../../src/tools/cloudIncidents.js";
import {
  AnomaliesArgumentsSchema,
  AnomalyArgumentsSchema,
  anomaliesTool,
  anomalyTool,
} from "../../src/tools/anomalies.js";
import {
  ReportsArgumentsSchema,
  RunQueryArgumentsSchema,
  GetReportResultsArgumentsSchema,
  reportsTool,
  runQueryTool,
  getReportResultsTool,
} from "../../src/tools/reports.js";
import {
  ValidateUserArgumentsSchema,
  validateUserTool,
} from "../../src/tools/validateUser.js";
import {
  DimensionsArgumentsSchema,
  dimensionsTool,
} from "../../src/tools/dimensions.js";
import {
  DimensionArgumentsSchema,
  dimensionTool,
} from "../../src/tools/dimension.js";
import {
  ListTicketsArgumentsSchema,
  CreateTicketArgumentsSchema,
  listTicketsTool,
  createTicketTool,
} from "../../src/tools/tickets.js";
import {
  ListInvoicesArgumentsSchema,
  GetInvoiceArgumentsSchema,
  listInvoicesTool,
  getInvoiceTool,
} from "../../src/tools/invoices.js";
import { zodSchemaToMcpTool } from "../../src/utils/util.js";
import { executeToolHandler } from "../../src/utils/toolsHandler.js";
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

  // Generic callback factory for tools
  private createToolCallback(toolName: string) {
    return async (args: any) => {
      const token = this.getToken();
      return await executeToolHandler(
        toolName,
        args,
        token,
        convertToMcpResponse
      );
    };
  }

  // Generic tool registration helper
  private registerTool(tool: any, schema: any) {
    (this.server.tool as any)(
      tool.name,
      tool.description,
      zodSchemaToMcpTool(schema),
      this.createToolCallback(tool.name)
    );
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
    this.registerTool(cloudIncidentsTool, CloudIncidentsArgumentsSchema);
    this.registerTool(cloudIncidentTool, CloudIncidentArgumentsSchema);

    // Anomalies tools
    this.registerTool(anomaliesTool, AnomaliesArgumentsSchema);
    this.registerTool(anomalyTool, AnomalyArgumentsSchema);

    // Reports tools
    this.registerTool(reportsTool, ReportsArgumentsSchema);
    this.registerTool(runQueryTool, RunQueryArgumentsSchema);
    this.registerTool(getReportResultsTool, GetReportResultsArgumentsSchema);

    // Validation tool
    this.registerTool(validateUserTool, ValidateUserArgumentsSchema);

    // Dimensions tools
    this.registerTool(dimensionsTool, DimensionsArgumentsSchema);
    this.registerTool(dimensionTool, DimensionArgumentsSchema);

    // Tickets tools
    this.registerTool(listTicketsTool, ListTicketsArgumentsSchema);
    this.registerTool(createTicketTool, CreateTicketArgumentsSchema);

    // Invoices tools
    this.registerTool(listInvoicesTool, ListInvoicesArgumentsSchema);
    this.registerTool(getInvoiceTool, GetInvoiceArgumentsSchema);
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
