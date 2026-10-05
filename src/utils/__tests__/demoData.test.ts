import { describe, expect, it } from "vitest";
import { getDemoResponse } from "../demoData.js";

describe("demo list filters", () => {
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
