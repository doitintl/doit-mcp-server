import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTINUATION_TOKEN_PREFIX } from "../../../src/utils/continuation.js";
import { MAX_TOOL_RESULT_CHARS, measureToolResponse } from "../../../src/utils/responseLimit.js";
import { createTestClient, getTextContent } from "../helpers.js";
import { mswServer } from "../setup.js";

// 40 tickets of 4,500 characters: about 185k, above the 140k result limit on its own.
const TICKETS = 40;
const SECOND_PAGE = 3;
const CURSOR = "tickets-page-2";
const ticket = (id: number, descriptionChars: number) => ({
    id,
    subject: `Ticket ${id}`,
    description: "x".repeat(descriptionChars),
    status: "open",
    severity: "low",
    platform: "google_cloud_platform",
});

const CUSTOMERS = 300;
const DIAGRAMS = 120;
const diagram = (n: number) => ({
    _id: `diagram-${n}`,
    name: `Diagram ${n}`,
    type: "infrastructure",
    import: {
        status: "success",
        region: Object.fromEntries(
            Array.from({ length: 20 }, (_, r) => [`region-${r}`, { allVpc: true, nonVpc: true }])
        ),
    },
    changes: [],
});

describe("result paging over stdio", () => {
    let client: Client;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        ({ client, cleanup } = await createTestClient());
        mswServer.use(
            http.get("https://api.doit.com/support/v1/tickets", ({ request }) => {
                const cursor = new URL(request.url).searchParams.get("pageToken");
                return HttpResponse.json(
                    cursor === CURSOR
                        ? {
                              rowCount: SECOND_PAGE,
                              pageToken: "",
                              tickets: Array.from({ length: SECOND_PAGE }, (_, i) => ticket(TICKETS + i + 1, 20)),
                          }
                        : {
                              rowCount: TICKETS,
                              pageToken: CURSOR,
                              tickets: Array.from({ length: TICKETS }, (_, i) => ticket(i + 1, 4_500)),
                          }
                );
            }),
            http.post("https://console.doit.com/api/customers/v1/customers/search", () =>
                HttpResponse.json({
                    nextPageToken: "customers-page-2",
                    customers: Array.from({ length: CUSTOMERS }, (_, i) => ({
                        id: `customer-${i + 1}`,
                        name: "x".repeat(1_500),
                    })),
                })
            ),
            http.get("https://api.doit.com/clouddiagrams/v1/scheme/stats", () =>
                HttpResponse.json(Array.from({ length: DIAGRAMS }, (_, i) => diagram(i + 1)))
            )
        );
    });

    afterEach(async () => {
        process.env.DOIT_API_KEY = "test-api-key";
        await cleanup();
        vi.restoreAllMocks();
    });

    async function walk(name: string, args: Record<string, unknown>, recordsOf: (page: any) => any[]) {
        const pages: any[] = [];
        let pageToken: string | undefined;
        for (let call = 0; call < 20; call += 1) {
            const result = (await client.callTool({
                name,
                arguments: pageToken ? { ...args, pageToken } : args,
            })) as any;
            expect(result.isError, getTextContent(result)).not.toBe(true);
            expect(measureToolResponse(result)?.serializedChars).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS);
            const page = JSON.parse(getTextContent(result));
            pages.push(page);
            if (typeof page.pageToken !== "string" || !page.pageToken.startsWith(CONTINUATION_TOKEN_PREFIX)) break;
            pageToken = page.pageToken;
        }
        return { pages, records: pages.flatMap(recordsOf) };
    }

    it("splits an oversized ticket page, returns every ticket once, then hands over the API cursor", async () => {
        const { pages, records } = await walk("list_tickets", {}, (page) => page.tickets);
        expect(pages.length).toBeGreaterThan(1);
        for (const page of pages.slice(0, -1)) {
            expect(page).toMatchObject({ rowCount: TICKETS, pageSplit: { returnedRecords: page.tickets.length } });
            expect(page.pageToken).not.toBe(CURSOR);
        }
        expect(records.map((t: { id: number }) => t.id)).toEqual(Array.from({ length: TICKETS }, (_, i) => i + 1));
        const last = pages[pages.length - 1];
        expect(last.pageToken).toBe(CURSOR);
        expect(last).not.toHaveProperty("pageSplit");

        const second = JSON.parse(
            getTextContent((await client.callTool({ name: "list_tickets", arguments: { pageToken: CURSOR } })) as any)
        );
        expect(second.tickets.map((t: { id: number }) => t.id)).toEqual(
            Array.from({ length: SECOND_PAGE }, (_, i) => TICKETS + i + 1)
        );
        expect(second.pageToken).toBe("");
    });

    it("keeps the API's nextPageToken out of split parts so no customer is skipped", async () => {
        // search_customers is employee-only; the gate reads the key on every call.
        const employeeClaims = Buffer.from(JSON.stringify({ sub: "employee@doit.com" })).toString("base64url");
        process.env.DOIT_API_KEY = `e30.${employeeClaims}.sig`;
        const { pages, records } = await walk("search_customers", {}, (page) => page.customers);
        expect(pages.length).toBeGreaterThan(1);
        for (const page of pages.slice(0, -1)) expect(page).not.toHaveProperty("nextPageToken");
        expect(records.map((c: { id: string }) => c.id)).toEqual(
            Array.from({ length: CUSTOMERS }, (_, i) => `customer-${i + 1}`)
        );
        expect(pages[pages.length - 1]).toMatchObject({ nextPageToken: "customers-page-2" });
        expect(pages[pages.length - 1]).not.toHaveProperty("pageToken");
    });

    it("pages an unpaginated endpoint through the server's own pageToken", async () => {
        const args = { start: "2026-10-01T00:00:00Z", end: "2026-11-10T00:00:00Z" };
        const { pages, records } = await walk("get_cloud_diagrams_stats", args, (page) => page.items);
        expect(pages.length).toBeGreaterThan(1);
        expect(records.map((d: { _id: string }) => d._id)).toEqual(
            Array.from({ length: DIAGRAMS }, (_, i) => `diagram-${i + 1}`)
        );
        expect(pages[pages.length - 1]).toMatchObject({ rowCount: DIAGRAMS });
        expect(pages[pages.length - 1]).not.toHaveProperty("pageToken");
    });

    it("rejects an altered continuation token and a foreign pageToken on an unpaginated tool", async () => {
        const first = JSON.parse(
            getTextContent((await client.callTool({ name: "list_tickets", arguments: {} })) as any)
        );
        const altered = `${first.pageToken.slice(0, -2)}${first.pageToken.endsWith("A") ? "BB" : "AA"}`;
        const tampered = (await client.callTool({ name: "list_tickets", arguments: { pageToken: altered } })) as any;
        expect(tampered.isError).toBe(true);
        expect(getTextContent(tampered)).toContain("Invalid continuation pageToken");

        const foreign = (await client.callTool({
            name: "get_cloud_diagrams_stats",
            arguments: { start: "2026-10-01T00:00:00Z", end: "2026-11-10T00:00:00Z", pageToken: "not-a-token" },
        })) as any;
        expect(foreign.isError).toBe(true);
        expect(getTextContent(foreign)).toContain("must be a continuation token");
    });

    it("advertises pageToken on read-only tools whose endpoints cannot page", async () => {
        const { tools } = await client.listTools();
        const property = (name: string) =>
            (tools.find((tool) => tool.name === name)?.inputSchema as any)?.properties?.pageToken;
        expect(property("list_users")?.description).toContain("Continuation token");
        expect(property("get_cloud_diagrams_stats")?.description).toContain("Continuation token");
        expect(property("list_tickets")?.description).not.toContain("Continuation token");
        expect(property("create_ticket")).toBeUndefined();
    });
});
