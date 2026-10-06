import { expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import { handleCloudOverviewRequest } from "../overview.js";

vi.mock("../../utils/util.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../utils/util.js")>()),
    makeDoitRequest: vi.fn(),
}));

it("returns successful sections, caps lists at five, and represents partial failures as empty sections", async () => {
    vi.mocked(makeDoitRequest)
        .mockResolvedValueOnce({ result: { schema: [{ name: "cost" }], rows: [[10]] } })
        .mockRejectedValueOnce(new Error("unavailable"))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ anomalies: Array.from({ length: 8 }, (_, id) => ({ id })) })
        .mockResolvedValueOnce({ incidents: Array.from({ length: 8 }, (_, id) => ({ id })) });
    const result = await handleCloudOverviewRequest({ customerContext: "switched" }, "token");
    const data = JSON.parse(result.content[0].text);
    expect(result.isError).not.toBe(true);
    expect(data.costByCloud.rows).toEqual([[10]]);
    expect(data.topServices).toEqual({ columns: [], rows: [] });
    expect(data.topProjects).toEqual({ columns: [], rows: [] });
    expect(data.anomalies).toHaveLength(5);
    expect(data.incidents).toHaveLength(5);
    for (const [, , options] of vi.mocked(makeDoitRequest).mock.calls) {
        expect(options?.customerContext).toBe("switched");
    }
    for (const [, , options] of vi.mocked(makeDoitRequest).mock.calls.slice(0, 3)) {
        expect(options?.body).toMatchObject({
            config: { timeRange: { mode: "last", amount: 30, unit: "day", includeCurrent: true } },
        });
    }
    for (const [, , options] of vi.mocked(makeDoitRequest).mock.calls.slice(1, 3)) {
        expect(options?.body).toMatchObject({ config: { group: [{ id: "cloud_provider" }, { limit: { value: 5 } }] } });
    }
});
