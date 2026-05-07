import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, getTextContent } from "../helpers.js";

describe("Approval flow infrastructure (stdio)", () => {
    let rawClient: { callTool: (p: { name: string; arguments: Record<string, unknown> }) => Promise<any> };
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        ({ rawClient, cleanup } = await createTestClient());
    });

    afterEach(async () => {
        await cleanup();
        vi.restoreAllMocks();
    });

    it("confirm_action with an unknown confirmation id returns the canonical error", async () => {
        const result = await rawClient.callTool({
            name: "confirm_action",
            arguments: { confirmation_id: "00000000-0000-0000-0000-000000000000" },
        });
        expect(getTextContent(result)).toContain("unknown or expired");
    });
});
