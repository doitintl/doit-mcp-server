import { z } from "zod";
import {
    createAlertTool,
    handleCreateAlertRequest,
    handleGetAlertRequest,
    handleListAlertsRequest,
    handleUpdateAlertRequest,
    updateAlertTool,
} from "../tools/alerts.js";

import {
    createAllocationTool,
    handleCreateAllocationRequest,
    handleGetAllocationRequest,
    handleListAllocationsRequest,
    handleUpdateAllocationRequest,
    updateAllocationTool,
} from "../tools/allocations.js";
import {
    createAnnotationTool,
    handleCreateAnnotationRequest,
    handleGetAnnotationRequest,
    handleListAnnotationsRequest,
    handleUpdateAnnotationRequest,
    updateAnnotationTool,
} from "../tools/annotations.js";
import { handleAnomaliesRequest, handleAnomalyRequest } from "../tools/anomalies.js";
import { handleGetAssetRequest, handleListAssetsRequest } from "../tools/assets.js";
import { handleAskAvaSyncRequest } from "../tools/ava.js";
import {
    createBudgetTool,
    handleCreateBudgetRequest,
    handleGetBudgetRequest,
    handleListBudgetsRequest,
    handleUpdateBudgetRequest,
    updateBudgetTool,
} from "../tools/budgets.js";
import { handleFindCloudDiagramsRequest } from "../tools/cloudDiagrams.js";
import { handleTriggerCloudFlowRequest, triggerCloudFlowTool } from "../tools/cloudflow.js";
import { handleCloudIncidentRequest, handleCloudIncidentsRequest } from "../tools/cloudIncidents.js";
import { handleGetCommitmentRequest, handleListCommitmentsRequest } from "../tools/commitmentManager.js";
import { handleConfirmActionRequest } from "../tools/confirmAction.js";
import {
    createDatahubDatasetTool,
    handleCreateDatahubDatasetRequest,
    handleGetDatahubDatasetRequest,
    handleListDatahubDatasetsRequest,
    handleUpdateDatahubDatasetRequest,
    updateDatahubDatasetTool,
} from "../tools/datahubDatasets.js";
import { handleSendDatahubEventsRequest, sendDatahubEventsTool } from "../tools/datahubEvents.js";
import { handleDimensionRequest } from "../tools/dimension.js";
import { handleDimensionsRequest } from "../tools/dimensions.js";
import { handleGetInsightResourcesRequest, handleListInsightsRequest } from "../tools/insights.js";
import { handleGetInvoiceRequest, handleListInvoicesRequest } from "../tools/invoices.js";
import {
    assignObjectsToLabelTool,
    createLabelTool,
    handleAssignObjectsToLabelRequest,
    handleCreateLabelRequest,
    handleGetLabelAssignmentsRequest,
    handleGetLabelRequest,
    handleListLabelsRequest,
    handleUpdateLabelRequest,
    updateLabelTool,
} from "../tools/labels.js";
import { handleListOrganizationsRequest } from "../tools/organizations.js";
import { handleCloudOverviewRequest } from "../tools/overview.js";
import { handleListPlatformsRequest } from "../tools/platforms.js";
import { handleListProductsRequest } from "../tools/products.js";
import {
    handleCompareSpendRequest,
    handleCostBreakdownRequest,
    handleCostTrendRequest,
} from "../tools/queryHelpers.js";
import {
    createReportTool,
    handleCreateReportRequest,
    handleGetReportConfigRequest,
    handleGetReportResultsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    handleUpdateReportRequest,
    updateReportTool,
} from "../tools/reports.js";
import { handleListRolesRequest } from "../tools/roles.js";
import {
    handleCreateTicketCommentRequest,
    handleGetTicketRequest,
    handleListTicketCommentsRequest,
    handleListTicketsRequest,
} from "../tools/tickets.js";
import {
    handleInviteUserRequest,
    handleListUsersRequest,
    handleUpdateUserRequest,
    inviteUserTool,
    updateUserTool,
} from "../tools/users.js";
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
 * Registry of destructive tools gated by the two-phase approval flow.
 * Entries are assembled from the tool modules themselves (each tool co-locates its
 * `summary(args)` builder). Adding a new destructive tool is a single import + entry here.
 * Removing approval enforcement for a tool is just removing the entry — the tool itself
 * need not change. See server-enforced_approval_tool plan §"Tiering considerations".
 */
const DESTRUCTIVE_SUMMARIES: Record<string, (args: any) => string> = {
    [createReportTool.name]: createReportTool.summary,
    [updateReportTool.name]: updateReportTool.summary,
    [createAllocationTool.name]: createAllocationTool.summary,
    [updateAllocationTool.name]: updateAllocationTool.summary,
    [createAlertTool.name]: createAlertTool.summary,
    [updateAlertTool.name]: updateAlertTool.summary,
    [triggerCloudFlowTool.name]: triggerCloudFlowTool.summary,
    [createLabelTool.name]: createLabelTool.summary,
    [updateLabelTool.name]: updateLabelTool.summary,
    [assignObjectsToLabelTool.name]: assignObjectsToLabelTool.summary,
    [createBudgetTool.name]: createBudgetTool.summary,
    [updateBudgetTool.name]: updateBudgetTool.summary,
    [createAnnotationTool.name]: createAnnotationTool.summary,
    [updateAnnotationTool.name]: updateAnnotationTool.summary,
    [updateUserTool.name]: updateUserTool.summary,
    [inviteUserTool.name]: inviteUserTool.summary,
    [createDatahubDatasetTool.name]: createDatahubDatasetTool.summary,
    [updateDatahubDatasetTool.name]: updateDatahubDatasetTool.summary,
    [sendDatahubEventsTool.name]: sendDatahubEventsTool.summary,
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
     * gate is **not enforced** — destructive tools run immediately. Callers that want to
     * enforce approval (both transports, per the plan) must supply both.
     */
    userKey?: string;
    /**
     * Persistence for staged destructive actions. See `src/utils/approval.ts` for the
     * `MemoryApprovalStore` (stdio) and `doit-mcp-server/src/durableObjectApprovalStore.ts`
     * (HTTP/SSE) implementations. Omit only in tests that call non-destructive tools.
     */
    approvalStore?: ApprovalStore;
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
    const { trackingContext, convertResponse, userKey, approvalStore } = options;
    return runWithTracking({ ...trackingContext, mcpTool: toolName }, async () => {
        try {
            // Dispatches an already-confirmed (or non-destructive) tool call. The approval
            // gate below never calls this directly for a destructive tool without first
            // going through `confirm_action` + `ApprovalStore.consume`.
            const runOriginal = async (innerToolName: string, innerArgs: any, innerToken: string): Promise<any> => {
                const result = await runOriginalDispatch(innerToolName, innerArgs, innerToken);
                return convertResponse ? convertResponse(result) : result;
            };

            // Two-phase commit for destructive tools.
            //
            // Enforcement is opt-in: if either `userKey` or `approvalStore` is missing we
            // bypass the gate and run the tool immediately. Both transports (stdio +
            // HTTP/SSE) wire them through, so in production the gate is always on. Unit
            // tests that exercise non-destructive tools can continue to omit both.
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

                const summaryFn = DESTRUCTIVE_SUMMARIES[toolName];
                if (summaryFn) {
                    const approvalToken = mintApprovalToken();
                    await approvalStore.stash(approvalToken, {
                        toolName,
                        args,
                        userKey,
                        expiresAt: Date.now() + APPROVAL_TTL_MS,
                    });
                    const response = buildApprovalResponse(approvalToken, summaryFn(args));
                    return convertResponse ? convertResponse(response) : response;
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
 * Used both for non-destructive tools and as the "run original" callback after a
 * destructive tool has passed through `confirm_action`.
 */
async function runOriginalDispatch(toolName: string, args: any, token: string): Promise<any> {
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
        case "trigger_cloud_flow":
            result = await handleTriggerCloudFlowRequest(args, token);
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
        default:
            return createErrorResponse(`Unknown tool: ${toolName}`);
    }
    return result;
}
