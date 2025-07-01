import app from "./app";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { executeToolHandler } from "../../src/utils/toolsHandler.js";
import { zodSchemaToMcpTool } from "../../src/utils/util.js";
import { prompts } from "../../src/utils/prompts.js";

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

export class DoitMCPAgent extends McpAgent {
  server = new McpServer({
    name: "Doit",
    version: "1.0.0",
  });

  // Helper method to get the current token
  private getToken(): string {
    return this.props.apiKey as string;
  }

  // Generic callback factory for tools
  private createToolCallback(toolName: string) {
    return async (args: any) => {
      const token = this.getToken();
      const argsWithCustomerContext = {
        ...args,
        customerContext: this.props.customerContext,
      };
      return await executeToolHandler(
        toolName,
        argsWithCustomerContext,
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
    console.log("Initializing Doit MCP Agent", this.props.customerContext);

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

async function handleMcpRequest(req: Request, env: Env, ctx: ExecutionContext) {
  const { pathname } = new URL(req.url);

  if (pathname === "/sse" || pathname === "/sse/message") {
    return DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx);
  }
  if (pathname === "/mcp") {
    return DoitMCPAgent.serve("/mcp").fetch(req, env, ctx);
  }
  return new Response("Not found", { status: 404 });
}

// Export the OAuth handler as the default
export default new OAuthProvider({
  apiHandler: { fetch: handleMcpRequest as any },
  apiRoute: ["/sse", "/mcp"],
  // @ts-expect-error
  defaultHandler: app,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
