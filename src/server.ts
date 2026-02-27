import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    GetPromptRequestSchema,
    InitializeRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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
import {
    getReportResultsTool,
    handleGetReportResultsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    reportsTool,
    runQueryTool,
} from "./tools/reports.js";
import { handleListTicketsRequest, listTicketsTool } from "./tools/tickets.js";
import { handleValidateUserRequest, validateUserTool } from "./tools/validateUser.js";
import { SERVER_VERSION } from "./utils/consts.js";
import { prompts } from "./utils/prompts.js";
import { executeToolHandler } from "./utils/toolsHandler.js";
import { createErrorResponse, formatZodError, handleGeneralError } from "./utils/util.js";

export function createServer() {
    const server = new Server(
        {
            name: "doit-mcp-server",
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
            throw new Error(`Prompt not found: ${name}`);
        }
        return {
            description: prompt.description,
            messages: [
                {
                    role: prompt.role ?? "user",
                    content: {
                        type: "text",
                        text: prompt.text,
                    },
                },
            ],
        };
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
                name: "doit-mcp-server",
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
    createErrorResponse,
    formatZodError,
    handleGeneralError,
};
