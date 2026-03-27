import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    DATAHUB_DATASETS_BASE_URL,
    handleCreateDatahubDatasetRequest,
    handleGetDatahubDatasetRequest,
    handleListDatahubDatasetsRequest,
    handleUpdateDatahubDatasetRequest,
} from "../datahubDatasets.js";

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

const mockToken = "test-token";

describe("handleListDatahubDatasetsRequest", () => {
    it("should call makeDoitRequest with GET and correct URL", async () => {
        const mockResponse = {
            datasets: [
                { name: "Dataset A", description: "First dataset", records: 100 },
                { name: "Dataset B", description: "Second dataset", records: 200 },
            ],
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleListDatahubDatasetsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(DATAHUB_DATASETS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.datasets).toHaveLength(2);
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ datasets: [] });
        await handleListDatahubDatasetsRequest({ customerContext: "customer-123" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ customerContext: "customer-123" })
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const response = await handleListDatahubDatasetsRequest({}, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Failed to retrieve DataHub datasets") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
        const response = await handleListDatahubDatasetsRequest({}, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("handleGetDatahubDatasetRequest", () => {
    it("should call makeDoitRequest with GET and correct URL", async () => {
        const mockResponse = { name: "My Dataset", description: "A dataset", records: 500 };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleGetDatahubDatasetRequest({ name: "My Dataset" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/My%20Dataset"),
            mockToken,
            expect.objectContaining({ method: "GET", customerContext: undefined })
        );
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.name).toBe("My Dataset");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "ds" });
        await handleGetDatahubDatasetRequest({ name: "ds", customerContext: "customer-123" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ customerContext: "customer-123" })
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const response = await handleGetDatahubDatasetRequest({ name: "ds" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Failed to retrieve DataHub dataset") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
        const response = await handleGetDatahubDatasetRequest({ name: "ds" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("handleCreateDatahubDatasetRequest", () => {
    const validArgs = {
        name: "New Dataset",
        description: "A new dataset for tracking metrics",
    };

    it("should call makeDoitRequest with POST and correct body", async () => {
        const mockResponse = {
            name: "New Dataset",
            description: "A new dataset for tracking metrics",
            records: null,
            updatedBy: "user@example.com",
            lastUpdated: "2024-03-10T23:00:00Z",
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleCreateDatahubDatasetRequest(validArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(DATAHUB_DATASETS_BASE_URL, mockToken, {
            method: "POST",
            body: { name: "New Dataset", description: "A new dataset for tracking metrics" },
            customerContext: undefined,
        });
        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.name).toBe("New Dataset");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "New Dataset" });
        await handleCreateDatahubDatasetRequest({ ...validArgs, customerContext: "customer-123" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ customerContext: "customer-123" })
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const response = await handleCreateDatahubDatasetRequest(validArgs, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Failed to create DataHub dataset") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
        const response = await handleCreateDatahubDatasetRequest(validArgs, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should create dataset with only name (no description)", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "Minimal-Dataset" });
        await handleCreateDatahubDatasetRequest({ name: "Minimal-Dataset" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            DATAHUB_DATASETS_BASE_URL,
            mockToken,
            expect.objectContaining({
                method: "POST",
                body: { name: "Minimal-Dataset" },
            })
        );
    });

    it("should reject whitespace-only name", async () => {
        const response = await handleCreateDatahubDatasetRequest({ name: "   " }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should reject name with invalid characters", async () => {
        const response = await handleCreateDatahubDatasetRequest({ name: "My @Dataset!" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should trim whitespace from name before validation", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "Trimmed" });
        await handleCreateDatahubDatasetRequest({ name: "  Trimmed  ", description: "test" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            DATAHUB_DATASETS_BASE_URL,
            mockToken,
            expect.objectContaining({
                body: { name: "Trimmed", description: "test" },
            })
        );
    });
});

describe("handleUpdateDatahubDatasetRequest", () => {
    const validUpdateArgs = { name: "My Dataset", description: "Updated description" };

    it("should call makeDoitRequest with PATCH, correct URL, and body without name", async () => {
        const mockResponse = {
            name: "My Dataset",
            description: "Updated description",
            records: 1500,
            updatedBy: "user@example.com",
            lastUpdated: "2024-03-10T23:00:00Z",
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        await handleUpdateDatahubDatasetRequest(validUpdateArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/My%20Dataset"),
            mockToken,
            expect.objectContaining({
                method: "PATCH",
                body: { description: "Updated description" },
                customerContext: undefined,
            })
        );
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "My Dataset" });
        await handleUpdateDatahubDatasetRequest({ ...validUpdateArgs, customerContext: "customer-123" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            mockToken,
            expect.objectContaining({ customerContext: "customer-123" })
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const response = await handleUpdateDatahubDatasetRequest(validUpdateArgs, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Failed to update DataHub dataset") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
        const response = await handleUpdateDatahubDatasetRequest(validUpdateArgs, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("sends only provided fields and strips name from body", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ name: "My Dataset" });
        await handleUpdateDatahubDatasetRequest({ name: "My Dataset", description: "New desc" }, mockToken);
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("/My%20Dataset"),
            mockToken,
            expect.objectContaining({ method: "PATCH", body: { description: "New desc" } })
        );
    });

    it("should reject update with no updatable fields (name only)", async () => {
        const response = await handleUpdateDatahubDatasetRequest({ name: "My Dataset" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should reject whitespace-only name", async () => {
        const response = await handleUpdateDatahubDatasetRequest({ name: "   ", description: "test" }, mockToken);
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should reject name with invalid characters", async () => {
        const response = await handleUpdateDatahubDatasetRequest(
            { name: "My @Dataset!", description: "test" },
            mockToken
        );
        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Invalid arguments") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});
