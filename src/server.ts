import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    GetPromptRequestSchema,
    InitializeRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { applyPromptMessageArguments, filterPromptArgs, prompts, resolvePromptMessages } from "./prompts/index.js";
import { handleListAccountTeamRequest, listAccountTeamTool } from "./tools/accountTeam.js";
import {
    createAlertTool,
    getAlertTool,
    handleCreateAlertRequest,
    handleGetAlertRequest,
    handleListAlertsRequest,
    handleUpdateAlertRequest,
    listAlertsTool,
    updateAlertTool,
} from "./tools/alerts.js";
import {
    createAllocationTool,
    getAllocationTool,
    handleCreateAllocationRequest,
    handleGetAllocationRequest,
    handleListAllocationsRequest,
    handleUpdateAllocationRequest,
    listAllocationsTool,
    updateAllocationTool,
} from "./tools/allocations.js";
import {
    createAnnotationTool,
    getAnnotationTool,
    handleCreateAnnotationRequest,
    handleGetAnnotationRequest,
    handleListAnnotationsRequest,
    handleUpdateAnnotationRequest,
    listAnnotationsTool,
    updateAnnotationTool,
} from "./tools/annotations.js";
import { anomaliesTool, anomalyTool, handleAnomaliesRequest, handleAnomalyRequest } from "./tools/anomalies.js";
import { getAssetTool, handleGetAssetRequest, handleListAssetsRequest, listAssetsTool } from "./tools/assets.js";
import { askAvaSyncTool, handleAskAvaSyncRequest } from "./tools/ava.js";
import {
    getAwsAccountTool,
    getCloudConnectSupportedFeaturesTool,
    handleGetAwsAccountRequest,
    handleGetCloudConnectSupportedFeaturesRequest,
} from "./tools/awsAccounts.js";
import {
    createBudgetTool,
    getBudgetTool,
    handleCreateBudgetRequest,
    handleGetBudgetRequest,
    handleListBudgetsRequest,
    handleUpdateBudgetRequest,
    listBudgetsTool,
    updateBudgetTool,
} from "./tools/budgets.js";
import {
    findCloudDiagramsTool,
    getCloudDiagramCostSnapshotTool,
    getCloudDiagramResourceRelationshipsTool,
    getCloudDiagramsStatsTool,
    handleFindCloudDiagramsRequest,
    handleGetCloudDiagramCostSnapshotRequest,
    handleGetCloudDiagramResourceRelationshipsRequest,
    handleGetCloudDiagramsStatsRequest,
    handleListCloudDiagramActivityGroupsRequest,
    handleListCloudDiagramNodeActivitiesRequest,
    handleSearchCloudDiagramsRequest,
    listCloudDiagramActivityGroupsTool,
    listCloudDiagramNodeActivitiesTool,
    searchCloudDiagramsTool,
} from "./tools/cloudDiagrams.js";
import {
    getCloudFlowConnectionTool,
    getCloudFlowTemplateTool,
    handleGetCloudFlowConnectionRequest,
    handleGetCloudFlowTemplateRequest,
    handleListCloudFlowConnectionsRequest,
    handleListCloudFlowTemplatesRequest,
    handleRefineCloudflowRequest,
    handleTriggerCloudFlowRequest,
    listCloudFlowConnectionsTool,
    listCloudFlowTemplatesTool,
    refineCloudflowTool,
    triggerCloudFlowTool,
} from "./tools/cloudflow.js";
import {
    cloudIncidentsTool,
    cloudIncidentTool,
    handleCloudIncidentRequest,
    handleCloudIncidentsRequest,
} from "./tools/cloudIncidents.js";
import {
    getCommitmentTool,
    handleGetCommitmentRequest,
    handleListCommitmentsRequest,
    listCommitmentsTool,
} from "./tools/commitmentManager.js";
// Re-enable alongside the WRITE_GATED_SUMMARIES entry in utils/toolsHandler.ts
// and the registration on the tool list below.
// import { confirmActionTool } from "./tools/confirmAction.js";
import {
    createDatahubDatasetTool,
    getDatahubDatasetTool,
    handleCreateDatahubDatasetRequest,
    handleGetDatahubDatasetRequest,
    handleListDatahubDatasetsRequest,
    handleUpdateDatahubDatasetRequest,
    listDatahubDatasetsTool,
    updateDatahubDatasetTool,
} from "./tools/datahubDatasets.js";
import { handleSendDatahubEventsRequest, sendDatahubEventsTool } from "./tools/datahubEvents.js";
import { dimensionTool, handleDimensionRequest } from "./tools/dimension.js";
import { dimensionsTool, handleDimensionsRequest } from "./tools/dimensions.js";
import { getFolderTool, handleGetFolderRequest, handleListFoldersRequest, listFoldersTool } from "./tools/folders.js";
import { getInsightResourcesTool, getInsightTool, listOptimizationRecommendationsTool } from "./tools/insights.js";
import {
    getInvoiceTool,
    handleGetInvoiceRequest,
    handleListInvoicesRequest,
    listInvoicesTool,
} from "./tools/invoices.js";
import {
    assignObjectsToLabelTool,
    createLabelTool,
    getLabelAssignmentsTool,
    getLabelTool,
    handleAssignObjectsToLabelRequest,
    handleCreateLabelRequest,
    handleGetLabelAssignmentsRequest,
    handleGetLabelRequest,
    handleListLabelsRequest,
    handleUpdateLabelRequest,
    listLabelsTool,
    updateLabelTool,
} from "./tools/labels.js";
import { handleListOrganizationsRequest, listOrganizationsTool } from "./tools/organizations.js";
import { cloudOverviewTool } from "./tools/overview.js";
import { getResourcePermissionsTool, handleGetResourcePermissionsRequest } from "./tools/permissions.js";
import { handleListPlatformsRequest, listPlatformsTool } from "./tools/platforms.js";
import { handleListProductsRequest, listProductsTool } from "./tools/products.js";
import { compareSpendTool, costBreakdownTool, costTrendTool } from "./tools/queryHelpers.js";
import {
    createReportTool,
    getReportConfigTool,
    getReportResultsTool,
    handleCreateReportRequest,
    handleGetReportConfigRequest,
    handleGetReportResultsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    handleUpdateReportRequest,
    reportsTool,
    runQueryTool,
    updateReportTool,
} from "./tools/reports.js";
import { handleListRolesRequest, listRolesTool } from "./tools/roles.js";
import { handleSearchCustomersRequest, searchCustomersTool } from "./tools/searchCustomers.js";
import {
    getActiveThemeTool,
    getThemeTool,
    handleGetActiveThemeRequest,
    handleGetThemeRequest,
    handleListThemesRequest,
    listThemesTool,
} from "./tools/themes.js";
import {
    createTicketCommentTool,
    createTicketTool,
    getTicketTool,
    handleCreateTicketCommentRequest,
    handleCreateTicketRequest,
    handleGetTicketRequest,
    handleListTicketCommentsRequest,
    handleListTicketsRequest,
    listTicketCommentsTool,
    listTicketsTool,
} from "./tools/tickets.js";
import {
    handleInviteUserRequest,
    handleListUsersRequest,
    handleUpdateUserRequest,
    inviteUserTool,
    listUsersTool,
    updateUserTool,
} from "./tools/users.js";
import { handleValidateUserRequest, validateUserTool } from "./tools/validateUser.js";
import { MemoryApprovalStore } from "./utils/approval.js";
import { SERVER_NAME, SERVER_VERSION } from "./utils/consts.js";
import { executeToolHandler } from "./utils/toolsHandler.js";
import { createErrorResponse, formatZodError, handleGeneralError, type TrackingContext } from "./utils/util.js";

export function createServer() {
    // Connection-level MCP client info — set once on initialize, read on every tool call.
    // Stored in a closure (not a module global) so each server instance is isolated.
    let mcpClientInfo: TrackingContext = {};

    // stdio is single-process and single-user, so a stable string is sufficient as the
    // identity the approval flow is bound to. The Worker transport binds to the
    // OAuth-derived api key instead — see doit-mcp-server/src/index.ts.
    const approvalStore = new MemoryApprovalStore();
    const userKey = "stdio-local";
    const server = new Server(
        {
            name: SERVER_NAME,
            version: SERVER_VERSION,
        },
        {
            capabilities: {
                tools: {},
                prompts: {},
                resources: {},
            },
        }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                cloudOverviewTool,
                cloudIncidentsTool,
                cloudIncidentTool,
                anomaliesTool,
                anomalyTool,
                reportsTool,
                runQueryTool,
                costBreakdownTool,
                costTrendTool,
                compareSpendTool,
                listOptimizationRecommendationsTool,
                getInsightResourcesTool,
                getInsightTool,
                getReportResultsTool,
                getReportConfigTool,
                createReportTool,
                updateReportTool,
                validateUserTool,
                dimensionsTool,
                dimensionTool,
                listTicketsTool,
                getTicketTool,
                listTicketCommentsTool,
                createTicketCommentTool,
                createTicketTool,
                listInvoicesTool,
                getInvoiceTool,
                listAllocationsTool,
                getAllocationTool,
                createAllocationTool,
                updateAllocationTool,
                listAssetsTool,
                getAssetTool,
                searchCustomersTool,
                listAlertsTool,
                getAlertTool,
                createAlertTool,
                updateAlertTool,

                triggerCloudFlowTool,
                listCloudFlowConnectionsTool,
                getCloudFlowConnectionTool,
                listCloudFlowTemplatesTool,
                getCloudFlowTemplateTool,
                refineCloudflowTool,
                listOrganizationsTool,
                listPlatformsTool,
                listUsersTool,
                updateUserTool,
                inviteUserTool,
                listRolesTool,
                listProductsTool,
                listLabelsTool,
                getLabelTool,
                createLabelTool,
                updateLabelTool,
                getLabelAssignmentsTool,
                assignObjectsToLabelTool,
                listFoldersTool,
                getFolderTool,
                listThemesTool,
                getThemeTool,
                getActiveThemeTool,
                getAwsAccountTool,
                getCloudConnectSupportedFeaturesTool,
                listDatahubDatasetsTool,
                getDatahubDatasetTool,
                createDatahubDatasetTool,
                updateDatahubDatasetTool,
                sendDatahubEventsTool,
                findCloudDiagramsTool,
                getCloudDiagramsStatsTool,
                searchCloudDiagramsTool,
                getCloudDiagramCostSnapshotTool,
                getCloudDiagramResourceRelationshipsTool,
                listCloudDiagramActivityGroupsTool,
                listCloudDiagramNodeActivitiesTool,
                listBudgetsTool,
                getBudgetTool,
                createBudgetTool,
                updateBudgetTool,
                listAnnotationsTool,
                getAnnotationTool,
                createAnnotationTool,
                updateAnnotationTool,
                listCommitmentsTool,
                getCommitmentTool,
                listAccountTeamTool,
                getResourcePermissionsTool,
                askAvaSyncTool,
                // confirm_action is no longer exposed while the approval gate is
                // disabled — without any write-gated tool minting tokens there is
                // nothing for clients to confirm. Re-add when the gate returns.
                // confirmActionTool,
            ],
        };
    });

    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
            prompts: prompts.map((prompt) => ({
                name: prompt.name,
                description: prompt.description,
                ...(prompt.arguments ? { arguments: prompt.arguments } : {}),
            })),
        };
    });

    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name } = request.params;
        const prompt = prompts.find((p) => p.name === name);
        if (!prompt) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid prompt name: ${name}`);
        }

        try {
            const args = filterPromptArgs(prompt, request.params.arguments ?? {});
            const resolvedMessages = resolvePromptMessages(prompt);
            const messages = applyPromptMessageArguments(resolvedMessages, args);

            return {
                description: prompt.description,
                messages: messages.map((message) => ({
                    role: message.role,
                    content: {
                        type: "text",
                        text: message.text,
                    },
                })),
            };
        } catch (error) {
            if (error instanceof McpError) throw error;
            throw new McpError(
                ErrorCode.InternalError,
                error instanceof Error ? error.message : "An unexpected error occurred"
            );
        }
    });

    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
            resources: [],
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args, _meta } = request.params;
        const token = process.env.DOIT_API_KEY;
        if (!token) {
            return createErrorResponse("Unauthorized");
        }

        const progressToken = _meta?.progressToken;
        const onProgress = progressToken
            ? async (message: string) =>
                  server.notification({
                      method: "notifications/progress",
                      params: { progressToken, progress: 0, message },
                  })
            : undefined;

        return await executeToolHandler(name, args, token, {
            trackingContext: mcpClientInfo,
            userKey,
            approvalStore,
            onProgress,
        });
    });

    server.setRequestHandler(InitializeRequestSchema, async (request) => {
        mcpClientInfo = {
            mcpClient: request?.params?.clientInfo?.name,
            mcpClientVersion: request?.params?.clientInfo?.version,
            mcpProtocolVersion: request?.params?.protocolVersion,
        };

        return {
            protocolVersion: request?.params?.protocolVersion || "2024-11-05",
            serverInfo: {
                name: SERVER_NAME,
                version: SERVER_VERSION,
            },
            // biome-ignore lint/complexity/useLiteralKeys: bracket notation bypasses private property TS check
            capabilities: server["_capabilities"] || {},
        };
    });

    return server;
}

export const server = createServer();

export {
    createErrorResponse,
    formatZodError,
    handleAnomaliesRequest,
    handleAnomalyRequest,
    handleAskAvaSyncRequest,
    handleAssignObjectsToLabelRequest,
    handleCloudIncidentRequest,
    handleCloudIncidentsRequest,
    handleCreateAlertRequest,
    handleCreateAllocationRequest,
    handleCreateAnnotationRequest,
    handleCreateBudgetRequest,
    handleCreateDatahubDatasetRequest,
    handleCreateLabelRequest,
    handleCreateReportRequest,
    handleCreateTicketCommentRequest,
    handleCreateTicketRequest,
    handleDimensionRequest,
    handleDimensionsRequest,
    handleFindCloudDiagramsRequest,
    handleGeneralError,
    handleGetActiveThemeRequest,
    handleGetAlertRequest,
    handleGetAllocationRequest,
    handleGetAnnotationRequest,
    handleGetAssetRequest,
    handleGetAwsAccountRequest,
    handleGetBudgetRequest,
    handleGetCloudConnectSupportedFeaturesRequest,
    handleGetCloudDiagramCostSnapshotRequest,
    handleGetCloudDiagramResourceRelationshipsRequest,
    handleGetCloudDiagramsStatsRequest,
    handleGetCloudFlowConnectionRequest,
    handleGetCloudFlowTemplateRequest,
    handleGetCommitmentRequest,
    handleGetDatahubDatasetRequest,
    handleGetFolderRequest,
    handleGetInvoiceRequest,
    handleGetLabelAssignmentsRequest,
    handleGetLabelRequest,
    handleGetReportConfigRequest,
    handleGetReportResultsRequest,
    handleGetResourcePermissionsRequest,
    handleGetThemeRequest,
    handleGetTicketRequest,
    handleInviteUserRequest,
    handleListAccountTeamRequest,
    handleListAlertsRequest,
    handleListAllocationsRequest,
    handleListAnnotationsRequest,
    handleListAssetsRequest,
    handleListBudgetsRequest,
    handleListCloudDiagramActivityGroupsRequest,
    handleListCloudDiagramNodeActivitiesRequest,
    handleListCloudFlowConnectionsRequest,
    handleListCloudFlowTemplatesRequest,
    handleListCommitmentsRequest,
    handleListDatahubDatasetsRequest,
    handleListFoldersRequest,
    handleListInvoicesRequest,
    handleListLabelsRequest,
    handleListOrganizationsRequest,
    handleListPlatformsRequest,
    handleListProductsRequest,
    handleListRolesRequest,
    handleListThemesRequest,
    handleListTicketCommentsRequest,
    handleListTicketsRequest,
    handleListUsersRequest,
    handleRefineCloudflowRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    handleSearchCloudDiagramsRequest,
    handleSearchCustomersRequest,
    handleSendDatahubEventsRequest,
    handleTriggerCloudFlowRequest,
    handleUpdateAlertRequest,
    handleUpdateAllocationRequest,
    handleUpdateAnnotationRequest,
    handleUpdateBudgetRequest,
    handleUpdateDatahubDatasetRequest,
    handleUpdateLabelRequest,
    handleUpdateReportRequest,
    handleUpdateUserRequest,
    handleValidateUserRequest,
};
