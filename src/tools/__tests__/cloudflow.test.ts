import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest, makeDoitSSERequest } from "../../utils/util.js";
import {
    buildCloudflowTool,
    CLOUDFLOW_CONNECTIONS_BASE_URL,
    CLOUDFLOW_TEMPLATES_BASE_URL,
    CLOUDFLOW_TRIGGER_BASE_URL,
    extractCloudFlowId,
    getTriggerCloudFlowURL,
    handleBuildCloudflowRequest,
    handleCreateCloudFlowConnectionRequest,
    handleGetCloudFlowConnectionRequest,
    handleGetCloudFlowTemplateRequest,
    handleListCloudFlowConnectionsRequest,
    handleListCloudFlowTemplatesRequest,
    handleTriggerCloudFlowRequest,
    handleUpdateCloudFlowConnectionRequest,
} from "../cloudflow.js";

vi.mock("../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, makeDoitRequest: vi.fn(), makeDoitSSERequest: vi.fn() };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("cloudflow", () => {
    describe("extractCloudFlowId", () => {
        it("returns a plain ID unchanged", () => {
            expect(extractCloudFlowId("6OuBBTBsFROSyvdIOAWZ")).toBe("6OuBBTBsFROSyvdIOAWZ");
        });

        it("trims surrounding whitespace from a plain ID", () => {
            expect(extractCloudFlowId("  6OuBBTBsFROSyvdIOAWZ  ")).toBe("6OuBBTBsFROSyvdIOAWZ");
        });

        it("returns null for a plain ID containing a literal space", () => {
            expect(extractCloudFlowId("abc 123")).toBeNull();
        });

        it("returns null for a plain ID containing a percent character", () => {
            expect(extractCloudFlowId("abc%20123")).toBeNull();
        });

        it("returns null for a plain ID containing an invalid percent-escape", () => {
            expect(extractCloudFlowId("abc%zz")).toBeNull();
        });

        it("extracts the last path segment from a production trigger URL", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ";
            expect(extractCloudFlowId(fullUrl)).toBe("6OuBBTBsFROSyvdIOAWZ");
        });

        it("extracts the ID regardless of host as long as the path matches the trigger endpoint shape", () => {
            const untrustedUrl = "https://somethingelse.example.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ";
            const result = extractCloudFlowId(untrustedUrl);
            expect(result).toBe("6OuBBTBsFROSyvdIOAWZ");
            expect(result).not.toContain("somethingelse");
        });

        it("ignores a trailing slash", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ/";
            expect(extractCloudFlowId(fullUrl)).toBe("6OuBBTBsFROSyvdIOAWZ");
        });

        it("ignores a query string", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ?foo=bar";
            expect(extractCloudFlowId(fullUrl)).toBe("6OuBBTBsFROSyvdIOAWZ");
        });

        it("returns null when the last segment of a URL contains a percent-encoded space", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/abc%20123";
            expect(extractCloudFlowId(fullUrl)).toBeNull();
        });

        it("returns null when the last segment of a URL contains an invalid percent-escape", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/abc%zz";
            expect(extractCloudFlowId(fullUrl)).toBeNull();
        });

        it("returns null for an ID longer than the maximum allowed length", () => {
            const tooLong = "a".repeat(1501);
            expect(extractCloudFlowId(tooLong)).toBeNull();
        });

        it("accepts an ID at the maximum allowed length", () => {
            const maxLength = "a".repeat(1500);
            expect(extractCloudFlowId(maxLength)).toBe(maxLength);
        });

        it("trims surrounding whitespace from a URL before extracting the ID", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ";
            expect(extractCloudFlowId(`  ${fullUrl}  `)).toBe("6OuBBTBsFROSyvdIOAWZ");
        });

        it("returns null for a URL whose path does not match the trigger endpoint shape", () => {
            // e.g. an execution history link, not a trigger URL
            const historyUrl = "https://example.com/customers/customer-id/cloudflow/history/execution-id";
            expect(extractCloudFlowId(historyUrl)).toBeNull();
        });

        it("returns null for a trigger-shaped URL with extra trailing path segments", () => {
            const editUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ/nodes";
            expect(extractCloudFlowId(editUrl)).toBeNull();
        });

        it("returns null for a host-only URL with no path segments", () => {
            expect(extractCloudFlowId("https://somethingelse.example.com")).toBeNull();
        });

        it("returns null for an empty string", () => {
            expect(extractCloudFlowId("   ")).toBeNull();
        });
    });

    describe("getTriggerCloudFlowURL", () => {
        it("returns a plain ID prefixed with the trigger base URL", () => {
            expect(getTriggerCloudFlowURL("6OuBBTBsFROSyvdIOAWZ")).toBe(
                `${CLOUDFLOW_TRIGGER_BASE_URL}/6OuBBTBsFROSyvdIOAWZ`
            );
        });

        it("extracts the flow ID from a production trigger URL instead of using it as-is", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ";
            expect(getTriggerCloudFlowURL(fullUrl)).toBe(`${CLOUDFLOW_TRIGGER_BASE_URL}/6OuBBTBsFROSyvdIOAWZ`);
        });

        it("discards an untrusted host while keeping a trigger-shaped path's ID segment", () => {
            const untrustedHost = "somethingelse.example.com";
            const untrustedUrl = `https://${untrustedHost}/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ`;

            const result = getTriggerCloudFlowURL(untrustedUrl);

            expect(result).toBe(`${CLOUDFLOW_TRIGGER_BASE_URL}/6OuBBTBsFROSyvdIOAWZ`);
            expect(result).not.toContain(untrustedHost);
            expect(new URL(result as string).host).not.toBe(untrustedHost);
        });

        it("trims surrounding whitespace before prefixing a plain ID", () => {
            expect(getTriggerCloudFlowURL("  6OuBBTBsFROSyvdIOAWZ  ")).toBe(
                `${CLOUDFLOW_TRIGGER_BASE_URL}/6OuBBTBsFROSyvdIOAWZ`
            );
        });

        it("trims surrounding whitespace from a URL and still extracts the ID", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ";
            expect(getTriggerCloudFlowURL(`  ${fullUrl}  `)).toBe(`${CLOUDFLOW_TRIGGER_BASE_URL}/6OuBBTBsFROSyvdIOAWZ`);
        });

        it("returns null when the URL's last segment contains a percent-encoded character", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/abc%20123";
            expect(getTriggerCloudFlowURL(fullUrl)).toBeNull();
        });

        it("returns null for a pre-encoded plain ID instead of double-encoding it", () => {
            expect(getTriggerCloudFlowURL("abc%20123")).toBeNull();
        });

        it("returns null for a URL that doesn't match the trigger endpoint shape", () => {
            const historyUrl = "https://example.com/customers/customer-id/cloudflow/history/execution-id";
            expect(getTriggerCloudFlowURL(historyUrl)).toBeNull();
        });

        it("never resolves to a host other than the project's own trigger base URL host", () => {
            const untrustedHost = "somethingelse.example.com";
            const inputs = [
                "6OuBBTBsFROSyvdIOAWZ",
                `https://${untrustedHost}/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ`,
            ];

            const trustedHost = new URL(CLOUDFLOW_TRIGGER_BASE_URL).host;
            for (const input of inputs) {
                const result = getTriggerCloudFlowURL(input);
                expect(result).not.toBeNull();
                expect(new URL(result as string).host).toBe(trustedHost);
            }
        });
    });

    describe("handleTriggerCloudFlowRequest", () => {
        const mockToken = "fake-token";

        beforeEach(() => {
            vi.clearAllMocks();
        });

        const mockResponse = {
            executionLink: "https://example.com/customers/customer-id/cloudflow/history/execution-id",
        };

        const flowID = "6OuBBTBsFROSyvdIOAWZ";
        const expectedUrl = `${CLOUDFLOW_TRIGGER_BASE_URL}/${flowID}`;

        it("should call makeDoitRequest with correct URL and no body when requestBodyJson is omitted", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            const response = await handleTriggerCloudFlowRequest({ flowID }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(expectedUrl, mockToken, {
                method: "POST",
                body: {},
                customerContext: undefined,
            });
            expect(response).toEqual({
                content: [{ type: "text", text: JSON.stringify(mockResponse, null, 2) }],
            });
        });

        it("should return success with an empty object response", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue({});

            const response = await handleTriggerCloudFlowRequest({ flowID }, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: JSON.stringify({}, null, 2) }],
            });
        });

        it("should extract the flow ID and call the project's own trigger URL when a trigger-shaped URL is passed as flowID", async () => {
            const untrustedHost = "somethingelse.example.com";
            const untrustedUrl = `https://${untrustedHost}/cloudflow/v1/trigger/${flowID}`;
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            await handleTriggerCloudFlowRequest({ flowID: untrustedUrl }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(expectedUrl, mockToken, expect.any(Object));
            const calledUrl = (makeDoitRequest as vi.Mock).mock.calls[0][0] as string;
            expect(calledUrl).not.toContain(untrustedHost);
            expect(new URL(calledUrl).host).not.toBe(untrustedHost);
        });

        it("should return an error and not call makeDoitRequest when flowID is a URL that isn't a trigger endpoint", async () => {
            const historyUrl = "https://example.com/customers/customer-id/cloudflow/history/execution-id";

            const response = await handleTriggerCloudFlowRequest({ flowID: historyUrl }, mockToken);

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("flowID") }],
                isError: true,
            });
        });

        it("should call makeDoitRequest with requestBodyJson as body when provided", async () => {
            const requestBodyJson = { key: "value", count: 42 };
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            await handleTriggerCloudFlowRequest({ flowID, requestBodyJson }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(expectedUrl, mockToken, {
                method: "POST",
                body: requestBodyJson,
                customerContext: undefined,
            });
        });

        it("should pass customerContext when provided", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            await handleTriggerCloudFlowRequest({ flowID, customerContext: "customer-ctx" }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(expectedUrl, mockToken, {
                method: "POST",
                body: {},
                customerContext: "customer-ctx",
            });
        });

        it("should return an error when flowID is empty", async () => {
            const response = await handleTriggerCloudFlowRequest({ flowID: "   " }, mockToken);

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("specify the target flow ID"),
                    },
                ],
                isError: true,
            });
        });

        it("should return error response when API returns null", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleTriggerCloudFlowRequest({ flowID }, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Failed to trigger CloudFlow") }],
                isError: true,
            });
        });

        it("should return an error response when makeDoitRequest throws", async () => {
            (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

            const response = await handleTriggerCloudFlowRequest({ flowID }, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Network error") }],
                isError: true,
            });
        });

        it("should return formatted Zod error for invalid arguments", async () => {
            const mockArgs = { flowID: 123 }; // invalid: must be string
            const response = await handleTriggerCloudFlowRequest(mockArgs, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Invalid arguments:") }],
                isError: true,
            });
        });
    });

    describe("handleListCloudFlowConnectionsRequest", () => {
        const mockToken = "fake-token";

        const mockResponse = {
            connections: [
                {
                    connectionId: "conn-1",
                    name: "GCP Org Connection",
                    enabled: true,
                    status: "active",
                },
            ],
            nextPageToken: "next-page",
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("calls makeDoitRequest with the default maxResults when none provided", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            const response = await handleListCloudFlowConnectionsRequest({}, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDFLOW_CONNECTIONS_BASE_URL}?maxResults=50`, mockToken, {
                method: "GET",
                customerContext: undefined,
            });
            expect(response).toEqual({
                content: [{ type: "text", text: JSON.stringify(mockResponse, null, 2) }],
            });
        });

        it("passes maxResults, pageToken and customerContext when provided", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            await handleListCloudFlowConnectionsRequest(
                { maxResults: "10", pageToken: "tok", customerContext: "customer-ctx" },
                mockToken
            );

            expect(makeDoitRequest).toHaveBeenCalledWith(
                `${CLOUDFLOW_CONNECTIONS_BASE_URL}?maxResults=10&pageToken=tok`,
                mockToken,
                { method: "GET", customerContext: "customer-ctx" }
            );
        });

        it("returns an error response when the API returns null", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleListCloudFlowConnectionsRequest({}, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Failed to retrieve CloudFlow connections") }],
                isError: true,
            });
        });

        it("returns an error response when makeDoitRequest throws", async () => {
            (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

            const response = await handleListCloudFlowConnectionsRequest({}, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Network error") }],
                isError: true,
            });
        });
    });

    describe("handleGetCloudFlowConnectionRequest", () => {
        const mockToken = "fake-token";

        const mockConnection = {
            connectionId: "conn-1",
            name: "GCP Org Connection",
            enabled: true,
            status: "active",
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("calls makeDoitRequest with the encoded connection ID", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockConnection);

            const response = await handleGetCloudFlowConnectionRequest({ connectionId: "conn-1" }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDFLOW_CONNECTIONS_BASE_URL}/conn-1`, mockToken, {
                method: "GET",
                customerContext: undefined,
            });
            expect(response).toEqual({
                content: [{ type: "text", text: JSON.stringify(mockConnection, null, 2) }],
            });
        });

        it("passes customerContext when provided", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockConnection);

            await handleGetCloudFlowConnectionRequest(
                { connectionId: "conn-1", customerContext: "customer-ctx" },
                mockToken
            );

            expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDFLOW_CONNECTIONS_BASE_URL}/conn-1`, mockToken, {
                method: "GET",
                customerContext: "customer-ctx",
            });
        });

        it("returns a formatted Zod error when connectionId is empty", async () => {
            const response = await handleGetCloudFlowConnectionRequest({ connectionId: "   " }, mockToken);

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Invalid arguments:") }],
                isError: true,
            });
        });

        it("returns an error response when the API returns null", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleGetCloudFlowConnectionRequest({ connectionId: "conn-1" }, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Failed to retrieve CloudFlow connection") }],
                isError: true,
            });
        });
    });

    describe("handleCreateCloudFlowConnectionRequest", () => {
        const mockToken = "fake-token";

        const mockConnection = {
            connectionId: "conn-new",
            name: "New GCP Connection",
            enabled: true,
            status: "active",
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("POSTs the connection body when a single config is supplied", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockConnection);

            const args = {
                name: "New GCP Connection",
                gcpConfig: { organizationId: "123456789", level: "organization" },
            };
            const response = await handleCreateCloudFlowConnectionRequest(args, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(CLOUDFLOW_CONNECTIONS_BASE_URL, mockToken, {
                method: "POST",
                body: {
                    name: "New GCP Connection",
                    gcpConfig: { organizationId: "123456789", level: "organization" },
                },
                customerContext: undefined,
            });
            expect(response).toEqual({
                content: [{ type: "text", text: JSON.stringify(mockConnection, null, 2) }],
            });
        });

        it("passes customerContext when provided", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockConnection);

            await handleCreateCloudFlowConnectionRequest(
                { name: "New GCP Connection", gcpConfig: { projectId: "p-1" }, customerContext: "customer-ctx" },
                mockToken
            );

            expect(makeDoitRequest).toHaveBeenCalledWith(
                CLOUDFLOW_CONNECTIONS_BASE_URL,
                mockToken,
                expect.objectContaining({ method: "POST", customerContext: "customer-ctx" })
            );
        });

        it("rejects when both gcpConfig and awsConfig are supplied", async () => {
            const response = await handleCreateCloudFlowConnectionRequest(
                { name: "Both", gcpConfig: { projectId: "p-1" }, awsConfig: { roleName: "r" } },
                mockToken
            );

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("Exactly one of gcpConfig or awsConfig must be supplied."),
                    },
                ],
                isError: true,
            });
        });

        it("rejects when neither gcpConfig nor awsConfig is supplied", async () => {
            const response = await handleCreateCloudFlowConnectionRequest({ name: "Neither" }, mockToken);

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("Exactly one of gcpConfig or awsConfig must be supplied."),
                    },
                ],
                isError: true,
            });
        });

        it("returns a formatted Zod error when name is missing", async () => {
            const response = await handleCreateCloudFlowConnectionRequest(
                { gcpConfig: { projectId: "p-1" } },
                mockToken
            );

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Invalid arguments:") }],
                isError: true,
            });
        });

        it("returns an error response when the API returns null", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleCreateCloudFlowConnectionRequest(
                { name: "New GCP Connection", awsConfig: { roleName: "role" } },
                mockToken
            );

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Failed to create CloudFlow connection") }],
                isError: true,
            });
        });
    });

    describe("handleUpdateCloudFlowConnectionRequest", () => {
        const mockToken = "fake-token";

        const mockConnection = {
            connectionId: "conn-1",
            name: "Renamed Connection",
            enabled: false,
            status: "active",
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("PATCHes the connection with the encoded ID and body (id excluded)", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockConnection);

            const response = await handleUpdateCloudFlowConnectionRequest(
                { connectionId: "conn-1", name: "Renamed Connection", enabled: false },
                mockToken
            );

            expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDFLOW_CONNECTIONS_BASE_URL}/conn-1`, mockToken, {
                method: "PATCH",
                body: { name: "Renamed Connection", enabled: false },
                customerContext: undefined,
            });
            expect(response).toEqual({
                content: [{ type: "text", text: JSON.stringify(mockConnection, null, 2) }],
            });
        });

        it("rejects when both gcpConfig and awsConfig are set", async () => {
            const response = await handleUpdateCloudFlowConnectionRequest(
                { connectionId: "conn-1", gcpConfig: { projectId: "p-1" }, awsConfig: { roleName: "r" } },
                mockToken
            );

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("At most one of gcpConfig or awsConfig may be set per request."),
                    },
                ],
                isError: true,
            });
        });

        it("returns a formatted Zod error when connectionId is empty", async () => {
            const response = await handleUpdateCloudFlowConnectionRequest(
                { connectionId: "   ", name: "x" },
                mockToken
            );

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Invalid arguments:") }],
                isError: true,
            });
        });

        it("returns an error response when the API returns null", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleUpdateCloudFlowConnectionRequest(
                { connectionId: "conn-1", name: "Renamed Connection" },
                mockToken
            );

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Failed to update CloudFlow connection") }],
                isError: true,
            });
        });
    });

    describe("handleListCloudFlowTemplatesRequest", () => {
        const mockToken = "fake-token";

        const mockResponse = {
            items: [
                {
                    id: "tmpl-1",
                    name: "Idle VM Cleanup",
                    description: "Stops idle VMs on a schedule",
                    instructions: null,
                    createTime: "2024-01-01T00:00:00Z",
                    updateTime: null,
                },
            ],
            pageToken: "next-page",
            rowCount: 1,
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("calls makeDoitRequest with the default maxResults when none provided", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            const response = await handleListCloudFlowTemplatesRequest({}, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDFLOW_TEMPLATES_BASE_URL}?maxResults=50`, mockToken, {
                method: "GET",
                customerContext: undefined,
            });
            expect(response).toEqual({
                content: [{ type: "text", text: JSON.stringify(mockResponse, null, 2) }],
            });
        });

        it("passes maxResults, pageToken and customerContext when provided", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            await handleListCloudFlowTemplatesRequest(
                { maxResults: "10", pageToken: "tok", customerContext: "customer-ctx" },
                mockToken
            );

            expect(makeDoitRequest).toHaveBeenCalledWith(
                `${CLOUDFLOW_TEMPLATES_BASE_URL}?maxResults=10&pageToken=tok`,
                mockToken,
                { method: "GET", customerContext: "customer-ctx" }
            );
        });

        it("returns an error response when the API returns null", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleListCloudFlowTemplatesRequest({}, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Failed to retrieve CloudFlow templates") }],
                isError: true,
            });
        });

        it("returns an error response when makeDoitRequest throws", async () => {
            (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

            const response = await handleListCloudFlowTemplatesRequest({}, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Network error") }],
                isError: true,
            });
        });
    });

    describe("handleGetCloudFlowTemplateRequest", () => {
        const mockToken = "fake-token";

        const mockTemplate = {
            id: "tmpl-1",
            name: "Idle VM Cleanup",
            description: "Stops idle VMs on a schedule",
            instructions: "Provide a schedule and target project",
            createTime: "2024-01-01T00:00:00Z",
            updateTime: "2024-02-01T00:00:00Z",
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("calls makeDoitRequest with the encoded template ID", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockTemplate);

            const response = await handleGetCloudFlowTemplateRequest({ templateId: "tmpl-1" }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDFLOW_TEMPLATES_BASE_URL}/tmpl-1`, mockToken, {
                method: "GET",
                customerContext: undefined,
            });
            expect(response).toEqual({
                content: [{ type: "text", text: JSON.stringify(mockTemplate, null, 2) }],
            });
        });

        it("passes customerContext when provided", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockTemplate);

            await handleGetCloudFlowTemplateRequest(
                { templateId: "tmpl-1", customerContext: "customer-ctx" },
                mockToken
            );

            expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDFLOW_TEMPLATES_BASE_URL}/tmpl-1`, mockToken, {
                method: "GET",
                customerContext: "customer-ctx",
            });
        });

        it("returns a formatted Zod error when templateId is empty", async () => {
            const response = await handleGetCloudFlowTemplateRequest({ templateId: "   " }, mockToken);

            expect(makeDoitRequest).not.toHaveBeenCalled();
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Invalid arguments:") }],
                isError: true,
            });
        });

        it("returns an error response when the API returns null", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleGetCloudFlowTemplateRequest({ templateId: "tmpl-1" }, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Failed to retrieve CloudFlow template") }],
                isError: true,
            });
        });
    });

    describe("handleBuildCloudflowRequest", () => {
        const mockToken = "fake-token";

        // Yields the given event objects as the SSE helper would: each `data` string is the
        // JSON payload of one `data:` line (see makeDoitSSERequest / the builder stream shape).
        function sseStreamOf(events: Array<Record<string, unknown>>) {
            return (async function* () {
                for (const event of events) {
                    yield { data: JSON.stringify(event) };
                }
            })();
        }

        it("declares build_cloud_flow and covers the build endpoint so the generator skips it", () => {
            expect(buildCloudflowTool.name).toBe("build_cloud_flow");
            expect(buildCloudflowTool.coversEndpoint).toBe("post:/cloudflow/v1/flows/actions/build");
        });

        it("parses the stream into flowId, conversationId, answer, and steps and forwards progress", async () => {
            (makeDoitSSERequest as unknown as vi.Mock).mockReturnValue(
                sseStreamOf([
                    { answerId: "a1", conversationId: "conv-1" },
                    { answer: JSON.stringify({ toolStart: "Building nodes" }) },
                    {
                        answer: JSON.stringify({
                            customEvent: { messageId: "cloudflow_created", data: { flowId: "flow-123" } },
                        }),
                    },
                    { answer: "All set." },
                ])
            );
            const onProgress = vi.fn().mockResolvedValue(undefined);

            const response = await handleBuildCloudflowRequest({ question: "make a flow" }, mockToken, onProgress);

            expect(response.isError).toBeUndefined();
            const result = JSON.parse(response.content[0].text);
            expect(result).toEqual({
                flowId: "flow-123",
                conversationId: "conv-1",
                answer: "All set.",
                steps: ["Building nodes"],
            });
            expect(onProgress).toHaveBeenCalledWith("Building nodes");
        });

        it("surfaces the real error instead of an opaque 'Failed to call POST ...' when the stream fails", async () => {
            // Faithful to makeDoitSSERequest, which throws on a non-2xx (e.g. the 406 the build
            // endpoint returns for an application/json Accept) as the stream is first read.
            (makeDoitSSERequest as unknown as vi.Mock).mockReturnValue({
                [Symbol.asyncIterator]() {
                    return { next: () => Promise.reject(new Error("HTTP 406: Not Acceptable")) };
                },
            });

            const response = await handleBuildCloudflowRequest({ question: "make a flow" }, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("HTTP 406: Not Acceptable");
            expect(response.content[0].text).not.toContain("Failed to call POST");
        });

        it("reports the recoverable flow ID the stream emitted before it failed", async () => {
            (makeDoitSSERequest as unknown as vi.Mock).mockImplementation(async function* () {
                yield {
                    data: JSON.stringify({
                        answer: JSON.stringify({
                            customEvent: { messageId: "cloudflow_created", data: { flowId: "flow-partial" } },
                        }),
                    }),
                };
                throw new Error("HTTP 500: boom");
            });

            const response = await handleBuildCloudflowRequest({ question: "make a flow" }, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("flow-partial");
            expect(response.content[0].text).toContain("HTTP 500");
        });

        it("rejects a missing question via schema validation", async () => {
            const response = await handleBuildCloudflowRequest({}, mockToken);
            expect(response.isError).toBe(true);
            expect(makeDoitSSERequest as unknown as vi.Mock).not.toHaveBeenCalled();
        });
    });
});
