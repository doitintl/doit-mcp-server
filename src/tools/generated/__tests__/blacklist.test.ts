import { describe, expect, it } from "vitest";
import { BLACKLISTED_ENDPOINTS, isBlacklisted } from "../blacklist.js";

describe("isBlacklisted", () => {
    it("returns true for an exact method+path match", () => {
        expect(isBlacklisted("get", "/analytics/v1/alerts")).toBe(true);
    });

    it("is case-insensitive on method", () => {
        expect(isBlacklisted("GET", "/analytics/v1/alerts")).toBe(true);
    });

    it("returns false for a path not in the list", () => {
        expect(isBlacklisted("get", "/analytics/v1/alerts/{id}/nope")).toBe(false);
    });

    it("returns false when the method differs but the path matches", () => {
        expect(isBlacklisted("delete", "/analytics/v1/alerts/{id}")).toBe(false);
    });

    it("has no duplicate entries", () => {
        const keys = BLACKLISTED_ENDPOINTS.map((entry) => `${entry.method} ${entry.path}`);
        expect(new Set(keys).size).toBe(keys.length);
    });
});
