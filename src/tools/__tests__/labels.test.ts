import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LABEL_SORT_BY_VALUES, LABEL_SORT_ORDER_VALUES } from "../../types/labels.js";
import { makeDoitRequest } from "../../utils/util.js";
import {
    DEFAULT_MAX_RESULTS_LABELS,
    handleGetLabelRequest,
    handleListLabelsRequest,
    LABELS_BASE_URL,
    listLabelsTool,
} from "../labels.js";

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

describe("listLabelsTool metadata", () => {
    it("should include sortBy accepted values in description", () => {
        const sortByProp = listLabelsTool.inputSchema.properties?.sortBy as { description: string };
        for (const value of LABEL_SORT_BY_VALUES) {
            expect(sortByProp.description).toContain(value);
        }
    });

    it("should include sortOrder accepted values in description", () => {
        const sortOrderProp = listLabelsTool.inputSchema.properties?.sortOrder as { description: string };
        for (const value of LABEL_SORT_ORDER_VALUES) {
            expect(sortOrderProp.description).toContain(value);
        }
    });
});

describe("labels", () => {
    const mockToken = "fake-token";

    const mockLabel = {
        id: "label-1",
        name: "Engineering",
        color: "blue",
        type: "custom",
        createTime: "2026-01-01T00:00:00.000Z",
        updateTime: "2026-01-02T00:00:00.000Z",
    };

    it("should call makeDoitRequest with base URL and return labels in response", async () => {
        const mockApiResponse = { pageToken: "", rowCount: 1, labels: [mockLabel] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListLabelsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${LABELS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_LABELS}`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.labels).toHaveLength(1);
        expect(parsed.labels[0].id).toBe("label-1");
        expect(parsed.labels[0].name).toBe("Engineering");
        expect(parsed.labels[0].color).toBe("blue");
        expect(parsed.rowCount).toBe(1);
    });

    it("should append all query params when provided", async () => {
        const mockApiResponse = { pageToken: "next", rowCount: 1, labels: [mockLabel] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListLabelsRequest(
            {
                maxResults: "10",
                pageToken: "token-1",
                filter: "name:test",
                sortBy: "name",
                sortOrder: "asc",
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${LABELS_BASE_URL}?maxResults=10&pageToken=token-1&filter=name%3Atest&sortBy=name&sortOrder=asc`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.labels).toHaveLength(1);
        expect(parsed.pageToken).toBe("next");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
            pageToken: "",
            rowCount: 1,
            labels: [mockLabel],
        });

        await handleListLabelsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${LABELS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_LABELS}`,
            mockToken,
            {
                method: "GET",
                customerContext: "customer-123",
            }
        );
    });

    it("should include createTime and updateTime when present in response", async () => {
        const mockApiResponse = { pageToken: "", rowCount: 1, labels: [mockLabel] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListLabelsRequest({}, mockToken);

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.labels[0].createTime).toBe("2026-01-01T00:00:00.000Z");
        expect(parsed.labels[0].updateTime).toBe("2026-01-02T00:00:00.000Z");
    });

    it("should handle labels without createTime and updateTime", async () => {
        const labelWithoutTimes = { id: "label-2", name: "Finance", color: "teal", type: "preset" };
        const mockApiResponse = { pageToken: "", rowCount: 1, labels: [labelWithoutTimes] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListLabelsRequest({}, mockToken);

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.labels).toHaveLength(1);
        expect(parsed.labels[0].id).toBe("label-2");
        expect(parsed.labels[0].name).toBe("Finance");
        expect(parsed.labels[0]).not.toHaveProperty("createTime");
        expect(parsed.labels[0]).not.toHaveProperty("updateTime");
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListLabelsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("labels") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListLabelsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("get_label", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with label ID in URL and return label data", async () => {
        const mockLabel = {
            id: "label-1",
            name: "Engineering",
            color: "blue",
            type: "custom",
            createTime: "2026-01-01T00:00:00.000Z",
            updateTime: "2026-01-02T00:00:00.000Z",
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockLabel);

        const response = await handleGetLabelRequest({ id: "label-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("label-1");
        expect(parsed.name).toBe("Engineering");
        expect(parsed.color).toBe("blue");
        expect(parsed.type).toBe("custom");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        const mockLabel = { id: "label-1", name: "Engineering", color: "blue", type: "custom" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockLabel);

        await handleGetLabelRequest({ id: "label-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${LABELS_BASE_URL}/label-1`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetLabelRequest({ id: "label-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("label") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetLabelRequest({ id: "label-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleGetLabelRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should return error when id is an empty string", async () => {
        const response = await handleGetLabelRequest({ id: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Label ID is required and cannot be empty") }],
            isError: true,
        });
    });

    it("should return error when id is only whitespace", async () => {
        const response = await handleGetLabelRequest({ id: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Label ID is required and cannot be empty") }],
            isError: true,
        });
    });
});
