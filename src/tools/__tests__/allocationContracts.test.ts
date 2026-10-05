import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import * as allocations from "../allocations.js";

vi.mock("../../utils/util.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../utils/util.js")>()),
    makeDoitRequest: vi.fn(),
}));
const request = vi.mocked(makeDoitRequest);
const component = { key: "project_id", type: "fixed", values: ["test-project"], mode: "is" };
const rule = { components: [component], formula: "A" };
const selected = [
    { action: "select", id: "first" },
    { action: "select", id: "second" },
];
const token = "test-token";
beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ id: "test" });
});

describe("allocation contracts", () => {
    it.each([{ unallocatedCosts: "Other" }, { unallocatedCosts: null }, { rules: selected }])(
        "sends partial updates without inventing omitted fields: %j",
        async (patch) => {
            const response = await allocations.handleUpdateAllocationRequest(
                { id: "group", ...patch, customerContext: "switched-customer" },
                token
            );
            expect(response.isError).not.toBe(true);
            expect(request).toHaveBeenCalledWith(expect.stringContaining("/group"), token, {
                method: "PATCH",
                body: patch,
                customerContext: "switched-customer",
            });
        }
    );
    it("preserves the group rules and unmatched-cost label on readback", async () => {
        const data = {
            id: "group",
            name: "Group",
            allocationType: "multiple",
            rules: [
                { id: "first", name: "First", type: "custom" },
                { id: "second", name: "Second", type: "custom" },
            ],
            unallocatedCosts: "Other",
        };
        request.mockResolvedValue(data);
        const response = await allocations.handleGetAllocationRequest({ id: "group" }, token);
        expect(JSON.parse(response.content[0].text)).toEqual(data);
    });
    it("accepts select rules without requiring components or formula", () => {
        for (const schema of [
            allocations.CreateAllocationArgumentsSchema,
            allocations.UpdateAllocationArgumentsSchema,
        ]) {
            expect(schema.safeParse({ id: "group", name: "Group", rules: selected }).success).toBe(true);
        }
    });
    it.each([
        { action: "create", ...rule },
        { action: "create", name: "Rule", id: "existing", ...rule },
        { action: "update", name: "Rule", ...rule },
        { action: "update", id: "first", ...rule },
        { action: "select" },
        { action: "create", name: "Rule", components: rule.components },
        { action: "update", id: "first", name: "Rule", formula: "A" },
    ])("rejects malformed group rule %j", (entry) => {
        for (const schema of [
            allocations.CreateAllocationArgumentsSchema,
            allocations.UpdateAllocationArgumentsSchema,
        ]) {
            expect(schema.safeParse({ id: "group", name: "Group", rules: [entry, selected[1]] }).success).toBe(false);
        }
    });
    it("enforces single/group exclusivity and component enums", () => {
        for (const schema of [
            allocations.CreateAllocationArgumentsSchema,
            allocations.UpdateAllocationArgumentsSchema,
        ]) {
            expect(schema.safeParse({ id: "a", name: "A", rule, rules: selected }).success).toBe(false);
            expect(schema.safeParse({ id: "a", name: "A", rule, unallocatedCosts: "Other" }).success).toBe(false);
            for (const [type, mode, valid] of [
                ["allocation_rule", "is", true],
                ["fixed", "regexp", true],
                ["attribution_group", "is", false],
                ["fixed", undefined, false],
            ] as const) {
                expect(
                    schema.safeParse({
                        id: "a",
                        name: "A",
                        rule: { formula: "A", components: [{ ...component, type, mode }] },
                    }).success
                ).toBe(valid);
            }
        }
    });
});
