import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    DATAHUB_DATASETS_BASE_URL,
    handleGetDatahubDatasetRequest,
    handleListDatahubDatasetsRequest,
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

describe("list_datahub_datasets", () => {
    const mockToken = "fake-token";

    const mockDataset = {
        name: "My Custom Dataset",
        description: "Dataset for tracking custom business metrics",
        records: 1500,
        updatedBy: "user@example.com",
        lastUpdated: "2024-03-10T23:00:00Z",
    };

    it("should call makeDoitRequest with base URL and return datasets", async () => {
        const mockResponse = { datasets: [mockDataset] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleListDatahubDatasetsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(DATAHUB_DATASETS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.datasets).toHaveLength(1);
        expect(parsed.datasets[0].name).toBe("My Custom Dataset");
        expect(parsed.datasets[0].records).toBe(1500);
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ datasets: [] });

        await handleListDatahubDatasetsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(DATAHUB_DATASETS_BASE_URL, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListDatahubDatasetsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("DataHub datasets") }],
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

describe("get_datahub_dataset", () => {
    const mockToken = "fake-token";

    const mockDataset = {
        name: "My Custom Dataset",
        description: "Dataset for tracking custom business metrics",
        records: 1500,
        updatedBy: "user@example.com",
        lastUpdated: "2024-03-10T23:00:00Z",
    };

    it("should call makeDoitRequest with dataset name in URL and return dataset data", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockDataset);

        const response = await handleGetDatahubDatasetRequest({ name: "My Custom Dataset" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${DATAHUB_DATASETS_BASE_URL}/My%20Custom%20Dataset`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.name).toBe("My Custom Dataset");
        expect(parsed.records).toBe(1500);
        expect(parsed.updatedBy).toBe("user@example.com");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockDataset);

        await handleGetDatahubDatasetRequest({ name: "My Custom Dataset", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetDatahubDatasetRequest({ name: "My Custom Dataset" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("DataHub dataset") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetDatahubDatasetRequest({ name: "My Custom Dataset" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when name is missing", async () => {
        const response = await handleGetDatahubDatasetRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when name is an empty string", async () => {
        const response = await handleGetDatahubDatasetRequest({ name: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Dataset name is required and cannot be empty") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when name is only whitespace", async () => {
        const response = await handleGetDatahubDatasetRequest({ name: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Dataset name is required and cannot be empty") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});
