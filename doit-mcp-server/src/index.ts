import app from "./app";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DurableObject } from "cloudflare:workers";

import { SERVER_VERSION } from "../../src/utils/consts.js";

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
  listTicketsTool,
} from "../../src/tools/tickets.js";
import {
  ListInvoicesArgumentsSchema,
  GetInvoiceArgumentsSchema,
  listInvoicesTool,
  getInvoiceTool,
} from "../../src/tools/invoices.js";
import {
  ListAllocationsArgumentsSchema,
  GetAllocationArgumentsSchema,
  CreateAllocationArgumentsSchema,
  UpdateAllocationArgumentsSchema,
  listAllocationsTool,
  getAllocationTool,
  createAllocationTool,
  updateAllocationTool,
} from "../../src/tools/allocations.js";
import {
  ListAssetsArgumentsSchema,
  listAssetsTool,
} from "../../src/tools/assets.js";
import {
  ChangeCustomerArgumentsSchema,
  changeCustomerTool,
} from "../../src/tools/changeCustomer.js";

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { executeToolHandler } from "../../src/utils/toolsHandler.js";
import { zodSchemaToMcpTool } from "../../src/utils/util.js";
import { prompts } from "../../src/utils/prompts.js";

const KEEP_ALIVE_INTERVAL_MS = 120_000; // 2 minutes in milliseconds

// Create an MCP ping notification JSON-RPC message
// This is a notification (no id field) that MCP clients can safely handle.
const MCP_NOTIFICATIONS_PING = {
  jsonrpc: "2.0",
  method: "notifications/ping",
};

// SSE message to send the MCP ping notification and keep the connection alive.
const SSE_KEEP_ALIVE_MESSAGE = new TextEncoder().encode(
  `event: message\ndata: ${JSON.stringify(MCP_NOTIFICATIONS_PING)}\n\n`
);

// Context Storage Durable Object
export class ContextStorage extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async saveContext(customerContext: string): Promise<void> {
    console.log(
      "Saving customer context:",
      customerContext,
      this.ctx.id.toString().slice(-6)
    );

    await this.ctx.storage.put("customerContext", customerContext);
  }

  async loadContext(): Promise<string | null> {
    const context = await this.ctx.storage.get<string>("customerContext");
    console.log(
      "Loaded customer context:",
      context,
      this.ctx.id.toString().slice(-6)
    );
    return context || null;
  }
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

export class DoitMCPAgent extends McpAgent {
  server = new McpServer({
    name: "Doit",
    version: SERVER_VERSION,
  });

  // Helper method to get the current token
  private getToken(): string {
    return this.props.apiKey as string;
  }

  // Persist props to Context Storage Durable Object
  private async saveProps(): Promise<void> {
    const env = this.env as Env;
    const apiKey = this.props.apiKey as string;
    const customerContext = this.props.customerContext as string;
    if (apiKey && env?.CONTEXT_STORAGE) {
      const id = env.CONTEXT_STORAGE.idFromName(apiKey);
      const contextStorage = env.CONTEXT_STORAGE.get(id);
      await contextStorage.saveContext(customerContext);
    }
  }

  // Load props from Context Storage Durable Object
  private async loadPersistedProps(): Promise<string | null> {
    const env = this.env as Env;
    const apiKey = this.props.apiKey as string;
    if (apiKey && env?.CONTEXT_STORAGE) {
      const id = env.CONTEXT_STORAGE.idFromName(apiKey);
      const contextStorage = env.CONTEXT_STORAGE.get(id);
      const persistedProps = await contextStorage.loadContext();
      if (persistedProps) {
        // Update props with persisted values
        this.props.customerContext = persistedProps;
        return persistedProps;
      }
    }
    return (this.props.customerContext as string) || null;
  }

  // Generic callback factory for tools
  private createToolCallback(toolName: string) {
    return async (args: any) => {
      const token = this.getToken();
      const persistedCustomerContext = await this.loadPersistedProps();
      const customerContext =
        persistedCustomerContext || (this.props.customerContext as string);

      const argsWithCustomerContext = {
        ...args,
        customerContext,
      };
      return await executeToolHandler(
        toolName,
        argsWithCustomerContext,
        token,
        convertToMcpResponse
      );
    };
  }

  // Special callback for changeCustomer tool
  private createChangeCustomerCallback() {
    return async (args: any) => {
      const token = this.getToken();
      const { handleChangeCustomerRequest } = await import(
        "../../src/tools/changeCustomer.js"
      );

      // Create update function to modify the customer context
      const updateCustomerContext = async (newContext: string) => {
        this.props.customerContext = newContext;

        // Persist the updated props
        await this.saveProps();
      };

      const response = await handleChangeCustomerRequest(
        args,
        token,
        updateCustomerContext
      );

      return convertToMcpResponse(response);
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

    // Load persisted props first
    await this.loadPersistedProps();

    console.log("After loading persisted props:", this.props.customerContext);

    // Save current props if they exist (for initial OAuth setup)
    if (this.props.apiKey && this.props.customerContext) {
      await this.saveProps();
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

    // Invoices tools
    this.registerTool(listInvoicesTool, ListInvoicesArgumentsSchema);
    this.registerTool(getInvoiceTool, GetInvoiceArgumentsSchema);

    // Allocations tools
    this.registerTool(listAllocationsTool, ListAllocationsArgumentsSchema);
    this.registerTool(getAllocationTool, GetAllocationArgumentsSchema);
    this.registerTool(createAllocationTool, CreateAllocationArgumentsSchema);
    this.registerTool(updateAllocationTool, UpdateAllocationArgumentsSchema);

    // Assets tools
    this.registerTool(listAssetsTool, ListAssetsArgumentsSchema);

    // Change Customer tool (requires special handling)
    if (this.props.isDoitUser === "true") {
      (this.server.tool as any)(
        changeCustomerTool.name,
        changeCustomerTool.description,
        zodSchemaToMcpTool(ChangeCustomerArgumentsSchema),
        this.createChangeCustomerCallback()
      );
    }
  }
}

/**
 * Helper function to wrap SSE response stream with keep-alive messages,
 * this is used to keep the connection alive for the client.
 * Returns a wrapped response whose body stream sends all the messages from the original
 * response, plus an internal timer to send keep-alive messages at regular intervals.
 * @param response The original SSE response to wrap
 * @param keepAliveIntervalMs Optional interval in milliseconds between keep-alive messages
 */
function wrapSSEResponseWithKeepAlive(
  response: Response,
  keepAliveIntervalMs: number = KEEP_ALIVE_INTERVAL_MS
): Response {
  const originalBody = response.body;

  if (!originalBody) {
    return response;
  }

  let keepAliveTimer: number | null = null;
  let isStreamActive = true;
  let originalReader = originalBody.getReader();

  const transformedStream = new ReadableStream({
    async start(controller) {
      // Recursive function to schedule the next keep-alive message
      const scheduleKeepAlive = () => {
        if (!isStreamActive) {
          return;
        }

        keepAliveTimer = setTimeout(() => {
          if (!isStreamActive) {
            return;
          }

          try {
            controller.enqueue(SSE_KEEP_ALIVE_MESSAGE);
            // Schedule the next keep-alive
            scheduleKeepAlive();
          } catch (error) {
            console.error("Error sending MCP ping notification:", error);
            isStreamActive = false;
          }
        }, keepAliveIntervalMs) as unknown as number;
      };

      // Start the keep-alive cycle
      scheduleKeepAlive();

      // Forward all messages from the original SSE response
      try {
        while (true) {
          const { done, value } = await originalReader.read();
          if (done) {
            break;
          }
          controller.enqueue(value);
        }
      } catch (error) {
        console.error("Error reading from original SSE stream:", error);
        controller.error(error);
      } finally {
        // Clean up when the stream ends
        isStreamActive = false;
        if (keepAliveTimer !== null) {
          clearTimeout(keepAliveTimer);
          keepAliveTimer = null;
        }
        controller.close();
      }
    },
    cancel() {
      // Clean up when the client disconnects
      isStreamActive = false;
      if (keepAliveTimer !== null) {
        clearTimeout(keepAliveTimer);
        keepAliveTimer = null;
      }
      originalReader.cancel();
    }
  });

  // Return a new Response with the transformed stream and original headers
  return new Response(transformedStream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function handleMcpRequest(req: Request, env: Env, ctx: ExecutionContext) {
  const { pathname } = new URL(req.url);

  if (pathname === "/sse") {
    const response = await DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx);
    return wrapSSEResponseWithKeepAlive(response);
  }
  if (pathname === "/sse/message") {
    return DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx);
  }
  if (pathname === "/mcp") {
    return DoitMCPAgent.serve("/mcp").fetch(req, env, ctx);
  }
  return new Response("Not found", { status: 404 });
}

// Helper function to extract token from Authorization header
function extractTokenFromAuthHeader(authHeader: string): string | null {
  if (!authHeader) return null;

  // Support both "Bearer <token>" and just "<token>" formats
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1];
  }

  // If no Bearer prefix, assume the whole header is the token
  return authHeader;
}

// Create the OAuth provider instance
const oauthProvider = new OAuthProvider({
  apiHandler: { fetch: handleMcpRequest as any },
  apiRoute: ["/sse", "/mcp"],
  // @ts-expect-error
  defaultHandler: app,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  accessTokenTTL: 1000 * 60 * 60 * 24 * 24, // 24 days (2,073,600,000 - within 32-bit range)
  tokenExchangeCallback: async ({ grantType, props }) => {
    console.log("tokenExchangeCallback", grantType, props);
    if (grantType === "refresh_token" || grantType === "authorization_code") {
      return {
        newProps: {
          ...props,
          customerContext: props.customerContext,
          apiKey: props.apiKey,
          isDoitUser: props.isDoitUser,
        },
      };
    }
  },
});

// Main request handler that checks for Authorization header
async function handleRequest(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(req.url);
  const authHeader = req.headers.get("Authorization");

  // Check if this is an API route and has Authorization header
  if (
    (url.pathname === "/sse" ||
      url.pathname === "/sse/message" ||
      url.pathname === "/mcp") &&
    authHeader
  ) {
    const token = extractTokenFromAuthHeader(authHeader);
    const customerContext = url.searchParams.get("customerContext") || "";

    if (token && customerContext) {
      console.log("Using Authorization header for authentication");

      ctx.props = {
        ...ctx.props,
        apiKey: token,
        customerContext: customerContext,
      };

      if (url.pathname === "/sse") {
        // Handle the request directly with the modified request
        const response = await DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx);
        return wrapSSEResponseWithKeepAlive(response);
      } else if (url.pathname === "/sse/message") {
        const response = await DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx);
        return response;
      }
      if (url.pathname === "/mcp") {
        return DoitMCPAgent.serve("/mcp").fetch(req, env, ctx);
      }
    }
  }

  // If no Authorization header or not an API route, use the OAuth provider
  return oauthProvider.fetch(req, env, ctx);
}

// Export the main handler as the default
export default {
  fetch: handleRequest,
};
