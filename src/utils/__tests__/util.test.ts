import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DebugLevel,
  debugLog,
  formatEnumValues,
  getTrackingContext,
  runWithTracking,
  makeDoitRequest,
  toSnakeCase,
} from "../util.js";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
    expect(() =>
      debugLog("test message", DebugLevel.INFO, "arg1", "arg2"),
    ).not.toThrow();
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
    expect(() =>
      debugLog("test", DebugLevel.INFO, "a", "b", "c", { d: 1 }),
    ).not.toThrow();
  });
});

describe("toSnakeCase", () => {
  it("converts space-separated words to snake_case", () => {
    expect(toSnakeCase("Filter Fields Reference")).toBe(
      "filter_fields_reference",
    );
  });

  it("converts a single word to lowercase", () => {
    expect(toSnakeCase("Create Ticket")).toBe("create_ticket");
  });

  it("handles mixed case with multiple words", () => {
    expect(toSnakeCase("Generate Report Document")).toBe(
      "generate_report_document",
    );
  });

  it("treats non-alphanumeric characters as word separators", () => {
    expect(toSnakeCase("Trigger CloudFlow flow")).toBe(
      "trigger_cloudflow_flow",
    );
  });

  it("converts hyphens to underscores", () => {
    expect(toSnakeCase("hello-world")).toBe("hello_world");
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

describe("formatEnumValues", () => {
  const SORT_ORDER_VALUES = ["asc", "desc"] as const;
  const SORT_BY_VALUES = [
    "id",
    "name",
    "type",
    "createTime",
    "updateTime",
  ] as const;
  const COLOR_VALUES = ["blue", "teal", "mint"] as const;

  it("joins enum values with default separator", () => {
    expect(formatEnumValues(SORT_ORDER_VALUES)).toBe("asc, desc");
  });

  it("joins enum values with custom separator", () => {
    expect(formatEnumValues(SORT_BY_VALUES, " | ")).toBe(
      "id | name | type | createTime | updateTime",
    );
  });

  it("joins enum values with dash separator", () => {
    expect(formatEnumValues(COLOR_VALUES, " - ")).toBe("blue - teal - mint");
  });

  it("returns single enum value as-is", () => {
    const SINGLE = ["only"] as const;
    expect(formatEnumValues(SINGLE)).toBe("only");
  });

  it("returns empty string for empty array", () => {
    expect(formatEnumValues([])).toBe("");
  });

  it("works with plain arrays", () => {
    expect(formatEnumValues(["a", "b", "c"])).toBe("a, b, c");
  });
});

describe("runWithTracking / AsyncLocalStorage propagation", () => {
  it("getTrackingContext() returns undefined outside a runWithTracking call", () => {
    expect(getTrackingContext()).toBeUndefined();
  });

  it("getTrackingContext() returns the context set by runWithTracking", () => {
    const ctx = {
      mcpTool: "list_reports",
      mcpClient: "cursor-vscode",
      mcpClientVersion: "1.0.0",
    };
    runWithTracking(ctx, () => {
      expect(getTrackingContext()).toEqual(ctx);
    });
  });

  it("context is visible inside nested async calls", async () => {
    const ctx = { mcpTool: "run_query", mcpClient: "claude-desktop" };
    await runWithTracking(ctx, async () => {
      await Promise.resolve(); // simulate await boundary
      expect(getTrackingContext()).toEqual(ctx);
    });
  });

  it("context propagates through Promise.all (parallel fan-out)", async () => {
    const ctx = { mcpTool: "get_cloud_overview" };
    await runWithTracking(ctx, async () => {
      const [a, b] = await Promise.all([
        Promise.resolve(getTrackingContext()),
        Promise.resolve(getTrackingContext()),
      ]);
      expect(a).toEqual(ctx);
      expect(b).toEqual(ctx);
    });
  });

  it("outer context is not polluted by an inner runWithTracking call", async () => {
    const outer = { mcpTool: "list_budgets" };
    const inner = { mcpTool: "get_budget" };

    await runWithTracking(outer, async () => {
      // Nested call creates its own scope — must not affect the outer scope after it returns
      await runWithTracking(inner, async () => {
        expect(getTrackingContext()).toEqual(inner);
      });
      expect(getTrackingContext()).toEqual(outer);
    });
  });

  it("context is undefined outside runWithTracking after it completes", async () => {
    const ctx = { mcpTool: "list_tickets" };
    await runWithTracking(ctx, async () => {
      expect(getTrackingContext()).toEqual(ctx);
    });
    // After the call completes, we are back outside any ALS scope
    expect(getTrackingContext()).toBeUndefined();
  });
});

describe("makeDoitRequest timeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should throw TimeoutError when fetch does not respond within timeoutMs", async () => {
    // Simulate a fetch that hangs but correctly aborts when the signal fires
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("signal timed out", "TimeoutError"));
        });
      });
    });

    await expect(
      makeDoitRequest("https://api.doit.com/test", "test-token", {
        timeoutMs: 50,
      }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("should return null and not throw when fetch rejects with a non-timeout error", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("Network error")));

    const result = await makeDoitRequest(
      "https://api.doit.com/test",
      "test-token",
    );

    expect(result).toBeNull();
  });
});
