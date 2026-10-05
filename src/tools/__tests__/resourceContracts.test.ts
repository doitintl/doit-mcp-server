import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import * as allocations from "../allocations.js";
import * as annotations from "../annotations.js";
import * as folders from "../folders.js";
import * as labels from "../labels.js";
import * as permissions from "../permissions.js";
import * as themes from "../themes.js";

vi.mock("../../utils/util.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../utils/util.js")>()),
    makeDoitRequest: vi.fn(),
}));
const request = vi.mocked(makeDoitRequest);
const component = { key: "project_id", type: "fixed", values: ["test-project"], mode: "is" };
const rule = { components: [component], formula: "A" };
const token = "test-token";
beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ id: "test" });
});

describe("annotation contracts", () => {
    it.each(["id", "content", "timestamp"])("accepts supported sort %s", (sortBy) => {
        expect(annotations.ListAnnotationsArgumentsSchema.safeParse({ sortBy }).success).toBe(true);
    });
    it.each(["timeCreated", "timeModified", "createTime", "updateTime"])("rejects nonfunctional sort %s", (sortBy) => {
        expect(annotations.ListAnnotationsArgumentsSchema.safeParse({ sortBy }).success).toBe(false);
    });
    it.each([
        ["2026-01-15T00:00:00Z", true],
        ["2026-01-15T00:00:00.123456789Z", true],
        ["2026-01-15T01:00:00+01:00", true],
        ["2026-01-15T00:00:00-08:00", true],
        ["2026-01-15", false],
        ["2026-01-15T00:00Z", false],
        ["2026-01-15T00:00:00", false],
        ["2026-02-30T00:00:00Z", false],
        ["2026-01-15T00:00:00+0100", false],
    ])("validates RFC 3339 timestamp %s", (timestamp, valid) => {
        for (const schema of [
            annotations.CreateAnnotationArgumentsSchema,
            annotations.UpdateAnnotationArgumentsSchema,
        ]) {
            expect(schema.safeParse({ id: "a", content: "Note", timestamp }).success).toBe(valid);
        }
    });
    it.each([undefined, null, ""])("requires nonempty update content (%s)", (content) => {
        expect(annotations.UpdateAnnotationArgumentsSchema.safeParse({ id: "a", content, labels: [] }).success).toBe(
            false
        );
    });
    it.each([null, []])("preserves the distinction between null and empty lists (%j)", async (value) => {
        await annotations.handleUpdateAnnotationRequest(
            { id: "a", content: "Keep", labels: value, reports: value },
            token
        );
        expect(request).toHaveBeenCalledWith(
            expect.any(String),
            token,
            expect.objectContaining({ body: { content: "Keep", labels: value, reports: value } })
        );
    });
});

describe("theme validation", () => {
    it.each(["#aBc", "#123ABC", "#123abcFF"])("accepts color %s", (color) => {
        expect(
            themes.UpdateThemeArgumentsSchema.safeParse({
                id: "t",
                primaryColor: color,
                colors: { light: [color], dark: Array(32).fill(color) },
            }).success
        ).toBe(true);
    });
    it.each(["red", "#abcd", "123456", "#gggggg"])("rejects color %s", (primaryColor) => {
        expect(themes.UpdateThemeArgumentsSchema.safeParse({ id: "t", primaryColor }).success).toBe(false);
    });
    it.each([0, 33])("rejects palette length %s", (size) => {
        expect(
            themes.UpdateThemeArgumentsSchema.safeParse({
                id: "t",
                colors: { light: Array(size).fill("#abc"), dark: ["#def"] },
            }).success
        ).toBe(false);
    });
    it("checks name length and requires both palettes", () => {
        expect(themes.UpdateThemeArgumentsSchema.safeParse({ id: "t", newName: "a".repeat(200) }).success).toBe(true);
        expect(themes.UpdateThemeArgumentsSchema.safeParse({ id: "t", newName: "a".repeat(201) }).success).toBe(false);
        expect(themes.UpdateThemeArgumentsSchema.safeParse({ id: "t", newName: "   " }).success).toBe(false);
        expect(themes.UpdateThemeArgumentsSchema.safeParse({ id: "t", colors: { light: ["#abc"] } }).success).toBe(
            false
        );
    });
});

const lookups = [
    ["allocation", allocations.handleGetAllocationRequest, "allocations", "name", true],
    ["annotation", annotations.handleGetAnnotationRequest, "annotations", "content", true],
    ["label", labels.handleGetLabelRequest, "labels", "name", true],
    ["folder", folders.handleGetFolderRequest, "folders", "name", true],
    ["theme", themes.handleGetThemeRequest, "themes", "name", false],
] as const;
describe.each(lookups)("%s name lookup", (_name, handler, key, field, paginated) => {
    it("uses id in preference to name", async () => {
        await handler({ id: "chosen", [field]: "ignored" }, token);
        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0][0]).toContain("/chosen");
    });
    it("does not silently pick an ambiguous match or fetch another page", async () => {
        request.mockResolvedValue({
            [key]: [
                { id: "a", [field]: "Test A" },
                { id: "b", [field]: "TEST B" },
            ],
            pageToken: "next",
        });
        const result = await handler({ [field]: "test" }, token);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Multiple items match");
        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0][0].includes("maxResults=200")).toBe(paginated);
    });
    it("carries customer scope through lookup and subsequent get", async () => {
        request.mockResolvedValueOnce({ [key]: [{ id: "a", [field]: "Test" }] }).mockResolvedValueOnce({ id: "a" });
        await handler({ [field]: "test", customerContext: "switched-customer" }, token);
        expect(request).toHaveBeenCalledTimes(2);
        for (const [, passedToken, options] of request.mock.calls) {
            expect(passedToken).toBe(token);
            expect(options?.customerContext).toBe("switched-customer");
        }
    });
});

const scopedCalls = [
    [allocations.handleListAllocationsRequest, {}],
    [allocations.handleCreateAllocationRequest, { name: "Test", rule }],
    [allocations.handleUpdateAllocationRequest, { id: "a", description: "" }],
    [annotations.handleListAnnotationsRequest, {}],
    [annotations.handleCreateAnnotationRequest, { content: "Test", timestamp: "2026-01-01T00:00:00Z" }],
    [annotations.handleUpdateAnnotationRequest, { id: "a", content: "Test" }],
    [labels.handleListLabelsRequest, {}],
    [labels.handleCreateLabelRequest, { name: "Test", color: "blue" }],
    [labels.handleUpdateLabelRequest, { id: "l", name: null }],
    [labels.handleGetLabelAssignmentsRequest, { id: "l" }],
    [labels.handleAssignObjectsToLabelRequest, { id: "l", add: [{ objectId: "a", objectType: "annotation" }] }],
    [folders.handleListFoldersRequest, {}],
    [folders.handleCreateFolderRequest, { name: "Test" }],
    [folders.handleUpdateFolderRequest, { id: "f", description: "" }],
    [themes.handleListThemesRequest, {}],
    [themes.handleGetActiveThemeRequest, {}],
    [themes.handleSetActiveThemeRequest, { themeId: "default" }],
    [themes.handleUpdateThemeRequest, { id: "t", primaryColor: "#abc" }],
    [permissions.handleGetResourcePermissionsRequest, { resourceType: "reports", resourceId: "r" }],
    [
        permissions.handleUpdateResourcePermissionsRequest,
        { resourceType: "reports", resourceId: "r", permissions: [{ user: "owner@example.com", role: "owner" }] },
    ],
] as const;
it.each(scopedCalls)("passes explicit customer scope through %s", async (handler, args) => {
    await handler({ ...args, customerContext: "switched-customer" }, token);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1]).toBe(token);
    expect(request.mock.calls[0][2]?.customerContext).toBe("switched-customer");
});
