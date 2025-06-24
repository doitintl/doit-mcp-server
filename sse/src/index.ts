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
        const token = this.getToken();
        return await executeToolHandler(
          cloudIncidentsTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    this.server.tool(
      cloudIncidentTool.name,
      cloudIncidentTool.description,
      zodSchemaToMcpTool(CloudIncidentArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          cloudIncidentTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    // Anomalies tools
    this.server.tool(
      anomaliesTool.name,
      anomaliesTool.description,
      zodSchemaToMcpTool(AnomaliesArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          anomaliesTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    this.server.tool(
      anomalyTool.name,
      anomalyTool.description,
      zodSchemaToMcpTool(AnomalyArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          anomalyTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    // Reports tools
    this.server.tool(
      reportsTool.name,
      reportsTool.description,
      zodSchemaToMcpTool(ReportsArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          reportsTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    this.server.tool(
      runQueryTool.name,
      runQueryTool.description,
      zodSchemaToMcpTool(RunQueryArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          runQueryTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    this.server.tool(
      getReportResultsTool.name,
      getReportResultsTool.description,
      zodSchemaToMcpTool(GetReportResultsArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          getReportResultsTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    // Validation tool
    this.server.tool(
      validateUserTool.name,
      validateUserTool.description,
      zodSchemaToMcpTool(ValidateUserArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          validateUserTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    // Dimensions tools
    this.server.tool(
      dimensionsTool.name,
      dimensionsTool.description,
      zodSchemaToMcpTool(DimensionsArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          dimensionsTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    this.server.tool(
      dimensionTool.name,
      dimensionTool.description,
      zodSchemaToMcpTool(DimensionArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          dimensionTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    // Tickets tools
    this.server.tool(
      listTicketsTool.name,
      listTicketsTool.description,
      zodSchemaToMcpTool(ListTicketsArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          listTicketsTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    this.server.tool(
      createTicketTool.name,
      createTicketTool.description,
      zodSchemaToMcpTool(CreateTicketArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          createTicketTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    // Invoices tools
    this.server.tool(
      listInvoicesTool.name,
      listInvoicesTool.description,
      zodSchemaToMcpTool(ListInvoicesArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          listInvoicesTool.name,
          args,
          token,
          convertToMcpResponse
        );
      }
    );

    this.server.tool(
      getInvoiceTool.name,
      getInvoiceTool.description,
      zodSchemaToMcpTool(GetInvoiceArgumentsSchema),
      async (args) => {
        const token = this.getToken();
        return await executeToolHandler(
          getInvoiceTool.name,
          args,
          token,
          convertToMcpResponse
        );
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
