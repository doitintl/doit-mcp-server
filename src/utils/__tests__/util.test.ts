import { describe, expect, it } from "vitest";
import { DebugLevel, debugLog } from "../util.js";

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
