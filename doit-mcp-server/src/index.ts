import app from "./app";
import {
  type BearerEnv,
  verifyBearer,
  wwwAuthenticateHeaderForResource,
} from "./oauth/bearerMiddleware";
import {
  exchangeMcpTokenForUpstreamToken,
  type TokenExchangeEnv,
} from "./oauth/tokenExchange";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DurableObject } from "cloudflare:workers";

import { SERVER_NAME_WEB, SERVER_VERSION } from "../../src/utils/consts.js";
import { configureDoiTApiBase } from "../../src/utils/util.js";
import { DEMO_TOKEN } from "../../src/utils/demoData.js";

import {
  CloudIncidentsArgumentsSchema,
  CloudIncidentArgumentsSchema,
  cloudIncidentTool,
  cloudIncidentsTool,
} from "../../src/tools/cloudIncidents.js";
import {
  cloudOverviewTool,
  CloudOverviewArgumentsSchema,
} from "../../src/tools/overview.js";
import {
  AnomaliesArgumentsSchema,
  AnomalyArgumentsSchema,
  anomaliesTool,
  anomalyTool,
} from "../../src/tools/anomalies.js";
import {
  AskAvaSyncArgumentsSchema,
  askAvaSyncTool,
} from "../../src/tools/ava.js";
import {
  CreateReportArgumentsSchema,
  GetReportConfigArgumentsSchema,
  GetReportResultsArgumentsSchema,
  ReportsArgumentsSchema,
  RunQueryArgumentsSchema,
  UpdateReportArgumentsSchema,
  createReportTool,
  getReportConfigTool,
  getReportResultsTool,
  reportsTool,
  runQueryTool,
  updateReportTool,
} from "../../src/tools/reports.js";
import {
  CostBreakdownArgumentsSchema,
  CostTrendArgumentsSchema,
  CompareSpendArgumentsSchema,
  costBreakdownTool,
  costTrendTool,
  compareSpendTool,
} from "../../src/tools/queryHelpers.js";
import {
  ListInsightsArgumentsSchema,
  GetInsightResourcesArgumentsSchema,
  listOptimizationRecommendationsTool,
  getInsightResourcesTool,
} from "../../src/tools/insights.js";
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
  createTicketTool,
  CreateTicketCommentArgumentsSchema,
  createTicketCommentTool,
  GetTicketArgumentsSchema,
  getTicketTool,
  ListTicketCommentsArgumentsSchema,
  listTicketCommentsTool,
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
  GetAssetArgumentsSchema,
  getAssetTool,
  ListAssetsArgumentsSchema,
  listAssetsTool,
} from "../../src/tools/assets.js";
import {
  SearchCustomersArgumentsSchema,
  searchCustomersTool,
} from "../../src/tools/searchCustomers.js";
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
// Re-enable alongside the WRITE_GATED_SUMMARIES entry in utils/toolsHandler.ts
// and the registerTool() call further down.
// import {
//   ConfirmActionArgumentsSchema,
//   confirmActionTool,
// } from "../../src/tools/confirmAction.js";
import {
  ListOrganizationsArgumentsSchema,
  listOrganizationsTool,
} from "../../src/tools/organizations.js";
import {
  ListPlatformsArgumentsSchema,
  listPlatformsTool,
} from "../../src/tools/platforms.js";
import {
  InviteUserArgumentsSchema,
  inviteUserTool,
  ListUsersArgumentsSchema,
  listUsersTool,
  UpdateUserArgumentsSchema,
  updateUserTool,
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
  GetFolderArgumentsSchema,
  getFolderTool,
  ListFoldersArgumentsSchema,
  listFoldersTool,
} from "../../src/tools/folders.js";
import {
  GetThemeArgumentsSchema,
  getThemeTool,
  ListThemesArgumentsSchema,
  listThemesTool,
} from "../../src/tools/themes.js";
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
  GetCommitmentArgumentsSchema,
  getCommitmentTool,
  ListCommitmentsArgumentsSchema,
  listCommitmentsTool,
} from "../../src/tools/commitmentManager.js";
import {
  CreateDatahubDatasetArgumentsSchema,
  GetDatahubDatasetArgumentsSchema,
  ListDatahubDatasetsArgumentsSchema,
  UpdateDatahubDatasetArgumentsSchema,
  createDatahubDatasetTool,
  getDatahubDatasetTool,
  listDatahubDatasetsTool,
  updateDatahubDatasetTool,
} from "../../src/tools/datahubDatasets.js";
import {
  SendDatahubEventsArgumentsSchema,
  sendDatahubEventsTool,
} from "../../src/tools/datahubEvents.js";

import type { ApprovalStore } from "../../src/utils/approval.js";
import { executeToolHandler } from "../../src/utils/toolsHandler.js";
import {
  type TrackingContext,
  runWithConsoleEnv,
  runWithTracking,
} from "../../src/utils/util.js";
import { DurableObjectApprovalStore } from "./durableObjectApprovalStore.js";
import {
  getErrorMessage,
  getMcpDiagnosticsMessage,
  getMcpTraceContext,
  getMcpTraceId,
  installMcpMethodDiagnosticsFromServer,
  isMcpDiagnosticsPath,
  logMcpRequestComplete,
  logMcpRequestError,
  logMcpRoute,
  MCP_TRACE_ID_HEADER,
  withMcpTraceId,
} from "./mcpDiagnostics.js";
import { adaptToolResponse } from "./responseAdapter.js";
import { WIDGET_URI } from "./responseAdapter.js";
import {
  promptsIncludingLegacyNames,
  resolvePromptMessages,
} from "../../src/prompts/index.js";
import {
  resolveAuthServerUrl,
  resolveMcpResourceUrl,
  shouldUseConsoleProxy,
  type ConsoleProxyBinding,
  type DoitWorkerEnv,
  type UiDomainProvider,
} from "./runtimeEnv.js";
import {
  buildFallbackWidgetResourceContent,
  buildWidgetResourceContent,
  classifyUiDomainProvider,
  resolvePublicMcpUrl,
  resolveWidgetFetchOrigin,
  type WidgetResourceContent,
  WIDGET_RESOURCE_MIME_TYPE,
} from "./widgetResource.js";

const KEEP_ALIVE_INTERVAL_MS = 120_000; // 2 minutes in milliseconds

// Create an MCP ping notification JSON-RPC message
// This is a notification (no id field) that MCP clients can safely handle.
const MCP_NOTIFICATIONS_PING = {
  jsonrpc: "2.0",
  method: "notifications/ping",
};

// SSE message to send the MCP ping notification and keep the connection alive.
const SSE_KEEP_ALIVE_MESSAGE = new TextEncoder().encode(
  `event: message\ndata: ${JSON.stringify(MCP_NOTIFICATIONS_PING)}\n\n`,
);
const SESSION_UI_DOMAIN_PROVIDER_KEY = "sessionUiDomainProvider";
const MCP_CORS_ALLOW_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "cache-control",
  "mcp-session-id",
  "mcp-protocol-version",
  "last-event-id",
  MCP_TRACE_ID_HEADER,
].join(", ");
const MCP_CORS_EXPOSE_HEADERS = [
  "WWW-Authenticate",
  "mcp-session-id",
  MCP_TRACE_ID_HEADER,
].join(", ");
const MCP_CORS_VARY_HEADERS =
  "Origin, Access-Control-Request-Headers, Access-Control-Request-Method";

function isMcpDiscoveryPath(pathname: string): boolean {
  return pathname.endsWith("/.well-known/oauth-protected-resource");
}

function withMcpCorsHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const existingVary = headers.get("Vary");

  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  headers.set("Access-Control-Allow-Headers", MCP_CORS_ALLOW_HEADERS);
  headers.set("Access-Control-Expose-Headers", MCP_CORS_EXPOSE_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
  headers.set(
    "Vary",
    existingVary
      ? `${existingVary}, ${MCP_CORS_VARY_HEADERS}`
      : MCP_CORS_VARY_HEADERS,
  );

  return headers;
}

function mcpCorsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: withMcpCorsHeaders(),
  });
}

function withMcpCors(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withMcpCorsHeaders(response.headers),
  });
}

function logWidgetResourceError(
  message: string,
  error: unknown,
  context: {
    mcpClient?: string;
    mcpClientVersion?: string;
    sessionProvider?: UiDomainProvider;
    hasWorkerUrl: boolean;
    hasPublicMcpUrl: boolean;
    hasClaudeUiDomain: boolean;
    hasOpenAiUiDomain: boolean;
  },
) {
  console.error(
    message,
    {
      reason: getErrorMessage(error),
      ...context,
    },
    error,
  );
}

// Per-apiKey customer-context persistence for legacy (API-key) sessions, keyed by
// `idFromName(apiKey)`. Mirrors main: a Do'er's change_customer selection survives
// reconnects. OAuth sessions do NOT use this (their context is sealed in the JWT).
export class ContextStorage extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async saveContext(customerContext: string): Promise<void> {
    await this.ctx.storage.put("customerContext", customerContext);
  }

  async loadContext(): Promise<string | null> {
    const context = await this.ctx.storage.get<string>("customerContext");
    return context || null;
  }
}

export class DoitMCPAgent extends McpAgent {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    configureDoiTApiBase((env as { DOIT_API_BASE?: string }).DOIT_API_BASE);
  }

  server = new McpServer(
    {
      name: SERVER_NAME_WEB,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        resources: {},
      },
    },
  );

  // Per-instance MCP client info — stored on the DO instance, not a module global,
  // so there is no cross-session bleed between DO instances sharing the same isolate.
  private _mcpClientInfo: TrackingContext = {};
  private _sessionUiDomainProvider?: UiDomainProvider;
  private _registeredPromptCount = 0;
  private _registeredResourceCount = 0;
  private _registeredToolCount = 0;

  // Per-instance approval store for the two-phase destructive-tool commit flow.
  // Backed by `this.ctx.storage` (DurableObject storage) so that a staged action
  // survives isolate eviction between the initial destructive call and the matching
  // `confirm_action`. Lazily created on first use so test harnesses that instantiate
  // the class without a full DO context don't crash at construction time.
  private _approvalStore: ApprovalStore | null = null;
  private getApprovalStore(): ApprovalStore {
    if (!this._approvalStore) {
      this._approvalStore = new DurableObjectApprovalStore(this.ctx.storage);
    }
    return this._approvalStore;
  }

  private upstreamTokenCache?: {
    mcpAccessToken: string;
    upstreamAccessToken: string;
    expiresAtSeconds: number;
  };

  // Helper method to get the token used for upstream DoiT API calls.
  // Legacy connections keep using the provided API key. OAuth connections must
  // exchange the MCP-scoped token for a separate upstream token before calling
  // DoiT APIs, per the MCP authorization spec.
  private async getToken(): Promise<string> {
    const token = this.props.apiKey as string;
    const authMethod = this.props.authMethod as string | undefined;
    console.info("[mcp] resolving upstream DoiT API token", {
      authMethod,
      hasToken: Boolean(token),
      hasCachedUpstreamToken: Boolean(this.upstreamTokenCache),
    });
    // Demo sessions use the sentinel token directly; the upstream demo path in
    // util.ts keys off DEMO_TOKEN and must not go through token exchange.
    if (token === DEMO_TOKEN) {
      console.info("[mcp] using demo token for upstream DoiT API calls");
      return token;
    }

    // Legacy API-key sessions: the key IS the upstream DoiT API credential, so use
    // it directly — no MCP→upstream token exchange (that's only for OAuth tokens).
    if (authMethod === "apikey") {
      console.info("[mcp] using legacy API key for upstream DoiT API calls");
      return token;
    }

    const now = Math.floor(Date.now() / 1000);
    if (
      this.upstreamTokenCache?.mcpAccessToken === token &&
      this.upstreamTokenCache.expiresAtSeconds > now + 30
    ) {
      console.info("[mcp] using cached upstream DoiT API token", {
        expiresAtSeconds: this.upstreamTokenCache.expiresAtSeconds,
        now,
      });
      return this.upstreamTokenCache.upstreamAccessToken;
    }

    console.info(
      "[mcp] exchanging OAuth MCP token for upstream DoiT API token",
      {
        authMethod,
        cachePresentForDifferentToken: Boolean(
          this.upstreamTokenCache &&
          this.upstreamTokenCache.mcpAccessToken !== token,
        ),
      },
    );
    const exchanged = await exchangeMcpTokenForUpstreamToken({
      mcpToken: token,
      env: this.env as TokenExchangeEnv,
    });

    this.upstreamTokenCache = {
      mcpAccessToken: token,
      upstreamAccessToken: exchanged.accessToken,
      expiresAtSeconds: now + exchanged.expiresIn,
    };

    return exchanged.accessToken;
  }

  // Persist the legacy session's customerContext to the ContextStorage DO,
  // keyed by apiKey, so a change_customer selection survives reconnects (mirrors
  // main). No-op when CONTEXT_STORAGE is unbound (e.g. test harnesses).
  private async saveProps(): Promise<void> {
    const env = this.env as DoitWorkerEnv;
    const apiKey = this.props.apiKey as string;
    const customerContext = this.props.customerContext as string;
    if (apiKey && env?.CONTEXT_STORAGE) {
      const id = env.CONTEXT_STORAGE.idFromName(apiKey);
      const contextStorage = env.CONTEXT_STORAGE.get(id);
      await contextStorage.saveContext(customerContext);
    }
  }

  // Load the persisted customerContext for this apiKey from the ContextStorage DO.
  // Returns the persisted value (and updates this.props) when present, else the
  // current in-memory context. Used only on legacy (API-key) sessions.
  private async loadPersistedProps(): Promise<string | null> {
    const env = this.env as DoitWorkerEnv;
    const apiKey = this.props.apiKey as string;
    if (apiKey && env?.CONTEXT_STORAGE) {
      const id = env.CONTEXT_STORAGE.idFromName(apiKey);
      const contextStorage = env.CONTEXT_STORAGE.get(id);
      const persisted = await contextStorage.loadContext();
      if (persisted) {
        this.props.customerContext = persisted;
        return persisted;
      }
    }
    return (this.props.customerContext as string) || null;
  }

  private async persistSessionUiDomainProvider(
    provider: UiDomainProvider,
  ): Promise<void> {
    if (provider === "omit") {
      return;
    }

    this._sessionUiDomainProvider = provider;
    await this.ctx.storage.put(SESSION_UI_DOMAIN_PROVIDER_KEY, provider);
  }

  private async loadPersistedSessionUiDomainProvider(): Promise<
    UiDomainProvider | undefined
  > {
    try {
      const provider = await this.ctx.storage.get<UiDomainProvider>(
        SESSION_UI_DOMAIN_PROVIDER_KEY,
      );

      if (provider === "claude" || provider === "openai") {
        this._sessionUiDomainProvider = provider;
        return provider;
      }
    } catch (error) {
      console.error(
        "[widget] failed to load persisted UI domain provider",
        {
          reason: getErrorMessage(error),
        },
        error,
      );
    }

    return undefined;
  }

  // Generic callback factory for tools
  private createToolCallback(toolName: string) {
    return async (args: any) => {
      const token = await this.getToken();
      let customerContext = this.props.customerContext as string;

      // Legacy DoiT-employee sessions persist customerContext per-key in
      // ContextStorage (mirrors main); load it so a prior change_customer selection
      // is applied. Regular customer keys are pinned to their own domain (no
      // change_customer), and OAuth sessions keep the JWT-sealed context in memory.
      if (
        this.props.authMethod === "apikey" &&
        this.props.isDoitUser === "true"
      ) {
        try {
          customerContext =
            (await this.loadPersistedProps()) || customerContext;
        } catch (error) {
          console.error(
            "[mcp] loadPersistedProps failed during tool call",
            { reason: getErrorMessage(error), toolName },
            error,
          );
        }
      }

      const argsWithCustomerContext = {
        ...args,
        customerContext,
      };

      // Console-targeting tools (e.g. search_customers) call console.doit.com /api/...
      // which in prod must go through the CONSOLE_PROXY service binding. Expose that to
      // the tool layer for the duration of this call; api.doit.com tools ignore it.
      const workerEnv = this.env as DoitWorkerEnv & {
        CONSOLE_PROXY?: ConsoleProxyBinding;
      };
      const consoleBaseUrl =
        workerEnv.DOIT_CONSOLE_BASE ?? resolveAuthServerUrl(workerEnv);
      const consoleProxy = workerEnv.CONSOLE_PROXY;
      const consoleProxyFetch =
        consoleProxy && shouldUseConsoleProxy(workerEnv, consoleBaseUrl)
          ? (((input: any, init?: any) =>
              consoleProxy.fetch(input, init)) as typeof fetch)
          : undefined;

      const result = await runWithConsoleEnv(
        { baseUrl: consoleBaseUrl, proxyFetch: consoleProxyFetch },
        () =>
          executeToolHandler(toolName, argsWithCustomerContext, token, {
            trackingContext: this._mcpClientInfo,
            convertResponse: (rawResult) =>
              adaptToolResponse(toolName, rawResult),
            // The identity the approval flow is bound to. `props.apiKey` is the
            // OAuth-derived DoiT API key and is per-user, so staged actions cannot
            // be consumed across users even if a token somehow leaked.
            userKey: token,
            approvalStore: this.getApprovalStore(),
          }),
      );
      return result;
    };
  }

  // Special callback for changeCustomer tool
  private createChangeCustomerCallback() {
    return async (args: any) => {
      const token = await this.getToken();
      const { handleChangeCustomerRequest } =
        await import("../../src/tools/changeCustomer.js");

      // Update the customer context. Legacy API-key sessions persist the switch
      // per-apiKey in ContextStorage (mirrors main), so it survives reconnects.
      // Under OAuth there is no durable persistence — a reconnect reverts to the
      // customer context sealed in the JWT.
      const updateCustomerContext = async (newContext: string) => {
        this.props.customerContext = newContext;
        if (this.props.authMethod === "apikey") {
          await this.saveProps();
        }
      };

      // change_customer bypasses executeToolHandler, so wrap manually with tracking context.
      return runWithTracking(
        { ...this._mcpClientInfo, mcpTool: "change_customer" },
        async () => {
          const response = await handleChangeCustomerRequest(
            args,
            token,
            updateCustomerContext,
          );
          return adaptToolResponse("change_customer", response);
        },
      );
    };
  }

  // Generic tool registration helper — includes _meta so ChatGPT knows to open the widget.
  // Both "ui/resourceUri" (flat key) and "ui.resourceUri" (nested) are set to match what
  // registerAppTool() from @modelcontextprotocol/ext-apps normalises.
  private registerTool(tool: any, schema: any) {
    (this.server as any).registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: schema.shape,
        annotations: tool.annotations,
        _meta: {
          ...tool._meta,
          "ui/resourceUri": WIDGET_URI,
          "openai/outputTemplate": WIDGET_URI,
          ui: { ...(tool._meta?.ui ?? {}), resourceUri: WIDGET_URI },
        },
      },
      this.createToolCallback(tool.name),
    );
    this._registeredToolCount += 1;
  }

  private registerWidgetResource() {
    const env = this.env as DoitWorkerEnv;
    this.server.resource(
      "cloud-intelligence-widget",
      WIDGET_URI,
      { mimeType: WIDGET_RESOURCE_MIME_TYPE },
      async () => {
        if (!this._mcpClientInfo.mcpClient && !this._sessionUiDomainProvider) {
          await this.loadPersistedSessionUiDomainProvider();
        }
        const logContext = {
          mcpClient: this._mcpClientInfo.mcpClient,
          mcpClientVersion: this._mcpClientInfo.mcpClientVersion,
          sessionProvider: this._sessionUiDomainProvider,
          hasWorkerUrl: Boolean(env.WORKER_URL),
          hasPublicMcpUrl: Boolean(env.PUBLIC_MCP_URL),
          hasClaudeUiDomain: Boolean(env.CLAUDE_UI_DOMAIN),
          hasOpenAiUiDomain: Boolean(env.OPENAI_UI_DOMAIN),
        };
        let widgetFetchOrigin: string;
        let publicMcpUrl: string;
        try {
          widgetFetchOrigin = resolveWidgetFetchOrigin(env);
          publicMcpUrl = resolvePublicMcpUrl(env, widgetFetchOrigin);
        } catch (error) {
          logWidgetResourceError(
            "[widget] config resolution failed",
            error,
            logContext,
          );
          return {
            contents: [buildFallbackWidgetResourceContent(WIDGET_URI)],
          };
        }

        console.log("[widget] resources/read called for", WIDGET_URI, {
          mcpClient: this._mcpClientInfo.mcpClient,
          mcpClientVersion: this._mcpClientInfo.mcpClientVersion,
          sessionProvider: this._sessionUiDomainProvider,
          widgetFetchOrigin,
          publicMcpUrl,
        });
        let resourceContent: WidgetResourceContent;
        try {
          resourceContent = await buildWidgetResourceContent({
            widgetUri: WIDGET_URI,
            mcpClient: this._mcpClientInfo.mcpClient,
            sessionProvider: this._sessionUiDomainProvider,
            widgetFetchOrigin,
            publicMcpUrl,
            env,
          });
        } catch (error) {
          logWidgetResourceError(
            "[widget] resource content build failed",
            error,
            logContext,
          );
          resourceContent = buildFallbackWidgetResourceContent(WIDGET_URI);
        }
        return {
          contents: [resourceContent],
        };
      },
    );
    this._registeredResourceCount += 1;
  }

  private installMcpMethodDiagnostics() {
    installMcpMethodDiagnosticsFromServer(this.server.server);
  }

  async init() {
    // Guard: this.props may be undefined on the very first connection because
    // McpAgent.onStart() calls _init(stored_props) → init() BEFORE the Worker-side
    // doStub._init(ctx.props) RPC delivers the OAuth props. Tool callbacks read
    // this.props at call-time (after props are set), so registration still works.
    this.props = (this.props ?? {}) as typeof this.props;
    this._registeredPromptCount = 0;
    this._registeredResourceCount = 0;
    this._registeredToolCount = 0;

    console.log(getMcpDiagnosticsMessage("init start"), {
      serverName: SERVER_NAME_WEB,
      serverVersion: SERVER_VERSION,
      hasApiKey: Boolean(this.props.apiKey),
      hasCustomerContext: Boolean(this.props.customerContext),
      isDoitUser: this.props.isDoitUser,
    });

    console.log(getMcpDiagnosticsMessage("initializing agent"), {
      hasCustomerContext: Boolean(this.props.customerContext),
    });

    // Capture MCP client identity for tracking query params.
    // Stored on the DO instance (_mcpClientInfo), not a module global, to avoid cross-session
    // bleed between DO instances that may share the same isolate.
    // Note: mcpProtocolVersion is intentionally omitted — the MCP SDK's oninitialized callback
    // takes no arguments and getClientVersion() only returns { name, version }. The SDK
    // computes the negotiated protocol version in _oninitialize() but discards it without
    // storing it. The STDIO path has direct access via InitializeRequest params; SSE does not.
    this.server.server.oninitialized = () => {
      const clientInfo = this.server.server.getClientVersion();
      this._mcpClientInfo = {
        mcpClient: clientInfo?.name,
        mcpClientVersion: clientInfo?.version,
      };
      const provider = classifyUiDomainProvider(clientInfo?.name);
      if (provider !== "omit") {
        void this.persistSessionUiDomainProvider(provider).catch((error) => {
          console.error(
            "[mcp] failed to persist session UI domain provider",
            error,
          );
        });
      }
      console.log("[mcp] initialized client", {
        ...this._mcpClientInfo,
        sessionProvider: this._sessionUiDomainProvider,
      });
    };

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
      this._registeredPromptCount += 1;
    });

    // Cloud Overview tool
    this.registerTool(cloudOverviewTool, CloudOverviewArgumentsSchema);

    // Cloud Incidents tools
    this.registerTool(cloudIncidentsTool, CloudIncidentsArgumentsSchema);
    this.registerTool(cloudIncidentTool, CloudIncidentArgumentsSchema);

    // Anomalies tools
    this.registerTool(anomaliesTool, AnomaliesArgumentsSchema);
    this.registerTool(anomalyTool, AnomalyArgumentsSchema);

    // Reports tools
    this.registerTool(reportsTool, ReportsArgumentsSchema);
    this.registerTool(runQueryTool, RunQueryArgumentsSchema);
    this.registerTool(costBreakdownTool, CostBreakdownArgumentsSchema);
    this.registerTool(costTrendTool, CostTrendArgumentsSchema);
    this.registerTool(compareSpendTool, CompareSpendArgumentsSchema);
    this.registerTool(
      listOptimizationRecommendationsTool,
      ListInsightsArgumentsSchema,
    );
    this.registerTool(
      getInsightResourcesTool,
      GetInsightResourcesArgumentsSchema,
    );
    this.registerTool(getReportResultsTool, GetReportResultsArgumentsSchema);
    this.registerTool(getReportConfigTool, GetReportConfigArgumentsSchema);
    this.registerTool(createReportTool, CreateReportArgumentsSchema);
    this.registerTool(updateReportTool, UpdateReportArgumentsSchema);

    // Validation tool
    this.registerTool(validateUserTool, ValidateUserArgumentsSchema);

    // Dimensions tools
    this.registerTool(dimensionsTool, DimensionsArgumentsSchema);
    this.registerTool(dimensionTool, DimensionArgumentsSchema);

    // Tickets tools
    this.registerTool(listTicketsTool, ListTicketsArgumentsSchema);
    this.registerTool(getTicketTool, GetTicketArgumentsSchema);
    this.registerTool(
      listTicketCommentsTool,
      ListTicketCommentsArgumentsSchema,
    );
    this.registerTool(
      createTicketCommentTool,
      CreateTicketCommentArgumentsSchema,
    );
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
    this.registerTool(searchCustomersTool, SearchCustomersArgumentsSchema);

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
    this.registerTool(updateUserTool, UpdateUserArgumentsSchema);
    this.registerTool(inviteUserTool, InviteUserArgumentsSchema);

    // Roles tools
    this.registerTool(listRolesTool, ListRolesArgumentsSchema);

    // Products tools
    this.registerTool(listProductsTool, ListProductsArgumentsSchema);

    // Labels tools
    this.registerTool(listLabelsTool, ListLabelsArgumentsSchema);
    this.registerTool(getLabelTool, GetLabelArgumentsSchema);
    this.registerTool(createLabelTool, CreateLabelArgumentsSchema);
    this.registerTool(updateLabelTool, UpdateLabelArgumentsSchema);
    this.registerTool(
      getLabelAssignmentsTool,
      GetLabelAssignmentsArgumentsSchema,
    );
    this.registerTool(
      assignObjectsToLabelTool,
      AssignObjectsToLabelArgumentsSchema,
    );

    // Folders tools
    this.registerTool(listFoldersTool, ListFoldersArgumentsSchema);
    this.registerTool(getFolderTool, GetFolderArgumentsSchema);

    // Themes tools
    this.registerTool(listThemesTool, ListThemesArgumentsSchema);
    this.registerTool(getThemeTool, GetThemeArgumentsSchema);

    // DataHub Datasets tools
    this.registerTool(
      listDatahubDatasetsTool,
      ListDatahubDatasetsArgumentsSchema,
    );
    this.registerTool(getDatahubDatasetTool, GetDatahubDatasetArgumentsSchema);
    this.registerTool(
      createDatahubDatasetTool,
      CreateDatahubDatasetArgumentsSchema,
    );
    this.registerTool(
      updateDatahubDatasetTool,
      UpdateDatahubDatasetArgumentsSchema,
    );
    this.registerTool(sendDatahubEventsTool, SendDatahubEventsArgumentsSchema);

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

    // Commitment Manager tools
    this.registerTool(listCommitmentsTool, ListCommitmentsArgumentsSchema);
    this.registerTool(getCommitmentTool, GetCommitmentArgumentsSchema);

    // AVA tools
    this.registerTool(askAvaSyncTool, AskAvaSyncArgumentsSchema);

    // Approval flow — exposed so the LLM can finalize destructive actions that
    // were previously staged by other tools. See src/tools/confirmAction.ts.
    // Currently disabled along with the WRITE_GATED_SUMMARIES gate; no tool
    // mints approval tokens, so there's nothing for clients to confirm.
    // this.registerTool(confirmActionTool, ConfirmActionArgumentsSchema);

    // Change Customer tool (requires special handling). Registered only for DoiT
    // employees through OAuth's doit_employee JWT claim. Regular customers never
    // see this employee-only tool.
    if (this.props.isDoitUser === "true") {
      (this.server as any).registerTool(
        changeCustomerTool.name,
        {
          description: changeCustomerTool.description,
          inputSchema: ChangeCustomerArgumentsSchema.shape,
          annotations: changeCustomerTool.annotations,
          _meta: {
            ...changeCustomerTool._meta,
            "ui/resourceUri": WIDGET_URI,
            "openai/outputTemplate": WIDGET_URI,
            ui: {
              ...((changeCustomerTool._meta as any)?.ui ?? {}),
              resourceUri: WIDGET_URI,
            },
          },
        },
        this.createChangeCustomerCallback(),
      );
      this._registeredToolCount += 1;
    }

    try {
      this.registerWidgetResource();
    } catch (error) {
      console.error(
        "[widget] failed to register widget resource",
        {
          reason: getErrorMessage(error),
        },
        error,
      );
    }
    this.installMcpMethodDiagnostics();

    console.log(getMcpDiagnosticsMessage("registered capabilities"), {
      toolCount: this._registeredToolCount,
      promptCount: this._registeredPromptCount,
      resourceCount: this._registeredResourceCount,
      hasChangeCustomerTool: this.props.isDoitUser === "true",
      hasApiKey: Boolean(this.props.apiKey),
      hasCustomerContext: Boolean(this.props.customerContext),
      isDoitUser: this.props.isDoitUser,
    });

    console.log(getMcpDiagnosticsMessage("init complete"), {
      hasApiKey: Boolean(this.props.apiKey),
      hasCustomerContext: Boolean(this.props.customerContext),
      isDoitUser: this.props.isDoitUser,
      sessionProvider: this._sessionUiDomainProvider,
    });
  }
}

/**
 * Helper function to wrap SSE response stream with keep-alive messages,
 * this is used to keep the connection alive for the client.
 * Returns a wrapped response whose body stream sends all the messages from the original
 * response, plus an internal timer to send keep-alive messages at regular intervals.
 * @param response The original SSE response to wrap
 * @param traceId Trace ID used to correlate SSE lifecycle diagnostics
 * @param keepAliveIntervalMs Optional interval in milliseconds between keep-alive messages
 */
function wrapSSEResponseWithKeepAlive(
  response: Response,
  traceId: string,
  keepAliveIntervalMs: number = KEEP_ALIVE_INTERVAL_MS,
): Response {
  const originalBody = response.body;

  if (!originalBody) {
    console.log(getMcpDiagnosticsMessage("sse stream missing body", traceId), {
      ...getMcpTraceContext(traceId),
      status: response.status,
    });
    return response;
  }

  let keepAliveTimer: number | null = null;
  let isStreamActive = true;
  let streamCanceled = false;
  let originalReader = originalBody.getReader();

  const transformedStream = new ReadableStream({
    async start(controller) {
      console.log(getMcpDiagnosticsMessage("sse stream start", traceId), {
        ...getMcpTraceContext(traceId),
      });

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
            console.error(
              getMcpDiagnosticsMessage("sse keepalive enqueue error", traceId),
              {
                ...getMcpTraceContext(traceId),
                reason: getErrorMessage(error),
              },
              error,
            );
            isStreamActive = false;
          }
        }, keepAliveIntervalMs) as unknown as number;
      };

      // Start the keep-alive cycle
      scheduleKeepAlive();

      // Forward all messages from the original SSE response
      let streamErrored = false;
      try {
        while (true) {
          const { done, value } = await originalReader.read();
          if (done) {
            console.log(getMcpDiagnosticsMessage("sse stream done", traceId), {
              ...getMcpTraceContext(traceId),
            });
            break;
          }
          controller.enqueue(value);
        }
      } catch (error) {
        console.error(
          getMcpDiagnosticsMessage("sse stream read error", traceId),
          {
            ...getMcpTraceContext(traceId),
            reason: getErrorMessage(error),
          },
          error,
        );
        streamErrored = true;
        controller.error(error);
      } finally {
        // Clean up when the stream ends
        isStreamActive = false;
        if (keepAliveTimer !== null) {
          clearTimeout(keepAliveTimer);
          keepAliveTimer = null;
        }
        if (!streamErrored && !streamCanceled) {
          controller.close();
        }
      }
    },
    cancel() {
      console.log(getMcpDiagnosticsMessage("sse stream cancel", traceId), {
        ...getMcpTraceContext(traceId),
      });

      // Clean up when the client disconnects
      isStreamActive = false;
      streamCanceled = true;
      if (keepAliveTimer !== null) {
        clearTimeout(keepAliveTimer);
        keepAliveTimer = null;
      }
      return originalReader.cancel();
    },
  });

  // Return a new Response with the transformed stream and original headers
  return new Response(transformedStream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

const DURABLE_OBJECT_STORAGE_TIMEOUT =
  "Durable Object storage operation exceeded timeout";

function isDurableObjectStorageTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(DURABLE_OBJECT_STORAGE_TIMEOUT)
  );
}

async function handleMcpRequest(req: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(req.url);
  const { pathname } = url;
  const traceId = getMcpTraceId(req);

  // SSE transport: GET /sse opens the event stream; POST /sse/message sends messages
  if (pathname === "/sse" && req.method === "GET") {
    let response: Response;
    try {
      response = await logMcpRoute(
        traceId,
        "sse-open",
        req,
        () => DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx),
        { wrapsKeepAlive: true },
      );
    } catch (error) {
      if (isDurableObjectStorageTimeout(error)) {
        return new Response("Service temporarily unavailable", {
          status: 503,
          headers: { "Retry-After": "5" },
        });
      }
      throw error;
    }
    return wrapSSEResponseWithKeepAlive(response, traceId);
  }
  if (pathname === "/sse/message") {
    try {
      return await logMcpRoute(traceId, "sse-message", req, () =>
        DoitMCPAgent.serveSSE("/sse").fetch(req, env, ctx),
      );
    } catch (error) {
      if (isDurableObjectStorageTimeout(error)) {
        return new Response("Service temporarily unavailable", {
          status: 503,
          headers: { "Retry-After": "5" },
        });
      }
      throw error;
    }
  }

  // StreamableHTTP transport: POST /mcp (native) or POST /sse (ChatGPT tries the
  // configured MCP URL with POST first per the new MCP spec).
  // Rewrite /sse → /mcp so the agents SDK basePattern matches.
  if (pathname === "/mcp" || (pathname === "/sse" && req.method === "POST")) {
    const rewrittenPathname = pathname === "/sse" ? "/mcp" : pathname;
    const mcpReq =
      pathname === "/sse"
        ? new Request(
            Object.assign(new URL(req.url), { pathname: "/mcp" }).toString(),
            req,
          )
        : req;
    try {
      return await logMcpRoute(
        traceId,
        "streamable-http",
        req,
        () => DoitMCPAgent.serve("/mcp").fetch(mcpReq, env, ctx),
        {
          rewrittenPathname,
          isRewrite: pathname === "/sse",
          rewrittenUrlPathname: new URL(mcpReq.url).pathname,
          rewrittenHasAuthorization: Boolean(
            mcpReq.headers.get("authorization"),
          ),
          rewrittenHasMcpSessionId: Boolean(
            mcpReq.headers.get("mcp-session-id"),
          ),
        },
      );
    } catch (error) {
      if (isDurableObjectStorageTimeout(error)) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message: "Service temporarily unavailable" },
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "5",
            },
          },
        );
      }
      throw error;
    }
  }

  return logMcpRoute(
    traceId,
    "not-found",
    req,
    async () => new Response("Not found", { status: 404 }),
  );
}

// Workers types `ExecutionContext.props` as readonly, but McpAgent receives the
// per-connection auth context via ctx.props. Assign through a writable view and
// merge with any existing props. (This typing was previously provided by the
// @cloudflare/workers-oauth-provider package; we now own it.)
function assignCtxProps(
  ctx: ExecutionContext,
  props: Record<string, unknown>,
): void {
  const mutable = ctx as unknown as { props?: Record<string, unknown> };
  mutable.props = { ...(mutable.props ?? {}), ...props };
}

// Helper function to extract token from Authorization header.
// Supports both "Bearer <token>" and bare "<token>" formats.
function extractTokenFromAuthHeader(authHeader: string): string | null {
  if (!authHeader) return null;
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1];
  }
  return authHeader;
}

// Main request handler that checks for Authorization header
async function handleRequest(
  req: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(req.url);
  const startedAt = Date.now();
  const traceId = isMcpDiagnosticsPath(url.pathname)
    ? getMcpTraceId(req)
    : undefined;
  const authHeader = req.headers.get("Authorization");
  const mcpResourceUrl = resolveMcpResourceUrl(
    env as { MCP_RESOURCE_URL?: string },
  );
  const isMcpPath =
    url.pathname === "/sse" ||
    url.pathname === "/sse/message" ||
    url.pathname === "/mcp";

  try {
    // Serve the RFC 9728 protected-resource metadata unauthenticated at ANY path
    // prefix. MCP clients (e.g. ChatGPT) append the well-known path to the MCP
    // server URL (e.g. /sse/.well-known/oauth-protected-resource), so we answer it
    // here before the MCP auth check runs. The metadata points clients to the real
    // authorization server (auth.doit.com).
    if (isMcpDiscoveryPath(url.pathname)) {
      const authServerUrl = resolveAuthServerUrl(
        env as { AUTH_SERVER_URL?: string },
      );
      const resource = resolveMcpResourceUrl(
        env as { MCP_RESOURCE_URL?: string },
      );
      const response = Response.json({
        resource,
        authorization_servers: [authServerUrl],
        scopes_supported: ["mcp:tools", "mcp:resources", "offline_access"],
        bearer_methods_supported: ["header"],
        resource_documentation: "https://help.doit.com/docs/mcp",
      });
      logMcpRequestComplete(traceId, response, startedAt);
      return response;
    }

    // RFC 9728 §5.3: protected resources MUST emit a discoverable WWW-Authenticate
    // on 401 so MCP clients can locate the authorization server. We send it for any
    // unauthenticated request to an MCP endpoint.
    if (isMcpPath && !authHeader) {
      const response = new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": wwwAuthenticateHeaderForResource(mcpResourceUrl),
        },
      });
      logMcpRequestComplete(traceId, response, startedAt);
      return response;
    }

    if (isMcpPath && authHeader) {
      const token = extractTokenFromAuthHeader(authHeader);
      if (token) {
        // Demo login: the sentinel token bypasses JWT verification and yields a
        // synthetic demo session. Gated behind DEMO_MODE_ENABLED.
        if (
          token === DEMO_TOKEN &&
          (env as { DEMO_MODE_ENABLED?: string }).DEMO_MODE_ENABLED === "true"
        ) {
          assignCtxProps(ctx, {
            apiKey: DEMO_TOKEN,
            customerContext: "demo",
            authMethod: "oauth",
            userId: "demo",
            isDoitUser: "false",
          });
          const response = await handleMcpRequest(
            withMcpTraceId(req, traceId),
            env,
            ctx,
          );
          if (response.status >= 400) {
            logMcpRequestComplete(traceId, response, startedAt);
          }
          return response;
        }

        const mode = url.pathname === "/sse" ? "handshake" : "request";
        const result = await verifyBearer(token, env as BearerEnv, { mode });

        if (!result.ok) {
          if (result.reason === "verification_unavailable") {
            const response = new Response(
              "Authentication service unavailable",
              {
                status: 503,
                headers: {
                  "Retry-After": "30",
                },
              },
            );
            logMcpRequestComplete(traceId, response, startedAt);
            return response;
          }

          // Legacy API-key fallback is disabled by requirement. Keep the code path
          // here so it can be re-enabled deliberately later by restoring the
          // validateLegacyApiKey import and hasMcpAccessKid import.
          /*
          if (!hasMcpAccessKid(token)) {
            const legacy = await validateLegacyApiKey(token);
            if (legacy) {
              console.log(getMcpDiagnosticsMessage("legacy api key session"), {
                userId: legacy.email,
                isDoitUser: legacy.isDoitEmployee,
                hasCustomerContext: Boolean(legacy.customerContext),
              });
              assignCtxProps(ctx, {
                apiKey: token,
                customerContext: legacy.customerContext,
                authMethod: "apikey",
                userId: legacy.email,
                isDoitUser: legacy.isDoitEmployee ? "true" : "false",
              });
              const response = await handleMcpRequest(withMcpTraceId(req, traceId), env, ctx);
              if (response.status >= 400) {
                logMcpRequestComplete(traceId, response, startedAt);
              }
              return response;
            }
          }
          */

          const response = new Response("Unauthorized", {
            status: 401,
            headers: {
              "WWW-Authenticate":
                wwwAuthenticateHeaderForResource(mcpResourceUrl),
            },
          });
          logMcpRequestComplete(traceId, response, startedAt);
          return response;
        }

        // OAuth-issued token: customer context is sealed in the JWT claim.
        // Ignore any customerContext query param to close the override loophole.
        // change_customer is gated on isDoitUser — only DoiT employees may switch context.
        assignCtxProps(ctx, {
          apiKey: token,
          customerContext: result.claims.customerContext,
          authMethod: "oauth",
          userId: result.claims.userId,
          cid: result.claims.cid,
          flowId: result.claims.flowId,
          isDoitUser: result.claims.isDoitEmployee ? "true" : "false",
        });

        // Dispatch through main's handleMcpRequest so we get its routing,
        // diagnostics, and SSE keep-alive wrapping.
        const response = await handleMcpRequest(
          withMcpTraceId(req, traceId),
          env,
          ctx,
        );
        if (response.status >= 400) {
          logMcpRequestComplete(traceId, response, startedAt);
        }
        return response;
      }
    }

    // Non-MCP, non-discovery requests (home page, widget, well-known metadata)
    // are served by the Hono app.
    const response = await app.fetch(withMcpTraceId(req, traceId), env, ctx);
    if (response.status >= 400) {
      logMcpRequestComplete(traceId, response, startedAt);
    }
    return response;
  } catch (error) {
    logMcpRequestError(traceId, error, startedAt);
    throw error;
  }
}

// Export the main handler as the default, wrapped with CORS handling so
// browser-based MCP clients (e.g. the Claude.ai web connector) can talk to the
// worker cross-origin: answer the preflight, and expose WWW-Authenticate on the
// 401 challenge so the client can discover the authorization server.
export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (req.method === "OPTIONS") {
      return mcpCorsPreflightResponse();
    }
    return withMcpCors(await handleRequest(req, env, ctx));
  },
};
