import { afterEach, describe, expect, it, vi } from "vitest";
import { handleReportsRequest } from "../../tools/reports.js";
import { DEMO_TOKEN, getDemoResponse } from "../demoData.js";

describe("demo list filters", () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
        ["cLoUd CoSt", ["report-001"]],
        ["COST", ["report-001", "report-003"]],
        ["no matching demo report", []],
        ["", ["report-001", "report-002", "report-003"]],
    ])("applies report nameContains %j to the demo rows and count", (name, ids) => {
        const params = new URLSearchParams({ nameContains: name });
        const response = getDemoResponse(`https://api.doit.com/analytics/v1/reports?${params}`, "GET") as {
            rowCount: number;
            reports: { id: string }[];
        };
        expect(response.reports.map((report) => report.id)).toEqual(ids);
        expect(response.rowCount).toBe(ids.length);
    });

    it("filters reports through the real demo-token handler without HTTP or changing the fixtures", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected HTTP request"));
        const filtered = await handleReportsRequest({ name: "cLoUd CoSt" }, DEMO_TOKEN);
        expect(filtered).not.toHaveProperty("isError", true);
        expect(JSON.parse(filtered.content[0].text)).toMatchObject({
            rowCount: 1,
            reports: [{ id: "report-001", reportName: "Monthly Cloud Cost by Service" }],
        });

        const unmatched = await handleReportsRequest({ name: "no matching demo report" }, DEMO_TOKEN);
        expect(unmatched).toMatchObject({ isError: true, content: [{ text: "No reports found" }] });

        const unfiltered = await handleReportsRequest({}, DEMO_TOKEN);
        expect(JSON.parse(unfiltered.content[0].text).rowCount).toBe(3);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("applies budget nameContains before returning the demo page", () => {
        const response = getDemoResponse("https://api.doit.com/analytics/v1/budgets?nameContains=gcp", "GET") as {
            rowCount: number;
            budgets: { budgetName: string }[];
        };
        expect(response.rowCount).toBe(1);
        expect(response.budgets[0].budgetName).toBe("GCP Production Budget");
    });

    it("applies platform filters from the incident filter expression", () => {
        const response = getDemoResponse(
            "https://api.doit.com/core/v1/cloudincidents?filter=platform%3Agoogle-cloud",
            "GET"
        ) as { rowCount: number; incidents: { platform: string }[] };
        expect(response.rowCount).toBe(1);
        expect(response.incidents[0].platform).toBe("google-cloud");
    });
});
