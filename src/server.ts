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
    createBudgetTool,
    getBudgetTool,
    handleCreateBudgetRequest,
    handleGetBudgetRequest,
    handleListBudgetsRequest,
    handleUpdateBudgetRequest,
    listBudgetsTool,
    updateBudgetTool,
} from "./tools/budgets.js";
import { findCloudDiagramsTool, handleFindCloudDiagramsRequest } from "./tools/cloudDiagrams.js";
import { handleTriggerCloudFlowRequest, triggerCloudFlowTool } from "./tools/cloudflow.js";
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
import { getInsightResourcesTool, listOptimizationRecommendationsTool } from "./tools/insights.js";
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
import {
    createTicketCommentTool,
    getTicketTool,
    handleCreateTicketCommentRequest,
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
import { SERVER_NAME, SERVER_VERSION } from "./utils/consts.js";
import { executeToolHandler } from "./utils/toolsHandler.js";
import { createErrorResponse, formatZodError, handleGeneralError, type TrackingContext } from "./utils/util.js";

export function createServer() {
    // Connection-level MCP client info — set once on initialize, read on every tool call.
    // Stored in a closure (not a module global) so each server instance is isolated.
    let mcpClientInfo: TrackingContext = {};
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
                listInvoicesTool,
                getInvoiceTool,
                listAllocationsTool,
                getAllocationTool,
                createAllocationTool,
                updateAllocationTool,
                listAssetsTool,
                getAssetTool,
                listAlertsTool,
                getAlertTool,
                createAlertTool,
                updateAlertTool,

                triggerCloudFlowTool,
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
                listDatahubDatasetsTool,
                getDatahubDatasetTool,
                createDatahubDatasetTool,
                updateDatahubDatasetTool,
                sendDatahubEventsTool,
                findCloudDiagramsTool,
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
                askAvaSyncTool,
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
        const { name, arguments: args } = request.params;
        const token = process.env.DOIT_API_KEY;
        if (!token) {
            return createErrorResponse("Unauthorized");
        }

        return await executeToolHandler(name, args, token, { trackingContext: mcpClientInfo });
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
    handleDimensionRequest,
    handleDimensionsRequest,
    handleFindCloudDiagramsRequest,
    handleGeneralError,
    handleGetAlertRequest,
    handleGetAllocationRequest,
    handleGetAnnotationRequest,
    handleGetAssetRequest,
    handleGetBudgetRequest,
    handleGetCommitmentRequest,
    handleGetDatahubDatasetRequest,
    handleGetInvoiceRequest,
    handleGetLabelAssignmentsRequest,
    handleGetLabelRequest,
    handleGetReportConfigRequest,
    handleGetReportResultsRequest,
    handleGetTicketRequest,
    handleInviteUserRequest,
    handleListAlertsRequest,
    handleListAllocationsRequest,
    handleListAnnotationsRequest,
    handleListAssetsRequest,
    handleListBudgetsRequest,
    handleListCommitmentsRequest,
    handleListDatahubDatasetsRequest,
    handleListInvoicesRequest,
    handleListLabelsRequest,
    handleListOrganizationsRequest,
    handleListPlatformsRequest,
    handleListProductsRequest,
    handleListRolesRequest,
    handleListTicketCommentsRequest,
    handleListTicketsRequest,
    handleListUsersRequest,
    handleReportsRequest,
    handleRunQueryRequest,
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
