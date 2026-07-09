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
import { handleListAccountTeamRequest } from "./tools/accountTeam.js";
import {
    handleCreateAlertRequest,
    handleGetAlertRequest,
    handleListAlertsRequest,
    handleUpdateAlertRequest,
} from "./tools/alerts.js";
import {
    handleCreateAllocationRequest,
    handleGetAllocationRequest,
    handleListAllocationsRequest,
    handleUpdateAllocationRequest,
} from "./tools/allocations.js";
import {
    handleCreateAnnotationRequest,
    handleGetAnnotationRequest,
    handleListAnnotationsRequest,
    handleUpdateAnnotationRequest,
} from "./tools/annotations.js";
import { handleAnomaliesRequest, handleAnomalyRequest } from "./tools/anomalies.js";
import { handleGetAssetRequest, handleListAssetsRequest } from "./tools/assets.js";
import { handleAskAvaSyncRequest } from "./tools/ava.js";
import { handleGetAwsAccountRequest, handleGetCloudConnectSupportedFeaturesRequest } from "./tools/awsAccounts.js";
import {
    handleCreateBudgetRequest,
    handleGetBudgetRequest,
    handleListBudgetsRequest,
    handleUpdateBudgetRequest,
} from "./tools/budgets.js";
import {
    handleFindCloudDiagramsRequest,
    handleGetCloudDiagramComponentsRequest,
    handleGetCloudDiagramCostSnapshotRequest,
    handleGetCloudDiagramResourceRelationshipsRequest,
    handleGetCloudDiagramsStatsRequest,
    handleListCloudDiagramActivityGroupsRequest,
    handleListCloudDiagramNodeActivitiesRequest,
    handleSearchCloudDiagramsRequest,
} from "./tools/cloudDiagrams.js";
import {
    handleGetCloudFlowConnectionRequest,
    handleGetCloudFlowTemplateRequest,
    handleListCloudFlowConnectionsRequest,
    handleListCloudFlowTemplatesRequest,
    handleRefineCloudflowRequest,
    handleTriggerCloudFlowRequest,
} from "./tools/cloudflow.js";
import { handleCloudIncidentRequest, handleCloudIncidentsRequest } from "./tools/cloudIncidents.js";
import { handleGetCommitmentRequest, handleListCommitmentsRequest } from "./tools/commitmentManager.js";
// Re-enable alongside the WRITE_GATED_SUMMARIES entry in utils/toolsHandler.ts
// and the registration in src/tools/handWrittenTools.ts.
// import { confirmActionTool } from "./tools/confirmAction.js";
import {
    handleCreateDatahubDatasetRequest,
    handleGetDatahubDatasetRequest,
    handleListDatahubDatasetsRequest,
    handleUpdateDatahubDatasetRequest,
} from "./tools/datahubDatasets.js";
import { handleSendDatahubEventsRequest } from "./tools/datahubEvents.js";
import { handleDimensionRequest } from "./tools/dimension.js";
import { handleDimensionsRequest } from "./tools/dimensions.js";
import {
    handleCreateFolderRequest,
    handleGetFolderRequest,
    handleListFoldersRequest,
    handleUpdateFolderRequest,
} from "./tools/folders.js";
import { generatedTools, generatedToolsByName } from "./tools/generated/registry.js";
import { HAND_WRITTEN_TOOLS } from "./tools/handWrittenTools.js";
import { handleGetInvoiceRequest, handleListInvoicesRequest } from "./tools/invoices.js";
import {
    handleAssignObjectsToLabelRequest,
    handleCreateLabelRequest,
    handleGetLabelAssignmentsRequest,
    handleGetLabelRequest,
    handleListLabelsRequest,
    handleUpdateLabelRequest,
} from "./tools/labels.js";
import { handleListOrganizationsRequest } from "./tools/organizations.js";
import { handleGetResourcePermissionsRequest, handleUpdateResourcePermissionsRequest } from "./tools/permissions.js";
import { handleListPlatformsRequest } from "./tools/platforms.js";
import { handleListProductsRequest } from "./tools/products.js";
import {
    handleCreateReportRequest,
    handleGetReportConfigRequest,
    handleGetReportResultsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    handleUpdateReportRequest,
} from "./tools/reports.js";
import { handleListRolesRequest } from "./tools/roles.js";
import { handleSearchCustomersRequest } from "./tools/searchCustomers.js";
import {
    handleGetActiveThemeRequest,
    handleGetThemeRequest,
    handleListThemesRequest,
    handleSetActiveThemeRequest,
    handleUpdateThemeRequest,
} from "./tools/themes.js";
import {
    handleCreateTicketCommentRequest,
    handleCreateTicketRequest,
    handleGetTicketRequest,
    handleListTicketCommentsRequest,
    handleListTicketsRequest,
} from "./tools/tickets.js";
import { handleInviteUserRequest, handleListUsersRequest, handleUpdateUserRequest } from "./tools/users.js";
import { handleValidateUserRequest } from "./tools/validateUser.js";
import { MemoryApprovalStore } from "./utils/approval.js";
import { SERVER_NAME, SERVER_VERSION } from "./utils/consts.js";
import { zodToMcpInputSchema } from "./utils/schemaHelpers.js";
import { executeToolHandler } from "./utils/toolsHandler.js";
import { createErrorResponse, formatZodError, handleGeneralError, type TrackingContext } from "./utils/util.js";

// Raw stdio tool definitions for every OpenAPI operation not already covered by a
// hand-written tool — see src/tools/handWrittenTools.ts (coversEndpoint).
const generatedToolDefinitions = generatedTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToMcpInputSchema(tool.zodSchema),
    annotations: tool.annotations,
    securitySchemes: tool.securitySchemes,
}));

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
                ...HAND_WRITTEN_TOOLS,
                // confirm_action is no longer exposed while the approval gate is
                // disabled — without any write-gated tool minting tokens there is
                // nothing for clients to confirm. Re-add when the gate returns.
                // confirmActionTool,
                ...generatedToolDefinitions,
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
            generatedTools: generatedToolsByName,
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
    handleCreateFolderRequest,
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
    handleGetCloudDiagramComponentsRequest,
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
    handleSetActiveThemeRequest,
    handleTriggerCloudFlowRequest,
    handleUpdateAlertRequest,
    handleUpdateAllocationRequest,
    handleUpdateAnnotationRequest,
    handleUpdateBudgetRequest,
    handleUpdateDatahubDatasetRequest,
    handleUpdateFolderRequest,
    handleUpdateLabelRequest,
    handleUpdateReportRequest,
    handleUpdateResourcePermissionsRequest,
    handleUpdateThemeRequest,
    handleUpdateUserRequest,
    handleValidateUserRequest,
};
