import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMITMENT_SORT_BY_VALUES, COMMITMENT_SORT_ORDER_VALUES } from "../../types/commitmentManager.js";
import { makeDoitRequest } from "../../utils/util.js";
import {
    COMMITMENT_MANAGER_BASE_URL,
    DEFAULT_MAX_RESULTS_COMMITMENTS,
    getCommitmentTool,
    handleGetCommitmentRequest,
    handleListCommitmentsRequest,
    listCommitmentsTool,
} from "../commitmentManager.js";

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

describe("listCommitmentsTool metadata", () => {
    it("should include sortBy accepted values in description", () => {
        const sortByProp = listCommitmentsTool.inputSchema.properties?.sortBy as { description: string };
        for (const value of COMMITMENT_SORT_BY_VALUES) {
            expect(sortByProp.description).toContain(value);
        }
    });

    it("should include sortOrder accepted values in description", () => {
        const sortOrderProp = listCommitmentsTool.inputSchema.properties?.sortOrder as { description: string };
        for (const value of COMMITMENT_SORT_ORDER_VALUES) {
            expect(sortOrderProp.description).toContain(value);
        }
    });
});

describe("handleListCommitmentsRequest", () => {
    const mockToken = "fake-token";

    const mockCommitment = {
        id: "commitment-1",
        name: "GCP 3-Year CUD",
        startDate: "2025-01-01T00:00:00.000Z",
        endDate: "2028-01-01T00:00:00.000Z",
        currency: "USD",
        cloudProvider: "google-cloud",
        totalCommitmentValue: 100000,
        totalCurrentAttainment: 75000,
        periods: [
            {
                startDate: "2025-01-01T00:00:00.000Z",
                endDate: "2026-01-01T00:00:00.000Z",
                commitmentValue: 33333,
                marketplaceLimitPercentage: 25,
            },
        ],
        createTime: 1735689600000,
        updateTime: 1750032000000,
    };

    it("should call makeDoitRequest with base URL and return commitments in response", async () => {
        const mockApiResponse = { pageToken: "", rowCount: 1, commitments: [mockCommitment] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListCommitmentsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${COMMITMENT_MANAGER_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_COMMITMENTS}`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.commitments).toHaveLength(1);
        expect(parsed.commitments[0].id).toBe("commitment-1");
        expect(parsed.commitments[0].name).toBe("GCP 3-Year CUD");
        expect(parsed.commitments[0].cloudProvider).toBe("google-cloud");
        expect(parsed.rowCount).toBe(1);
    });

    it("should append all query params when provided", async () => {
        const mockApiResponse = { pageToken: "next", rowCount: 1, commitments: [mockCommitment] };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        await handleListCommitmentsRequest(
            {
                maxResults: "10",
                pageToken: "token-1",
                filter: "provider:[google-cloud]",
                sortBy: "name",
                sortOrder: "asc",
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("maxResults=10"),
            mockToken,
            expect.any(Object)
        );
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("pageToken=token-1"),
            mockToken,
            expect.any(Object)
        );
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("sortBy=name"),
            mockToken,
            expect.any(Object)
        );
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.stringContaining("sortOrder=asc"),
            mockToken,
            expect.any(Object)
        );
        expect(makeDoitRequest).toHaveBeenCalledWith(expect.stringContaining("filter="), mockToken, expect.any(Object));
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ commitments: [], rowCount: 0 });

        await handleListCommitmentsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListCommitmentsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("commitments") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListCommitmentsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});

describe("handleGetCommitmentRequest", () => {
    const mockToken = "fake-token";

    const mockCommitment = {
        id: "commitment-1",
        name: "GCP 3-Year CUD",
        startDate: "2025-01-01T00:00:00.000Z",
        endDate: "2028-01-01T00:00:00.000Z",
        currency: "USD",
        cloudProvider: "google-cloud",
        totalCommitmentValue: 100000,
        totalCurrentAttainment: 75000,
        periods: [
            {
                startDate: "2025-01-01T00:00:00.000Z",
                endDate: "2026-01-01T00:00:00.000Z",
                commitmentValue: 33333,
                marketplaceLimitPercentage: 25,
            },
        ],
        createTime: 1735689600000,
        updateTime: 1750032000000,
    };

    it("should call makeDoitRequest with correct URL including ID and return commitment", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCommitment);

        const response = await handleGetCommitmentRequest({ id: "commitment-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${COMMITMENT_MANAGER_BASE_URL}/commitment-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("commitment-1");
        expect(parsed.name).toBe("GCP 3-Year CUD");
        expect(parsed.cloudProvider).toBe("google-cloud");
        expect(parsed.totalCommitmentValue).toBe(100000);
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCommitment);

        await handleGetCommitmentRequest({ id: "commitment-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(expect.any(String), mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetCommitmentRequest({ id: "commitment-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("commitment") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetCommitmentRequest({ id: "commitment-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when id is missing", async () => {
        const response = await handleGetCommitmentRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when id is empty string", async () => {
        const response = await handleGetCommitmentRequest({ id: "" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should return error when id is whitespace only", async () => {
        const response = await handleGetCommitmentRequest({ id: "   " }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});

describe("getCommitmentTool metadata", () => {
    it("should have correct tool name", () => {
        expect(getCommitmentTool.name).toBe("get_commitment");
    });

    it("should have id in inputSchema", () => {
        expect(getCommitmentTool.inputSchema.properties).toHaveProperty("id");
    });
});
