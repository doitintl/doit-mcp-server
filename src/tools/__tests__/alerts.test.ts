import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createErrorResponse, createSuccessResponse, handleGeneralError, makeDoitRequest } from "../../utils/util.js";
import {
    ALERTS_BASE_URL,
    handleCreateAlertRequest,
    handleGetAlertRequest,
    handleListAlertsRequest,
} from "../alerts.js";

vi.mock("../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        createErrorResponse: vi.fn(actual.createErrorResponse),
        createSuccessResponse: vi.fn(actual.createSuccessResponse),
        handleGeneralError: vi.fn(actual.handleGeneralError),
        makeDoitRequest: vi.fn(),
    };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

const mockAlertBase = {
    id: "7jyrczd6CSh3M8TuQ6Qq",
    name: "Test Alert",
    createTime: 1678628817062,
    updateTime: 1678628938891,
    lastAlerted: null,
    recipients: ["user1@example.com"],
    config: {
        condition: "value",
        currency: "USD",
        metric: { type: "basic", value: "cost" },
        operator: "gt",
        evaluateForEach: "",
        scopes: [{ id: "project_id", type: "fixed", mode: "is", values: ["my-project"] }],
        timeInterval: "month",
        dataSource: "billing",
        value: 500,
    },
};

// Simulates a legacy API response that still includes the deprecated attributions field
const mockAlertLegacy = {
    ...mockAlertBase,
    config: { ...mockAlertBase.config, attributions: ["PvqyGcdFcTHh7aLUdGdf"] },
};

describe("handleGetAlertRequest", () => {
    const mockToken = "fake-token";
    const alertId = "7jyrczd6CSh3M8TuQ6Qq";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls the API with the correct URL when given a valid ID", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockAlertBase);

        await handleGetAlertRequest({ id: alertId }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${ALERTS_BASE_URL}/${alertId}`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });
        expect(createSuccessResponse).toHaveBeenCalledWith(expect.stringContaining(alertId));
    });

    it("returns alerts even when the legacy attributions field is present in the API response", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(mockAlertLegacy);
        await handleGetAlertRequest({ id: alertId }, mockToken);

        expect(createSuccessResponse).toHaveBeenCalledWith(expect.stringContaining(mockAlertLegacy.id));
    });

    it("returns error when API returns null", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(null);

        await handleGetAlertRequest({ id: alertId }, mockToken);

        expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("alert"));
    });

    it("delegates to handleGeneralError when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        await handleGetAlertRequest({ id: alertId }, mockToken);

        expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining("alert"));
    });

    it("returns a Zod validation error when id is missing", async () => {
        await handleGetAlertRequest({}, mockToken);

        expect(createErrorResponse).toHaveBeenCalled();
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});

describe("handleListAlertsRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns alerts without attributions in the response", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ rowCount: 1, alerts: [mockAlertBase] });

        await handleListAlertsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${ALERTS_BASE_URL}?maxResults=40`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });
        expect(createSuccessResponse).toHaveBeenCalledWith(expect.stringContaining(mockAlertBase.id));
    });

    it("returns alerts even when the legacy attributions field is present in the API response", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ rowCount: 1, alerts: [mockAlertLegacy] });

        await handleListAlertsRequest({}, mockToken);

        expect(createSuccessResponse).toHaveBeenCalledWith(expect.stringContaining(mockAlertLegacy.id));
    });

    it("appends all provided query params to the URL", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ rowCount: 1, alerts: [mockAlertBase] });

        await handleListAlertsRequest(
            { sortBy: "name", sortOrder: "asc", maxResults: "10", pageToken: "tok123", filter: "owner:[me]" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${ALERTS_BASE_URL}?maxResults=10&sortBy=name&sortOrder=asc&pageToken=tok123&filter=owner%3A%5Bme%5D`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );
    });

    it("returns error when API returns null", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue(null);

        await handleListAlertsRequest({}, mockToken);

        expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("alerts"));
    });

    it("returns empty alerts list when alerts array is empty", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ rowCount: 0, alerts: [] });

        await handleListAlertsRequest({}, mockToken);

        expect(createSuccessResponse).toHaveBeenCalledWith(expect.stringContaining("alerts"));
    });

    it("omits pageToken from the response when the API does not return one", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ rowCount: 1, alerts: [mockAlertBase] });

        await handleListAlertsRequest({}, mockToken);

        const call = (createSuccessResponse as vi.Mock).mock.calls[0][0];
        const parsed = JSON.parse(call);
        expect(parsed).not.toHaveProperty("pageToken");
    });

    it("includes pageToken in the response when the API returns one", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({
            rowCount: 1,
            alerts: [mockAlertBase],
            pageToken: "next-page-token",
        });

        await handleListAlertsRequest({}, mockToken);

        const call = (createSuccessResponse as vi.Mock).mock.calls[0][0];
        const parsed = JSON.parse(call);
        expect(parsed.pageToken).toBe("next-page-token");
    });

    it("delegates to handleGeneralError when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        await handleListAlertsRequest({}, mockToken);

        expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining("alert"));
    });
});

describe("create_alert", () => {
    const mockToken = "fake-token";

    const mockCreateAlertResponse = {
        id: "alert-new-1",
        name: "Test Alert",
        createTime: 1700000000000,
        updateTime: 1700000000000,
        lastAlerted: null,
        recipients: ["user@example.com"],
        config: {
            condition: "value",
            currency: "USD",
            metric: { type: "basic", value: "cost" },
            operator: "gt",
            evaluateForEach: "",
            scopes: [{ id: "project_name", type: "fixed", mode: "is", values: ["my-project"] }],
            timeInterval: "month",
            dataSource: "billing",
            value: 1000,
        },
    };

    const validCreateAlertArgs = {
        name: "Test Alert",
        recipients: ["user@example.com"],
        config: {
            condition: "value",
            currency: "USD" as const,
            metric: { type: "basic", value: "cost" },
            operator: "gt" as const,
            evaluateForEach: "",
            scopes: [{ id: "project_name", type: "fixed" as const, mode: "is" as const, values: ["my-project"] }],
            timeInterval: "month" as const,
            dataSource: "billing",
            value: 1000,
        },
    };

    const minimalCreateAlertArgs = {
        name: "Minimal Alert",
        config: {
            metric: { type: "basic", value: "cost" },
            timeInterval: "month" as const,
            value: 500,
        },
    };

    describe("happy paths", () => {
        it("should create an alert with all fields", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockCreateAlertResponse);

            await handleCreateAlertRequest(validCreateAlertArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(ALERTS_BASE_URL, mockToken, {
                method: "POST",
                body: validCreateAlertArgs,
                customerContext: undefined,
            });
            expect(createSuccessResponse).toHaveBeenCalledWith(expect.stringContaining("alert-new-1"));
        });

        it("should create an alert with only required fields", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockCreateAlertResponse);

            await handleCreateAlertRequest(minimalCreateAlertArgs, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(ALERTS_BASE_URL, mockToken, {
                method: "POST",
                body: minimalCreateAlertArgs,
                customerContext: undefined,
            });
            expect(createSuccessResponse).toHaveBeenCalled();
        });
    });

    describe("customerContext and error handling", () => {
        it("should pass customerContext to makeDoitRequest", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(mockCreateAlertResponse);

            await handleCreateAlertRequest({ ...validCreateAlertArgs, customerContext: "customer-456" }, mockToken);

            expect(makeDoitRequest).toHaveBeenCalledWith(ALERTS_BASE_URL, mockToken, {
                method: "POST",
                body: validCreateAlertArgs,
                customerContext: "customer-456",
            });
        });

        it("should return error response when API returns null", async () => {
            (makeDoitRequest as vi.Mock).mockResolvedValue(null);

            await handleCreateAlertRequest(validCreateAlertArgs, mockToken);

            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("Failed to create alert"));
        });

        it("should return error response when makeDoitRequest throws", async () => {
            (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

            await handleCreateAlertRequest(validCreateAlertArgs, mockToken);

            expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining("alert"));
        });
    });

    describe("validation errors", () => {
        it("should reject when name is missing", async () => {
            const { name: _, ...args } = validCreateAlertArgs;
            await handleCreateAlertRequest(args, mockToken);

            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("name"));
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject empty string name", async () => {
            await handleCreateAlertRequest({ ...validCreateAlertArgs, name: "" }, mockToken);

            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("name"));
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject when config is missing", async () => {
            const { config: _, ...args } = validCreateAlertArgs;
            await handleCreateAlertRequest(args, mockToken);

            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("config"));
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject when config.metric is missing", async () => {
            const { metric: _, ...configWithoutMetric } = validCreateAlertArgs.config;
            await handleCreateAlertRequest({ ...validCreateAlertArgs, config: configWithoutMetric }, mockToken);

            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("metric"));
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject when config.timeInterval is missing", async () => {
            const { timeInterval: _, ...configWithoutInterval } = validCreateAlertArgs.config;
            await handleCreateAlertRequest({ ...validCreateAlertArgs, config: configWithoutInterval }, mockToken);

            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("timeInterval"));
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject when config.value is missing", async () => {
            const { value: _, ...configWithoutValue } = validCreateAlertArgs.config;
            await handleCreateAlertRequest({ ...validCreateAlertArgs, config: configWithoutValue }, mockToken);

            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("value"));
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid operator enum", async () => {
            await handleCreateAlertRequest(
                { ...validCreateAlertArgs, config: { ...validCreateAlertArgs.config, operator: "eq" } },
                mockToken
            );

            expect(createErrorResponse).toHaveBeenCalled();
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid timeInterval enum", async () => {
            await handleCreateAlertRequest(
                { ...validCreateAlertArgs, config: { ...validCreateAlertArgs.config, timeInterval: "minute" } },
                mockToken
            );

            expect(createErrorResponse).toHaveBeenCalled();
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid currency enum", async () => {
            await handleCreateAlertRequest(
                { ...validCreateAlertArgs, config: { ...validCreateAlertArgs.config, currency: "FAKE" } },
                mockToken
            );

            expect(createErrorResponse).toHaveBeenCalled();
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid scope type enum", async () => {
            await handleCreateAlertRequest(
                {
                    ...validCreateAlertArgs,
                    config: {
                        ...validCreateAlertArgs.config,
                        scopes: [{ id: "test", type: "invalid_type", mode: "is" }],
                    },
                },
                mockToken
            );

            expect(createErrorResponse).toHaveBeenCalled();
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid scope mode enum", async () => {
            await handleCreateAlertRequest(
                {
                    ...validCreateAlertArgs,
                    config: {
                        ...validCreateAlertArgs.config,
                        scopes: [{ id: "test", type: "fixed", mode: "invalid_mode" }],
                    },
                },
                mockToken
            );

            expect(createErrorResponse).toHaveBeenCalled();
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject invalid email in recipients", async () => {
            await handleCreateAlertRequest({ ...validCreateAlertArgs, recipients: ["not-an-email"] }, mockToken);

            expect(createErrorResponse).toHaveBeenCalledWith(expect.stringContaining("email"));
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject empty metric type", async () => {
            await handleCreateAlertRequest(
                {
                    ...validCreateAlertArgs,
                    config: { ...validCreateAlertArgs.config, metric: { type: "", value: "cost" } },
                },
                mockToken
            );

            expect(createErrorResponse).toHaveBeenCalled();
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });

        it("should reject empty metric value", async () => {
            await handleCreateAlertRequest(
                {
                    ...validCreateAlertArgs,
                    config: { ...validCreateAlertArgs.config, metric: { type: "basic", value: "" } },
                },
                mockToken
            );

            expect(createErrorResponse).toHaveBeenCalled();
            expect(makeDoitRequest).not.toHaveBeenCalled();
        });
    });
});
