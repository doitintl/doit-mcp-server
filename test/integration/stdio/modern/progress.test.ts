import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient } from "../../helpers.js";
import { mswServer } from "../../setup.js";
import { createModernTestClient, getTextContent } from "./helpers.js";

const BUILD_URL = "https://api.doit.com/cloudflow/v1/flows/actions/build";
const STEPS = ["Searching templates", "Creating flow"];

/** An SSE stream shaped like the CloudFlow NL builder's: lifecycle JSON embedded in `answer`. */
function builderStream() {
    const events = [
        { conversationId: "conv-1", answer: JSON.stringify({ toolStart: STEPS[0] }) },
        { answer: JSON.stringify({ toolStart: STEPS[1] }) },
        { answer: JSON.stringify({ customEvent: { messageId: "cloudflow_created", data: { flowId: "flow-123" } } }) },
        { answer: "Built your flow." },
    ];
    const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
    return new HttpResponse(body, { headers: { "Content-Type": "text/event-stream" } });
}

// build_cloud_flow forwards each builder step as a `notifications/progress` for the request's
// progressToken (src/server.ts → ctx.mcpReq.notify). Progress notifications are still on the
// 2026-07-28 wire, so both eras must receive them.
describe("progress notifications from build_cloud_flow", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mswServer.use(http.post(BUILD_URL, () => builderStream()));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const expectBuiltFlow = (result: { content: Array<{ type: string; text?: string }> }) => {
        expect(JSON.parse(getTextContent(result))).toMatchObject({ flowId: "flow-123", steps: STEPS });
    };

    it("delivers each builder step to a 2026-07-28 client", async () => {
        const { rawClient, cleanup } = await createModernTestClient();
        const messages: Array<string | undefined> = [];

        const result = await rawClient.callTool(
            { name: "build_cloud_flow", arguments: { question: "Notify me on new incidents" } },
            { onprogress: (progress) => messages.push(progress.message) }
        );
        await cleanup();

        expectBuiltFlow(result as { content: Array<{ type: string; text?: string }> });
        expect(messages).toEqual(STEPS);
    });

    it("delivers each builder step to a 2025-era (v1 SDK) client", async () => {
        const { rawClient, cleanup } = await createTestClient();
        const messages: Array<string | undefined> = [];

        const result = await rawClient.callTool(
            { name: "build_cloud_flow", arguments: { question: "Notify me on new incidents" } },
            undefined,
            { onprogress: (progress) => messages.push(progress.message as string | undefined) }
        );
        await cleanup();

        expectBuiltFlow(result as { content: Array<{ type: string; text?: string }> });
        expect(messages).toEqual(STEPS);
    });
});
