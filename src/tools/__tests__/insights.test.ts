import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { getInsightTool, handleGetInsightRequest, INSIGHTS_BASE_URL } from "../insights.js";

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

const mockInsight = {
    key: "delete-ebs-volumes",
    source: "aws-cost-optimization-hub",
    title: "Delete unattached EBS volumes",
    shortDescription: "Remove idle EBS volumes to reduce cost.",
    displayStatus: "actionable",
    categories: ["FinOps"],
    summary: {
        potentialDailySavings: 12.5,
        securityRisks: 0,
    },
    lastUpdated: "2026-06-01T00:00:00.000Z",
};

describe("getInsightTool metadata", () => {
    it("should be read-only and named get_insight", () => {
        expect(getInsightTool.annotations.readOnlyHint).toBe(true);
        expect(getInsightTool.name).toBe("get_insight");
    });
});

describe("get_insight", () => {
    const mockToken = "fake-token";

    it("should call makeDoitRequest with the source/key URL and return the insight", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsight);

        const response = await handleGetInsightRequest(
            { source: "aws-cost-optimization-hub", key: "delete-ebs-volumes" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${INSIGHTS_BASE_URL}/results/source/aws-cost-optimization-hub/insight/delete-ebs-volumes`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.key).toBe("delete-ebs-volumes");
        expect(parsed.source).toBe("aws-cost-optimization-hub");
        expect(parsed.summary.potentialDailySavings).toBe(12.5);
    });

    it("should url-encode source and key path segments", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsight);

        await handleGetInsightRequest({ source: "custom source", key: "a/b" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${INSIGHTS_BASE_URL}/results/source/custom%20source/insight/a%2Fb`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockInsight);

        await handleGetInsightRequest(
            { source: "aws-cost-optimization-hub", key: "delete-ebs-volumes", customerContext: "customer-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${INSIGHTS_BASE_URL}/results/source/aws-cost-optimization-hub/insight/delete-ebs-volumes`,
            mockToken,
            { method: "GET", customerContext: "customer-123" }
        );
    });

    it("should return a validation error when source or key is missing", async () => {
        const response = await handleGetInsightRequest({ source: "aws-cost-optimization-hub" }, mockToken);

        expect(response.isError).toBe(true);
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetInsightRequest(
            { source: "aws-cost-optimization-hub", key: "delete-ebs-volumes" },
            mockToken
        );

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("delete-ebs-volumes");
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetInsightRequest(
            { source: "aws-cost-optimization-hub", key: "delete-ebs-volumes" },
            mockToken
        );

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});
