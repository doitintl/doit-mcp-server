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
import { getAlertTool, handleGetAlertRequest, handleListAlertsRequest, listAlertsTool } from "./tools/alerts.js";
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
import { anomaliesTool, anomalyTool, handleAnomaliesRequest, handleAnomalyRequest } from "./tools/anomalies.js";
import { handleListAssetsRequest, listAssetsTool } from "./tools/assets.js";
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
import { dimensionTool, handleDimensionRequest } from "./tools/dimension.js";
import { dimensionsTool, handleDimensionsRequest } from "./tools/dimensions.js";
import {
    getInvoiceTool,
    handleGetInvoiceRequest,
    handleListInvoicesRequest,
    listInvoicesTool,
} from "./tools/invoices.js";
import { getLabelTool, handleGetLabelRequest, handleListLabelsRequest, listLabelsTool } from "./tools/labels.js";
import { handleListOrganizationsRequest, listOrganizationsTool } from "./tools/organizations.js";
import { handleListPlatformsRequest, listPlatformsTool } from "./tools/platforms.js";
import { handleListProductsRequest, listProductsTool } from "./tools/products.js";
import {
    getReportResultsTool,
    handleGetReportResultsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    reportsTool,
    runQueryTool,
} from "./tools/reports.js";
import { handleListRolesRequest, listRolesTool } from "./tools/roles.js";
import { handleListTicketsRequest, listTicketsTool } from "./tools/tickets.js";
import { handleListUsersRequest, listUsersTool } from "./tools/users.js";
import { handleValidateUserRequest, validateUserTool } from "./tools/validateUser.js";
import { SERVER_NAME, SERVER_VERSION } from "./utils/consts.js";
import { executeToolHandler } from "./utils/toolsHandler.js";
import { createErrorResponse, formatZodError, handleGeneralError } from "./utils/util.js";

export function createServer() {
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
                cloudIncidentsTool,
                cloudIncidentTool,
                anomaliesTool,
                anomalyTool,
                reportsTool,
                runQueryTool,
                getReportResultsTool,
                validateUserTool,
                dimensionsTool,
                dimensionTool,
                listTicketsTool,
                listInvoicesTool,
                getInvoiceTool,
                listAllocationsTool,
                getAllocationTool,
                createAllocationTool,
                updateAllocationTool,
                listAssetsTool,
                listAlertsTool,
                getAlertTool,
                triggerCloudFlowTool,
                listOrganizationsTool,
                listPlatformsTool,
                listUsersTool,
                listRolesTool,
                listProductsTool,
                listLabelsTool,
                getLabelTool,
                findCloudDiagramsTool,
                listBudgetsTool,
                getBudgetTool,
                createBudgetTool,
                updateBudgetTool,
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

        return await executeToolHandler(name, args, token);
    });

    server.setRequestHandler(InitializeRequestSchema, async (request) => {
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
    handleCloudIncidentsRequest,
    handleCloudIncidentRequest,
    handleAnomaliesRequest,
    handleAnomalyRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    handleGetReportResultsRequest,
    handleValidateUserRequest,
    handleDimensionsRequest,
    handleDimensionRequest,
    handleListTicketsRequest,
    handleListInvoicesRequest,
    handleGetInvoiceRequest,
    handleListAllocationsRequest,
    handleGetAllocationRequest,
    handleCreateAllocationRequest,
    handleUpdateAllocationRequest,
    handleListAssetsRequest,
    handleTriggerCloudFlowRequest,
    handleListAlertsRequest,
    handleGetAlertRequest,
    handleListOrganizationsRequest,
    handleListPlatformsRequest,
    handleListUsersRequest,
    handleListRolesRequest,
    handleListProductsRequest,
    handleListLabelsRequest,
    handleGetLabelRequest,
    handleFindCloudDiagramsRequest,
    handleListBudgetsRequest,
    handleGetBudgetRequest,
    handleCreateBudgetRequest,
    handleUpdateBudgetRequest,
    createErrorResponse,
    formatZodError,
    handleGeneralError,
};
