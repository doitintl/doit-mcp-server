import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient, getTextContent } from "../helpers.js";
import { mswServer } from "../setup.js";

describe("support and account request contracts over MCP", () => {
    let connection: Awaited<ReturnType<typeof createTestClient>>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        connection = await createTestClient();
    });

    afterEach(async () => {
        await connection.cleanup();
        vi.restoreAllMocks();
    });

    it("sends requested ticket page size as maxResults and keeps the cursor on an empty subject match", async () => {
        const requests: URL[] = [];
        mswServer.use(
            http.get("https://api.doit.com/support/v1/tickets", ({ request }) => {
                requests.push(new URL(request.url));
                return HttpResponse.json({
                    tickets: [{ id: 1, subject: "Synthetic" }],
                    rowCount: 1,
                    pageToken: "next",
                });
            })
        );
        const result = await connection.rawClient.callTool({
            name: "list_tickets",
            arguments: { pageSize: 1, subject: "absent", pageToken: "current" },
        });
        expect(JSON.parse(getTextContent(result))).toEqual({ tickets: [], rowCount: 1, pageToken: "next" });
        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get("maxResults")).toBe("1");
        expect(requests[0].searchParams.has("pageSize")).toBe(false);
        expect(requests[0].searchParams.get("pageToken")).toBe("current");
    });

    it.each([undefined, "legacy-timestamp"])(
        "creates a synthetic ticket without forwarding created=%s",
        async (created) => {
            const ticket = {
                body: "Synthetic",
                subject: "Synthetic",
                severity: "normal",
                platform: "finance___billing",
                product: "billing",
            };
            const bodies: unknown[] = [];
            mswServer.use(
                http.post("https://api.doit.com/support/v1/tickets", async ({ request }) => {
                    bodies.push(await request.json());
                    return HttpResponse.json({ id: 123 });
                })
            );
            const result = await connection.rawClient.callTool({
                name: "create_ticket",
                arguments: { ticket: { ...ticket, ...(created === undefined ? {} : { created }) } },
            });
            expect(result.isError).not.toBe(true);
            expect(bodies).toEqual([{ ticket }]);
        }
    );

    it("preserves repeated asset type filters and the cursor on an empty name match", async () => {
        const requests: URL[] = [];
        mswServer.use(
            http.get("https://api.doit.com/billing/v1/assets", ({ request }) => {
                requests.push(new URL(request.url));
                return HttpResponse.json({ assets: [{ id: "1", name: "Synthetic" }], rowCount: 1, pageToken: "next" });
            })
        );
        const result = await connection.rawClient.callTool({
            name: "list_assets",
            arguments: { maxResults: "1", name: "absent", filter: "type:g-suite|type:office-365" },
        });
        expect(JSON.parse(getTextContent(result))).toEqual({ assets: [], rowCount: 1, pageToken: "next" });
        expect(requests).toHaveLength(1);
        expect(requests[0].searchParams.get("filter")).toBe("type:g-suite|type:office-365");
        expect(requests[0].searchParams.get("maxResults")).toBe("1");
    });

    it("leaves the invite role and domain/duplicate policy to the API", async () => {
        const bodies: unknown[] = [];
        mswServer.use(
            http.post("https://api.doit.com/iam/v1/users/invite", async ({ request }) => {
                bodies.push(await request.json());
                return HttpResponse.json({
                    user: { id: "synthetic", status: "invited", roleId: "preset/support-user" },
                });
            })
        );
        const result = await connection.rawClient.callTool({
            name: "invite_user",
            arguments: { email: "synthetic@example.com" },
        });
        expect(result.isError).not.toBe(true);
        expect(bodies).toEqual([{ email: "synthetic@example.com" }]);
        expect(JSON.parse(getTextContent(result)).user.roleId).toBe("preset/support-user");
    });

    it.each(["Domain is not allowed", "User already exists", "User was already invited"])(
        "reports API invitation rejection: %s",
        async (error) => {
            let calls = 0;
            mswServer.use(
                http.post("https://api.doit.com/iam/v1/users/invite", () => {
                    calls++;
                    return HttpResponse.json({ error }, { status: 400 });
                })
            );
            const result = await connection.rawClient.callTool({
                name: "invite_user",
                arguments: { email: "synthetic@example.com" },
            });
            expect(result.isError).toBe(true);
            expect(calls).toBe(1);
        }
    );

    it.each([
        { name: "list_tickets", arguments: { pageSize: 101 } },
        {
            name: "create_ticket",
            arguments: {
                ticket: {
                    body: "Synthetic",
                    subject: "Synthetic",
                    platform: "google-cloud",
                    severity: "normal",
                    product: "billing",
                },
            },
        },
        { name: "invite_user", arguments: { email: "invalid" } },
        { name: "invite_user", arguments: { email: "synthetic@example.com", roleId: "   " } },
    ])("rejects invalid $name arguments without HTTP requests", async (params) => {
        let calls = 0;
        mswServer.use(
            http.all("https://api.doit.com/*", () => {
                calls++;
                return HttpResponse.json({});
            })
        );
        const result = await connection.rawClient.callTool(params);
        expect(result.isError).toBe(true);
        expect(calls).toBe(0);
    });
});
