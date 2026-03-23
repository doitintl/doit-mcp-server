import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANNOTATION_SORT_BY_VALUES, ANNOTATION_SORT_ORDER_VALUES } from "../../types/annotations.js";
import { makeDoitRequest } from "../../utils/util.js";
import {
    ANNOTATIONS_BASE_URL,
    DEFAULT_MAX_RESULTS_ANNOTATIONS,
    handleGetAnnotationRequest,
    handleListAnnotationsRequest,
    listAnnotationsTool,
} from "../annotations.js";

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

describe("listAnnotationsTool metadata", () => {
    it("should include sortBy accepted values in description", () => {
        const sortByProp = listAnnotationsTool.inputSchema.properties?.sortBy as { description: string };
        for (const value of ANNOTATION_SORT_BY_VALUES) {
            expect(sortByProp.description).toContain(value);
        }
    });

    it("should include sortOrder accepted values in description", () => {
        const sortOrderProp = listAnnotationsTool.inputSchema.properties?.sortOrder as { description: string };
        for (const value of ANNOTATION_SORT_ORDER_VALUES) {
            expect(sortOrderProp.description).toContain(value);
        }
    });
});

describe("list_annotations", () => {
    const mockToken = "fake-token";

    const mockAnnotation = {
        id: "annotation-1",
        content: "Budget threshold reached",
        timestamp: "2026-01-15T00:00:00.000Z",
        reports: ["report-1"],
        labels: [{ id: "label-1", name: "Engineering" }],
        createTime: "2026-01-01T00:00:00.000Z",
        updateTime: "2026-01-02T00:00:00.000Z",
    };

    it("should call makeDoitRequest with base URL and return annotations in response", async () => {
        const mockApiResponse = { pageToken: "", rowCount: 1, annotations: [mockAnnotation] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListAnnotationsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${ANNOTATIONS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_ANNOTATIONS}`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.annotations).toHaveLength(1);
        expect(parsed.annotations[0].id).toBe("annotation-1");
        expect(parsed.annotations[0].content).toBe("Budget threshold reached");
        expect(parsed.rowCount).toBe(1);
    });

    it("should append all query params when provided", async () => {
        const mockApiResponse = { pageToken: "next", rowCount: 1, annotations: [mockAnnotation] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListAnnotationsRequest(
            {
                maxResults: "10",
                pageToken: "token-1",
                filter: "content:budget",
                sortBy: "timestamp",
                sortOrder: "asc",
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${ANNOTATIONS_BASE_URL}?maxResults=10&pageToken=token-1&filter=content%3Abudget&sortBy=timestamp&sortOrder=asc`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.annotations).toHaveLength(1);
        expect(parsed.pageToken).toBe("next");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
            pageToken: "",
            rowCount: 1,
            annotations: [mockAnnotation],
        });

        await handleListAnnotationsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${ANNOTATIONS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_ANNOTATIONS}`,
            mockToken,
            {
                method: "GET",
                customerContext: "customer-123",
            }
        );
    });

    it("should include createTime and updateTime when present in response", async () => {
        const mockApiResponse = { pageToken: "", rowCount: 1, annotations: [mockAnnotation] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListAnnotationsRequest({}, mockToken);

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.annotations[0].createTime).toBe("2026-01-01T00:00:00.000Z");
        expect(parsed.annotations[0].updateTime).toBe("2026-01-02T00:00:00.000Z");
    });

    it("should handle annotations without createTime and updateTime", async () => {
        const annotationWithoutTimes = {
            id: "annotation-2",
            content: "Cost anomaly detected",
            timestamp: "2026-02-01T00:00:00.000Z",
        };
        const mockApiResponse = { pageToken: "", rowCount: 1, annotations: [annotationWithoutTimes] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListAnnotationsRequest({}, mockToken);

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.annotations).toHaveLength(1);
        expect(parsed.annotations[0].id).toBe("annotation-2");
        expect(parsed.annotations[0].content).toBe("Cost anomaly detected");
        expect(parsed.annotations[0]).not.toHaveProperty("createTime");
        expect(parsed.annotations[0]).not.toHaveProperty("updateTime");
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListAnnotationsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("annotations") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListAnnotationsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("get_annotation", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with annotation ID in URL and return annotation data", async () => {
        const mockAnnotation = {
            id: "annotation-1",
            content: "Budget threshold reached",
            timestamp: "2026-01-15T00:00:00.000Z",
            reports: ["report-1"],
            labels: [{ id: "label-1", name: "Engineering" }],
            createTime: "2026-01-01T00:00:00.000Z",
            updateTime: "2026-01-02T00:00:00.000Z",
        };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockAnnotation);

        const response = await handleGetAnnotationRequest({ id: "annotation-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${ANNOTATIONS_BASE_URL}/annotation-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("annotation-1");
        expect(parsed.content).toBe("Budget threshold reached");
        expect(parsed.timestamp).toBe("2026-01-15T00:00:00.000Z");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        const mockAnnotation = { id: "annotation-1", content: "Test", timestamp: "2026-01-15T00:00:00.000Z" };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockAnnotation);

        await handleGetAnnotationRequest({ id: "annotation-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${ANNOTATIONS_BASE_URL}/annotation-1`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetAnnotationRequest({ id: "annotation-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("annotation") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetAnnotationRequest({ id: "annotation-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleGetAnnotationRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
    });

    it("should return error when id is an empty string", async () => {
        const response = await handleGetAnnotationRequest({ id: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Annotation ID is required and cannot be empty") }],
            isError: true,
        });
    });

    it("should return error when id is only whitespace", async () => {
        const response = await handleGetAnnotationRequest({ id: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Annotation ID is required and cannot be empty") }],
            isError: true,
        });
    });
});
