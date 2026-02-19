import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createErrorResponse,
  createSuccessResponse,
  formatZodError,
  handleGeneralError,
  makeDoitRequest,
} from "../../utils/util.js";
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
        platform: KnownIssuePlatforms.GCP,
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
        "https://api.doit.com/core/v1/cloudincidents?filter=status%3Aactive&pageToken=next-page",
        mockToken,
        { method: "GET" }
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("Cloud incidents") },
        ],
      });
    });

    it("should filter by platform if filter is not provided", async () => {
      const mockArgs = { platform: KnownIssuePlatforms.AWS };
      const mockApiResponse = {
        pageToken: "",
        incidents: [
          {
            id: "incident-1",
            createTime: 1678886400000,
            platform: "amazon-web-services",
            product: "S3",
            title: "Issue 1",
            status: "active",
          },
          {
            id: "incident-2",
            createTime: 1678886400000,
            platform: "google-cloud",
            product: "Compute Engine",
            title: "Issue 2",
            status: "active",
          },
        ],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/core/v1/cloudincidents",
        mockToken,
        { method: "GET" }
      );
      const responseText = (createSuccessResponse as vi.Mock).mock.calls[0][0];
      expect(responseText).not.toContain("Issue 2"); // Ensure GCP incident is filtered out
      expect(response).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("Cloud incidents") },
        ],
      });
    });

    it("should handle no incidents found", async () => {
      const mockArgs = { platform: KnownIssuePlatforms.GCP };
      const mockApiResponse = {
        pageToken: "",
        incidents: [],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/core/v1/cloudincidents",
        mockToken,
        { method: "GET" }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "No incidents found for google-cloud-project"
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: "No incidents found for google-cloud-project" },
        ],
      });
    });

    it("should handle no incidents found without platform filter", async () => {
      const mockArgs = {};
      const mockApiResponse = {
        pageToken: "",
        incidents: [],
      };
      (makeDoitRequest as vi.Mock).mockResolvedValue(mockApiResponse);

      const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/core/v1/cloudincidents",
        mockToken,
        { method: "GET" }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "No cloud incidents found"
      );
      expect(response).toEqual({
        content: [{ type: "text", text: "No cloud incidents found" }],
      });
    });

    it("should handle API request failure", async () => {
      const mockArgs = {};
      (makeDoitRequest as vi.Mock).mockResolvedValue(null);

      const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

      expect(makeDoitRequest).toHaveBeenCalledWith(
        "https://api.doit.com/core/v1/cloudincidents",
        mockToken,
        { method: "GET" }
      );
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve cloud incidents data"
      );
      expect(response).toEqual({
        content: [
          { type: "text", text: "Failed to retrieve cloud incidents data" },
        ],
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
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleCloudIncidentsRequest(mockArgs, mockToken);

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
            text: expect.stringContaining("Cloud incident details:"),
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
      expect(createErrorResponse).toHaveBeenCalledWith(
        "Failed to retrieve cloud incident with ID: incident-123"
      );
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
      const mockArgs = { id: 123 }; // Invalid id type
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
      (makeDoitRequest as vi.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const response = await handleCloudIncidentRequest(mockArgs, mockToken);

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
