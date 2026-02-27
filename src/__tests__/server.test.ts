import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    GetPromptRequestSchema,
    InitializeRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { SERVER_VERSION } from "../utils/consts.js";
import { prompts } from "../utils/prompts.js";

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
    handleListAssetsRequest: vi.fn(),
}));
vi.mock(import("../tools/alerts.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleListAlertsRequest: vi.fn(),
    handleGetAlertRequest: vi.fn(),
}));
vi.mock(import("../tools/cloudflow.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    handleTriggerCloudFlowRequest: vi.fn(),
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
    handleCloudIncidentRequest,
    handleCloudIncidentsRequest,
    handleCreateAllocationRequest,
    handleDimensionRequest,
    handleDimensionsRequest,
    handleGeneralError,
    handleGetAlertRequest,
    handleGetAllocationRequest,
    handleGetInvoiceRequest,
    handleGetReportResultsRequest,
    handleListAlertsRequest,
    handleListAllocationsRequest,
    handleListAssetsRequest,
    handleListInvoicesRequest,
    handleListTicketsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
    handleTriggerCloudFlowRequest,
    handleUpdateAllocationRequest,
    handleValidateUserRequest,
} from "../server.js";
import { getAlertTool, listAlertsTool } from "../tools/alerts.js";
import {
    createAllocationTool,
    getAllocationTool,
    listAllocationsTool,
    updateAllocationTool,
} from "../tools/allocations.js";
import { anomaliesTool, anomalyTool } from "../tools/anomalies.js";
import { listAssetsTool } from "../tools/assets.js";
import { triggerCloudFlowTool } from "../tools/cloudflow.js";
import { cloudIncidentsTool, cloudIncidentTool } from "../tools/cloudIncidents.js";
import { dimensionTool } from "../tools/dimension.js";
import { dimensionsTool } from "../tools/dimensions.js";
import { getInvoiceTool, listInvoicesTool } from "../tools/invoices.js";
import { getReportResultsTool, reportsTool, runQueryTool } from "../tools/reports.js";
import { listTicketsTool } from "../tools/tickets.js";
import { validateUserTool } from "../tools/validateUser.js";
import * as utilModule from "../utils/util.js";

const createErrorResponseSpy = vi.spyOn(utilModule, "createErrorResponse");
const formatZodErrorSpy = vi.spyOn(utilModule, "formatZodError");

const originalProcessEnv = process.env;
let server: any;

beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalProcessEnv, DOIT_API_KEY: "fake-token" };
    (Server as any).mockImplementation(() => ({
        setRequestHandler: setRequestHandlerMock,
        connect: vi.fn(),
        _capabilities: { tools: {}, prompts: {}, resources: {} },
    }));
    server = createServer();
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
});

describe("GetPromptRequestSchema handler", () => {
    it("returns description and a single message for a single-message prompt", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];

        const response = await handler({ params: { name: "Allow Artifacts" } });

        expect(response).toHaveProperty("description");
        expect(response).toHaveProperty("messages");
        expect(response.messages).toHaveLength(1);
        expect(response.messages[0].role).toBe("user");
        expect(response.messages[0].content.type).toBe("text");
        expect(response.messages[0].content.text).toBeTruthy();
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
        prompts.push(multiMessagePrompt); // this is cleanup after the test by the afterEach hook

        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];
        const response = await handler({ params: { name: "__test_multi__" } });

        expect(response.messages).toHaveLength(3);
        expect(response.messages[0]).toEqual({ role: "user", content: { type: "text", text: "Hello" } });
        expect(response.messages[1]).toEqual({ role: "assistant", content: { type: "text", text: "How can I help?" } });
        expect(response.messages[2]).toEqual({ role: "user", content: { type: "text", text: "Tell me about costs." } });
    });

    afterEach(() => {
        // cleanup the test prompt injected by the tests
        const idx = prompts.findIndex((p) => p.name === "__test_multi__");
        if (idx !== -1) prompts.splice(idx, 1);
    });

    it("throws an error for an unknown prompt name", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === GetPromptRequestSchema)?.[1];

        await expect(handler({ params: { name: "nonexistent-prompt" } })).rejects.toThrow(
            "Prompt not found: nonexistent-prompt"
        );
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
        ["list_alerts", "list_alerts", { sortBy: "name", sortOrder: "asc" }, handleListAlertsRequest],
        ["get_alert", "get_alert", { id: "alert-123" }, handleGetAlertRequest],
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
