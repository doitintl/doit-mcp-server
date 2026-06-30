import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    CLOUDFLOW_CONNECTIONS_BASE_URL,
    CLOUDFLOW_TRIGGER_BASE_URL,
    getTriggerCloudFlowURL,
    handleGetCloudFlowConnectionRequest,
    handleListCloudFlowConnectionsRequest,
    handleTriggerCloudFlowRequest,
} from "../cloudflow.js";

vi.mock("../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, makeDoitRequest: vi.fn() };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("cloudflow", () => {
    describe("getTriggerCloudFlowURL", () => {
        it("returns a plain ID prefixed with the trigger base URL", () => {
            expect(getTriggerCloudFlowURL("6OuBBTBsFROSyvdIOAWZ")).toBe(
                `${CLOUDFLOW_TRIGGER_BASE_URL}/6OuBBTBsFROSyvdIOAWZ`
            );
        });

        it("returns a production trigger URL as-is", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ";
            expect(getTriggerCloudFlowURL(fullUrl)).toBe(fullUrl);
        });

        it("trims surrounding whitespace before prefixing a plain ID", () => {
            expect(getTriggerCloudFlowURL("  6OuBBTBsFROSyvdIOAWZ  ")).toBe(
                `${CLOUDFLOW_TRIGGER_BASE_URL}/6OuBBTBsFROSyvdIOAWZ`
            );
        });

        it("trims surrounding whitespace from a URL and returns it as-is", () => {
            const fullUrl = "https://api.doit.com/cloudflow/v1/trigger/6OuBBTBsFROSyvdIOAWZ";
            expect(getTriggerCloudFlowURL(`  ${fullUrl}  `)).toBe(fullUrl);
        });
    });

    describe("handleTriggerCloudFlowRequest", () => {
        const mockToken = "fake-token";

        beforeEach(() => {
            vi.clearAllMocks();
        });

        const mockResponse = {
            executionLink: "https://app.doit.com/customers/EE8CtpzYiKp0dVAESVrB/cloudflow/history/AB3WMRLqVlgjXc1kBmTo",
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

        it("should use the URL as-is when a full trigger URL is passed as flowID", async () => {
            const triggerUrl = `https://api.doit.com/cloudflow/v1/trigger/${flowID}`;
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockResponse);

            await handleTriggerCloudFlowRequest({ flowID: triggerUrl }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(triggerUrl, mockToken, expect.any(Object));
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
});
