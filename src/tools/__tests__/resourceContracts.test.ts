import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import * as allocations from "../allocations.js";
import * as annotations from "../annotations.js";
import * as themes from "../themes.js";

vi.mock("../../utils/util.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../utils/util.js")>()),
    makeDoitRequest: vi.fn(),
}));
const request = vi.mocked(makeDoitRequest);
beforeEach(() => request.mockReset());

describe("annotation regressions", () => {
    it.each(["timeCreated", "timeModified", "createTime", "updateTime"])("rejects nonfunctional sort %s", (sortBy) => {
        expect(annotations.ListAnnotationsArgumentsSchema.safeParse({ sortBy }).success).toBe(false);
    });
    it.each([
        ["2026-01-15T01:00:00.123+01:00", true],
        ["2026-01-15T00:00Z", false],
        ["2026-01-15T00:00:00", false],
    ])("supports RFC 3339 offsets without accepting incomplete timestamps: %s", (timestamp, valid) => {
        for (const schema of [
            annotations.CreateAnnotationArgumentsSchema,
            annotations.UpdateAnnotationArgumentsSchema,
        ]) {
            expect(schema.safeParse({ id: "a", content: "Note", timestamp }).success).toBe(valid);
        }
    });
    it("rejects empty content even when an update includes other fields", async () => {
        const result = await annotations.handleUpdateAnnotationRequest({ id: "a", content: "", labels: [] }, "token");
        expect(result.isError).toBe(true);
        expect(request).not.toHaveBeenCalled();
    });
});

describe("theme contract boundaries", () => {
    it("accepts all supported hex formats and both palette size boundaries", () => {
        expect(
            themes.UpdateThemeArgumentsSchema.safeParse({
                id: "t",
                primaryColor: "#aBc",
                colors: { light: ["#123ABC"], dark: Array(32).fill("#123abcFF") },
            }).success
        ).toBe(true);
    });
    it("rejects unsupported four-digit hex colors", () => {
        expect(themes.UpdateThemeArgumentsSchema.safeParse({ id: "t", primaryColor: "#abcd" }).success).toBe(false);
    });
    it.each([0, 33])("rejects an out-of-range palette length (%s)", (size) => {
        expect(
            themes.UpdateThemeArgumentsSchema.safeParse({
                id: "t",
                colors: { light: Array(size).fill("#abc"), dark: ["#def"] },
            }).success
        ).toBe(false);
    });
});

// Existing tests cover single-request scope forwarding.
// Exercise the two-request paths where a lookup could accidentally lose customer scope.
it.each([
    ["allocation read", allocations.handleGetAllocationRequest, "allocations", {}],
    ["theme update", themes.handleUpdateThemeRequest, "themes", { newName: "Updated" }],
] as const)("preserves customer scope through name lookup and %s", async (_name, handler, key, args) => {
    request.mockResolvedValueOnce({ [key]: [{ id: "found", name: "Test" }] }).mockResolvedValueOnce({ id: "found" });
    const result = await handler({ name: "test", ...args, customerContext: "switched-customer" }, "token");
    expect(result.isError).not.toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    for (const [, token, options] of request.mock.calls) {
        expect(token).toBe("token");
        expect(options?.customerContext).toBe("switched-customer");
    }
});
