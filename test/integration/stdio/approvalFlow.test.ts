import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, getTextContent } from "../helpers.js";

/**
 * `handleCreateTicketRequest` returns a markdown header (with the clickable ticket
 * URL) followed by the JSON payload. Pull just the trailing JSON object so existing
 * structured assertions keep working.
 */
function parseTicketResponse(text: string): { id?: number; status?: string; urlUI?: string } {
    const match = text.match(/\{[\s\S]*\}\s*$/);
    if (!match) throw new Error(`Expected trailing JSON object in: ${text}`);
    return JSON.parse(match[0]);
}

// This suite intentionally uses `rawClient` to bypass the test helper's
// auto-confirm wrapper, so we can observe the two-phase approval envelope
// emitted by the server directly.
describe("Write-gated tool approval flow (stdio)", () => {
    let rawClient: { callTool: (p: { name: string; arguments: Record<string, unknown> }) => Promise<any> };
    let cleanup: () => Promise<void>;

    const ticketArgs = {
        ticket: {
            body: "Need help with billing.",
            created: "2026-04-22T00:00:00Z",
            platform: "amazon_web_services",
            product: "billing",
            severity: "high",
            subject: "Gated Ticket",
        },
    };

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        ({ rawClient, cleanup } = await createTestClient());
    });

    afterEach(async () => {
        await cleanup();
        vi.restoreAllMocks();
    });

    it("emits an approval_required envelope on the first call — and never leaks a token to the LLM", async () => {
        const result = await rawClient.callTool({ name: "create_ticket", arguments: ticketArgs });
        const body = JSON.parse(getTextContent(result));

        expect(body.status).toBe("approval_required");
        // Header line uses natural prepositional phrases with double-quoted values
        // (severity "high", platform "amazon_web_services", subject "Gated Ticket")
        // followed by "More details below:" and the indented field table — see
        // createTicketTool.summary in src/tools/tickets.ts.
        expect(body.summary).toContain('with severity "high"');
        expect(body.summary).toContain('on platform "amazon_web_services"');
        expect(body.summary).toContain("More details below:");
        // Detail rows are markdown bullets with bold labels — see the rationale in
        // createTicketTool.summary about chat clients flattening plain whitespace.
        expect(body.summary).toContain("- **Body:** Need help with billing.");
        expect(body.summary).toContain("- **Platform:** amazon_web_services");
        // Question references "these details" rather than restating the header.
        expect(body.userPrompt).toBe("Are you sure you want to create the support ticket with these details?");
        expect(body.next).toContain("confirm_action");
        // The whole point of the userKey-keyed design: no UUID surfaces to the LLM
        // (and therefore to MCP client permission dialogs that render raw args).
        expect(body.approvalToken).toBeUndefined();
        expect(JSON.stringify(body)).not.toMatch(/token/i);
    });

    it("confirm_action (no args) executes the staged write-gated call and surfaces the ticket link", async () => {
        await rawClient.callTool({ name: "create_ticket", arguments: ticketArgs });

        const second = await rawClient.callTool({
            name: "confirm_action",
            arguments: {},
        });
        const text = getTextContent(second);
        // The markdown header is what makes the URL clickable in chat clients —
        // assert it is present so we don't accidentally regress to raw JSON output.
        expect(text).toMatch(/^Ticket #99999 created/);
        expect(text).toContain("View ticket:");
        const parsed = parseTicketResponse(text);
        expect(parsed.id).toBe(99999);
        expect(parsed.status).toBe("created");
    });

    it("pending actions are single-use — a second confirm_action after a successful one errors out", async () => {
        await rawClient.callTool({ name: "create_ticket", arguments: ticketArgs });

        await rawClient.callTool({ name: "confirm_action", arguments: {} });
        const replay = await rawClient.callTool({
            name: "confirm_action",
            arguments: {},
        });

        expect(getTextContent(replay)).toContain("No pending action to confirm");
    });

    it("confirm_action with no prior staging returns the canonical error", async () => {
        const result = await rawClient.callTool({
            name: "confirm_action",
            arguments: {},
        });
        expect(getTextContent(result)).toContain("No pending action to confirm");
    });

    it("staging twice in a row overwrites — the user is only ever confirming the most recent action", async () => {
        await rawClient.callTool({
            name: "create_ticket",
            arguments: { ticket: { ...ticketArgs.ticket, subject: "first" } },
        });
        await rawClient.callTool({
            name: "create_ticket",
            arguments: { ticket: { ...ticketArgs.ticket, subject: "second" } },
        });

        const confirmed = await rawClient.callTool({ name: "confirm_action", arguments: {} });
        // The stdio integration uses the canned fixture handler, which echoes a fixed
        // id regardless of input. We just verify it succeeded — the unit-level test
        // in toolsHandler.test.ts asserts the second-wins payload directly against
        // the mocked makeDoitRequest.
        const parsed = parseTicketResponse(getTextContent(confirmed));
        expect(parsed.status).toBe("created");
    });

    it("confirm_action rejects unexpected arguments (defends against stale `token` field from old contract)", async () => {
        await rawClient.callTool({ name: "create_ticket", arguments: ticketArgs });

        const rejected = await rawClient.callTool({
            name: "confirm_action",
            arguments: { token: "00000000-0000-0000-0000-000000000000" },
        });
        expect(getTextContent(rejected)).toContain("no arguments");
    });
});
