import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    BUDGETS_BASE_URL,
    DEFAULT_MAX_RESULTS_BUDGETS,
    handleCreateBudgetRequest,
    handleGetBudgetRequest,
    handleListBudgetsRequest,
} from "../budgets.js";

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

describe("get_budget", () => {
    const mockToken = "fake-token";

    const mockBudgetDetails = {
        alerts: [{ forecastedDate: 1700090000000, percentage: 80, triggered: true }],
        amount: 1000,
        seasonalAmounts: [],
        collaborators: [{ email: "alice@example.com", role: "owner" }],
        createTime: 1700000000000,
        currency: "USD",
        currentUtilization: 50,
        description: "Monthly cloud budget",
        endPeriod: 1700100000000,
        forecastedUtilization: 75,
        growthPerPeriod: 0,
        id: "budget-1",
        metric: "cost",
        name: "Monthly Budget",
        public: "owner",
        recipients: ["alice@example.com"],
        recipientsSlackChannels: [],
        scope: [],
        scopes: [{ id: "cloud_provider", type: "fixed", inverse: false, mode: "is", values: ["google-cloud"] }],
        startPeriod: 1700000000000,
        timeInterval: "month",
        type: "recurring",
        updateTime: 1700050000000,
        usePrevSpend: false,
    };

    it("should call makeDoitRequest with the correct URL and return budget details", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockBudgetDetails);

        const response = await handleGetBudgetRequest({ id: "budget-1" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${BUDGETS_BASE_URL}/budget-1`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("budget-1");
        expect(parsed.name).toBe("Monthly Budget");
        expect(parsed.currency).toBe("USD");
        expect(parsed.type).toBe("recurring");
        expect(parsed.alerts).toHaveLength(1);
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockBudgetDetails);

        await handleGetBudgetRequest({ id: "budget-1", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${BUDGETS_BASE_URL}/budget-1`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetBudgetRequest({ id: "budget-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("budget") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetBudgetRequest({ id: "budget-1" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return Zod error when id is missing", async () => {
        const response = await handleGetBudgetRequest({}, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toEqual(expect.stringContaining("id"));
    });

    it("should return Zod error when id is empty string", async () => {
        const response = await handleGetBudgetRequest({ id: "" }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toEqual(expect.stringContaining("id"));
    });
});

describe("create_budget", () => {
    const mockToken = "fake-token";

    const mockCreateBudgetResponse = {
        id: "budget-new-1",
        name: "Test Budget",
        amount: 500,
        currency: "USD",
        type: "recurring",
        timeInterval: "month",
        startPeriod: 1704067200000,
        createTime: 1704067200000,
        metric: "cost",
        usePrevSpend: false,
        scopes: [{ id: "cloud_provider", type: "fixed", mode: "is", values: ["amazon-web-services"] }],
        collaborators: [{ role: "owner", email: "test@example.com" }],
    };

    it("should call makeDoitRequest with POST method and body, and return created budget", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

        const args = {
            name: "Test Budget",
            amount: 500,
            currency: "USD",
            type: "recurring",
            timeInterval: "month",
            startPeriod: 1704067200000,
            scopes: [{ id: "cloud_provider", type: "fixed", mode: "is", values: ["amazon-web-services"] }],
            collaborators: [{ role: "owner", email: "test@example.com" }],
        };

        const response = await handleCreateBudgetRequest(args, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
            method: "POST",
            body: {
                name: "Test Budget",
                amount: 500,
                currency: "USD",
                type: "recurring",
                timeInterval: "month",
                startPeriod: 1704067200000,
                scopes: [{ id: "cloud_provider", type: "fixed", mode: "is", values: ["amazon-web-services"] }],
                collaborators: [{ role: "owner", email: "test@example.com" }],
            },
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.id).toBe("budget-new-1");
        expect(parsed.name).toBe("Test Budget");
        expect(parsed.currency).toBe("USD");
    });

    it("should only include provided fields in the request body", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

        await handleCreateBudgetRequest({ name: "Minimal Budget" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
            method: "POST",
            body: { name: "Minimal Budget" },
            customerContext: undefined,
        });
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

        await handleCreateBudgetRequest({ name: "Test Budget", customerContext: "customer-456" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
            method: "POST",
            body: { name: "Test Budget" },
            customerContext: "customer-456",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleCreateBudgetRequest({ name: "Test" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Failed to create budget") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleCreateBudgetRequest({ name: "Test" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return Zod validation error when name is missing", async () => {
        const response = await handleCreateBudgetRequest({}, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Required") }],
            isError: true,
        });
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});
