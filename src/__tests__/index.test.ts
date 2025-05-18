import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Mock the SDK and tool handlers
vi.mock("@modelcontextprotocol/sdk/server/index.js");
vi.mock("@modelcontextprotocol/sdk/server/stdio.js");
vi.mock("../tools/cloudIncidents.js", () => ({
  cloudIncidentsTool: {
    name: "list_cloud_incidents",
    description: "List cloud incidents",
  },
  cloudIncidentTool: {
    name: "get_cloud_incident",
    description: "Get a cloud incident",
  },
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
  getReportResultsTool: {
    name: "get_report_results",
    description: "Get report results",
  },
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
  createTicketTool: {
    name: "create_ticket",
    description: "Create a new support ticket in DoiT using the support API.",
  },
  handleListTicketsRequest: vi.fn(),
  handleCreateTicketRequest: vi.fn(),
}));
vi.mock("../tools/invoices.ts", () => ({
  listInvoicesTool: {
    name: "list_invoices",
    description:
      "List all current and historical invoices for your organization from the DoiT API.",
  },
  getInvoiceTool: {
    name: "get_invoice",
    description:
      "Retrieve the full details of an invoice specified by the invoice number from the DoiT API.",
  },
  handleListInvoicesRequest: vi.fn(),
  handleGetInvoiceRequest: vi.fn(),
}));
vi.mock("../utils/util.js", async () => {
  const actual = await vi.importActual("../utils/util.js");
  return {
    ...actual,
    createErrorResponse: vi.fn((msg) => ({
      content: [{ type: "text", text: msg }],
    })),
    createSuccessResponse: vi.fn((text) => ({
      content: [{ type: "text", text }],
    })),
    formatZodError: vi.fn((error) => `Formatted Zod Error: ${error.message}`),
    handleGeneralError: vi.fn((error, context) => ({
      content: [{ type: "text", text: `General Error: ${context}` }],
    })),
    DOIT_API_BASE: "https://api.doit.com",
    makeDoitRequest: vi.fn(),
  };
});
vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

// Mock the setRequestHandler method of the Server instance
const setRequestHandlerMock = vi.fn();
(Server as any).mockImplementation(() => ({
  setRequestHandler: setRequestHandlerMock,
  connect: vi.fn(),
  _capabilities: { tools: {}, prompts: {}, resources: {} },
}));

// Mock process.env
const originalProcessEnv = process.env;
let server: any;
let connectSpy: any;
let stdioTransportSpy: any;

// Attach spies to the mocked util functions before importing the index module
import * as utilModule from "../utils/util.js";
const createErrorResponseSpy = vi.spyOn(utilModule, "createErrorResponse");
const formatZodErrorSpy = vi.spyOn(utilModule, "formatZodError");

beforeEach(() => {
  vi.resetAllMocks();
  process.env = { ...originalProcessEnv, DOIT_API_KEY: "fake-token" };
  (Server as any).mockImplementation(() => ({
    setRequestHandler: setRequestHandlerMock,
    connect: vi.fn(),
    _capabilities: { tools: {}, prompts: {}, resources: {} },
  }));
  server = createServer();
  connectSpy = vi.spyOn(server, "connect");
  stdioTransportSpy = vi.spyOn(
    require("@modelcontextprotocol/sdk/server/stdio.js"),
    "StdioServerTransport"
  );
  formatZodErrorSpy.mockClear();
  createErrorResponseSpy.mockClear();
});

afterEach(() => {
  process.env = originalProcessEnv;
});

describe("MCP Server Setup", () => {
  it("should create a Server instance with correct details", () => {
    expect(Server).toHaveBeenCalledWith(
      { name: "doit-mcp-server", version: "1.0.0" },
      { capabilities: { tools: {}, prompts: {}, resources: {} } }
    );
  });

  it("should set request handlers for all required schemas", () => {
    expect(setRequestHandlerMock).toHaveBeenCalledWith(
      ListToolsRequestSchema,
      expect.any(Function)
    );
    expect(setRequestHandlerMock).toHaveBeenCalledWith(
      ListPromptsRequestSchema,
      expect.any(Function)
    );
    expect(setRequestHandlerMock).toHaveBeenCalledWith(
      ListResourcesRequestSchema,
      expect.any(Function)
    );
    expect(setRequestHandlerMock).toHaveBeenCalledWith(
      CallToolRequestSchema,
      expect.any(Function)
    );
    expect(setRequestHandlerMock).toHaveBeenCalledWith(
      InitializeRequestSchema,
      expect.any(Function)
    );
  });

  it("should connect the server to StdioServerTransport", async () => {
    const mainWithServer = indexModule.mainWithServer;
    await mainWithServer(server);
    expect(StdioServerTransport).toHaveBeenCalled();
    expect(server.connect).toHaveBeenCalledWith(
      expect.any(StdioServerTransport)
    );
  });
});

describe("ListToolsRequestSchema Handler", () => {
  it("should return the correct list of tools", async () => {
    // Find the handler function for ListToolsRequestSchema
    const listToolsHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === ListToolsRequestSchema
    )?.[1];

    const response = await listToolsHandler();

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
        {
          name: "list_tickets",
          description: "List support tickets from DoiT using the support API.",
        },
        {
          name: "create_ticket",
          description:
            "Create a new support ticket in DoiT using the support API.",
        },
        {
          name: "list_invoices",
          description:
            "List all current and historical invoices for your organization from the DoiT API.",
        },
        {
          name: "get_invoice",
          description:
            "Retrieve the full details of an invoice specified by the invoice number from the DoiT API.",
        },
      ],
    });
  });
});

describe("ListPromptsRequestSchema Handler", () => {
  it("should return the correct list of prompts", async () => {
    // Find the handler function for ListPromptsRequestSchema
    const listPromptsHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === ListPromptsRequestSchema
    )?.[1];

    const response = await listPromptsHandler();

    expect(response.prompts.length).toBeGreaterThan(0);
    expect(response.prompts[0]).toHaveProperty("name");
    expect(response.prompts[0]).toHaveProperty("text");
  });
});

describe("ListResourcesRequestSchema Handler", () => {
  it("should return an empty list of resources", async () => {
    // Find the handler function for ListResourcesRequestSchema
    const listResourcesHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === ListResourcesRequestSchema
    )?.[1];

    const response = await listResourcesHandler();

    expect(response).toEqual({ resources: [] });
  });
});

describe("CallToolRequestSchema Handler", () => {
  const mockRequest = (name: string, args: any) => ({
    params: { name, arguments: args },
  });

  it("should return Unauthorized error if DOIT_API_KEY is missing", async () => {
    process.env.DOIT_API_KEY = undefined;
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const request = mockRequest("list_cloud_incidents", {});

    const response = await callToolHandler(request);

    expect(createErrorResponseSpy).toHaveBeenCalled();
    expect(response).toEqual({
      content: [{ type: "text", text: "Unauthorized" }],
    });
  });

  it("should route to the correct tool handler for get_cloud_incidents", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { filter: "status:open" };
    const request = mockRequest("get_cloud_incidents", args);

    await callToolHandler(request);

    expect(indexModule.handleCloudIncidentsRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for get_cloud_incident", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { id: "incident-123" };
    const request = mockRequest("get_cloud_incident", args);

    await callToolHandler(request);

    expect(indexModule.handleCloudIncidentRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for get_anomalies", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { filter: "severity:high" };
    const request = mockRequest("get_anomalies", args);

    await callToolHandler(request);

    expect(indexModule.handleAnomaliesRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for get_anomaly", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { id: "anomaly-456" };
    const request = mockRequest("get_anomaly", args);

    await callToolHandler(request);

    expect(indexModule.handleAnomalyRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for list_reports", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { type: "cost" };
    const request = mockRequest("list_reports", args);

    await callToolHandler(request);

    expect(indexModule.handleReportsRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for run_query", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { config: {} };
    const request = mockRequest("run_query", args);

    await callToolHandler(request);

    expect(indexModule.handleRunQueryRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for get_report_results", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { reportId: "report-789" };
    const request = mockRequest("get_report_results", args);

    await callToolHandler(request);

    expect(indexModule.handleGetReportResultsRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for validate_user", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { email: "test@example.com" };
    const request = mockRequest("validate_user", args);

    await callToolHandler(request);

    expect(indexModule.handleValidateUserRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for list_dimensions", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { filter: "type:fixed" };
    const request = mockRequest("list_dimensions", args);

    await callToolHandler(request);

    expect(indexModule.handleDimensionsRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for get_dimension", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { id: "dimension-abc" };
    const request = mockRequest("get_dimension", args);

    await callToolHandler(request);

    expect(indexModule.handleDimensionRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for list_tickets", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { pageSize: 5 };
    const request = mockRequest("list_tickets", args);

    await callToolHandler(request);

    expect(indexModule.handleListTicketsRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for create_ticket", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = {
      ticket: {
        body: "Help!",
        created: "2024-06-01T12:00:00Z",
        platform: "doit",
        product: "test-product",
        severity: "normal",
        subject: "Test ticket",
      },
    };
    const request = mockRequest("create_ticket", args);

    await callToolHandler(request);

    expect(indexModule.handleCreateTicketRequest).toHaveBeenCalledWith(
      args,
      "fake-token"
    );
  });

  it("should route to the correct tool handler for list_invoices", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { pageToken: "next-page-token" };
    const request = mockRequest("list_invoices", args);

    await callToolHandler(request);

    expect(handleListInvoicesRequest).toHaveBeenCalledWith(args, "fake-token");
  });

  it("should route to the correct tool handler for get_invoice", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { id: "invoice-123" };
    const request = mockRequest("get_invoice", args);

    await callToolHandler(request);

    expect(handleGetInvoiceRequest).toHaveBeenCalledWith(args, "fake-token");
  });

  it("should return Unknown tool error for unknown tool names", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const request = mockRequest("unknown_tool", {});

    const response = await callToolHandler(request);

    expect(createErrorResponseSpy).toHaveBeenCalled();
    expect(response).toEqual({
      content: [{ type: "text", text: "Unknown tool: unknown_tool" }],
    });
  });

  it("should handle ZodError during tool request handling", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = { invalid: "args" };
    const request = mockRequest("get_cloud_incidents", args);

    // Mock the tool handler to throw a real ZodError
    (indexModule.handleCloudIncidentsRequest as any).mockImplementation(() => {
      throw new z.ZodError([
        {
          path: ["invalid"],
          message: "Invalid field",
          code: "custom",
        },
      ]);
    });

    const response = await callToolHandler(request);

    expect(formatZodErrorSpy).toHaveBeenCalled();
    expect(createErrorResponseSpy).toHaveBeenCalled();
    expect(response).toEqual({
      content: [
        { type: "text", text: expect.stringContaining("Formatted Zod Error") },
      ],
    });
  });

  it("should handle general errors during tool request handling", async () => {
    const callToolHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === CallToolRequestSchema
    )?.[1];
    const args = {};
    const request = mockRequest("get_cloud_incidents", args);

    // Mock the tool handler to throw a general error
    (indexModule.handleCloudIncidentsRequest as any).mockImplementation(() => {
      throw new Error("API request failed");
    });

    const response = await callToolHandler(request);

    expect(indexModule.handleGeneralError).toHaveBeenCalledWith(
      expect.any(Error),
      "handling tool request"
    );
    expect(response).toEqual({
      content: [{ type: "text", text: "General Error: handling tool request" }],
    });
  });
});

describe("InitializeRequestSchema Handler", () => {
  it("should return the correct server info and capabilities", async () => {
    const initializeHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === InitializeRequestSchema
    )?.[1];
    const request = { params: { protocolVersion: "2024-11-05" } };

    const response = await initializeHandler(request);

    expect(response).toEqual({
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "doit-mcp-server",
        version: "1.0.0",
      },
      capabilities: { tools: {}, prompts: {}, resources: {} },
    });
  });

  it("should use default protocol version if not provided", async () => {
    const initializeHandler = setRequestHandlerMock.mock.calls.find(
      (call) => call[0] === InitializeRequestSchema
    )?.[1];
    const request = { params: {} };

    const response = await initializeHandler(request);

    expect(response.protocolVersion).toBe("2024-11-05");
  });
});

const indexModule = await import("../index.js");
const { createServer, handleListInvoicesRequest, handleGetInvoiceRequest } =
  indexModule;
