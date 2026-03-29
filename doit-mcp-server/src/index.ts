import app from "./app";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DurableObject } from "cloudflare:workers";

import { SERVER_NAME_WEB, SERVER_VERSION } from "../../src/utils/consts.js";

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
  CreateReportArgumentsSchema,
  GetReportResultsArgumentsSchema,
  ReportsArgumentsSchema,
  RunQueryArgumentsSchema,
  UpdateReportArgumentsSchema,
  createReportTool,
  getReportResultsTool,
  reportsTool,
  runQueryTool,
  updateReportTool,
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
  CreateTicketArgumentsSchema,
  ListTicketsArgumentsSchema,
  createTicketTool,
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
  GetAssetArgumentsSchema,
  getAssetTool,
  ListAssetsArgumentsSchema,
  listAssetsTool,
} from "../../src/tools/assets.js";
import {
  CreateAlertArgumentsSchema,
  createAlertTool,
  GetAlertArgumentsSchema,
  getAlertTool,
  ListAlertsArgumentsSchema,
  listAlertsTool,
  UpdateAlertArgumentsSchema,
  updateAlertTool,
} from "../../src/tools/alerts.js";
import {
  ChangeCustomerArgumentsSchema,
  changeCustomerTool,
} from "../../src/tools/changeCustomer.js";
import {
  TriggerCloudFlowArgumentsSchema,
  triggerCloudFlowTool,
} from "../../src/tools/cloudflow.js";
import {
  ListOrganizationsArgumentsSchema,
  listOrganizationsTool,
} from "../../src/tools/organizations.js";
import {
  ListPlatformsArgumentsSchema,
  listPlatformsTool,
} from "../../src/tools/platforms.js";
import {
  ListUsersArgumentsSchema,
  listUsersTool,
} from "../../src/tools/users.js";
import {
  ListRolesArgumentsSchema,
  listRolesTool,
} from "../../src/tools/roles.js";
import {
  AssignObjectsToLabelArgumentsSchema,
  assignObjectsToLabelTool,
  CreateLabelArgumentsSchema,
  createLabelTool,
  GetLabelArgumentsSchema,
  GetLabelAssignmentsArgumentsSchema,
  getLabelAssignmentsTool,
  getLabelTool,
  ListLabelsArgumentsSchema,
  listLabelsTool,
  UpdateLabelArgumentsSchema,
  updateLabelTool,
} from "../../src/tools/labels.js";
import {
  ListProductsArgumentsSchema,
  listProductsTool,
} from "../../src/tools/products.js";
import {
  FindCloudDiagramsArgumentsSchema,
  findCloudDiagramsTool,
} from "../../src/tools/cloudDiagrams.js";
import {
  CreateBudgetArgumentsSchema,
  createBudgetTool,
  GetBudgetArgumentsSchema,
  ListBudgetsArgumentsSchema,
  UpdateBudgetArgumentsSchema,
  getBudgetTool,
  listBudgetsTool,
  updateBudgetTool,
} from "../../src/tools/budgets.js";
import {
  CreateAnnotationArgumentsSchema,
  createAnnotationTool,
  GetAnnotationArgumentsSchema,
  getAnnotationTool,
  ListAnnotationsArgumentsSchema,
  listAnnotationsTool,
  UpdateAnnotationArgumentsSchema,
  updateAnnotationTool,
} from "../../src/tools/annotations.js";
import {
  GetDatahubDatasetArgumentsSchema,
  ListDatahubDatasetsArgumentsSchema,
  getDatahubDatasetTool,
  listDatahubDatasetsTool,
} from "../../src/tools/datahubDatasets.js";

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { executeToolHandler, adaptToolResponse } from "../../src/utils/toolsHandler.js";
import { WIDGET_HTML } from "./widgetHtml.js";
import { zodSchemaToMcpTool } from "../../src/utils/util.js";
import { promptsIncludingLegacyNames, resolvePromptMessages } from "../../src/prompts/index.js";

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
    name: SERVER_NAME_WEB,
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
        (rawResult) => adaptToolResponse(toolName, rawResult)
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

      return adaptToolResponse("change_customer", response);
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
    // Guard: this.props may be undefined on the very first connection because
    // McpAgent.onStart() calls _init(stored_props) → init() BEFORE the Worker-side
    // doStub._init(ctx.props) RPC delivers the OAuth props. Tool callbacks read
    // this.props at call-time (after props are set), so registration still works.
    this.props = (this.props ?? {}) as typeof this.props;

    console.log("Initializing Doit MCP Agent", this.props.customerContext);

    // Load persisted props first (no-op if apiKey not available yet)
    await this.loadPersistedProps();

    console.log("After loading persisted props:", this.props.customerContext);

    // Save current props if they exist (for initial OAuth setup)
    if (this.props.apiKey && this.props.customerContext) {
      await this.saveProps();
    }

    // Register prompts
    promptsIncludingLegacyNames.forEach((prompt) => {
      this.server.prompt(prompt.name, prompt.description, async () => ({
        messages: resolvePromptMessages(prompt).map((message) => ({
          role: message.role,
          content: {
            type: "text",
            text: message.text,
          },
        })),
      }));
    });

    // Register the widget as an MCP resource so ChatGPT can load it in the iframe
    const WIDGET_URI = "ui://doit/cloud-intelligence-v1.html";
    this.server.resource(
      "cloud-intelligence-widget",
      WIDGET_URI,
      { mimeType: "text/html;profile=mcp-app" },
      async () => ({
        contents: [{ uri: WIDGET_URI, mimeType: "text/html;profile=mcp-app", text: WIDGET_HTML }],
      })
    );

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
    this.registerTool(createReportTool, CreateReportArgumentsSchema);
    this.registerTool(updateReportTool, UpdateReportArgumentsSchema);

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

    // Allocations tools
    this.registerTool(listAllocationsTool, ListAllocationsArgumentsSchema);
    this.registerTool(getAllocationTool, GetAllocationArgumentsSchema);
    this.registerTool(createAllocationTool, CreateAllocationArgumentsSchema);
    this.registerTool(updateAllocationTool, UpdateAllocationArgumentsSchema);

    // Assets tools
    this.registerTool(listAssetsTool, ListAssetsArgumentsSchema);
    this.registerTool(getAssetTool, GetAssetArgumentsSchema);

    // CloudFlow tools
    this.registerTool(triggerCloudFlowTool, TriggerCloudFlowArgumentsSchema);

    // Alerts tools
    this.registerTool(listAlertsTool, ListAlertsArgumentsSchema);
    this.registerTool(getAlertTool, GetAlertArgumentsSchema);
    this.registerTool(createAlertTool, CreateAlertArgumentsSchema);
    this.registerTool(updateAlertTool, UpdateAlertArgumentsSchema);


    // Organizations tools
    this.registerTool(listOrganizationsTool, ListOrganizationsArgumentsSchema);

    // Platforms tools
    this.registerTool(listPlatformsTool, ListPlatformsArgumentsSchema);

    // Users tools
    this.registerTool(listUsersTool, ListUsersArgumentsSchema);

    // Roles tools
    this.registerTool(listRolesTool, ListRolesArgumentsSchema);

    // Products tools
    this.registerTool(listProductsTool, ListProductsArgumentsSchema);

    // Labels tools
    this.registerTool(listLabelsTool, ListLabelsArgumentsSchema);
    this.registerTool(getLabelTool, GetLabelArgumentsSchema);
    this.registerTool(createLabelTool, CreateLabelArgumentsSchema);
    this.registerTool(updateLabelTool, UpdateLabelArgumentsSchema);
    this.registerTool(getLabelAssignmentsTool, GetLabelAssignmentsArgumentsSchema);
    this.registerTool(assignObjectsToLabelTool, AssignObjectsToLabelArgumentsSchema);

    // DataHub Datasets tools
    this.registerTool(listDatahubDatasetsTool, ListDatahubDatasetsArgumentsSchema);
    this.registerTool(getDatahubDatasetTool, GetDatahubDatasetArgumentsSchema);

    // Cloud Diagrams tools
    this.registerTool(findCloudDiagramsTool, FindCloudDiagramsArgumentsSchema);

    // Budgets tools
    this.registerTool(listBudgetsTool, ListBudgetsArgumentsSchema);
    this.registerTool(getBudgetTool, GetBudgetArgumentsSchema);
    this.registerTool(createBudgetTool, CreateBudgetArgumentsSchema);
    this.registerTool(updateBudgetTool, UpdateBudgetArgumentsSchema);

    // Annotations tools
    this.registerTool(listAnnotationsTool, ListAnnotationsArgumentsSchema);
    this.registerTool(getAnnotationTool, GetAnnotationArgumentsSchema);
    this.registerTool(createAnnotationTool, CreateAnnotationArgumentsSchema);
    this.registerTool(updateAnnotationTool, UpdateAnnotationArgumentsSchema);

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
  const url = new URL(req.url);
  const { pathname } = url;

  // SSE transport: GET /sse opens the event stream; POST /sse/message sends messages
  if (pathname === "/sse" && req.method === "GET") {
    const response = await DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx);
    return wrapSSEResponseWithKeepAlive(response);
  }
  if (pathname === "/sse/message") {
    return DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx);
  }

  // StreamableHTTP transport: POST /mcp (native) or POST /sse (ChatGPT tries the
  // configured MCP URL with POST first per the new MCP spec).
  // Rewrite /sse → /mcp so the agents SDK basePattern matches.
  if (pathname === "/mcp" || (pathname === "/sse" && req.method === "POST")) {
    const mcpReq =
      pathname === "/sse"
        ? new Request(
            Object.assign(new URL(req.url), { pathname: "/mcp" }).toString(),
            req
          )
        : req;
    return DoitMCPAgent.serve("/mcp").fetch(mcpReq, env, ctx);
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
  accessTokenTTL: 60 * 60 * 24 * 30, // 30 days in seconds (OAuthProvider uses seconds, not ms)
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

  // Serve OAuth discovery endpoints unauthenticated at ANY path prefix.
  // Per RFC 9728/8414, ChatGPT appends these well-known paths to the MCP server URL
  // (e.g. /sse/.well-known/oauth-protected-resource), but the OAuthProvider
  // intercepts /sse/* and demands auth. We handle them here before the provider sees it.
  //
  // Use the Host request header (not url.origin) because wrangler dev rewrites request.url
  // to use the route pattern host (mcp.doit.com) regardless of the actual incoming host.
  // The Host header correctly reflects the public URL (ngrok, cloudflare tunnel, or prod).
  if (url.pathname.endsWith("/.well-known/oauth-protected-resource") ||
      url.pathname.endsWith("/.well-known/oauth-authorization-server")) {
    // PUBLIC_URL overrides everything — required for local dev via tunnel because
    // wrangler dev rewrites request.url and Host to the route pattern (mcp.doit.com).
    const base = (env as any).PUBLIC_URL ||
      (() => {
        const host = req.headers.get("host") || url.host;
        const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
        return `${isLocal ? "http" : "https"}://${host}`;
      })();

    if (url.pathname.endsWith("/.well-known/oauth-protected-resource")) {
      return Response.json({
        resource: base,
        authorization_servers: [base],
        scopes_supported: ["read_profile", "read_data", "write_data"],
      });
    }
    return Response.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      revocation_endpoint: `${base}/token`,
      scopes_supported: ["read_profile", "read_data", "write_data"],
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
      code_challenge_methods_supported: ["S256"],
    });
  }

  // If no Authorization header or not an API route, use the OAuth provider
  return oauthProvider.fetch(req, env, ctx);
}

// Export the main handler as the default
export default {
  fetch: handleRequest,
};
