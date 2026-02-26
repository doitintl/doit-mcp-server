import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    InitializeRequestSchema,
    ListPromptsRequestSchema,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { SERVER_VERSION } from "../utils/consts.js";

vi.mock("@modelcontextprotocol/sdk/server/index.js");
vi.mock("../tools/cloudIncidents.js", () => ({
    cloudIncidentsTool: { name: "list_cloud_incidents", description: "List cloud incidents" },
    cloudIncidentTool: { name: "get_cloud_incident", description: "Get a cloud incident" },
    handleCloudIncidentsRequest: vi.fn(),
    handleCloudIncidentRequest: vi.fn(),
}));
vi.mock("../tools/anomalies.js", () => ({
    anomaliesTool: { name: "get_anomalies", description: "List anomalies" },
    anomalyTool: { name: "get_anomaly", description: "Get an anomaly" },
    handleAnomaliesRequest: vi.fn(),
    handleAnomalyRequest: vi.fn(),
}));
vi.mock("../tools/reports.js", () => ({
    reportsTool: { name: "list_reports", description: "List reports" },
    runQueryTool: { name: "run_query", description: "Run a query" },
    getReportResultsTool: { name: "get_report_results", description: "Get report results" },
    handleReportsRequest: vi.fn(),
    handleRunQueryRequest: vi.fn(),
    handleGetReportResultsRequest: vi.fn(),
}));
vi.mock("../tools/validateUser.js", () => ({
    validateUserTool: { name: "validate_user", description: "Validate user" },
    handleValidateUserRequest: vi.fn(),
}));
vi.mock("../tools/dimensions.js", () => ({
    dimensionsTool: { name: "list_dimensions", description: "List dimensions" },
    handleDimensionsRequest: vi.fn(),
}));
vi.mock("../tools/dimension.js", () => ({
    dimensionTool: { name: "get_dimension", description: "Get a dimension" },
    handleDimensionRequest: vi.fn(),
}));
vi.mock("../tools/tickets.js", () => ({
    listTicketsTool: {
        name: "list_tickets",
        description: "List support tickets from DoiT using the support API.",
    },
    handleListTicketsRequest: vi.fn(),
}));
vi.mock("../tools/invoices.ts", () => ({
    listInvoicesTool: {
        name: "list_invoices",
        description: "List all current and historical invoices for your organization from the DoiT API.",
    },
    getInvoiceTool: {
        name: "get_invoice",
        description: "Retrieve the full details of an invoice specified by the invoice number from the DoiT API.",
    },
    handleListInvoicesRequest: vi.fn(),
    handleGetInvoiceRequest: vi.fn(),
}));
vi.mock("../tools/allocations.js", () => ({
    listAllocationsTool: {
        name: "list_allocations",
        description: "List allocations that your account has access to from the DoiT API",
    },
    getAllocationTool: {
        name: "get_allocation",
        description: "Get a specific allocation by ID from the DoiT API",
    },
    createAllocationTool: {
        name: "create_allocation",
        description: `Create a new allocation via the DoiT API
    Allocations let you group and segment cloud costs using allocation rules.
    For a single-rule allocation, provide 'rule' (a single rule object).
    For a group allocation, provide 'rules' (an array of at least two rules) and 'unallocatedCosts' (a label for unmatched costs).`,
    },
    updateAllocationTool: {
        name: "update_allocation",
        description: `Update an existing allocation
    Provide the allocation ID and the updated allocation configuration.
    For a single-rule allocation, provide 'rule' (a single rule object).
    For a group allocation, provide 'rules' (an array of at least two rules) and 'unallocatedCosts' (a label for unmatched costs).
    The 'rule' and 'rules' fields are mutually exclusive.`,
    },
    handleListAllocationsRequest: vi.fn(),
    handleGetAllocationRequest: vi.fn(),
    handleCreateAllocationRequest: vi.fn(),
    handleUpdateAllocationRequest: vi.fn(),
}));
vi.mock("../tools/assets.js", () => ({
    listAssetsTool: {
        name: "list_assets",
        description:
            "Returns a list of all available customer assets such as Google Cloud billing accounts, G Suite/Workspace subscriptions, etc. Assets are returned in reverse chronological order by default.",
    },
    handleListAssetsRequest: vi.fn(),
}));
vi.mock("../tools/alerts.js", () => ({
    listAlertsTool: {
        name: "list_alerts",
        description:
            "Returns a list of alerts that your account has access to. Alerts are listed in reverse chronological order by default.",
    },
    getAlertTool: { name: "get_alert", description: "Returns a specific alert by ID." },
    handleListAlertsRequest: vi.fn(),
    handleGetAlertRequest: vi.fn(),
}));
vi.mock("../tools/cloudflow.js", () => ({
    triggerCloudFlowTool: {
        name: "trigger_cloud_flow",
        description:
            "Triggers a CloudFlow by its flow ID, optionally passing a JSON payload as the request body if the flow requires it",
        inputSchema: {
            type: "object",
            properties: {
                flowID: { type: "string", description: "The ID of the CloudFlow flow to trigger" },
                requestBodyJson: {
                    type: "object",
                    description: "Optional JSON object to pass as the request body to the flow if the flow requires it",
                },
            },
            required: ["flowID"],
        },
    },
    handleTriggerCloudFlowRequest: vi.fn(),
}));
vi.mock("../utils/util.js", async () => {
    const actual = await vi.importActual("../utils/util.js");
    return {
        ...actual,
        createErrorResponse: vi.fn((msg) => ({ content: [{ type: "text", text: msg }] })),
        createSuccessResponse: vi.fn((text) => ({ content: [{ type: "text", text }] })),
        formatZodError: vi.fn((error) => `Formatted Zod Error: ${error.message}`),
        handleGeneralError: vi.fn((_error, context) => ({
            content: [{ type: "text", text: `General Error: ${context}` }],
        })),
        DOIT_API_BASE: "https://api.doit.com",
        makeDoitRequest: vi.fn(),
    };
});

const setRequestHandlerMock = vi.fn();
(Server as any).mockImplementation(() => ({
    setRequestHandler: setRequestHandlerMock,
    connect: vi.fn(),
    _capabilities: { tools: {}, prompts: {}, resources: {} },
}));

import * as utilModule from "../utils/util.js";
import {
    createServer,
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
    handleListAlertsRequest,
    handleGetAlertRequest,
    handleTriggerCloudFlowRequest,
    handleGeneralError,
} from "../server.js";

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
                { name: "list_cloud_incidents", description: "List cloud incidents" },
                { name: "get_cloud_incident", description: "Get a cloud incident" },
                { name: "get_anomalies", description: "List anomalies" },
                { name: "get_anomaly", description: "Get an anomaly" },
                { name: "list_reports", description: "List reports" },
                { name: "run_query", description: "Run a query" },
                { name: "get_report_results", description: "Get report results" },
                { name: "validate_user", description: "Validate user" },
                { name: "list_dimensions", description: "List dimensions" },
                { name: "get_dimension", description: "Get a dimension" },
                { name: "list_tickets", description: "List support tickets from DoiT using the support API." },
                {
                    name: "list_invoices",
                    description: "List all current and historical invoices for your organization from the DoiT API.",
                },
                {
                    name: "get_invoice",
                    description:
                        "Retrieve the full details of an invoice specified by the invoice number from the DoiT API.",
                },
                {
                    name: "list_allocations",
                    description: "List allocations that your account has access to from the DoiT API",
                },
                { name: "get_allocation", description: "Get a specific allocation by ID from the DoiT API" },
                {
                    name: "create_allocation",
                    description: `Create a new allocation via the DoiT API
    Allocations let you group and segment cloud costs using allocation rules.
    For a single-rule allocation, provide 'rule' (a single rule object).
    For a group allocation, provide 'rules' (an array of at least two rules) and 'unallocatedCosts' (a label for unmatched costs).`,
                },
                {
                    name: "update_allocation",
                    description: `Update an existing allocation
    Provide the allocation ID and the updated allocation configuration.
    For a single-rule allocation, provide 'rule' (a single rule object).
    For a group allocation, provide 'rules' (an array of at least two rules) and 'unallocatedCosts' (a label for unmatched costs).
    The 'rule' and 'rules' fields are mutually exclusive.`,
                },
                {
                    name: "list_assets",
                    description:
                        "Returns a list of all available customer assets such as Google Cloud billing accounts, G Suite/Workspace subscriptions, etc. Assets are returned in reverse chronological order by default.",
                },
                {
                    name: "list_alerts",
                    description:
                        "Returns a list of alerts that your account has access to. Alerts are listed in reverse chronological order by default.",
                },
                { name: "get_alert", description: "Returns a specific alert by ID." },
                {
                    name: "trigger_cloud_flow",
                    description:
                        "Triggers a CloudFlow by its flow ID, optionally passing a JSON payload as the request body if the flow requires it",
                    inputSchema: {
                        type: "object",
                        properties: {
                            flowID: { type: "string", description: "The ID of the CloudFlow flow to trigger" },
                            requestBodyJson: {
                                type: "object",
                                description:
                                    "Optional JSON object to pass as the request body to the flow if the flow requires it",
                            },
                        },
                        required: ["flowID"],
                    },
                },
            ],
        });
    });
});

describe("ListPromptsRequestSchema handler", () => {
    it("returns a non-empty list of prompts with name and text fields", async () => {
        const handler = setRequestHandlerMock.mock.calls.find((call) => call[0] === ListPromptsRequestSchema)?.[1];

        const response = await handler();

        expect(response.prompts.length).toBeGreaterThan(0);
        expect(response.prompts[0]).toHaveProperty("name");
        expect(response.prompts[0]).toHaveProperty("text");
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
