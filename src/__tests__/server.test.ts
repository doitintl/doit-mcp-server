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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { prompts } from "../prompts/index.js";
import { SERVER_VERSION } from "../utils/consts.js";

vi.mock("@modelcontextprotocol/sdk/server/index.js");
vi.mock(import("../tools/cloudIncidents.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleCloudIncidentsRequest: vi.fn(),
    handleCloudIncidentRequest: vi.fn(),
}));
vi.mock(import("../tools/anomalies.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleAnomaliesRequest: vi.fn(),
    handleAnomalyRequest: vi.fn(),
}));
vi.mock(import("../tools/reports.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleReportsRequest: vi.fn(),
    handleRunQueryRequest: vi.fn(),
    handleGetReportResultsRequest: vi.fn(),
    handleGetReportConfigRequest: vi.fn(),
    handleCreateReportRequest: vi.fn(),
    handleUpdateReportRequest: vi.fn(),
}));
vi.mock(import("../tools/validateUser.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleValidateUserRequest: vi.fn(),
}));
vi.mock(import("../tools/dimensions.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleDimensionsRequest: vi.fn(),
}));
vi.mock(import("../tools/dimension.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleDimensionRequest: vi.fn(),
}));
vi.mock(import("../tools/tickets.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListTicketsRequest: vi.fn(),
}));
vi.mock(import("../tools/invoices.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListInvoicesRequest: vi.fn(),
    handleGetInvoiceRequest: vi.fn(),
}));
vi.mock(import("../tools/allocations.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListAllocationsRequest: vi.fn(),
    handleGetAllocationRequest: vi.fn(),
    handleCreateAllocationRequest: vi.fn(),
    handleUpdateAllocationRequest: vi.fn(),
}));
vi.mock(import("../tools/assets.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleGetAssetRequest: vi.fn(),
    handleListAssetsRequest: vi.fn(),
}));
vi.mock(import("../tools/alerts.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListAlertsRequest: vi.fn(),
    handleGetAlertRequest: vi.fn(),
    handleCreateAlertRequest: vi.fn(),
    handleUpdateAlertRequest: vi.fn(),
}));
vi.mock(import("../tools/cloudflow.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleTriggerCloudFlowRequest: vi.fn(),
}));
vi.mock(import("../tools/organizations.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListOrganizationsRequest: vi.fn(),
}));
vi.mock(import("../tools/roles.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListRolesRequest: vi.fn(),
}));
vi.mock(import("../tools/labels.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListLabelsRequest: vi.fn(),
    handleGetLabelRequest: vi.fn(),
    handleCreateLabelRequest: vi.fn(),
    handleUpdateLabelRequest: vi.fn(),
    handleGetLabelAssignmentsRequest: vi.fn(),
    handleAssignObjectsToLabelRequest: vi.fn(),
}));
vi.mock(import("../tools/datahubDatasets.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListDatahubDatasetsRequest: vi.fn(),
    handleGetDatahubDatasetRequest: vi.fn(),
    handleCreateDatahubDatasetRequest: vi.fn(),
    handleUpdateDatahubDatasetRequest: vi.fn(),
}));
vi.mock(import("../tools/datahubEvents.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleSendDatahubEventsRequest: vi.fn(),
}));
vi.mock(import("../tools/cloudDiagrams.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleFindCloudDiagramsRequest: vi.fn(),
}));
vi.mock(import("../tools/budgets.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListBudgetsRequest: vi.fn(),
    handleGetBudgetRequest: vi.fn(),
    handleCreateBudgetRequest: vi.fn(),
    handleUpdateBudgetRequest: vi.fn(),
}));
vi.mock(import("../tools/annotations.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListAnnotationsRequest: vi.fn(),
    handleGetAnnotationRequest: vi.fn(),
    handleCreateAnnotationRequest: vi.fn(),
    handleUpdateAnnotationRequest: vi.fn(),
}));
vi.mock(import("../utils/util.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    createErrorResponse: vi.fn((msg) => ({ content: [{ type: "text", text: msg }] })),
    createSuccessResponse: vi.fn((text) => ({ content: [{ type: "text", text }] })),
    formatZodError: vi.fn((error) => `Formatted Zod Error: ${error.message}`),
    handleGeneralError: vi.fn((_error, context) => ({
        content: [{ type: "text", text: `General Error: ${context}` }],
    })),
    DOIT_API_BASE: "https://api.doit.com",
    makeDoitRequest: vi.fn(),
}));

const setRequestHandlerMock = vi.fn();
(Server as any).mockImplementation(() => ({
    setRequestHandler: setRequestHandlerMock,
    connect: vi.fn(),
    _capabilities: { tools: {}, prompts: {}, resources: {} },
}));

import {
    createServer,
    handleAnomaliesRequest,
    handleAnomalyRequest,
    handleAssignObjectsToLabelRequest,
    handleCloudIncidentRequest,
    handleCloudIncidentsRequest,
    handleCreateAllocationRequest,
    handleCreateDatahubDatasetRequest,
    handleCreateLabelRequest,
    handleDimensionRequest,
    handleDimensionsRequest,
    handleGeneralError,
    handleGetAlertRequest,
    handleGetAllocationRequest,
    handleGetAssetRequest,
    handleGetDatahubDatasetRequest,
    handleGetInvoiceRequest,
    handleGetLabelAssignmentsRequest,
    handleGetReportResultsRequest,
    handleListAlertsRequest,
    handleListAllocationsRequest,
    handleListAssetsRequest,
    handleListDatahubDatasetsRequest,
    handleListInvoicesRequest,
    handleListTicketsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    handleSendDatahubEventsRequest,
    handleTriggerCloudFlowRequest,
    handleUpdateAllocationRequest,
    handleUpdateDatahubDatasetRequest,
    handleUpdateLabelRequest,
    handleUpdateReportRequest,
    handleValidateUserRequest,
} from "../server.js";
import { createAlertTool, getAlertTool, listAlertsTool, updateAlertTool } from "../tools/alerts.js";

import {
    createAllocationTool,
    getAllocationTool,
    listAllocationsTool,
    updateAllocationTool,
} from "../tools/allocations.js";
import {
    createAnnotationTool,
    getAnnotationTool,
    listAnnotationsTool,
    updateAnnotationTool,
} from "../tools/annotations.js";
import { anomaliesTool, anomalyTool } from "../tools/anomalies.js";
import { getAssetTool, listAssetsTool } from "../tools/assets.js";
import { createBudgetTool, getBudgetTool, listBudgetsTool, updateBudgetTool } from "../tools/budgets.js";
import { findCloudDiagramsTool } from "../tools/cloudDiagrams.js";
import { triggerCloudFlowTool } from "../tools/cloudflow.js";
import { cloudIncidentsTool, cloudIncidentTool } from "../tools/cloudIncidents.js";
import {
    createDatahubDatasetTool,
    getDatahubDatasetTool,
    listDatahubDatasetsTool,
    updateDatahubDatasetTool,
} from "../tools/datahubDatasets.js";
import { sendDatahubEventsTool } from "../tools/datahubEvents.js";
import { dimensionTool } from "../tools/dimension.js";
import { dimensionsTool } from "../tools/dimensions.js";
import { getInvoiceTool, listInvoicesTool } from "../tools/invoices.js";
import {
    assignObjectsToLabelTool,
    createLabelTool,
    getLabelAssignmentsTool,
    getLabelTool,
    listLabelsTool,
    updateLabelTool,
} from "../tools/labels.js";
import { listOrganizationsTool } from "../tools/organizations.js";
import { listPlatformsTool } from "../tools/platforms.js";
import { listProductsTool } from "../tools/products.js";
import {
    createReportTool,
    getReportConfigTool,
    getReportResultsTool,
    reportsTool,
    runQueryTool,
    updateReportTool,
} from "../tools/reports.js";
import { listRolesTool } from "../tools/roles.js";
import { listTicketsTool } from "../tools/tickets.js";
import { listUsersTool } from "../tools/users.js";
import { validateUserTool } from "../tools/validateUser.js";
import * as utilModule from "../utils/util.js";

const createErrorResponseSpy = vi.spyOn(utilModule, "createErrorResponse");
const formatZodErrorSpy = vi.spyOn(utilModule, "formatZodError");

const originalProcessEnv = process.env;
let _server: any;

beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalProcessEnv, DOIT_API_KEY: "fake-token" };
    (Server as any).mockImplementation(() => ({
        setRequestHandler: setRequestHandlerMock,
        connect: vi.fn(),
        _capabilities: { tools: {}, prompts: {}, resources: {} },
    }));
    _server = createServer();
    formatZodErrorSpy.mockClear();
    createErrorResponseSpy.mockClear();
});

afterEach(() => {
    process.env = originalProcessEnv;
});

describe("createServer", () => {
    it("creates a Server instance with correct name and version", () => {
        expect(Server).toHaveBeenCalledWith(
            { name: "doit-mcp-server", version: SERVER_VERSION },
            { capabilities: { tools: {}, prompts: {}, resources: {} } }
        );
    });

    it("registers handlers for all required schemas", () => {
        expect(setRequestHandlerMock).toHaveBeenCalledWith(ListToolsRequestSchema, expect.any(Function));
        expect(setRequestHandlerMock).toHaveBeenCalledWith(ListPromptsRequestSchema, expect.any(Function));
        expect(setRequestHandlerMock).toHaveBeenCalledWith(GetPromptRequestSchema, expect.any(Function));
        expect(setRequestHandlerMock).toHaveBeenCalledWith(ListResourcesRequestSchema, expect.any(Function));
        expect(setRequestHandlerMock).toHaveBeenCalledWith(CallToolRequestSchema, expect.any(Function));
        expect(setRequestHandlerMock).toHaveBeenCalledWith(InitializeRequestSchema, expect.any(Function));
    });
});

describe("ListToolsRequestSchema handler", () => {
    it("returns all registered tools in order", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === ListToolsRequestSchema)?.[1];

        const response = await handler();

        expect(response).toEqual({
            tools: [
                cloudIncidentsTool,
                cloudIncidentTool,
                anomaliesTool,
                anomalyTool,
                reportsTool,
                runQueryTool,
                getReportResultsTool,
                getReportConfigTool,
                createReportTool,
                updateReportTool,
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
                getAssetTool,
                listAlertsTool,
                getAlertTool,
                createAlertTool,
                updateAlertTool,

                triggerCloudFlowTool,
                listOrganizationsTool,
                listPlatformsTool,
                listUsersTool,
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
            ],
        });
    });
});

describe("ListPromptsRequestSchema handler", () => {
    it("returns a non-empty list of prompts with name and description fields", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === ListPromptsRequestSchema)?.[1];

        const response = await handler();

        expect(response.prompts.length).toBeGreaterThan(0);
        expect(response.prompts[0]).toHaveProperty("name");
        expect(response.prompts[0]).toHaveProperty("description");
        expect(response.prompts[0]).not.toHaveProperty("text");
    });

    it("exposes only snake_case names", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === ListPromptsRequestSchema)?.[1];

        const response = await handler();
        const names: string[] = response.prompts.map((p: { name: string }) => p.name);
        const snakeCasePattern = /^[a-z][a-z0-9_]*$/;

        expect(names).toContain("allow_artifacts");
        expect(names).not.toContain("Allow Artifacts");
        for (const name of names) {
            expect(name).toMatch(snakeCasePattern);
        }
    });
});

describe("GetPromptRequestSchema handler", () => {
    const TEST_PROMPT_NAMES = ["__test_multi__", "__test_args__", "__test_no_args__"];

    afterEach(() => {
        for (const name of TEST_PROMPT_NAMES) {
            const idx = prompts.findIndex((p) => p.name === name);
            if (idx !== -1) prompts.splice(idx, 1);
        }
    });

    it("returns description and a single message for a snake_case prompt name", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];

        const response = await handler({ params: { name: "allow_artifacts" } });

        expect(response).toHaveProperty("description");
        expect(response).toHaveProperty("messages");
        expect(response.messages).toHaveLength(1);
        expect(response.messages[0].role).toBe("user");
        expect(response.messages[0].content.type).toBe("text");
        expect(response.messages[0].content.text).toBeTruthy();
    });

    it("throws McpError with InvalidParams for a human-readable prompt name (not exposed by this server)", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];

        await expect(handler({ params: { name: "Allow Artifacts" } })).rejects.toThrow(McpError);
        await expect(handler({ params: { name: "Allow Artifacts" } })).rejects.toMatchObject({
            code: ErrorCode.InvalidParams,
        });
    });

    it("returns all messages for a multi-message prompt", async () => {
        const multiMessagePrompt = {
            name: "__test_multi__",
            description: "Multi-message test prompt",
            messages: [
                { role: "user" as const, text: "Hello" },
                { role: "assistant" as const, text: "How can I help?" },
                { role: "user" as const, text: "Tell me about costs." },
            ],
        };
        prompts.push(multiMessagePrompt); // this will be cleaned up by the afterEach hook

        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({ params: { name: "__test_multi__" } });

        expect(response.messages).toHaveLength(3);
        expect(response.messages[0]).toEqual({ role: "user", content: { type: "text", text: "Hello" } });
        expect(response.messages[1]).toEqual({ role: "assistant", content: { type: "text", text: "How can I help?" } });
        expect(response.messages[2]).toEqual({ role: "user", content: { type: "text", text: "Tell me about costs." } });
    });

    it("throws McpError with InvalidParams for an unknown prompt name", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];

        await expect(handler({ params: { name: "nonexistent-prompt" } })).rejects.toThrow(McpError);
        await expect(handler({ params: { name: "nonexistent-prompt" } })).rejects.toMatchObject({
            code: ErrorCode.InvalidParams,
            message: expect.stringContaining("nonexistent-prompt"),
        });
    });

    it("returns messages with only the provided arguments appended, ignoring missing ones", async () => {
        prompts.push({
            name: "__test_args__",
            description: "Test prompt with required args",
            text: "Please handle the following request.",
            arguments: [
                { name: "arg1", description: "First arg", required: true },
                { name: "arg2", description: "Second arg", required: true },
            ],
        });

        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({
            params: { name: "__test_args__", arguments: { arg1: "value" } },
        });

        expect(response.messages).toHaveLength(1);
        expect(response.messages[0].content.text).toBe("Please handle the following request.\n\narg1: value");
    });

    it("appends required arguments as key-value pairs after the last message", async () => {
        prompts.push({
            name: "__test_args__",
            description: "Test prompt with required args",
            text: "Please handle the following request.",
            arguments: [
                { name: "name", description: "User name", required: true },
                { name: "id", description: "User ID", required: true },
            ],
        });

        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({
            params: { name: "__test_args__", arguments: { name: "Alice", id: "42" } },
        });

        expect(response.messages).toHaveLength(1);
        expect(response.messages[0].content.text).toBe("Please handle the following request.\n\nname: Alice\nid: 42");
    });

    it("appends arguments only to the last message in a multi-message prompt", async () => {
        prompts.push({
            name: "__test_args__",
            description: "Multi-message prompt with args",
            messages: [
                { role: "user" as const, text: "What should I do?" },
                { role: "assistant" as const, text: "I will trigger the flow." },
            ],
            arguments: [{ name: "flowID", description: "Flow ID", required: true }],
        });

        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({
            params: { name: "__test_args__", arguments: { flowID: "flow-7" } },
        });

        expect(response.messages).toHaveLength(2);
        expect(response.messages[0].content.text).toBe("What should I do?");
        expect(response.messages[1].content.text).toBe("I will trigger the flow.\n\nflowID: flow-7");
    });

    it("returns prompt for expert_inquiries with expected message and arguments", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({ params: { name: "expert_inquiries" } });

        expect(response).toHaveProperty("description");
        expect(response.description).toContain("expert inquiries");
        expect(response.messages).toHaveLength(1);
        expect(response.messages[0].role).toBe("user");
        expect(response.messages[0].content.type).toBe("text");
        expect(response.messages[0].content.text).toContain("expert inquiries");
        expect(response.messages[0].content.text).toContain("support API");
    });

    it("returns prompt for expert_inquiries with arguments appended to message", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({
            params: {
                name: "expert_inquiries",
                arguments: { platform: "aws" },
            },
        });

        expect(response.messages).toHaveLength(1);
        expect(response.messages[0].content.text).toContain("platform: aws");
    });

    it("returns prompt for search_expert_inquiries with expected structure and content", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({ params: { name: "search_expert_inquiries" } });

        expect(response.description).toContain("expert inquiries");
        expect(response.messages).toHaveLength(1);
        expect(response.messages[0].role).toBe("user");
        const text: string = response.messages[0].content.text;
        expect(text).toContain("list_tickets");
    });

    it("appends arguments to search_expert_inquiries message", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({
            params: { name: "search_expert_inquiries", arguments: { keyword: "billing", platform: "gcp" } },
        });

        const text: string = response.messages[0].content.text;
        expect(text).toContain("keyword: billing");
        expect(text).toContain("platform: gcp");
    });

    it("does not alter message text when no arguments are provided", async () => {
        prompts.push({
            name: "__test_no_args__",
            description: "Prompt without arguments",
            text: "Static prompt text with no placeholders",
        });

        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({ params: { name: "__test_no_args__" } });

        expect(response.messages[0].content.text).toBe("Static prompt text with no placeholders");
    });
});

describe("ListResourcesRequestSchema handler", () => {
    it("returns an empty resources list", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === ListResourcesRequestSchema)?.[1];

        const response = await handler();

        expect(response).toEqual({ resources: [] });
    });
});

describe("InitializeRequestSchema handler", () => {
    it("returns server info and capabilities with the provided protocol version", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === InitializeRequestSchema)?.[1];

        const response = await handler({ params: { protocolVersion: "2024-11-05" } });

        expect(response).toEqual({
            protocolVersion: "2024-11-05",
            serverInfo: { name: "doit-mcp-server", version: SERVER_VERSION },
            capabilities: { tools: {}, prompts: {}, resources: {} },
        });
    });

    it("falls back to default protocol version when not provided", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === InitializeRequestSchema)?.[1];

        const response = await handler({ params: {} });

        expect(response.protocolVersion).toBe("2024-11-05");
    });
});

describe("CallToolRequestSchema handler", () => {
    const mockRequest = (name: string, args: any) => ({ params: { name, arguments: args } });

    const getCallToolHandler = () =>
        setRequestHandlerMock.mock.calls.find((call) => call[0] === CallToolRequestSchema)?.[1];

    it("returns Unauthorized when DOIT_API_KEY is missing", async () => {
        process.env.DOIT_API_KEY = undefined;
        const response = await getCallToolHandler()(mockRequest("list_cloud_incidents", {}));

        expect(createErrorResponseSpy).toHaveBeenCalled();
        expect(response).toEqual({ content: [{ type: "text", text: "Unauthorized" }] });
    });

    it("returns Unknown tool error for unrecognised tool names", async () => {
        const response = await getCallToolHandler()(mockRequest("unknown_tool", {}));

        expect(createErrorResponseSpy).toHaveBeenCalled();
        expect(response).toEqual({ content: [{ type: "text", text: "Unknown tool: unknown_tool" }] });
    });

    it("handles ZodError and returns a formatted error response", async () => {
        (handleCloudIncidentsRequest as any).mockImplementation(() => {
            throw new z.ZodError([{ path: ["invalid"], message: "Invalid field", code: "custom" }]);
        });

        const response = await getCallToolHandler()(mockRequest("get_cloud_incidents", { invalid: "args" }));

        expect(formatZodErrorSpy).toHaveBeenCalled();
        expect(createErrorResponseSpy).toHaveBeenCalled();
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Formatted Zod Error") }],
        });
    });

    it("handles general errors and returns a generic error response", async () => {
        (handleCloudIncidentsRequest as any).mockImplementation(() => {
            throw new Error("API request failed");
        });

        const response = await getCallToolHandler()(mockRequest("get_cloud_incidents", {}));

        expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), "handling tool request");
        expect(response).toEqual({ content: [{ type: "text", text: "General Error: handling tool request" }] });
    });

    const toolRoutingCases: Array<[string, string, any, any]> = [
        ["get_cloud_incidents", "get_cloud_incidents", { filter: "status:open" }, handleCloudIncidentsRequest],
        ["get_cloud_incident", "get_cloud_incident", { id: "incident-123" }, handleCloudIncidentRequest],
        ["get_anomalies", "get_anomalies", { filter: "severity:high" }, handleAnomaliesRequest],
        ["get_anomaly", "get_anomaly", { id: "anomaly-456" }, handleAnomalyRequest],
        ["list_reports", "list_reports", { type: "cost" }, handleReportsRequest],
        ["run_query", "run_query", { config: {} }, handleRunQueryRequest],
        ["get_report_results", "get_report_results", { reportId: "report-789" }, handleGetReportResultsRequest],
        ["update_report", "update_report", { id: "report-1", name: "Updated" }, handleUpdateReportRequest],
        ["validate_user", "validate_user", { email: "test@example.com" }, handleValidateUserRequest],
        ["list_dimensions", "list_dimensions", { filter: "type:fixed" }, handleDimensionsRequest],
        ["get_dimension", "get_dimension", { id: "dimension-abc" }, handleDimensionRequest],
        ["list_tickets", "list_tickets", { pageSize: 5 }, handleListTicketsRequest],
        ["list_invoices", "list_invoices", { pageToken: "next-page-token" }, handleListInvoicesRequest],
        ["get_invoice", "get_invoice", { id: "invoice-123" }, handleGetInvoiceRequest],
        ["list_allocations", "list_allocations", { pageToken: "next-page-token" }, handleListAllocationsRequest],
        ["get_allocation", "get_allocation", { id: "allocation-123" }, handleGetAllocationRequest],
        [
            "create_allocation",
            "create_allocation",
            { name: "Test", rule: { components: [{ key: "env", type: "label", values: ["prod"] }] } },
            handleCreateAllocationRequest,
        ],
        [
            "update_allocation",
            "update_allocation",
            {
                id: "allocation-123",
                name: "Updated",
                rule: { components: [{ key: "env", type: "label", values: ["staging"] }] },
            },
            handleUpdateAllocationRequest,
        ],
        ["list_assets", "list_assets", { pageToken: "next-page" }, handleListAssetsRequest],
        ["get_asset", "get_asset", { id: "asset-123" }, handleGetAssetRequest],
        ["list_alerts", "list_alerts", { sortBy: "name", sortOrder: "asc" }, handleListAlertsRequest],
        ["get_alert", "get_alert", { id: "alert-123" }, handleGetAlertRequest],
        ["create_label", "create_label", { name: "Test", color: "blue" }, handleCreateLabelRequest],
        ["update_label", "update_label", { id: "label-1", name: "Updated" }, handleUpdateLabelRequest],
        ["get_label_assignments", "get_label_assignments", { id: "label-1" }, handleGetLabelAssignmentsRequest],
        [
            "assign_objects_to_label",
            "assign_objects_to_label",
            { id: "label-1", add: [{ objectId: "report-1", objectType: "report" }] },
            handleAssignObjectsToLabelRequest,
        ],
        ["list_datahub_datasets", "list_datahub_datasets", {}, handleListDatahubDatasetsRequest],
        ["get_datahub_dataset", "get_datahub_dataset", { name: "My Custom Dataset" }, handleGetDatahubDatasetRequest],
        [
            "create_datahub_dataset",
            "create_datahub_dataset",
            { name: "New Dataset", description: "A dataset" },
            handleCreateDatahubDatasetRequest,
        ],
        [
            "update_datahub_dataset",
            "update_datahub_dataset",
            { name: "My Dataset", description: "Updated" },
            handleUpdateDatahubDatasetRequest,
        ],
        [
            "send_datahub_events",
            "send_datahub_events",
            { events: [{ provider: "Datadog", time: "2024-03-10T23:00:00Z" }] },
            handleSendDatahubEventsRequest,
        ],
        [
            "trigger_cloud_flow (with body)",
            "trigger_cloud_flow",
            { flowID: "flow-456", requestBodyJson: { key: "value" } },
            handleTriggerCloudFlowRequest,
        ],
        [
            "trigger_cloud_flow (without body)",
            "trigger_cloud_flow",
            { flowID: "flow-789" },
            handleTriggerCloudFlowRequest,
        ],
    ];

    it.each(toolRoutingCases)("routes %s to the correct handler", async (_label, toolName, args, handler) => {
        await getCallToolHandler()(mockRequest(toolName, args));
        expect(handler).toHaveBeenCalledWith(args, "fake-token");
    });
});
