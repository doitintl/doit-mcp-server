import { z } from "zod";
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
import { handleAskAvaSyncRequest } from "../tools/ava.js";
import {
    handleCreateBudgetRequest,
    handleGetBudgetRequest,
    handleListBudgetsRequest,
    handleUpdateBudgetRequest,
} from "../tools/budgets.js";
import { handleFindCloudDiagramsRequest } from "../tools/cloudDiagrams.js";
import { handleTriggerCloudFlowRequest } from "../tools/cloudflow.js";
import { handleCloudIncidentRequest, handleCloudIncidentsRequest } from "../tools/cloudIncidents.js";
import { handleGetCommitmentRequest, handleListCommitmentsRequest } from "../tools/commitmentManager.js";
import {
    handleCreateDatahubDatasetRequest,
    handleGetDatahubDatasetRequest,
    handleListDatahubDatasetsRequest,
    handleUpdateDatahubDatasetRequest,
} from "../tools/datahubDatasets.js";
import { handleSendDatahubEventsRequest } from "../tools/datahubEvents.js";
import { handleDimensionRequest } from "../tools/dimension.js";
import { handleDimensionsRequest } from "../tools/dimensions.js";
import { handleGetInsightResourcesRequest, handleListInsightsRequest } from "../tools/insights.js";
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
import {
    handleCreateTicketCommentRequest,
    handleGetTicketRequest,
    handleListTicketCommentsRequest,
    handleListTicketsRequest,
} from "../tools/tickets.js";
import { handleInviteUserRequest, handleListUsersRequest, handleUpdateUserRequest } from "../tools/users.js";
import { handleValidateUserRequest } from "../tools/validateUser.js";
import { runDestructiveIfNeeded, type ToolElicitFn } from "./confirmation.js";
import {
    createErrorResponse,
    formatZodError,
    handleGeneralError,
    runWithTracking,
    type TrackingContext,
} from "./util.js";

export interface ToolHandlerOptions {
    /** Connection-level MCP client metadata (mcpClient, mcpClientVersion, etc.) */
    trackingContext?: TrackingContext;
    /** Optional function to convert the raw response format */
    convertResponse?: (response: any) => any;
    /** When set (client supports MCP form elicitation), mutating tools may prompt for confirmation first. */
    elicit?: ToolElicitFn;
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
    const { trackingContext, convertResponse, elicit } = options;
    return runWithTracking({ ...trackingContext, mcpTool: toolName }, async () => {
        try {
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
                    result = await runDestructiveIfNeeded(
                        "create_report",
                        args,
                        token,
                        elicit,
                        handleCreateReportRequest
                    );
                    break;
                case "update_report":
                    result = await runDestructiveIfNeeded(
                        "update_report",
                        args,
                        token,
                        elicit,
                        handleUpdateReportRequest
                    );
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
                    result = await runDestructiveIfNeeded(
                        "create_allocation",
                        args,
                        token,
                        elicit,
                        handleCreateAllocationRequest
                    );
                    break;
                case "update_allocation":
                    result = await runDestructiveIfNeeded(
                        "update_allocation",
                        args,
                        token,
                        elicit,
                        handleUpdateAllocationRequest
                    );
                    break;
                case "list_assets":
                    result = await handleListAssetsRequest(args, token);
                    break;
                case "get_asset":
                    result = await handleGetAssetRequest(args, token);
                    break;
                case "trigger_cloud_flow":
                    result = await runDestructiveIfNeeded(
                        "trigger_cloud_flow",
                        args,
                        token,
                        elicit,
                        handleTriggerCloudFlowRequest
                    );
                    break;
                case "list_alerts":
                    result = await handleListAlertsRequest(args, token);
                    break;
                case "get_alert":
                    result = await handleGetAlertRequest(args, token);
                    break;
                case "create_alert":
                    result = await runDestructiveIfNeeded(
                        "create_alert",
                        args,
                        token,
                        elicit,
                        handleCreateAlertRequest
                    );
                    break;
                case "update_alert":
                    result = await runDestructiveIfNeeded(
                        "update_alert",
                        args,
                        token,
                        elicit,
                        handleUpdateAlertRequest
                    );
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
                    result = await runDestructiveIfNeeded("update_user", args, token, elicit, handleUpdateUserRequest);
                    break;
                case "invite_user":
                    result = await runDestructiveIfNeeded("invite_user", args, token, elicit, handleInviteUserRequest);
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
                    result = await runDestructiveIfNeeded(
                        "create_label",
                        args,
                        token,
                        elicit,
                        handleCreateLabelRequest
                    );
                    break;
                case "update_label":
                    result = await runDestructiveIfNeeded(
                        "update_label",
                        args,
                        token,
                        elicit,
                        handleUpdateLabelRequest
                    );
                    break;
                case "get_label_assignments":
                    result = await handleGetLabelAssignmentsRequest(args, token);
                    break;
                case "assign_objects_to_label":
                    result = await runDestructiveIfNeeded(
                        "assign_objects_to_label",
                        args,
                        token,
                        elicit,
                        handleAssignObjectsToLabelRequest
                    );
                    break;
                case "list_datahub_datasets":
                    result = await handleListDatahubDatasetsRequest(args, token);
                    break;
                case "get_datahub_dataset":
                    result = await handleGetDatahubDatasetRequest(args, token);
                    break;
                case "create_datahub_dataset":
                    result = await runDestructiveIfNeeded(
                        "create_datahub_dataset",
                        args,
                        token,
                        elicit,
                        handleCreateDatahubDatasetRequest
                    );
                    break;
                case "update_datahub_dataset":
                    result = await runDestructiveIfNeeded(
                        "update_datahub_dataset",
                        args,
                        token,
                        elicit,
                        handleUpdateDatahubDatasetRequest
                    );
                    break;
                case "send_datahub_events":
                    result = await runDestructiveIfNeeded(
                        "send_datahub_events",
                        args,
                        token,
                        elicit,
                        handleSendDatahubEventsRequest
                    );
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
                    result = await runDestructiveIfNeeded(
                        "create_budget",
                        args,
                        token,
                        elicit,
                        handleCreateBudgetRequest
                    );
                    break;
                case "update_budget":
                    result = await runDestructiveIfNeeded(
                        "update_budget",
                        args,
                        token,
                        elicit,
                        handleUpdateBudgetRequest
                    );
                    break;
                case "list_annotations":
                    result = await handleListAnnotationsRequest(args, token);
                    break;
                case "get_annotation":
                    result = await handleGetAnnotationRequest(args, token);
                    break;
                case "create_annotation":
                    result = await runDestructiveIfNeeded(
                        "create_annotation",
                        args,
                        token,
                        elicit,
                        handleCreateAnnotationRequest
                    );
                    break;
                case "update_annotation":
                    result = await runDestructiveIfNeeded(
                        "update_annotation",
                        args,
                        token,
                        elicit,
                        handleUpdateAnnotationRequest
                    );
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

            // Apply response conversion if provided
            return convertResponse ? convertResponse(result) : result;
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
