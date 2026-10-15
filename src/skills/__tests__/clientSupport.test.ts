import { describe, expect, it } from "vitest";
import { supportsSkills } from "../clientSupport.js";

describe("Skills client support", () => {
    it.each([
        ["2026-07-28", { extensions: { "io.modelcontextprotocol/skills": {} } }, true],
        ["2025-11-25", { extensions: { "io.modelcontextprotocol/skills": {} } }, false],
        [undefined, { extensions: { "io.modelcontextprotocol/skills": {} } }, false],
        ["2026-07-28", {}, false],
        ["2026-07-28", undefined, false],
        ["2026-07-28", { extensions: { "io.modelcontextprotocol/skills": null } }, false],
        ["2026-07-28", { extensions: { "io.modelcontextprotocol/skills": true } }, false],
        ["2026-07-28", { extensions: { "io.modelcontextprotocol/skills": [] } }, false],
    ])("checks protocol %s with capabilities %j", (version, capabilities, expected) => {
        expect(supportsSkills(version, capabilities)).toBe(expected);
    });
});
