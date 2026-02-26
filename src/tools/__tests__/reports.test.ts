import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createErrorResponse,
    createSuccessResponse,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../../utils/util.js";
import {
    formatQueryResult,
    formatReport,
    formatReportResults,
    handleGetReportResultsRequest,
    handleReportsRequest,
    handleRunQueryRequest,
} from "../reports.js";

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

describe("reports", () => {
    describe("formatReport", () => {
        it("should format a report object correctly", () => {
            const mockReport = {
                id: "report-123",
                reportName: "Cost Overview",
                owner: "test@example.com",
                type: "billing",
                createTime: 1678886400000, // March 15, 2023 12:00:00 PM UTC
                updateTime: 1678972800000, // March 16, 2023 12:00:00 PM UTC
                urlUI: "http://example.com/report/123",
            };

            const expected = `ID: report-123
Name: Cost Overview
Owner: test@example.com
Type: billing
Created: ${new Date(mockReport.createTime).toLocaleString()}
Updated: ${new Date(mockReport.updateTime).toLocaleString()}
URL: http://example.com/report/123
-----------`;

            expect(formatReport(mockReport)).toBe(expected);
        });
    });

    describe("formatQueryResult", () => {
        it("should format a query result object correctly", () => {
            const mockQueryResult = {
                schema: [
                    { name: "service", type: "string" },
                    { name: "cost", type: "number" },
                ],
                rows: [
                    ["Compute Engine", 100],
                    ["Cloud Storage", 50],
                ],
                cacheHit: true,
            };

            const _expected = `Query Results:
Schema: service (string), cost (number)
Cache Hit: true
Rows (2 total):
Compute Engine,100
Cloud Storage,50`;

            // Mock console.log to capture output
            const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            const formattedResult = formatQueryResult(mockQueryResult);

            // The function also returns a string with schema and cache hit info
            expect(formattedResult).toContain("Query Results:");
            expect(formattedResult).toContain("Schema: service (string), cost (number)");
            expect(formattedResult).toContain("Cache Hit: true");
            expect(formattedResult).toContain("Rows (2 total):");

            consoleLogSpy.mockRestore(); // Restore console.log
        });

        it("should handle empty rows", () => {
            const mockQueryResult = {
                schema: [
                    { name: "service", type: "string" },
                    { name: "cost", type: "number" },
                ],
                rows: [],
                cacheHit: false,
            };

            const _expected = `Query Results:
Schema: service (string), cost (number)
Cache Hit: false
Rows (0 total):
`;
            // Mock console.log to capture output
            const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            const formattedResult = formatQueryResult(mockQueryResult);

            expect(consoleLogSpy).not.toHaveBeenCalled(); // No rows to log

            expect(formattedResult).toEqual(expect.stringContaining("Query Results:"));

            consoleLogSpy.mockRestore(); // Restore console.log
        });
    });

    describe("formatReportResults", () => {
        it("should format report results correctly", () => {
            const mockReportResults = {
                id: "report-123",
                reportName: "Cost Overview",
                owner: "test@example.com",
                type: "billing",
                createTime: 1678886400000,
                updateTime: 1678972800000,
                urlUI: "http://example.com/report/123",
                result: {
                    schema: [
                        { name: "service", type: "string" },
                        { name: "cost", type: "number" },
                    ],
                    rows: [
                        ["Compute Engine", 100],
                        ["Cloud Storage", 50],
                    ],
                    cacheHit: true,
                },
            };

            const _expected = `Report Details:
ID: report-123
Name: Cost Overview
Owner: test@example.com
Type: billing
Created: ${new Date(mockReportResults.createTime).toLocaleString()}
Updated: ${new Date(mockReportResults.updateTime).toLocaleString()}
URL: ${mockReportResults.urlUI}

Query Results:
Schema: service (string), cost (number)
Cache Hit: true
Rows (2 total):
Compute Engine,100
Cloud Storage,50`;

            // Mock console.log to capture output
            const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

            const formattedResult = formatReportResults(mockReportResults);

            // The function also returns a string with report details and query result info
            expect(formattedResult).toContain("Report Details:");
            expect(formattedResult).toContain("ID: report-123");
            expect(formattedResult).toContain("Name: Cost Overview");
            expect(formattedResult).toContain("Schema: service (string), cost (number)");

            consoleLogSpy.mockRestore(); // Restore console.log
        });
    });

    describe("handleReportsRequest", () => {
        const mockToken = "fake-token";

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should call makeDoitRequest with correct parameters and return success response", async () => {
            const mockArgs = { filter: "type:billing", pageToken: "next-page" };
            const mockApiResponse = {
                pageToken: "another-page",
                rowCount: 1,
                reports: [
                    {
                        id: "report-1",
                        reportName: "Report 1",
                        owner: "owner1",
                        type: "billing",
                        createTime: 1,
                        updateTime: 2,
                        urlUI: "url1",
                    },
                ],
            };
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

            const response = await handleReportsRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/analytics/v1/reports?filter=type%3Abilling&pageToken=next-page",
                mockToken,
                { method: "GET" }
            );
            expect(createSuccessResponse).toHaveBeenCalledWith(
                expect.stringContaining("Found 1 reports (filtered by: type:billing)")
            );
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Found 1 reports") }],
            });
        });

        it("should handle no reports found", async () => {
            const mockArgs = { filter: "type:cost" };
            const mockApiResponse = {
                pageToken: "",
                rowCount: 0,
                reports: [],
            };
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

            const response = await handleReportsRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/analytics/v1/reports?filter=type%3Acost",
                mockToken,
                { method: "GET" }
            );
            expect(createErrorResponse).toHaveBeenCalledWith("No reports found");
            expect(response).toEqual({
                content: [{ type: "text", text: "No reports found" }],
            });
        });

        it("should handle API request failure", async () => {
            const mockArgs = {};
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleReportsRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith("https://api.doit.com/analytics/v1/reports", mockToken, {
                method: "GET",
            });
            expect(createErrorResponse).toHaveBeenCalledWith(
                "Failed to retrieve reports data, please check the filter parameter, try without filter if you don't know the exact value of the key"
            );
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: "Failed to retrieve reports data, please check the filter parameter, try without filter if you don't know the exact value of the key",
                    },
                ],
            });
        });

        it("should handle ZodError for invalid arguments", async () => {
            const mockArgs = { filter: 123 }; // Invalid filter type
            const response = await handleReportsRequest(mockArgs, mockToken);

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

            const response = await handleReportsRequest(mockArgs, mockToken);

            expect(handleGeneralError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.stringContaining("making DoiT API request")
            );
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: "General Error: making DoiT API request",
                    },
                ],
            });
        });
    });

    describe("handleRunQueryRequest", () => {
        const mockToken = "fake-token";

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should call makeDoitRequest with correct parameters and return success response", async () => {
            const mockArgs = { config: { metric: { type: "basic", value: "cost" } } };
            const mockApiResponse = {
                result: {
                    schema: [{ name: "cost", type: "number" }],
                    rows: [[100]],
                    cacheHit: true,
                },
            };
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

            const response = await handleRunQueryRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/analytics/v1/reports/query",
                mockToken,
                expect.objectContaining({ method: "POST" })
            );
            expect(createSuccessResponse).toHaveBeenCalledWith(expect.stringContaining("Query Results:"));
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Query Results:") }],
            });
        });

        it("should handle API request failure", async () => {
            const mockArgs = { config: { metric: { type: "basic", value: "cost" } } };
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleRunQueryRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/analytics/v1/reports/query",
                mockToken,
                expect.objectContaining({ method: "POST" })
            );
            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("Failed to run query"));
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("Failed to run query"),
                    },
                ],
            });
        });

        it("should handle ZodError for invalid arguments", async () => {
            const mockArgs = { config: "invalid-config" }; // Invalid config type
            const response = await handleRunQueryRequest(mockArgs, mockToken);

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
            const mockArgs = { config: { metric: { type: "basic", value: "cost" } } };
            (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

            const response = await handleRunQueryRequest(mockArgs, mockToken);

            expect(handleGeneralError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.stringContaining("making DoiT API query request")
            );
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: "General Error: making DoiT API query request",
                    },
                ],
            });
        });
    });

    describe("handleGetReportResultsRequest", () => {
        const mockToken = "fake-token";

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should call makeDoitRequest with correct parameters and return success response", async () => {
            const mockArgs = { id: "report-123" };
            const mockApiResponse = {
                id: "report-123",
                reportName: "Cost Overview",
                owner: "test@example.com",
                type: "billing",
                createTime: 1,
                updateTime: 2,
                urlUI: "url",
                result: {
                    schema: [{ name: "cost", type: "number" }],
                    rows: [[100]],
                    cacheHit: true,
                },
            };
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

            const response = await handleGetReportResultsRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/analytics/v1/reports/report-123",
                mockToken,
                { method: "GET" }
            );
            expect(createSuccessResponse).toHaveBeenCalledWith(expect.stringContaining("Report Details:"));
            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Report Details:") }],
            });
        });

        it("should handle API request failure", async () => {
            const mockArgs = { id: "report-123" };
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            const response = await handleGetReportResultsRequest(mockArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(
                "https://api.doit.com/analytics/v1/reports/report-123",
                mockToken,
                { method: "GET" }
            );
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: expect.stringContaining("Failed to retrieve report results"),
                    },
                ],
            });
        });

        it("should handle ZodError for invalid arguments", async () => {
            const mockArgs = { id: 123 }; // Invalid id type
            const response = await handleGetReportResultsRequest(mockArgs, mockToken);

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
            const mockArgs = { id: "report-123" };
            (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

            const response = await handleGetReportResultsRequest(mockArgs, mockToken);

            expect(handleGeneralError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.stringContaining("making DoiT API request for report results")
            );
            expect(response).toEqual({
                content: [
                    {
                        type: "text",
                        text: "General Error: making DoiT API request for report results",
                    },
                ],
            });
        });
    });
});
