import { ProtocolError, ProtocolErrorCode, Server, type Tool } from "@modelcontextprotocol/server";
import { CLOUDFLOW_AUTHORING_GUIDE } from "./docs/cloudflowGuidance.js";
import { SERVER_INSTRUCTIONS } from "./docs/serverInstructions.js";
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
    handleBuildCloudflowRequest,
    handleCreateCloudFlowConnectionRequest,
    handleGetCloudFlowConnectionRequest,
    handleGetCloudFlowTemplateRequest,
    handleListCloudFlowConnectionsRequest,
    handleListCloudFlowTemplatesRequest,
    handleRefineCloudflowRequest,
    handleTriggerCloudFlowRequest,
    handleUpdateCloudFlowConnectionRequest,
} from "./tools/cloudflow.js";
import { handleCloudIncidentRequest, handleCloudIncidentsRequest } from "./tools/cloudIncidents.js";
import { handleGetCommitmentRequest, handleListCommitmentsRequest } from "./tools/commitmentManager.js";
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
    title: tool.title,
    description: tool.description,
    inputSchema: zodToMcpInputSchema(tool.zodSchema),
    annotations: tool.annotations,
    securitySchemes: tool.securitySchemes,
}));

// Resources are pull-only: a client has to ask. This is the depth-on-request tier — the
// load-bearing rules also ride the tool descriptions and the server instructions.
const CLOUDFLOW_GUIDE_URI = "doit://docs/cloudflow-authoring";

/**
 * Connection-level MCP client identity, attached to every tool call for analytics.
 *
 * This used to be captured by a hand-written `initialize` handler into a closure
 * variable. That handler was removed: in v2 the SDK's own `initialize` does work an
 * override silently skips — it negotiates and records the protocol version (which the
 * outbound wire codec is selected from), calls `transport.setProtocolVersion()`, and
 * stores the client's capabilities and identity. Reading those back through the public
 * accessors keeps the same three fields without reimplementing the handshake.
 */
function resolveTrackingContext(server: Server): TrackingContext {
    const clientInfo = server.getClientVersion();
    return {
        mcpClient: clientInfo?.name,
        mcpClientVersion: clientInfo?.version,
        mcpProtocolVersion: server.getNegotiatedProtocolVersion(),
    };
}

export function createServer() {
    // stdio is single-process and single-user, so a stable string is sufficient as the
    // identity the approval flow is bound to. The Worker transport binds to the
    // OAuth-derived api key instead — see the remote Worker in the separate private repo.
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
            // Returned in the initialize result. Only the stdio server is constructed here —
            // the remote Worker builds its own Server and has to pass this itself.
            instructions: SERVER_INSTRUCTIONS,
        }
    );

    server.setRequestHandler("tools/list", async () => {
        return {
            // v2 types handler returns from the method name, so this array is now checked
            // against the spec `Tool` type. Two of our fields aren't spec vocabulary:
            // `securitySchemes` (DoiT OAuth scope hints, consumed downstream) and
            // `coversEndpoint` (internal, feeds COVERED_ENDPOINTS — it has always leaked
            // onto the wire from here). The cast keeps both on the wire byte-for-byte so
            // this SDK swap stays behaviour-neutral; relocating `securitySchemes` under
            // `_meta` and dropping `coversEndpoint` are wire-visible changes that belong
            // in their own commit.
            tools: [...HAND_WRITTEN_TOOLS, ...generatedToolDefinitions] as unknown as Tool[],
        };
    });

    server.setRequestHandler("prompts/list", async () => {
        return {
            prompts: prompts.map((prompt) => ({
                name: prompt.name,
                description: prompt.description,
                ...(prompt.arguments ? { arguments: prompt.arguments } : {}),
            })),
        };
    });

    server.setRequestHandler("prompts/get", async (request) => {
        const { name } = request.params;
        const prompt = prompts.find((p) => p.name === name);
        if (!prompt) {
            throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Invalid prompt name: ${name}`);
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
            if (error instanceof ProtocolError) throw error;
            throw new ProtocolError(
                ProtocolErrorCode.InternalError,
                error instanceof Error ? error.message : "An unexpected error occurred"
            );
        }
    });

    server.setRequestHandler("resources/list", async () => {
        return {
            resources: [
                {
                    uri: CLOUDFLOW_GUIDE_URI,
                    name: "CloudFlow authoring guide",
                    description: "Runtime contracts for authoring, repairing and verifying CloudFlow flows.",
                    mimeType: "text/markdown",
                },
            ],
        };
    });

    server.setRequestHandler("resources/read", async (request) => {
        if (request.params.uri !== CLOUDFLOW_GUIDE_URI) {
            throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown resource: ${request.params.uri}`);
        }

        return {
            contents: [
                {
                    uri: CLOUDFLOW_GUIDE_URI,
                    mimeType: "text/markdown",
                    text: CLOUDFLOW_AUTHORING_GUIDE,
                },
            ],
        };
    });

    server.setRequestHandler("tools/call", async (request) => {
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
            trackingContext: resolveTrackingContext(server),
            userKey,
            approvalStore,
            onProgress,
            generatedTools: generatedToolsByName,
        });
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
    handleBuildCloudflowRequest,
    handleCloudIncidentRequest,
    handleCloudIncidentsRequest,
    handleCreateAlertRequest,
    handleCreateAllocationRequest,
    handleCreateAnnotationRequest,
    handleCreateBudgetRequest,
    handleCreateCloudFlowConnectionRequest,
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
    handleUpdateCloudFlowConnectionRequest,
    handleUpdateDatahubDatasetRequest,
    handleUpdateFolderRequest,
    handleUpdateLabelRequest,
    handleUpdateReportRequest,
    handleUpdateResourcePermissionsRequest,
    handleUpdateThemeRequest,
    handleUpdateUserRequest,
    handleValidateUserRequest,
};
