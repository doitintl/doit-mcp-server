import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  formatAnomaly,
  handleAnomaliesRequest,
  handleAnomalyRequest,
} from "../anomalies.js";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
} from "../../utils/util.js";

// Mock the utility functions
vi.mock("../../utils/util.js", () => ({
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
  makeDoitRequest: vi.fn(),
  DOIT_API_BASE: "https://api.doit.com",
}));

describe("anomalies", () => {
  describe("formatAnomaly", () => {
    it("should format an anomaly object correctly", () => {
      const mockAnomaly = {
        id: "anomaly-123",
        anomalyChartUrl: "http://example.com/chart",
        billingAccount: "account-abc",
        attribution: "service",
        costOfAnomaly: 123.45,
        platform: "gcp",
        scope: "project",
        serviceName: "Compute Engine",
        top3SKUs: [
          { name: "CPU", cost: 100 },
          { name: "Network", cost: 20 },
          { name: "Disk", cost: 3.45 },
        ],
        severityLevel: "High",
        timeFrame: "Daily",
        startTime: 1678886400000, // March 15, 2023 12:00:00 PM UTC
        status: "Open",
        endTime: 1678972800000, // March 16, 2023 12:00:00 PM UTC
        acknowledged: false,
      };

      const expected = `ID: anomaly-123
Chart URL: http://example.com/chart
Platform: gcp
Service: Compute Engine
Scope: project
Cost of Anomaly: $123.45
Severity: High
Time Frame: Daily
Started: ${new Date(mockAnomaly.startTime).toLocaleString()}
Ended: ${new Date(mockAnomaly.endTime).toLocaleString()}
Status: Open
Acknowledged: No
Top SKUs: 
    - CPU: $100.00
    - Network: $20.00
    - Disk: $3.45
-----------`;

      expect(formatAnomaly(mockAnomaly)).toBe(expected);
    });

    it("should handle missing optional fields", () => {
      const mockAnomaly = {
        billingAccount: "account-abc",
        attribution: "service",
        costOfAnomaly: 123.45,
        platform: "gcp",
        scope: "project",
        serviceName: "Compute Engine",
        top3SKUs: [],
        severityLevel: "High",
        timeFrame: "Daily",
        startTime: 1678886400000,
        status: null,
        endTime: null,
        acknowledged: true,
      };

      const expected = `Platform: gcp
Service: Compute Engine
Scope: project
Cost of Anomaly: $123.45
Severity: High
Time Frame: Daily
Started: ${new Date(mockAnomaly.startTime).toLocaleString()}
Ended: Ongoing
Status: N/A
Acknowledged: Yes
Top SKUs: 
-----------`;

      expect(formatAnomaly(mockAnomaly)).toBe(expected);
    });
  });

  describe("handleAnomaliesRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call makeDoitRequest with correct parameters and return success response", async () => {
      const mockArgs = { pageToken: "next-page" };
      const mockApiResponse = {
        rowCount: 1,
        anomalies: [
          {
            id: "anomaly-1",
            billingAccount: "acc-1",
            attribution: "attr-1",
            costOfAnomaly: 50,
            platform: "gcp",
            scope: "scope-1",
            serviceName: "Service 1",
            top3SKUs: [{ name: "SKU 1", cost: 40 }],
            severityLevel: "Low",
            timeFrame: "Weekly",
            startTime: 1678886400000,
            status: "Open",
            endTime: null,
            acknowledged: false,
          },
        ],
        pageToken: "another-page",
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleAnomaliesRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/anomalies/v1?pageToken=next-page&maxResults=32",
        mockToken,
        {
          method: "GET",
        }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("Found 1 anomalies")
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("Found 1 anomalies") },
        ],
      });
    });

    it("should handle no anomalies found", async () => {
      const mockArgs = {};
      const mockApiResponse = {
        rowCount: 0,
        anomalies: [],
        pageToken: "",
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleAnomaliesRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/anomalies/v1?maxResults=32",
        mockToken,
        {
          method: "GET",
        }
      );
      expect(createErrorResponse).toHaveBeenCalledWith("No anomalies found");
      expect(response).toEqual({
        content: [{ type: "text", text: "No anomalies found" }],
      });
    });

    it("should handle API request failure", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleAnomaliesRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/anomalies/v1?maxResults=32",
        mockToken,
        { method: "GET" }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve anomalies data"
      );
      expect(response).toEqual({
        content: [{ type: "text", text: "Failed to retrieve anomalies data" }],
      });
    });

    it("should handle general errors", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleAnomaliesRequest(mockArgs, mockToken);

      expect(handleGeneralError).toHaveBeenCalledWith(
        expect.any(Error),
        "making DoiT API request"
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: "General Error: making DoiT API request" },
        ],
      });
    });

    it("should handle ZodError for invalid arguments", async () => {
      const mockArgs = { pageToken: 123 }; // Invalid argument type for Zod
      const response = await handleAnomaliesRequest(mockArgs, mockToken);

      expect(createErrorResponse).toHaveBeenCalledWith(
        expect.stringContaining("Formatted Zod Error:")
      );
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining("Formatted Zod Error:"),
          },
        ],
      });
    });
  });

  describe("handleAnomalyRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call makeDoitRequest with correct parameters and return success response", async () => {
      const mockArgs = { id: "anomaly-123" };
      const mockApiResponse = {
        billingAccount: "acc-1",
        attribution: "attr-1",
        costOfAnomaly: 50,
        platform: "gcp",
        scope: "scope-1",
        serviceName: "Service 1",
        top3SKUs: [{ name: "SKU 1", cost: 40 }],
        severityLevel: "Low",
        timeFrame: "Weekly",
        startTime: 1678886400000,
        status: "Open",
        endTime: null,
        acknowledged: false,
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleAnomalyRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/anomalies/v1/anomaly-123",
        mockToken,
        {
          appendParams: true,
          method: "GET",
        }
      );
      expect(createSuccessResponse).toHaveBeenCalledWith(
        expect.stringContaining("Anomaly details:")
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("Anomaly details:") },
        ],
      });
    });

    it("should handle API request failure", async () => {
      const mockArgs = { id: "anomaly-123" };
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleAnomalyRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/anomalies/v1/anomaly-123",
        mockToken,
        {
          appendParams: true,
          method: "GET",
        }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve anomaly with ID: anomaly-123"
      );
      expect(response).toEqual({
        content: [
          {
            type: "text",
            text: "Failed to retrieve anomaly with ID: anomaly-123",
          },
        ],
      });
    });

    it("should handle ZodError for invalid arguments", async () => {
      const mockArgs = { id: 123 }; // Invalid id type
      const response = await handleAnomalyRequest(mockArgs, mockToken);

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
      const mockArgs = { id: "anomaly-123" };
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleAnomalyRequest(mockArgs, mockToken);

      expect(handleGeneralError).toHaveBeenCalledWith(
        expect.any(Error),
        "making DoiT API request"
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: "General Error: making DoiT API request" },
        ],
      });
    });
  });
});
