import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeConsoleRequest } from "../../utils/util.js";
import { handleSearchCustomersRequest, SEARCH_CUSTOMERS_PATH } from "../searchCustomers.js";

vi.mock("../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, makeConsoleRequest: vi.fn() };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

const mockToken = "test-token";

describe("handleSearchCustomersRequest", () => {
    it("posts assembled filters to the console search endpoint and returns JSON", async () => {
        const apiResponse = {
            customers: [{ id: "c1", name: "Acme", primaryDomain: "acme.com" }],
            nextPageToken: "tok",
            truncated: false,
        };
        (makeConsoleRequest as ReturnType<typeof vi.fn>).mockResolvedValue(apiResponse);

        const response = await handleSearchCustomersRequest(
            {
                classification: ["strategic"],
                assetPlatforms: ["amazon-web-services"],
                hasFlexsave: true,
                minMonthlyCloudSpend: 1000,
                invoicedFromMonth: "2026-01",
                invoicedToMonth: "2026-03",
                invoicedMinTotal: 500,
                contractsActive: true,
                pageSize: 25,
            },
            mockToken
        );

        expect(makeConsoleRequest).toHaveBeenCalledWith(SEARCH_CUSTOMERS_PATH, mockToken, {
            method: "POST",
            body: {
                filters: {
                    classification: ["strategic"],
                    assetPlatforms: ["amazon-web-services"],
                    hasFlexsave: true,
                    spend: {
                        minMonthlyCloudSpend: 1000,
                        invoiced: {
                            fromMonth: "2026-01",
                            toMonth: "2026-03",
                            minTotal: 500,
                        },
                    },
                    contracts: { active: true },
                },
                pageSize: 25,
            },
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.customers).toHaveLength(1);
        expect(parsed.nextPageToken).toBe("tok");
    });

    it("omits empty filters and spend when nothing is set", async () => {
        (makeConsoleRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
            customers: [],
            nextPageToken: "",
            truncated: false,
        });

        await handleSearchCustomersRequest({}, mockToken);

        expect(makeConsoleRequest).toHaveBeenCalledWith(SEARCH_CUSTOMERS_PATH, mockToken, {
            method: "POST",
            body: { filters: {} },
        });
    });

    it("surfaces upstream errors (e.g. 403 for non-doers)", async () => {
        (makeConsoleRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("HTTP 403: doers only"));

        const response = await handleSearchCustomersRequest({ classification: ["business"] }, mockToken);

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("403");
    });

    it("returns a validation error for an invalid classification", async () => {
        const response = await handleSearchCustomersRequest({ classification: ["not-a-class"] }, mockToken);

        expect(response.isError).toBe(true);
        expect(makeConsoleRequest).not.toHaveBeenCalled();
    });
});
