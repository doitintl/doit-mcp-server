import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeToolHandler } from "../../utils/toolsHandler.js";

// Exercise the same dispatch and HTTP helper the hosted core uses, with synthetic tenants.
const cases = [
    { name: "list_tickets", args: { pageSize: 2 }, data: { tickets: [], rowCount: 0 }, path: "/support/v1/tickets" },
    { name: "get_ticket", args: { id: "123" }, data: { id: 123 }, path: "/support/v1/tickets/123" },
    { name: "list_assets", args: { maxResults: "2" }, data: { assets: [], rowCount: 0 }, path: "/billing/v1/assets" },
    { name: "get_asset", args: { id: "asset-1" }, data: { id: "asset-1" }, path: "/billing/v1/assets/asset-1" },
    { name: "list_invoices", args: {}, data: { invoices: [], rowCount: 0 }, path: "/billing/v1/invoices" },
    {
        name: "get_invoice",
        args: { id: "invoice-1" },
        data: { id: "invoice-1", invoiceDate: 0, dueDate: 0 },
        path: "/billing/v1/invoices/invoice-1",
    },
    { name: "list_users", args: {}, data: { users: [], rowCount: 0 }, path: "/iam/v1/users" },
    { name: "list_roles", args: {}, data: { roles: [] }, path: "/iam/v1/roles" },
    { name: "list_organizations", args: {}, data: { organizations: [] }, path: "/iam/v1/organizations" },
    { name: "list_platforms", args: {}, data: { platforms: [] }, path: "/support/v1/metadata/platforms" },
    {
        name: "list_products",
        args: { platform: "google_cloud_platform" },
        data: { products: [] },
        path: "/support/v1/metadata/products",
    },
    {
        name: "list_commitments",
        args: { maxResults: "2" },
        data: { commitments: [], rowCount: 0 },
        path: "/analytics/v1/commitment-manager",
    },
    {
        name: "get_commitment",
        args: { id: "commitment-1" },
        data: { id: "commitment-1" },
        path: "/analytics/v1/commitment-manager/commitment-1",
    },
    { name: "list_account_team", args: {}, data: { accountManagers: [] }, path: "/customers/v1/accountTeam" },
    {
        name: "create_ticket",
        args: {
            ticket: {
                body: "Synthetic body",
                subject: "Synthetic subject",
                severity: "normal",
                platform: "finance___billing",
                product: "Billing",
            },
        },
        data: { id: 123 },
        path: "/support/v1/tickets",
    },
    {
        name: "invite_user",
        args: { email: "synthetic@example.com" },
        data: { message: "ok" },
        path: "/iam/v1/users/invite",
    },
];

beforeEach(() => {
    vi.stubEnv("CUSTOMER_CONTEXT", "default-customer");
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("support and account tools customer context", () => {
    it.each(cases)(
        "$name keeps concurrent explicit tenant scopes in the query and header",
        async ({ name, args, data, path }) => {
            const requests: Array<{ url: URL; headers: Headers }> = [];
            vi.stubGlobal(
                "fetch",
                vi.fn(async (url: string, options: RequestInit) => {
                    requests.push({ url: new URL(url), headers: new Headers(options.headers) });
                    await Promise.resolve();
                    return Response.json(data);
                })
            );

            const results = await Promise.all(
                ["customer-a", "customer-b"].map((customerContext) =>
                    executeToolHandler(name, { ...args, customerContext }, "synthetic-token")
                )
            );

            expect(results.every((result) => !result.isError)).toBe(true);
            expect(requests).toHaveLength(2);
            for (const [index, request] of requests.entries()) {
                const customer = index === 0 ? "customer-a" : "customer-b";
                expect(request.url.pathname).toBe(path);
                expect(request.url.searchParams.get("customerContext")).toBe(customer);
                expect(request.headers.get("X-Tenant-Id")).toBe(customer);
            }
        }
    );
});
