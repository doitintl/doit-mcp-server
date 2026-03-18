import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { BUDGETS_BASE_URL, DEFAULT_MAX_RESULTS_BUDGETS, handleListBudgetsRequest } from "../budgets.js";

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

describe("budgets", () => {
    const mockToken = "fake-token";

    const mockBudget = {
        alertThresholds: [{ amount: 0, percentage: 80 }],
        amount: 1000,
        budgetName: "Monthly Budget",
        createTime: 1700000000000,
        currency: "USD",
        currentUtilization: 50,
        endPeriod: 1700100000000,
        id: "budget-1",
        owner: "alice@example.com",
        scopes: [
            {
                id: "cloud_provider",
                type: "fixed",
                inverse: false,
                mode: "is",
                values: ["google-cloud"],
            },
        ],
        startPeriod: 1700000000000,
        timeInterval: "month",
        updateTime: 1700050000000,
        url: "https://console.doit.com/budgets/budget-1",
    };

    it("should call makeDoitRequest with base URL and return budgets in response", async () => {
        const mockApiResponse = { budgets: [mockBudget], pageToken: "", rowCount: 1 };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListBudgetsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${BUDGETS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_BUDGETS}`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.budgets).toHaveLength(1);
        expect(parsed.budgets[0].id).toBe("budget-1");
        expect(parsed.budgets[0].budgetName).toBe("Monthly Budget");
        expect(parsed.rowCount).toBe(1);
    });

    it("should append all query params when provided", async () => {
        const mockApiResponse = { budgets: [mockBudget], pageToken: "next", rowCount: 1 };
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiResponse);

        const response = await handleListBudgetsRequest(
            {
                maxResults: "10",
                pageToken: "token-1",
                filter: "owner:alice@example.com",
                minCreationTime: "1700000000000",
                maxCreationTime: "1700100000000",
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${BUDGETS_BASE_URL}?maxResults=10&pageToken=token-1&filter=owner%3Aalice%40example.com&minCreationTime=1700000000000&maxCreationTime=1700100000000`,
            mockToken,
            {
                method: "GET",
                customerContext: undefined,
            }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.budgets).toHaveLength(1);
        expect(parsed.pageToken).toBe("next");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
            budgets: [mockBudget],
            pageToken: "",
            rowCount: 1,
        });

        await handleListBudgetsRequest({ customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${BUDGETS_BASE_URL}?maxResults=${DEFAULT_MAX_RESULTS_BUDGETS}`,
            mockToken,
            {
                method: "GET",
                customerContext: "customer-123",
            }
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleListBudgetsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("budgets") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleListBudgetsRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});
