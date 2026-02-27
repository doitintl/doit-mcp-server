import { describe, expect, it } from "vitest";
import { DebugLevel, debugLog, toSnakeCase } from "../util.js";

describe("DebugLevel enum", () => {
    it("should have correct debug level values", () => {
        expect(DebugLevel.OFF).toBe(0);
        expect(DebugLevel.INFO).toBe(1);
        expect(DebugLevel.VERBOSE).toBe(2);
        expect(DebugLevel.TRACE).toBe(3);
    });
});

describe("debugLog function", () => {
    it("should accept message with default INFO level", () => {
        expect(() => debugLog("test message")).not.toThrow();
    });

    it("should accept message with explicit level", () => {
        expect(() => debugLog("test message", DebugLevel.VERBOSE)).not.toThrow();
    });

    it("should accept message with level and optional arguments", () => {
        expect(() => debugLog("test message", DebugLevel.INFO, "arg1", "arg2")).not.toThrow();
    });

    it("should accept non-string messages", () => {
        const obj = { key: "value", nested: { data: 123 } };
        expect(() => debugLog(obj)).not.toThrow();
        expect(() => debugLog(obj, DebugLevel.VERBOSE)).not.toThrow();
    });

    it("should accept all debug levels", () => {
        expect(() => debugLog("test", DebugLevel.OFF)).not.toThrow();
        expect(() => debugLog("test", DebugLevel.INFO)).not.toThrow();
        expect(() => debugLog("test", DebugLevel.VERBOSE)).not.toThrow();
        expect(() => debugLog("test", DebugLevel.TRACE)).not.toThrow();
    });

    it("should accept multiple optional arguments", () => {
        expect(() => debugLog("test", DebugLevel.INFO, "a", "b", "c", { d: 1 })).not.toThrow();
    });
});

describe("toSnakeCase", () => {
    it("converts space-separated words to snake_case", () => {
        expect(toSnakeCase("Filter Fields Reference")).toBe("filter_fields_reference");
    });

    it("converts a single word to lowercase", () => {
        expect(toSnakeCase("Create Ticket")).toBe("create_ticket");
    });

    it("handles mixed case with multiple words", () => {
        expect(toSnakeCase("Generate Report Document")).toBe("generate_report_document");
    });

    it("strips non-alphanumeric characters other than underscores", () => {
        expect(toSnakeCase("Trigger CloudFlow flow")).toBe("trigger_cloudflow_flow");
    });

    it("collapses multiple spaces into a single underscore", () => {
        expect(toSnakeCase("hello   world")).toBe("hello_world");
    });

    it("returns an already snake_case string unchanged", () => {
        expect(toSnakeCase("allow_artifacts")).toBe("allow_artifacts");
    });

    it("collapses consecutive underscores from removed special characters", () => {
        expect(toSnakeCase("Hello - World")).toBe("hello_world");
    });

    it("converts all legacy prompt names to valid snake_case identifiers", () => {
        const legacyNames = [
            "Filter Fields Reference",
            "Generate Report Document",
            "Query Best Practice",
            "Document Output Reminder",
            "Generate Report Command",
            "Generate Anomalies Document",
            "Dimension Usage Guidance",
            "Create Ticket",
            "Generate Invoice Details Document",
            "Allocations Usage Guidance",
            "Allow Artifacts",
            "Trigger CloudFlow flow",
        ];
        const snakeCasePattern = /^[a-z][a-z0-9_]*$/;
        for (const name of legacyNames) {
            expect(toSnakeCase(name)).toMatch(snakeCasePattern);
        }
    });
});
