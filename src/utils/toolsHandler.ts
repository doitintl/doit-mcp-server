import { z } from "zod";
import { handleListAccountTeamRequest } from "../tools/accountTeam.js";
import {
    handleCreateAlertRequest,
    handleGetAlertRequest,
    handleListAlertsRequest,
    handleUpdateAlertRequest,
} from "../tools/alerts.js";
import {
    handleCreateAllocationRequest,
    handleGetAllocationRequest,
    handleListAllocationsRequest,
    handleUpdateAllocationRequest,
} from "../tools/allocations.js";
import {
    handleCreateAnnotationRequest,
    handleGetAnnotationRequest,
    handleListAnnotationsRequest,
    handleUpdateAnnotationRequest,
} from "../tools/annotations.js";
import { handleAnomaliesRequest, handleAnomalyRequest } from "../tools/anomalies.js";
import { handleGetAssetRequest, handleListAssetsRequest } from "../tools/assets.js";
import { handleAskAvaSyncRequest, handleSubmitAvaFeedbackRequest } from "../tools/ava.js";
import {
    handleCreateAwsAccountRoleRequest,
    handleGetAwsAccountRequest,
    handleGetCloudConnectSupportedFeaturesRequest,
} from "../tools/awsAccounts.js";
import {
    handleCreateBudgetRequest,
    handleGetBudgetRequest,
    handleListBudgetsRequest,
    handleUpdateBudgetRequest,
} from "../tools/budgets.js";
import {
    handleFindCloudDiagramsRequest,
    handleGetCloudDiagramComponentsRequest,
    handleGetCloudDiagramCostSnapshotRequest,
    handleGetCloudDiagramResourceRelationshipsRequest,
    handleGetCloudDiagramsStatsRequest,
    handleListCloudDiagramActivityGroupsRequest,
    handleListCloudDiagramNodeActivitiesRequest,
    handleSearchCloudDiagramsRequest,
} from "../tools/cloudDiagrams.js";
import {
    handleCreateCloudFlowConnectionRequest,
    handleGetCloudFlowConnectionRequest,
    handleGetCloudFlowTemplateRequest,
    handleListCloudFlowConnectionsRequest,
    handleListCloudFlowsRequest,
    handleListCloudFlowTemplatesRequest,
    handleRefineCloudflowRequest,
    handleTriggerCloudFlowRequest,
    handleUpdateCloudFlowConnectionRequest,
} from "../tools/cloudflow.js";
import { handleCloudIncidentRequest, handleCloudIncidentsRequest } from "../tools/cloudIncidents.js";
import { handleGetCommitmentRequest, handleListCommitmentsRequest } from "../tools/commitmentManager.js";
import { handleConfirmActionRequest } from "../tools/confirmAction.js";
import {
    handleCreateDatahubDatasetRequest,
    handleGetDatahubDatasetRequest,
    handleListDatahubDatasetsRequest,
    handleUpdateDatahubDatasetRequest,
} from "../tools/datahubDatasets.js";
import { handleSendDatahubEventsRequest } from "../tools/datahubEvents.js";
import { handleDimensionRequest } from "../tools/dimension.js";
import { handleDimensionsRequest } from "../tools/dimensions.js";
import {
    handleCreateFolderRequest,
    handleGetFolderRequest,
    handleListFoldersRequest,
    handleUpdateFolderRequest,
} from "../tools/folders.js";
import { handleGeneratedOperationRequest } from "../tools/generated/callOperation.js";
import type { GeneratedTool } from "../tools/generated/types.js";
import {
    handleGetInsightRequest,
    handleGetInsightResourcesRequest,
    handleListInsightsRequest,
} from "../tools/insights.js";
import { handleGetInvoiceRequest, handleListInvoicesRequest } from "../tools/invoices.js";
import {
    handleAssignObjectsToLabelRequest,
    handleCreateLabelRequest,
    handleGetLabelAssignmentsRequest,
    handleGetLabelRequest,
    handleListLabelsRequest,
    handleUpdateLabelRequest,
} from "../tools/labels.js";
import { handleListOrganizationsRequest } from "../tools/organizations.js";
import { handleCloudOverviewRequest } from "../tools/overview.js";
import { handleGetResourcePermissionsRequest, handleUpdateResourcePermissionsRequest } from "../tools/permissions.js";
import { handleListPlatformsRequest } from "../tools/platforms.js";
import { handleListProductsRequest } from "../tools/products.js";
import {
    handleCompareSpendRequest,
    handleCostBreakdownRequest,
    handleCostTrendRequest,
} from "../tools/queryHelpers.js";
import {
    handleCreateReportRequest,
    handleGetReportConfigRequest,
    handleGetReportResultsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    handleUpdateReportRequest,
} from "../tools/reports.js";
import { handleListRolesRequest } from "../tools/roles.js";
import { handleSearchCustomersRequest } from "../tools/searchCustomers.js";
import {
    handleGetActiveThemeRequest,
    handleGetThemeRequest,
    handleListThemesRequest,
    handleSetActiveThemeRequest,
    handleUpdateThemeRequest,
} from "../tools/themes.js";
import {
    // createTicketTool, // Re-enable alongside the WRITE_GATED_SUMMARIES entry below.
    handleCreateTicketCommentRequest,
    handleCreateTicketRequest,
    handleGetTicketRequest,
    handleListTicketCommentsRequest,
    handleListTicketsRequest,
} from "../tools/tickets.js";
import { handleInviteUserRequest, handleListUsersRequest, handleUpdateUserRequest } from "../tools/users.js";
import { handleValidateUserRequest } from "../tools/validateUser.js";
import { APPROVAL_TTL_MS, type ApprovalStore, buildApprovalResponse, mintApprovalToken } from "./approval.js";
import {
    createErrorResponse,
    formatZodError,
    handleGeneralError,
    runWithTracking,
    type TrackingContext,
} from "./util.js";

/**
 * Registry of write-gated tools that go through the two-phase approval flow.
 *
 * "Write-gated" — not "destructive" — because the gate covers any state-changing call
 * that warrants explicit user confirmation, including pure creates like `create_ticket`.
 * (The MCP-spec `destructiveHint` annotation has a narrower meaning — irreversible
 * updates — and is set per-tool independently of this registry.)
 *
 * POC scope: only `create_ticket` is gated so the demo surface stays small. The mechanism
 * itself (`confirm_action`, {@link ApprovalStore}, single-use tokens) is generic —
 * extending approval to another tool is just (a) adding a `summary(args)` on that tool's
 * definition and (b) adding an entry below. Removing approval enforcement is the inverse.
 * No tool handler code needs to change.
 */
const WRITE_GATED_SUMMARIES: Record<string, (args: any) => string> = {
    // Approval-token gating for create_ticket is disabled — we rely on the
    // tool's `destructiveHint: true` annotation to surface a client-side
    // confirmation dialog instead. Re-enable by uncommenting the line below.
    // [createTicketTool.name]: createTicketTool.summary,
};

export interface ToolHandlerOptions {
    /** Connection-level MCP client metadata (mcpClient, mcpClientVersion, etc.) */
    trackingContext?: TrackingContext;
    /** Optional function to convert the raw response format */
    convertResponse?: (response: any) => any;
    /**
     * Stable identity the approval flow is bound to. On stdio use a constant such as
     * `"stdio-local"`; on the HTTP/SSE Worker use the OAuth-derived `props.apiKey`.
     *
     * If either this or {@link ToolHandlerOptions.approvalStore} is omitted the approval
     * gate is **not enforced** — write-gated tools run immediately. Callers that want to
     * enforce approval (both transports, per the plan) must supply both.
     */
    userKey?: string;
    /**
     * Persistence for staged write-gated actions. See `src/utils/approval.ts` for the
     * `MemoryApprovalStore` (stdio) and `doit-mcp-server/src/durableObjectApprovalStore.ts`
     * (HTTP/SSE) implementations. Omit only in tests that call non-gated tools.
     */
    approvalStore?: ApprovalStore;
    /** Called for each SSE progress event from streaming tools (e.g. refine_cloudflow). */
    onProgress?: (message: string) => Promise<void>;
    /**
     * Registry of auto-generated tools (see src/tools/generated/), keyed by tool name.
     * Injected by the caller rather than imported here because each transport loads the
     * bundled OpenAPI spec differently — stdio reads it off disk, the Worker has no
     * filesystem and statically imports it instead. Tool names not in the static switch
     * below fall back to this registry before erroring as unknown.
     */
    generatedTools?: Map<string, GeneratedTool>;
}

/**
 * Executes a tool handler with proper error handling
 * @param toolName - The name of the tool to execute
 * @param args - The arguments to pass to the tool handler
 * @param token - The API token to use
 * @param options - Optional tracking context and response converter
 * @returns The tool execution result
 */
export async function executeToolHandler(
    toolName: string,
    args: any,
    token: string,
    options: ToolHandlerOptions = {}
): Promise<any> {
    const { trackingContext, convertResponse, userKey, approvalStore, onProgress, generatedTools } = options;
    return runWithTracking({ ...trackingContext, mcpTool: toolName }, async () => {
        try {
            // Dispatches an already-confirmed (or non-gated) tool call. The approval
            // gate below never calls this directly for a write-gated tool without first
            // going through `confirm_action` + `ApprovalStore.consume`.
            const runOriginal = async (innerToolName: string, innerArgs: any, innerToken: string): Promise<any> => {
                const result = await runOriginalDispatch(innerToolName, innerArgs, innerToken, {
                    onProgress,
                    generatedTools,
                });
                return convertResponse ? convertResponse(result) : result;
            };

            // Two-phase commit for write-gated tools.
            //
            // Enforcement is opt-in: if either `userKey` or `approvalStore` is missing we
            // bypass the gate and run the tool immediately. Both transports (stdio +
            // HTTP/SSE) wire them through, so in production the gate is always on. Unit
            // tests that exercise non-gated tools can continue to omit both.
            if (approvalStore && userKey) {
                if (toolName === "confirm_action") {
                    const confirmed = await handleConfirmActionRequest(
                        args,
                        token,
                        userKey,
                        approvalStore,
                        runOriginal
                    );
                    return confirmed;
                }

                const summaryFn = WRITE_GATED_SUMMARIES[toolName];
                if (summaryFn) {
                    const approvalToken = mintApprovalToken();
                    await approvalStore.stash(approvalToken, {
                        toolName,
                        args,
                        userKey,
                        expiresAt: Date.now() + APPROVAL_TTL_MS,
                    });
                    // Return the approval envelope without running it through `convertResponse`
                    // (i.e. `adaptToolResponse` on the Worker). The envelope is a control
                    // message for the LLM, not tool output — wrapping it would:
                    //   (a) attach widget `_meta` / `_llmInstruction` that tells the model to
                    //       "respond with one short sentence", conflicting with the `next`
                    //       field that tells it to call `confirm_action`;
                    //   (b) cause the ChatGPT Cloud Intelligence widget to try to render the
                    //       approval JSON as if it were tool results.
                    // The real tool output (after `confirm_action` → `runOriginal`) still
                    // flows through `convertResponse` normally.
                    return buildApprovalResponse(approvalToken, summaryFn(args));
                }
            }

            return await runOriginal(toolName, args, token);
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errorResult = createErrorResponse(formatZodError(error));
                return convertResponse ? convertResponse(errorResult) : errorResult;
            }
            const errorResult = handleGeneralError(error, "handling tool request");
            return convertResponse ? convertResponse(errorResult) : errorResult;
        }
    }); // end runWithTracking
}

/**
 * Dispatches a tool call directly to its handler — no approval gating.
 * Used both for non-gated tools and as the "run original" callback after a
 * write-gated tool has passed through `confirm_action`.
 */
async function runOriginalDispatch(
    toolName: string,
    args: any,
    token: string,
    options?: ToolHandlerOptions
): Promise<any> {
    let result: any;
    switch (toolName) {
        case "get_cloud_incidents":
            result = await handleCloudIncidentsRequest(args, token);
            break;
        case "get_cloud_incident":
            result = await handleCloudIncidentRequest(args, token);
            break;
        case "get_anomalies":
            result = await handleAnomaliesRequest(args, token);
            break;
        case "get_anomaly":
            result = await handleAnomalyRequest(args, token);
            break;
        case "list_reports":
            result = await handleReportsRequest(args, token);
            break;
        case "run_query":
            result = await handleRunQueryRequest(args, token);
            break;
        case "cost_breakdown":
            result = await handleCostBreakdownRequest(args, token);
            break;
        case "cost_trend":
            result = await handleCostTrendRequest(args, token);
            break;
        case "compare_spend":
            result = await handleCompareSpendRequest(args, token);
            break;
        case "list_optimization_recommendations":
            result = await handleListInsightsRequest(args, token);
            break;
        case "get_insight_resources":
            result = await handleGetInsightResourcesRequest(args, token);
            break;
        case "get_insight":
            result = await handleGetInsightRequest(args, token);
            break;
        case "get_report_results":
            result = await handleGetReportResultsRequest(args, token);
            break;
        case "get_report_config":
            result = await handleGetReportConfigRequest(args, token);
            break;
        case "create_report":
            result = await handleCreateReportRequest(args, token);
            break;
        case "update_report":
            result = await handleUpdateReportRequest(args, token);
            break;
        case "validate_user":
            result = await handleValidateUserRequest(args, token);
            break;
        case "get_cloud_overview":
            result = await handleCloudOverviewRequest(args, token);
            break;
        case "list_dimensions":
            result = await handleDimensionsRequest(args, token);
            break;
        case "get_dimension":
            result = await handleDimensionRequest(args, token);
            break;
        case "list_tickets":
            result = await handleListTicketsRequest(args, token);
            break;
        case "get_ticket":
            result = await handleGetTicketRequest(args, token);
            break;
        case "list_ticket_comments":
            result = await handleListTicketCommentsRequest(args, token);
            break;
        case "create_ticket_comment":
            result = await handleCreateTicketCommentRequest(args, token);
            break;
        case "create_ticket":
            result = await handleCreateTicketRequest(args, token);
            break;
        case "list_invoices":
            result = await handleListInvoicesRequest(args, token);
            break;
        case "get_invoice":
            result = await handleGetInvoiceRequest(args, token);
            break;
        case "list_allocations":
            result = await handleListAllocationsRequest(args, token);
            break;
        case "get_allocation":
            result = await handleGetAllocationRequest(args, token);
            break;
        case "create_allocation":
            result = await handleCreateAllocationRequest(args, token);
            break;
        case "update_allocation":
            result = await handleUpdateAllocationRequest(args, token);
            break;
        case "list_assets":
            result = await handleListAssetsRequest(args, token);
            break;
        case "get_asset":
            result = await handleGetAssetRequest(args, token);
            break;
        case "search_customers":
            result = await handleSearchCustomersRequest(args, token);
            break;
        case "trigger_cloud_flow":
            result = await handleTriggerCloudFlowRequest(args, token);
            break;
        case "list_cloudflow_connections":
            result = await handleListCloudFlowConnectionsRequest(args, token);
            break;
        case "get_cloudflow_connection":
            result = await handleGetCloudFlowConnectionRequest(args, token);
            break;
        case "create_cloudflow_connection":
            result = await handleCreateCloudFlowConnectionRequest(args, token);
            break;
        case "update_cloudflow_connection":
            result = await handleUpdateCloudFlowConnectionRequest(args, token);
            break;
        case "list_cloudflow_templates":
            result = await handleListCloudFlowTemplatesRequest(args, token);
            break;
        case "get_cloudflow_template":
            result = await handleGetCloudFlowTemplateRequest(args, token);
            break;
        case "refine_cloudflow":
            result = await handleRefineCloudflowRequest(args, token, options?.onProgress);
            break;
        case "list_cloudflows":
            result = await handleListCloudFlowsRequest(args, token);
            break;
        case "list_alerts":
            result = await handleListAlertsRequest(args, token);
            break;
        case "get_alert":
            result = await handleGetAlertRequest(args, token);
            break;
        case "create_alert":
            result = await handleCreateAlertRequest(args, token);
            break;
        case "update_alert":
            result = await handleUpdateAlertRequest(args, token);
            break;

        case "list_organizations":
            result = await handleListOrganizationsRequest(args, token);
            break;
        case "list_platforms":
            result = await handleListPlatformsRequest(args, token);
            break;
        case "list_users":
            result = await handleListUsersRequest(args, token);
            break;
        case "update_user":
            result = await handleUpdateUserRequest(args, token);
            break;
        case "invite_user":
            result = await handleInviteUserRequest(args, token);
            break;
        case "list_roles":
            result = await handleListRolesRequest(args, token);
            break;
        case "list_products":
            result = await handleListProductsRequest(args, token);
            break;
        case "list_labels":
            result = await handleListLabelsRequest(args, token);
            break;
        case "get_label":
            result = await handleGetLabelRequest(args, token);
            break;
        case "create_label":
            result = await handleCreateLabelRequest(args, token);
            break;
        case "update_label":
            result = await handleUpdateLabelRequest(args, token);
            break;
        case "get_label_assignments":
            result = await handleGetLabelAssignmentsRequest(args, token);
            break;
        case "assign_objects_to_label":
            result = await handleAssignObjectsToLabelRequest(args, token);
            break;
        case "list_folders":
            result = await handleListFoldersRequest(args, token);
            break;
        case "get_folder":
            result = await handleGetFolderRequest(args, token);
            break;
        case "create_folder":
            result = await handleCreateFolderRequest(args, token);
            break;
        case "update_folder":
            result = await handleUpdateFolderRequest(args, token);
            break;
        case "get_aws_account":
            result = await handleGetAwsAccountRequest(args, token);
            break;
        case "get_cloud_connect_supported_features":
            result = await handleGetCloudConnectSupportedFeaturesRequest(args, token);
            break;
        case "create_aws_account_role":
            result = await handleCreateAwsAccountRoleRequest(args, token);
            break;
        case "list_themes":
            result = await handleListThemesRequest(args, token);
            break;
        case "get_theme":
            result = await handleGetThemeRequest(args, token);
            break;
        case "get_active_theme":
            result = await handleGetActiveThemeRequest(args, token);
            break;
        case "set_active_theme":
            result = await handleSetActiveThemeRequest(args, token);
            break;
        case "update_theme":
            result = await handleUpdateThemeRequest(args, token);
            break;
        case "list_datahub_datasets":
            result = await handleListDatahubDatasetsRequest(args, token);
            break;
        case "get_datahub_dataset":
            result = await handleGetDatahubDatasetRequest(args, token);
            break;
        case "create_datahub_dataset":
            result = await handleCreateDatahubDatasetRequest(args, token);
            break;
        case "update_datahub_dataset":
            result = await handleUpdateDatahubDatasetRequest(args, token);
            break;
        case "send_datahub_events":
            result = await handleSendDatahubEventsRequest(args, token);
            break;
        case "find_cloud_diagrams":
            result = await handleFindCloudDiagramsRequest(args, token);
            break;
        case "get_cloud_diagrams_stats":
            result = await handleGetCloudDiagramsStatsRequest(args, token);
            break;
        case "search_cloud_diagrams":
            result = await handleSearchCloudDiagramsRequest(args, token);
            break;
        case "get_cloud_diagram_cost_snapshot":
            result = await handleGetCloudDiagramCostSnapshotRequest(args, token);
            break;
        case "get_cloud_diagram_resource_relationships":
            result = await handleGetCloudDiagramResourceRelationshipsRequest(args, token);
            break;
        case "list_cloud_diagram_activity_groups":
            result = await handleListCloudDiagramActivityGroupsRequest(args, token);
            break;
        case "list_cloud_diagram_node_activities":
            result = await handleListCloudDiagramNodeActivitiesRequest(args, token);
            break;
        case "get_cloud_diagram_components":
            result = await handleGetCloudDiagramComponentsRequest(args, token);
            break;
        case "list_budgets":
            result = await handleListBudgetsRequest(args, token);
            break;
        case "get_budget":
            result = await handleGetBudgetRequest(args, token);
            break;
        case "create_budget":
            result = await handleCreateBudgetRequest(args, token);
            break;
        case "update_budget":
            result = await handleUpdateBudgetRequest(args, token);
            break;
        case "list_annotations":
            result = await handleListAnnotationsRequest(args, token);
            break;
        case "get_annotation":
            result = await handleGetAnnotationRequest(args, token);
            break;
        case "create_annotation":
            result = await handleCreateAnnotationRequest(args, token);
            break;
        case "update_annotation":
            result = await handleUpdateAnnotationRequest(args, token);
            break;
        case "list_commitments":
            result = await handleListCommitmentsRequest(args, token);
            break;
        case "get_commitment":
            result = await handleGetCommitmentRequest(args, token);
            break;
        case "ask_ava_sync":
            result = await handleAskAvaSyncRequest(args, token);
            break;
        case "submit_ava_feedback":
            result = await handleSubmitAvaFeedbackRequest(args, token);
            break;
        case "list_account_team":
            result = await handleListAccountTeamRequest(args, token);
            break;
        case "get_resource_permissions":
            result = await handleGetResourcePermissionsRequest(args, token);
            break;
        case "update_resource_permissions":
            result = await handleUpdateResourcePermissionsRequest(args, token);
            break;
        default: {
            const generatedTool = options?.generatedTools?.get(toolName);
            if (!generatedTool) {
                return createErrorResponse(`Unknown tool: ${toolName}`);
            }
            result = await handleGeneratedOperationRequest(generatedTool, args, token);
        }
    }
    return result;
}
