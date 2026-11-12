import { describe, expect, it, vi } from "vitest";
import { isChannelOnly, parseChannelConfig } from "../config.js";

describe("parseChannelConfig", () => {
    it("is off when DOIT_CHANNEL_EVENTS is unset or blank", () => {
        expect(parseChannelConfig({})).toBeUndefined();
        expect(parseChannelConfig({ DOIT_CHANNEL_EVENTS: " , " })).toBeUndefined();
    });

    it("parses known kinds case-insensitively, in canonical order, with the default interval", () => {
        expect(parseChannelConfig({ DOIT_CHANNEL_EVENTS: " Incidents, anomalies " })).toEqual({
            events: ["anomalies", "incidents"],
            pollIntervalMs: 300_000,
        });
    });

    it("warns about and ignores unknown kinds", () => {
        const warn = vi.fn();

        expect(parseChannelConfig({ DOIT_CHANNEL_EVENTS: "anomalies,budgets" }, warn)?.events).toEqual(["anomalies"]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("budgets"));
    });

    it("stays off when only unknown kinds are named", () => {
        expect(parseChannelConfig({ DOIT_CHANNEL_EVENTS: "budgets" }, vi.fn())).toBeUndefined();
    });

    it("honours DOIT_CHANNEL_POLL_SECONDS, enforcing the 60s floor", () => {
        const warn = vi.fn();
        const env = (seconds: string) => ({ DOIT_CHANNEL_EVENTS: "anomalies", DOIT_CHANNEL_POLL_SECONDS: seconds });

        expect(parseChannelConfig(env("900"), warn)?.pollIntervalMs).toBe(900_000);
        expect(warn).not.toHaveBeenCalled();
        expect(parseChannelConfig(env("5"), warn)?.pollIntervalMs).toBe(60_000);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("minimum"));
    });

    it("falls back to the default interval for an unparseable value", () => {
        const warn = vi.fn();

        expect(
            parseChannelConfig({ DOIT_CHANNEL_EVENTS: "anomalies", DOIT_CHANNEL_POLL_SECONDS: "soon" }, warn)
                ?.pollIntervalMs
        ).toBe(300_000);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("soon"));
    });

    it("reads DOIT_CHANNEL_ONLY as a boolean flag", () => {
        for (const value of ["1", "true", "TRUE", " yes ", "on"]) {
            expect(isChannelOnly({ DOIT_CHANNEL_ONLY: value })).toBe(true);
        }
        for (const value of [undefined, "", "0", "false", "no"]) {
            expect(isChannelOnly({ DOIT_CHANNEL_ONLY: value })).toBe(false);
        }
    });
});
