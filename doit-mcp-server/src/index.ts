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
import { cloudOverviewTool, CloudOverviewArgumentsSchema } from "../../src/tools/overview.js";
import {
  AnomaliesArgumentsSchema,
  AnomalyArgumentsSchema,
  anomaliesTool,
  anomalyTool,
} from "../../src/tools/anomalies.js";
import { AskAvaSyncArgumentsSchema, askAvaSyncTool } from "../../src/tools/ava.js";
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
  ConfirmActionArgumentsSchema,
  confirmActionTool,
} from "../../src/tools/confirmAction.js";
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

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import type { ApprovalStore } from "../../src/utils/approval.js";
import { executeToolHandler } from "../../src/utils/toolsHandler.js";
import { type TrackingContext, runWithTracking } from "../../src/utils/util.js";
import { DurableObjectApprovalStore } from "./durableObjectApprovalStore.js";
import { adaptToolResponse } from "./responseAdapter.js";
import { WIDGET_URI } from "./responseAdapter.js";
import { promptsIncludingLegacyNames, resolvePromptMessages } from "../../src/prompts/index.js";
import type { DoitWorkerEnv, UiDomainProvider } from "./runtimeEnv.js";
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
  `event: message\ndata: ${JSON.stringify(MCP_NOTIFICATIONS_PING)}\n\n`
);
const SESSION_UI_DOMAIN_PROVIDER_KEY = "sessionUiDomainProvider";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logMcpInitStorageError(
  message: string,
  error: unknown,
  props: Record<string, unknown>
) {
  console.error(
    message,
    {
      reason: getErrorMessage(error),
      hasApiKey: Boolean(props.apiKey),
    },
    error
  );
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
  }
) {
  console.error(
    message,
    {
      reason: getErrorMessage(error),
      ...context,
    },
    error
  );
}

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

export class DoitMCPAgent extends McpAgent {
  server = new McpServer(
    {
      name: SERVER_NAME_WEB,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        resources: {},
      },
    }
  );

  // Per-instance MCP client info — stored on the DO instance, not a module global,
  // so there is no cross-session bleed between DO instances sharing the same isolate.
  private _mcpClientInfo: TrackingContext = {};
  private _sessionUiDomainProvider?: UiDomainProvider;

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

  // Helper method to get the current token
  private getToken(): string {
    return this.props.apiKey as string;
  }

  // Persist props to Context Storage Durable Object
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

  // Load props from Context Storage Durable Object
  private async loadPersistedProps(): Promise<string | null> {
    const env = this.env as DoitWorkerEnv;
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

  private async persistSessionUiDomainProvider(
    provider: UiDomainProvider
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
        SESSION_UI_DOMAIN_PROVIDER_KEY
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
        error
      );
    }

    return undefined;
  }

  // Generic callback factory for tools
  private createToolCallback(toolName: string) {
    return async (args: any) => {
      const token = this.getToken();
      let persistedCustomerContext: string | null = null;
      try {
        persistedCustomerContext = await this.loadPersistedProps();
      } catch (error) {
        console.error(
          "[mcp] loadPersistedProps failed during tool call",
          {
            reason: getErrorMessage(error),
            toolName,
          },
          error
        );
      }
      const customerContext =
        persistedCustomerContext || (this.props.customerContext as string);

      const argsWithCustomerContext = {
        ...args,
        customerContext,
      };
      const result = await executeToolHandler(
        toolName,
        argsWithCustomerContext,
        token,
        {
          trackingContext: this._mcpClientInfo,
          convertResponse: (rawResult) => adaptToolResponse(toolName, rawResult),
          // The identity the approval flow is bound to. `props.apiKey` is the
          // OAuth-derived DoiT API key and is per-user, so staged actions cannot
          // be consumed across users even if a token somehow leaked.
          userKey: token,
          approvalStore: this.getApprovalStore(),
        }
      );
      return result;
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

      // change_customer bypasses executeToolHandler, so wrap manually with tracking context.
      return runWithTracking({ ...this._mcpClientInfo, mcpTool: "change_customer" }, async () => {
        const response = await handleChangeCustomerRequest(
          args,
          token,
          updateCustomerContext
        );
        return adaptToolResponse("change_customer", response);
      });
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
        inputSchema: schema,
        annotations: tool.annotations,
        _meta: {
          ...tool._meta,
          "ui/resourceUri": WIDGET_URI,
          "openai/outputTemplate": WIDGET_URI,
          ui: { ...(tool._meta?.ui ?? {}), resourceUri: WIDGET_URI },
        },
      },
      this.createToolCallback(tool.name)
    );
  }

  private registerWidgetResource() {
    try {
      const env = this.env as DoitWorkerEnv;
      this.server.resource(
        "cloud-intelligence-widget",
        WIDGET_URI,
        { mimeType: WIDGET_RESOURCE_MIME_TYPE },
        async () => {
          if (
            !this._mcpClientInfo.mcpClient &&
            !this._sessionUiDomainProvider
          ) {
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
              logContext
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
              logContext
            );
            resourceContent = buildFallbackWidgetResourceContent(WIDGET_URI);
          }
          return {
            contents: [resourceContent],
          };
        }
      );
    } catch (error) {
      console.error(
        "[widget] failed to register widget resource",
        {
          reason: getErrorMessage(error),
        },
        error
      );
    }
  }

  async init() {
    // Guard: this.props may be undefined on the very first connection because
    // McpAgent.onStart() calls _init(stored_props) → init() BEFORE the Worker-side
    // doStub._init(ctx.props) RPC delivers the OAuth props. Tool callbacks read
    // this.props at call-time (after props are set), so registration still works.
    this.props = (this.props ?? {}) as typeof this.props;

    console.log("Initializing Doit MCP Agent", {
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
            error
          );
        });
      }
      console.log("[mcp] initialized client", {
        ...this._mcpClientInfo,
        sessionProvider: this._sessionUiDomainProvider,
      });
    };

    // Swallow transient DO storage errors here so init never aborts.
    // Customer context predates widget support and is needed by tool callbacks.
    try {
      await this.loadPersistedProps();
    } catch (error) {
      logMcpInitStorageError(
        "[mcp] failed to load persisted customer context",
        error,
        this.props
      );
    }

    console.log("After loading persisted props:", {
      hasCustomerContext: Boolean(this.props.customerContext),
      sessionProvider: this._sessionUiDomainProvider,
    });

    // Save current props if they exist (for initial OAuth setup)
    if (this.props.apiKey && this.props.customerContext) {
      try {
        await this.saveProps();
      } catch (error) {
        logMcpInitStorageError(
          "[mcp] failed to save persisted customer context",
          error,
          this.props
        );
      }
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
    this.registerTool(listOptimizationRecommendationsTool, ListInsightsArgumentsSchema);
    this.registerTool(getInsightResourcesTool, GetInsightResourcesArgumentsSchema);
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
    this.registerTool(listTicketCommentsTool, ListTicketCommentsArgumentsSchema);
    this.registerTool(createTicketCommentTool, CreateTicketCommentArgumentsSchema);
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
    this.registerTool(getLabelAssignmentsTool, GetLabelAssignmentsArgumentsSchema);
    this.registerTool(assignObjectsToLabelTool, AssignObjectsToLabelArgumentsSchema);

    // DataHub Datasets tools
    this.registerTool(listDatahubDatasetsTool, ListDatahubDatasetsArgumentsSchema);
    this.registerTool(getDatahubDatasetTool, GetDatahubDatasetArgumentsSchema);
    this.registerTool(createDatahubDatasetTool, CreateDatahubDatasetArgumentsSchema);
    this.registerTool(updateDatahubDatasetTool, UpdateDatahubDatasetArgumentsSchema);
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
    this.registerTool(confirmActionTool, ConfirmActionArgumentsSchema);

    // Change Customer tool (requires special handling)
    if (this.props.isDoitUser === "true") {
      (this.server as any).registerTool(
        changeCustomerTool.name,
        {
          description: changeCustomerTool.description,
          inputSchema: ChangeCustomerArgumentsSchema,
          annotations: changeCustomerTool.annotations,
          _meta: {
            ...changeCustomerTool._meta,
            "ui/resourceUri": WIDGET_URI,
            "openai/outputTemplate": WIDGET_URI,
            ui: { ...((changeCustomerTool._meta as any)?.ui ?? {}), resourceUri: WIDGET_URI },
          },
        },
        this.createChangeCustomerCallback()
      );
    }

    this.registerWidgetResource();
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
    const logProps = props as
      | Partial<Record<"apiKey" | "customerContext" | "isDoitUser", unknown>>
      | undefined;
    console.log("tokenExchangeCallback", grantType, {
      hasApiKey: Boolean(logProps?.apiKey),
      hasCustomerContext: Boolean(logProps?.customerContext),
      isDoitUser: logProps?.isDoitUser,
    });
    if (grantType === "refresh_token" || grantType === "authorization_code") {
      return {
        newProps: { ...props },
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
  const runtimeEnv = env as DoitWorkerEnv;

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
    const base = runtimeEnv.PUBLIC_URL ||
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
