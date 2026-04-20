import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientSupportsFormElicitation, runDestructiveIfNeeded, withConfirmation } from "../confirmation.js";

describe("clientSupportsFormElicitation", () => {
    it("returns false when capabilities are missing", () => {
        expect(clientSupportsFormElicitation(undefined)).toBe(false);
    });

    it("returns true when client advertises form elicitation", () => {
        expect(clientSupportsFormElicitation({ elicitation: { form: {} } } as any)).toBe(true);
    });
});

describe("withConfirmation", () => {
    const handler = vi.fn(async () => ({ ok: true }));

    beforeEach(() => {
        handler.mockClear();
    });

    it("runs handler when elicit is not provided", async () => {
        const wrapped = withConfirmation(handler, () => "msg");
        const out = await wrapped({ x: 1 }, "tok", undefined);
        expect(handler).toHaveBeenCalledWith({ x: 1 }, "tok");
        expect(out).toEqual({ ok: true });
    });

    it("runs handler when user accepts with confirm true", async () => {
        const elicit = vi.fn(async () => ({
            action: "accept" as const,
            content: { confirm: true },
        }));
        const wrapped = withConfirmation(handler, () => "Proceed?");
        await wrapped({}, "tok", elicit);
        expect(elicit).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("returns error result on cancel", async () => {
        const elicit = vi.fn(async () => ({ action: "cancel" as const }));
        const wrapped = withConfirmation(handler, () => "Proceed?");
        const out = await wrapped({}, "tok", elicit);
        expect(handler).not.toHaveBeenCalled();
        expect(out).toMatchObject({ isError: true });
        expect((out as any).content[0].text).toContain("cancelled");
    });

    it("returns error result on decline", async () => {
        const elicit = vi.fn(async () => ({ action: "decline" as const }));
        const wrapped = withConfirmation(handler, () => "Proceed?");
        const out = await wrapped({}, "tok", elicit);
        expect(handler).not.toHaveBeenCalled();
        expect((out as any).content[0].text).toContain("declined");
    });

    it("returns error when accept without confirm true", async () => {
        const elicit = vi.fn(async () => ({
            action: "accept" as const,
            content: { confirm: false },
        }));
        const wrapped = withConfirmation(handler, () => "Proceed?");
        const out = await wrapped({}, "tok", elicit);
        expect(handler).not.toHaveBeenCalled();
        expect(out).toMatchObject({ isError: true });
    });

    it("falls through to handler when elicit throws InvalidParams", async () => {
        const elicit = vi.fn(async () => {
            throw new McpError(ErrorCode.InvalidParams, "unsupported");
        });
        const wrapped = withConfirmation(handler, () => "Proceed?");
        await wrapped({ a: 1 }, "tok", elicit);
        expect(handler).toHaveBeenCalledWith({ a: 1 }, "tok");
    });

    it("falls through when elicit throws MethodNotFound", async () => {
        const elicit = vi.fn(async () => {
            throw new McpError(ErrorCode.MethodNotFound, "no method");
        });
        const wrapped = withConfirmation(handler, () => "Proceed?");
        await wrapped({}, "tok", elicit);
        expect(handler).toHaveBeenCalled();
    });
});

describe("runDestructiveIfNeeded", () => {
    it("skips confirmation for non-destructive tools", async () => {
        const handler = vi.fn(async () => "done");
        const elicit = vi.fn();
        const out = await runDestructiveIfNeeded("list_budgets", {}, "tok", elicit as any, handler);
        expect(out).toBe("done");
        expect(elicit).not.toHaveBeenCalled();
    });

    it("uses confirmation path for destructive tools when elicit is set", async () => {
        const handler = vi.fn(async () => "done");
        const elicit = vi.fn(async () => ({
            action: "accept" as const,
            content: { confirm: true },
        }));
        await runDestructiveIfNeeded(
            "create_budget",
            { name: "B", amount: 1, currency: "USD" },
            "tok",
            elicit,
            handler
        );
        expect(elicit).toHaveBeenCalled();
        expect(handler).toHaveBeenCalled();
    });
});
