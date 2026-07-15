import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    getInsightTool,
    handleGetInsightRequest,
    handlePostInsightResultRequest,
    handleUpdateInsightStatusRequest,
    INSIGHTS_BASE_URL,
    postInsightResultTool,
    updateInsightStatusTool,
} from "../insights.js";

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

describe("postInsightResultTool metadata", () => {
    it("should be a write tool named post_insight_result", () => {
        expect(postInsightResultTool.annotations.readOnlyHint).toBe(false);
        expect(postInsightResultTool.name).toBe("post_insight_result");
        expect(postInsightResultTool.coversEndpoint).toBe(
            "post:/insights/v1/results/source/{sourceID}/insight/{insightKey}"
        );
    });
});

describe("post_insight_result", () => {
    const mockToken = "fake-token";

    const validArgs = {
        key: "idle-ec2",
        title: "Idle EC2 instances",
        shortDescription: "Stop idle EC2 instances to save cost.",
        cloudProvider: "aws",
        categories: ["FinOps"],
    };

    it("should POST to the source/key URL with the request body and default source public-api", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ ...validArgs, source: "public-api" });

        const response = await handlePostInsightResultRequest(validArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${INSIGHTS_BASE_URL}/results/source/public-api/insight/idle-ec2`,
            mockToken,
            {
                method: "POST",
                body: {
                    key: "idle-ec2",
                    title: "Idle EC2 instances",
                    shortDescription: "Stop idle EC2 instances to save cost.",
                    cloudProvider: "aws",
                    categories: ["FinOps"],
                },
                customerContext: undefined,
            }
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.key).toBe("idle-ec2");
    });

    it("should include optional fields in the body when provided", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ ...validArgs, source: "public-api" });

        await handlePostInsightResultRequest(
            { ...validArgs, status: "dismissed", dismissalDetails: { reason: "not relevant" }, reportUrl: "https://x" },
            mockToken
        );

        const call = (makeDoitRequest as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(call[2].body.status).toBe("dismissed");
        expect(call[2].body.dismissalDetails).toEqual({ reason: "not relevant" });
        expect(call[2].body.reportUrl).toBe("https://x");
    });

    it("should return a validation error when required fields are missing", async () => {
        const response = await handlePostInsightResultRequest({ key: "idle-ec2" }, mockToken);
        expect(response.isError).toBe(true);
    });

    it("should reject an invalid category", async () => {
        const response = await handlePostInsightResultRequest(
            { ...validArgs, categories: ["NotACategory"] },
            mockToken
        );
        expect(response.isError).toBe(true);
    });

    it("should return an error response when the API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handlePostInsightResultRequest(validArgs, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("idle-ec2");
    });
});

describe("updateInsightStatusTool metadata", () => {
    it("should be a write tool named update_insight_status", () => {
        expect(updateInsightStatusTool.annotations.readOnlyHint).toBe(false);
        expect(updateInsightStatusTool.name).toBe("update_insight_status");
        expect(updateInsightStatusTool.coversEndpoint).toBe(
            "put:/insights/v1/results/source/{sourceID}/insight/{insightKey}/status"
        );
    });
});

describe("update_insight_status", () => {
    const mockToken = "fake-token";

    it("should PUT to the status URL with the status body and not parse the 204 response", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const response = await handleUpdateInsightStatusRequest({ key: "idle-ec2", status: "acknowledged" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${INSIGHTS_BASE_URL}/results/source/public-api/insight/idle-ec2/status`,
            mockToken,
            {
                method: "PUT",
                body: { status: "acknowledged" },
                customerContext: undefined,
                parseResponse: false,
            }
        );

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.success).toBe(true);
        expect(parsed.status).toBe("acknowledged");
    });

    it("should include dismissalDetails in the body when dismissing", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

        await handleUpdateInsightStatusRequest(
            {
                key: "idle-ec2",
                status: "dismissed",
                dismissalDetails: { reason: "not worth the effort", comment: "x" },
            },
            mockToken
        );

        const call = (makeDoitRequest as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(call[2].body).toEqual({
            status: "dismissed",
            dismissalDetails: { reason: "not worth the effort", comment: "x" },
        });
    });

    it("should return a validation error when status is missing", async () => {
        const response = await handleUpdateInsightStatusRequest({ key: "idle-ec2" }, mockToken);
        expect(response.isError).toBe(true);
    });

    it("should reject an invalid status", async () => {
        const response = await handleUpdateInsightStatusRequest({ key: "idle-ec2", status: "bogus" }, mockToken);
        expect(response.isError).toBe(true);
    });

    it("should return an error response when the API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleUpdateInsightStatusRequest({ key: "idle-ec2", status: "acknowledged" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("idle-ec2");
    });
});
