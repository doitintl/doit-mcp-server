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

    const validRecurringArgs = {
        name: "Test Budget",
        amount: 500,
        currency: "USD" as const,
        type: "recurring" as const,
        timeInterval: "month" as const,
        startPeriod: 1704067200000,
        scopes: [
            { id: "cloud_provider", type: "fixed" as const, mode: "is" as const, values: ["amazon-web-services"] },
        ],
        collaborators: [{ role: "owner" as const, email: "test@example.com" }],
    };

    const validFixedArgs = {
        name: "Fixed Budget",
        amount: 1000,
        currency: "USD" as const,
        type: "fixed" as const,
        startPeriod: 1704067200000,
        endPeriod: 1706745600000,
        scope: ["allocation-1"],
        collaborators: [{ role: "owner" as const, email: "test@example.com" }],
    };

    describe("happy paths", () => {
        it("should create a recurring budget with scopes and owner collaborator", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

            const response = await handleCreateBudgetRequest(validRecurringArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
                method: "POST",
                body: validRecurringArgs,
                customerContext: undefined,
            });

            const parsed = JSON.parse(response.content[0].text);
            expect(parsed.id).toBe("budget-new-1");
            expect(parsed.name).toBe("Test Budget");
            expect(parsed.currency).toBe("USD");
        });

        it("should create a fixed budget with scope (deprecated) and endPeriod", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

            const response = await handleCreateBudgetRequest(validFixedArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
                method: "POST",
                body: validFixedArgs,
                customerContext: undefined,
            });

            expect(response.isError).toBeFalsy();
        });

        it("should accept usePrevSpend=true without amount", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

            const args = {
                ...validRecurringArgs,
                amount: undefined,
                usePrevSpend: true,
            };
            const { amount: _, ...expectedBody } = args;

            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
                method: "POST",
                body: expectedBody,
                customerContext: undefined,
            });
            expect(response.isError).toBeFalsy();
        });

        it("should accept seasonalAmounts for monthly recurring budget", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

            const args = {
                ...validRecurringArgs,
                seasonalAmounts: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
            };

            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBeFalsy();
            expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
                method: "POST",
                body: args,
                customerContext: undefined,
            });
        });

        it("should accept recipientsSlackChannels with Slack channel object", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

            const args = {
                ...validRecurringArgs,
                recipientsSlackChannels: [{ id: "C123", name: "alerts", workspace: "myteam" }],
            };

            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBeFalsy();
        });

        it("should accept three alerts (max valid count)", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

            const args = {
                ...validRecurringArgs,
                alerts: [{ percentage: 50 }, { percentage: 85 }, { percentage: 100 }],
            };

            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBeFalsy();
        });

        it("should accept recurring budget with growthPerPeriod", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

            const args = { ...validRecurringArgs, growthPerPeriod: 10 };

            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBeFalsy();
            expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
                method: "POST",
                body: expect.objectContaining({ growthPerPeriod: 10 }),
                customerContext: undefined,
            });
        });
    });

    describe("customerContext and error handling", () => {
        it("should pass customerContext to makeDoitRequest", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreateBudgetResponse);

            await handleCreateBudgetRequest({ ...validRecurringArgs, customerContext: "customer-456" }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(BUDGETS_BASE_URL, mockToken, {
                method: "POST",
                body: validRecurringArgs,
                customerContext: "customer-456",
            });
        });

        it("should return error response when API returns null", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            const response = await handleCreateBudgetRequest(validRecurringArgs, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Failed to create budget") }],
                isError: true,
            });
        });

        it("should return error response when makeDoitRequest throws", async () => {
            (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

            const response = await handleCreateBudgetRequest(validRecurringArgs, mockToken);

            expect(response).toEqual({
                content: [{ type: "text", text: expect.stringContaining("Network error") }],
                isError: true,
            });
        });
    });

    describe("validation errors", () => {
        it("should reject when name is missing", async () => {
            const { name: _, ...args } = validRecurringArgs;
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("name");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject empty string name", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, name: "" }, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("name");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject when only name is provided (missing required fields)", async () => {
            const response = await handleCreateBudgetRequest({ name: "Minimal Budget" }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject missing both scope and scopes", async () => {
            const { scopes: _, ...args } = validRecurringArgs;
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("scope");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject when both scope and scopes are provided", async () => {
            const args = { ...validRecurringArgs, scope: ["allocation-1"] };
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("scope");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject fixed budget without endPeriod", async () => {
            const { endPeriod: _, ...args } = validFixedArgs;
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("endPeriod");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject recurring budget with endPeriod", async () => {
            const args = { ...validRecurringArgs, endPeriod: 1706745600000 };
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("endPeriod");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject missing amount when usePrevSpend is false", async () => {
            const { amount: _, ...args } = validRecurringArgs;
            const response = await handleCreateBudgetRequest({ ...args, usePrevSpend: false }, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("amount");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject missing amount when usePrevSpend is omitted", async () => {
            const { amount: _, ...args } = validRecurringArgs;
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("amount");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject zero amount", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, amount: 0 }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject negative amount", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, amount: -100 }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid enum values for currency", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, currency: "INVALID" }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid enum values for type", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, type: "weekly" }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid enum values for metric", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, metric: "invalid" }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject more than 3 alerts", async () => {
            const args = {
                ...validRecurringArgs,
                alerts: [{ percentage: 25 }, { percentage: 50 }, { percentage: 75 }, { percentage: 100 }],
            };
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject negative growthPerPeriod", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, growthPerPeriod: -5 }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject collaborators without an owner role", async () => {
            const args = {
                ...validRecurringArgs,
                collaborators: [{ role: "editor" as const, email: "editor@example.com" }],
            };
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("owner");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should report multiple validation errors when several fields are invalid at once", async () => {
            const response = await handleCreateBudgetRequest(
                {
                    name: "",
                    amount: -100,
                    currency: "FAKE",
                    type: "recurring" as const,
                    timeInterval: "month" as const,
                    startPeriod: 1704067200000,
                    scopes: [{ id: "cloud_provider", type: "fixed" as const, mode: "is" as const, values: ["aws"] }],
                    collaborators: [{ role: "owner" as const, email: "test@example.com" }],
                },
                mockToken
            );

            expect(response.isError).toBe(true);
            const errorText = response.content[0].text;
            expect(errorText).toContain("name");
            expect(errorText).toContain("amount");
            expect(errorText).toContain("currency");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should not surface refinement errors when base schema fields are also invalid", async () => {
            const { scopes: _, ...argsWithoutScopes } = validRecurringArgs;
            const response = await handleCreateBudgetRequest({ ...argsWithoutScopes, currency: "FAKE" }, mockToken);

            expect(response.isError).toBe(true);
            const errorText = response.content[0].text;
            expect(errorText).toContain("currency");
            expect(errorText).not.toContain("scope");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid email in nested collaborator object", async () => {
            const args = {
                ...validRecurringArgs,
                collaborators: [{ role: "owner" as const, email: "not-an-email" }],
            };
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("email");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject recurring budget without timeInterval", async () => {
            const { timeInterval: _, ...args } = validRecurringArgs;
            const response = await handleCreateBudgetRequest(args, mockToken);

            expect(response.isError).toBe(true);
            expect(response.content[0].text).toContain("timeInterval");
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject empty scopes array", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, scopes: [] }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject empty collaborators array", async () => {
            const response = await handleCreateBudgetRequest({ ...validRecurringArgs, collaborators: [] }, mockToken);

            expect(response.isError).toBe(true);
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });
    });
});
