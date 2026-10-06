import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    CreateReportArgumentsSchema,
    createReportTool,
    handleCreateReportRequest,
    handleGetReportResultsRequest,
    handleRunQueryRequest,
    handleUpdateReportRequest,
    ReportConfigSchema,
    RunQueryArgumentsSchema,
    runQueryTool,
    UpdateReportArgumentsSchema,
} from "../reports.js";

vi.mock("../../utils/util.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../utils/util.js")>()),
    makeDoitRequest: vi.fn(),
}));

const dates = { from: "2026-08-01T00:00:00Z", to: "2026-08-02T23:59:59Z" };
const custom = { timeRange: { mode: "custom" }, customTimeRange: dates };
const tools = [
    { name: "run_query", schema: RunQueryArgumentsSchema, handler: handleRunQueryRequest, args: {}, method: "POST" },
    {
        name: "create_report",
        schema: CreateReportArgumentsSchema,
        handler: handleCreateReportRequest,
        args: { name: "Test" },
        method: "POST",
    },
    {
        name: "update_report",
        schema: UpdateReportArgumentsSchema,
        handler: handleUpdateReportRequest,
        args: { id: "test" },
        method: "PATCH",
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(makeDoitRequest).mockResolvedValue({ id: "test", result: { schema: [], rows: [] } });
});

describe.each(tools)("$name report contract", ({ schema, handler, args, method }) => {
    it("sends sibling custom dates and forwards switched-customer context without inventing a unit", async () => {
        const config = { ...custom, filters: [{ id: "cloud_provider", type: "fixed", values: ["google-cloud"] }] };
        const result = await handler({ ...args, config, customerContext: "switched-customer" }, "test-token");
        expect(result.isError).not.toBe(true);
        expect(makeDoitRequest).toHaveBeenCalledExactlyOnceWith(
            expect.any(String),
            "test-token",
            expect.objectContaining({
                method,
                customerContext: "switched-customer",
                body: { ...("name" in args ? { name: args.name } : {}), config },
            })
        );
    });

    it.each([
        { timeRange: { mode: "custom", customTimeRange: dates } },
        { ...custom, timeRange: { mode: "custom", customTimeRange: dates } },
        { ...custom, timeRange: { mode: "custom", unit: "month" } },
        { customTimeRange: dates, timeRange: { mode: "last", amount: 1, unit: "month" } },
        { timeRange: { mode: "current" } },
        { timeRange: { mode: "last", unit: "month" } },
        { ...custom, customTimeRange: { ...dates, from: "2026-08-03T00:00:00Z" } },
        { ...custom, customTimeRange: { ...dates, to: "2026-08-02" } },
    ])("rejects invalid time configuration before making a request: %j", async (config) => {
        expect(schema.safeParse({ ...args, config }).success).toBe(false);
        expect((await handler({ ...args, config }, "test-token")).isError).toBe(true);
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it.each([
        { timeRange: { mode: "current", unit: "month" } },
        { timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: false } },
        { ...custom, customTimeRange: { from: "2026-08-01T01:00:00+01:00", to: "2026-08-01T00:00:00Z" } },
        {},
    ])("accepts valid time configuration: %j", (config) => {
        expect(schema.safeParse({ ...args, config }).success).toBe(true);
    });

    it.each(["sankey_chart", "column_and_line_chart", "trend_board", "cumulative_comparison"])(
        "accepts API layout %s",
        (layout) => {
            expect(schema.safeParse({ ...args, config: { layout } }).success).toBe(true);
        }
    );
    it.each(["csv_export", "sheets_export"])("rejects unsupported export layout %s", (layout) => {
        expect(schema.safeParse({ ...args, config: { layout } }).success).toBe(false);
    });
});

describe("custom date patch semantics", () => {
    it.each([{ timeRange: { mode: "custom" } }, { customTimeRange: dates }])(
        "requires both custom fields for new queries/reports but preserves omitted fields on update: %j",
        async (config) => {
            expect(RunQueryArgumentsSchema.safeParse({ config }).success).toBe(false);
            expect(CreateReportArgumentsSchema.safeParse({ name: "Test", config }).success).toBe(false);
            expect(UpdateReportArgumentsSchema.parse({ id: "test", config }).config).toEqual(config);
            vi.mocked(makeDoitRequest).mockResolvedValueOnce({ config: custom });
            await handleUpdateReportRequest({ id: "test", config }, "token");
            expect(makeDoitRequest).toHaveBeenCalledWith(
                expect.any(String),
                "token",
                expect.objectContaining({ body: { config } })
            );
        }
    );

    it.each([{}, { timeRange: { mode: "last", amount: 1, unit: "month" } }, { customTimeRange: { from: "invalid" } }])(
        "rejects custom mode without valid saved dates before PATCH: %j",
        async (config) => {
            vi.mocked(makeDoitRequest).mockResolvedValueOnce({ config });
            const result = await handleUpdateReportRequest(
                { id: "test", config: { timeRange: { mode: "custom" } }, customerContext: "switched" },
                "token"
            );
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("config.customTimeRange is required");
            expect(makeDoitRequest).toHaveBeenCalledExactlyOnceWith(
                expect.stringContaining("/reports/test/config"),
                "token",
                { method: "GET", customerContext: "switched" }
            );
        }
    );

    it("rejects a date-only patch of a relative report without modifying it", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValueOnce({ config: { timeRange: { mode: "last" } } });
        const result = await handleUpdateReportRequest({ id: "test", config: { customTimeRange: dates } }, "token");
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("saved timeRange.mode");
        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
    });

    it.each([null, {}])("does not PATCH when saved config is unavailable: %j", async (saved) => {
        vi.mocked(makeDoitRequest).mockResolvedValueOnce(saved);
        expect(
            (await handleUpdateReportRequest({ id: "test", config: { timeRange: { mode: "custom" } } }, "token"))
                .isError
        ).toBe(true);
        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
    });

    it("propagates a failed preflight without attempting PATCH", async () => {
        vi.mocked(makeDoitRequest).mockRejectedValueOnce(new Error("saved config unavailable"));
        expect(
            (await handleUpdateReportRequest({ id: "test", config: { timeRange: { mode: "custom" } } }, "token"))
                .isError
        ).toBe(true);
        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
    });
});

describe("report examples and updates", () => {
    it("advertises a parseable previous-full-month example with the API's default filter mode", () => {
        const example = JSON.parse(runQueryTool.description.split("Example — top AWS services last month:")[1]);
        const { config } = RunQueryArgumentsSchema.parse(example);
        expect(config.timeRange).toEqual({ mode: "last", amount: 1, unit: "month", includeCurrent: false });
        expect(config.filters?.[0].mode).toBeUndefined();
    });
    it("does not apply the convenience tools' 25-group cap to run_query", () => {
        expect(
            ReportConfigSchema.safeParse({
                group: [
                    {
                        id: "service_description",
                        type: "fixed",
                        limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 30 },
                    },
                ],
            }).success
        ).toBe(true);
    });
    it("preserves empty replacement arrays and leaves omitted config fields to the API", async () => {
        const config = { filters: [], group: [], dimensions: [], splits: [], metrics: [], timeInterval: "month" };
        await handleUpdateReportRequest({ id: "test", config, labels: [] }, "test-token");
        expect(makeDoitRequest).toHaveBeenCalledWith(
            expect.any(String),
            "test-token",
            expect.objectContaining({ body: { config, labels: [] } })
        );
        await handleUpdateReportRequest({ id: "test", name: "Renamed" }, "test-token");
        expect(makeDoitRequest).toHaveBeenLastCalledWith(
            expect.any(String),
            "test-token",
            expect.objectContaining({ body: { name: "Renamed" } })
        );
    });
    it("provides the directory's write hint for report creation", () => {
        expect(createReportTool.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    });
});

describe("saved report lookup", () => {
    it("uses id in preference to name without listing reports", async () => {
        await handleGetReportResultsRequest({ id: "chosen", name: "ignored", customerContext: "switched" }, "token");
        expect(makeDoitRequest).toHaveBeenCalledExactlyOnceWith(
            expect.stringContaining("/reports/chosen"),
            "token",
            expect.objectContaining({ customerContext: "switched" })
        );
    });
    it("bounds substring lookup to one page of 200 and reports ambiguity", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue({
            reports: [
                { id: "one", reportName: "Cloud costs" },
                { id: "two", reportName: "CLOUD trend" },
            ],
            pageToken: "more",
        });
        const result = await handleGetReportResultsRequest({ name: "cloud", customerContext: "switched" }, "token");
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Cloud costs");
        expect(result.content[0].text).toContain("CLOUD trend");
        expect(makeDoitRequest).toHaveBeenCalledExactlyOnceWith(
            expect.stringContaining("?maxResults=200"),
            "token",
            expect.objectContaining({ customerContext: "switched" })
        );
    });
    it("does not search subsequent pages when the first page has no match", async () => {
        vi.mocked(makeDoitRequest).mockResolvedValue({ reports: [], pageToken: "more" });
        const result = await handleGetReportResultsRequest({ name: "missing" }, "token");
        expect(result.isError).toBe(true);
        expect(makeDoitRequest).toHaveBeenCalledTimes(1);
    });
});
