import { beforeEach, describe, expect, it, vi } from "vitest";
import { createErrorResponse, formatZodError, handleGeneralError, makeDoitRequest } from "../../utils/util.js";
import {
    formatCloudIncident,
    handleCloudIncidentRequest,
    handleCloudIncidentsRequest,
    KnownIssuePlatforms,
} from "../cloudIncidents.js";

// Mock the utility functions
vi.mock("../../utils/util.js", () => ({
    createErrorResponse: vi.fn((msg) => ({
        content: [{ type: "text", text: msg }],
    })),
    createSuccessResponse: vi.fn((text) => ({
        content: [{ type: "text", text }],
    })),
    formatZodError: vi.fn((error) => `Formatted Zod Error: ${error.message}`),
    handleGeneralError: vi.fn((_error, context) => ({
        content: [{ type: "text", text: `General Error: ${context}` }],
    })),
    makeDoitRequest: vi.fn(),
    DOIT_API_BASE: "https://api.doit.com",
}));

describe("cloudIncidents", () => {
    describe("formatCloudIncident", () => {
        it("should format a cloud incident object correctly", () => {
            const mockIncident = {
                id: "incident-123",
                createTime: 1678886400000, // March 15, 2023 12:00:00 PM UTC
                platform: "google-cloud",
                product: "Compute Engine",
                title: "VM instance issues",
                status: "active",
                summary: "Some VMs are experiencing connectivity issues.",
                description: "Detailed description of the problem.",
                symptoms: "Cannot connect to VM instances.",
                workaround: "Restart the VM instance.",
            };

            const expected = `ID: incident-123
Platform: google-cloud
Product: Compute Engine
Title: VM instance issues
Status: active
Created: ${new Date(mockIncident.createTime).toLocaleString()}
Summary: Some VMs are experiencing connectivity issues.
Description: Detailed description of the problem.
Symptoms: Cannot connect to VM instances.
Workaround: Restart the VM instance.
-----------`;

            expect(formatCloudIncident(mockIncident)).toBe(expected);
        });

        it("should handle missing optional fields", () => {
            const mockIncident = {
                id: "incident-456",
                createTime: 1678886400000,
                platform: "amazon-web-services",
                product: "",
                title: "S3 outage",
                status: "resolved",
            };

            const expected = `ID: incident-456
Platform: amazon-web-services
Product: N/A
Title: S3 outage
Status: resolved
Created: ${new Date(mockIncident.createTime).toLocaleString()}
-----------`;

            expect(formatCloudIncident(mockIncident)).toBe(expected);
        });
    });

    describe("handleCloudIncidentsRequest", () => {
        const mockToken = "fake-token";

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should call makeDoitRequest with correct parameters and return success response", async () => {
            const mockArgs = {
                platform: KnownIssuePlatforms.GoogleCloud,
                filter: "status:active",
                pageToken: "next-page",
            };
            const mockApiResponse = {
                pageToken: "another-page",
                incidents: [
                    {
                        id: "incident-1",
                        createTime: 1678886400000,
                        platform: "google-cloud-project",
                        product: "Compute Engine",
                        title: "Issue 1",
                        status: "active",
                    },
                ],
            };
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

            const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/core/v1/cloudincidents?filter=status%3Aactive%7Cplatform%3Agoogle-cloud&pageToken=next-page",
                mockToken,
                { method: "GET" }
            );
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("incidents") }],
            });
        });

        it("should send the platform constraint to the API before pagination", async () => {
            const page = { incidents: [{ id: "aws-1", platform: "amazon-web-services" }], pageToken: "next" };
            (makeDoitRequest as vi.Mock).mockResolvedValue(page);
            const response = await handleCloudIncidentsRequest({ platform: KnownIssuePlatforms.AWS }, mockToken);
            expect(new URL((makeDoitRequest as vi.Mock).mock.calls[0][0]).searchParams.get("filter")).toBe(
                "platform:amazon-web-services"
            );
            expect(JSON.parse(response.content[0].text)).toEqual({ ...page, rowCount: 1 });
        });

        it.each([{}, { platform: "google-cloud-project" }])(
            "should preserve an empty page and its continuation: %j",
            async (args) => {
                (makeDoitRequest as vi.Mock).mockResolvedValue({ incidents: [], pageToken: "continue" });
                const response = await handleCloudIncidentsRequest(args, mockToken);
                expect(JSON.parse(response.content[0].text)).toEqual({
                    rowCount: 0,
                    incidents: [],
                    pageToken: "continue",
                });
                expect(createErrorResponse).not.toHaveBeenCalled();
                if (args.platform)
                    expect(new URL((makeDoitRequest as vi.Mock).mock.calls[0][0]).searchParams.get("filter")).toBe(
                        "platform:google-cloud"
                    );
            }
        );

        it("should permit OR values for one key with AND constraints and continuation", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue({ incidents: [], pageToken: null });
            const filter = "platform:google-cloud|platform:amazon-web-services|status:active";
            await handleCloudIncidentsRequest(
                { filter, pageToken: "opaque/+=", customerContext: "switched" },
                mockToken
            );
            const [url, , options] = (makeDoitRequest as vi.Mock).mock.calls[0];
            expect(new URL(url).searchParams.get("filter")).toBe(filter);
            expect(new URL(url).searchParams.get("pageToken")).toBe("opaque/+=");
            expect(options.customerContext).toBe("switched");
        });

        it.each([
            { platform: "google-cloud", filter: "platform:amazon-web-services" },
            { filter: "platform:google-cloud|platform:amazon-web-services|status:active|status:archived" },
            { filter: "owner:user@example.com" },
            { filter: "product:a:b" },
        ])("should reject incompatible incident constraints: %j", async (args) => {
            await handleCloudIncidentsRequest(args, mockToken);
            expect(createErrorResponse).toHaveBeenCalled();
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should handle API request failure", async () => {
            const mockArgs = {};
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith("https://api.doit.com/core/v1/cloudincidents", mockToken, {
                method: "GET",
            });
            expect(createErrorResponse).toHaveBeenCalledWith("Failed to retrieve cloud incidents data");
            expect(response).toEqual({
                content: [{ type: "text", text: "Failed to retrieve cloud incidents data" }],
            });
        });

        it("should handle ZodError for invalid arguments", async () => {
            const mockArgs = { platform: "invalid-platform" }; // Invalid platform enum
            const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

            expect(formatZodError).toHaveBeenCalled();
            expect(createErrorResponse).toHaveBeenCalled();
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("Formatted Zod Error:"),
                    },
                ],
            });
        });

        it("should handle general errors", async () => {
            const mockArgs = {};
            (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

            const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

            expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), "making DoiT API request");
            expect(response).toEqual({
                content: [{ type: "text", text: "General Error: making DoiT API request" }],
            });
        });
    });

    describe("handleCloudIncidentRequest", () => {
        const mockToken = "fake-token";

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should call makeDoitRequest with correct parameters and return success response", async () => {
            const mockArgs = { id: "incident-123" };
            const mockApiResponse = {
                id: "incident-123",
                createTime: 1678886400000,
                platform: "google-cloud",
                product: "Compute Engine",
                title: "Issue 1",
                status: "active",
            };
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

            const response = await handleCloudIncidentRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/core/v1/cloudincidents/incident-123",
                mockToken,
                { appendParams: true, method: "GET" }
            );
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("google-cloud"),
                    },
                ],
            });
        });

        it("should handle API request failure", async () => {
            const mockArgs = { id: "incident-123" };
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleCloudIncidentRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/core/v1/cloudincidents/incident-123",
                mockToken,
                { appendParams: true, method: "GET" }
            );
            expect(createErrorResponse).toHaveBeenCalledWith("Failed to retrieve cloud incident with ID: incident-123");
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: "Failed to retrieve cloud incident with ID: incident-123",
                    },
                ],
            });
        });

        it("should handle ZodError for invalid arguments", async () => {
            const mockArgs = {}; // Missing both id and title
            const response = await handleCloudIncidentRequest(mockArgs, mockToken);

            expect(formatZodError).toHaveBeenCalled();
            expect(createErrorResponse).toHaveBeenCalled();
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("Formatted Zod Error:"),
                    },
                ],
            });
        });

        it("should handle general errors", async () => {
            const mockArgs = { id: "incident-123" };
            (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

            const response = await handleCloudIncidentRequest(mockArgs, mockToken);

            expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), "making DoiT API request");
            expect(response).toEqual({
                content: [{ type: "text", text: "General Error: making DoiT API request" }],
            });
        });
    });
});
