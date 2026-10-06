import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleCompareSpendRequest, handleCostBreakdownRequest, handleCostTrendRequest } from "../queryHelpers.js";
import { ReportConfigSchema } from "../reports.js";

vi.mock("../../utils/util.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../utils/util.js")>()),
    makeDoitRequest: vi.fn(),
}));

const period2 = { from: "2026-08-01T00:00:00Z", to: "2026-08-03T00:00:00Z" };
const query = { result: { schema: [{ name: "year", type: "INTEGER" }], rows: [[2026]] } };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(makeDoitRequest).mockResolvedValue(query);
});

describe("compare_spend", () => {
    it("labels offset timestamps using the UTC calendar days queried by the API", async () => {
        const offsetRange = { from: "2026-09-01T01:00:00+05:00", to: "2026-09-02T01:00:00+05:00" };
        const result = await handleCompareSpendRequest({ period2: offsetRange }, "token");
        expect(result.isError).not.toBe(true);
        expect(JSON.parse(result.content[0].text).period2.label).toBe("2026-08-31 to 2026-09-01");
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            "token",
            expect.objectContaining({
                body: expect.objectContaining({ config: expect.objectContaining({ customTimeRange: offsetRange }) }),
            })
        );
    });
    it.each([
        ["service", "service_description"],
        ["project", "project_id"],
        ["cloud", "cloud_provider"],
    ])("compares valid ranges grouped by %s with independent results and context", async (groupBy, id) => {
        const second = { result: { schema: query.result.schema, rows: [[2025]] } };
        vi.mocked(makeDoitRequest).mockResolvedValueOnce(query).mockResolvedValueOnce(second);
        const result = await handleCompareSpendRequest(
            { period1Months: 2, period2, cloud: "aws", groupBy, customerContext: "switched" },
            "token"
        );
        expect(result.isError).not.toBe(true);
        expect(makeDoitRequest).toHaveBeenCalledTimes(2);
        const configs = vi.mocked(makeDoitRequest).mock.calls.map(([, token, options]) => {
            expect(token).toBe("token");
            expect(options).toMatchObject({ customerContext: "switched", method: "POST" });
            const config = (options?.body as { config: unknown } | undefined)?.config;
            return ReportConfigSchema.parse(config);
        });
        expect(configs[0].timeRange).toEqual({ mode: "last", unit: "month", amount: 2, includeCurrent: true });
        expect(configs[1].timeRange).toEqual({ mode: "custom" });
        expect(configs[1].customTimeRange).toEqual(period2);
        for (const config of configs) {
            expect(config.timeInterval).toBe("month");
            expect(config.group).toEqual([
                { id, type: "fixed", limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 } },
            ]);
            expect(config.filters?.[0].values).toEqual(["amazon-web-services"]);
        }
        const data = JSON.parse(result.content[0].text);
        expect(Object.keys(data)).toEqual(["period1", "period2"]);
        expect(data.period1.rows).toEqual(query.result.rows);
        expect(data.period2.rows).toEqual(second.result.rows);
        expect(data.period1.label).toContain("current month-to-date");
    });
    it.each([null, { error: "failed" }, { ...query, error: "failed" }])(
        "returns an error if either period fails: %j",
        async (failure) => {
            vi.mocked(makeDoitRequest).mockResolvedValueOnce(query).mockResolvedValueOnce(failure);
            expect((await handleCompareSpendRequest({ period2 }, "token")).isError).toBe(true);
        }
    );
    it("rejects reversed dates before launching either query", async () => {
        expect(
            (await handleCompareSpendRequest({ period2: { from: period2.to, to: period2.from } }, "token")).isError
        ).toBe(true);
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});

describe.each([
    { name: "cost_breakdown", handler: handleCostBreakdownRequest, args: { groupBy: "service" }, months: 1, topN: 10 },
    { name: "cost_trend", handler: handleCostTrendRequest, args: { groupBy: "service" }, months: 6, topN: 5 },
])("$name ranges", ({ handler, args, months, topN }) => {
    it("includes the current month in the default count and forwards context", async () => {
        await handler({ ...args, customerContext: "switched" }, "token");
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            "token",
            expect.objectContaining({
                customerContext: "switched",
                body: {
                    config: expect.objectContaining({
                        timeInterval: "month",
                        timeRange: { mode: "last", unit: "month", amount: months, includeCurrent: true },
                        group: [expect.objectContaining({ limit: expect.objectContaining({ value: topN }) })],
                    }),
                },
            })
        );
    });
    it("enforces the convenience topN cap", async () => {
        expect((await handler({ ...args, topN: 26 }, "token")).isError).toBe(true);
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });
});
