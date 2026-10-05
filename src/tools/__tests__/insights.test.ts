import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    getInsightTool,
    handleGetInsightRequest,
    handleGetInsightResourcesRequest,
    handleListInsightsRequest,
    handlePostInsightResultRequest,
    handleUpdateInsightStatusRequest,
    INSIGHTS_BASE_URL,
    ListInsightsArgumentsSchema,
    PostInsightResultArgumentsSchema,
    postInsightResultTool,
    UpdateInsightStatusArgumentsSchema,
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
    vi.resetAllMocks();
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

describe("recommendation pagination and response semantics", () => {
    it("maps provider and legacy pageSize, sorts by savings and preserves the real cursor", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue({
            results: [
                {
                    ...mockInsight,
                    key: "low",
                    cloudProvider: "aws",
                    easyWinDescription: "",
                    summary: { potentialDailySavings: 1 },
                },
                {
                    ...mockInsight,
                    key: "high",
                    cloudProvider: "aws",
                    easyWinDescription: "Quick change",
                    summary: { potentialDailySavings: 9 },
                },
                { ...mockInsight, key: "unknown", cloudProvider: "aws", summary: { potentialDailySavings: 2 } },
            ],
            pagination: { rowCount: 3, pageToken: "opaque/+=" },
        });
        const response = await handleListInsightsRequest(
            {
                provider: "aws",
                category: ["FinOps"],
                page: 0,
                pageSize: 3,
                easyWin: false,
                searchTerm: "idle",
                customerContext: "switched",
            },
            "token"
        );
        const [url, , options] = vi.mocked(makeDoitRequest).mock.calls[0];
        const params = new URL(url).searchParams;
        expect(Object.fromEntries(params)).toEqual({
            cloudProvider: "aws",
            category: "FinOps",
            maxResults: "3",
            easyWin: "false",
            searchTerm: "idle",
        });
        expect(options?.customerContext).toBe("switched");
        const data = JSON.parse(response.content[0].text);
        expect(data.pageToken).toBe("opaque/+=");
        expect(data.insights.map((r: any) => [r.key, r.provider, r.easyWin])).toEqual([
            ["high", "aws", true],
            ["unknown", "aws", null],
            ["low", "aws", false],
        ]);
        expect(data.insights[0].easyWinDescription).toBe("Quick change");
    });

    it("continues a sparse empty page without inventing results or losing its cursor", async () => {
        vi.mocked(makeDoitRequest)
            .mockResolvedValueOnce({ results: [], pagination: { rowCount: 0, pageToken: "opaque/+=?" } })
            .mockResolvedValueOnce({ results: [mockInsight], pagination: { rowCount: 1 } });
        const first = JSON.parse((await handleListInsightsRequest({ maxResults: 1 }, "token")).content[0].text);
        expect(first).toEqual({ insights: [], rowCount: 0, pageToken: "opaque/+=?" });
        const last = JSON.parse(
            (await handleListInsightsRequest({ maxResults: 1, pageToken: first.pageToken }, "token")).content[0].text
        );
        expect(new URL(vi.mocked(makeDoitRequest).mock.calls[1][0]).searchParams.get("pageToken")).toBe(
            first.pageToken
        );
        expect(last.pageToken).toBeNull();
        expect(last.insights).toHaveLength(1);
    });

    it("supports a single category string and gives maxResults precedence", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue({ results: [] });
        await handleListInsightsRequest({ category: "FinOps", maxResults: 500, pageSize: 5 }, "token");
        const params = new URL(vi.mocked(makeDoitRequest).mock.calls[0][0]).searchParams;
        expect(params.get("maxResults")).toBe("500");
        expect(params.getAll("category")).toEqual(["FinOps"]);
    });

    it.each([
        { category: ["FinOps", "Security"] },
        { page: 1 },
        { page: 0.5 },
        { maxResults: 501 },
        { maxResults: 1.5 },
    ])("rejects unsupported pagination or multiple categories: %j", (args) => {
        expect(ListInsightsArgumentsSchema.safeParse(args).success).toBe(false);
    });
});

describe("insight resources pagination", () => {
    it("passes an encoded cursor and page size, and preserves the paginated resource envelope", async () => {
        const page = {
            resourceResults: [{ resourceId: "resource-1", cloudProvider: "aws", result: { value: 2 } }],
            rowCount: 1,
            pageToken: "next",
        };
        vi.mocked(makeDoitRequest).mockResolvedValue(page);
        const result = await handleGetInsightResourcesRequest(
            {
                source: "source/one",
                key: "key/two",
                maxResults: 1,
                pageToken: "opaque/+=",
                customerContext: "switched",
            },
            "token"
        );
        const [url, , options] = vi.mocked(makeDoitRequest).mock.calls[0];
        expect(new URL(url).pathname).toContain("source/source%2Fone/insight/key%2Ftwo/resource-results");
        expect(new URL(url).searchParams.get("pageToken")).toBe("opaque/+=");
        expect(new URL(url).searchParams.get("maxResults")).toBe("1");
        expect(options?.customerContext).toBe("switched");
        expect(JSON.parse(result.content[0].text)).toEqual(page);
    });

    it("preserves empty pages and defaults explicitly to 1000 resources", async () => {
        const page = { resourceResults: [], rowCount: 0, pageToken: "next" };
        vi.mocked(makeDoitRequest)
            .mockResolvedValueOnce(page)
            .mockResolvedValueOnce({ ...page, pageToken: null });
        const first = JSON.parse(
            (await handleGetInsightResourcesRequest({ source: "test", key: "test" }, "token")).content[0].text
        );
        expect(first).toEqual(page);
        expect(new URL(vi.mocked(makeDoitRequest).mock.calls[0][0]).searchParams.get("maxResults")).toBe("1000");
        const last = JSON.parse(
            (
                await handleGetInsightResourcesRequest(
                    { source: "test", key: "test", pageToken: first.pageToken },
                    "token"
                )
            ).content[0].text
        );
        expect(new URL(vi.mocked(makeDoitRequest).mock.calls[1][0]).searchParams.get("pageToken")).toBe("next");
        expect(last.pageToken).toBeNull();
    });
});

describe("insight status requirements", () => {
    const metadata = {
        key: "fixture",
        title: "Fixture",
        shortDescription: "Test",
        cloudProvider: "aws",
        categories: ["FinOps"],
    };
    it.each(["upgrade needed", "permissions needed", "dismissed"])(
        "rejects invalid status or missing dismissal reason: %s",
        (status) => {
            expect(UpdateInsightStatusArgumentsSchema.safeParse({ key: "fixture", status }).success).toBe(false);
        }
    );
    it("accepts a dismissal reason and defaults the source to public-api", () => {
        const status = { status: "dismissed", dismissalDetails: { reason: "not relevant" } };
        expect(UpdateInsightStatusArgumentsSchema.parse({ key: "fixture", ...status }).source).toBe("public-api");
        expect(PostInsightResultArgumentsSchema.parse({ ...metadata, ...status }).source).toBe("public-api");
    });
});
