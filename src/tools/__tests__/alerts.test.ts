import { beforeEach, describe, expect, it, vi } from "vitest";
import { createErrorResponse, createSuccessResponse, handleGeneralError, makeDoitRequest } from "../../utils/util.js";
import { ALERTS_BASE_URL, handleListAlertsRequest } from "../alerts.js";

vi.mock("../../utils/util.js", () => ({
    createErrorResponse: vi.fn((msg) => ({ content: [{ type: "text", text: msg }] })),
    createSuccessResponse: vi.fn((text) => ({ content: [{ type: "text", text }] })),
    formatZodError: vi.fn((error) => `Formatted Zod Error: ${error.message}`),
    handleGeneralError: vi.fn((_error, context) => ({
        content: [{ type: "text", text: `General Error: ${context}` }],
    })),
    makeDoitRequest: vi.fn(),
    DOIT_API_BASE: "https://api.doit.com",
}));

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

describe("handleListAlertsRequest", () => {
    const mockToken = "fake-token";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns alerts without attributions in the response", async () => {
        (makeDoitRequest as vi.Mock).mockResolvedValue({ rowCount: 1, alerts: [mockAlertBase] });

        await handleListAlertsRequest({}, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(ALERTS_BASE_URL, mockToken, { method: "GET" });
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
            `${ALERTS_BASE_URL}?sortBy=name&sortOrder=asc&maxResults=10&pageToken=tok123&filter=owner%3A%5Bme%5D`,
            mockToken,
            { method: "GET" }
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

    it("delegates to handleGeneralError when makeDoitRequest throws", async () => {
        (makeDoitRequest as vi.Mock).mockRejectedValue(new Error("Network error"));

        await handleListAlertsRequest({}, mockToken);

        expect(handleGeneralError).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining("alerts"));
    });
});
