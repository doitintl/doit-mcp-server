import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CreateTicketArgumentsSchema } from "../../../dist/tools/tickets.js";

// Explicit opt-in; this script is outside both deterministic Vitest include patterns.
// No write tools, confirmations, HTTP fallbacks, or customer-content logging.
if (process.env.DOIT_LIVE_READS !== "1" || !process.env.DOIT_OWN_CUSTOMER_API_KEY) {
    console.error("Requires DOIT_LIVE_READS=1 and DOIT_OWN_CUSTOMER_API_KEY in the environment.");
    process.exit(1);
}
const client = new Client({ name: "support-account-read-validation", version: "1.0.0" });
const entry = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));
let calls = 0;
let failures = 0;
const allowedTools = new Set([
    "list_tickets", "list_assets", "get_asset", "list_platforms", "list_products",
    "list_users", "list_roles", "list_organizations", "list_account_team",
    "list_invoices", "list_commitments", "get_commitment",
]);
function check(condition, assertion) {
    if (!condition) {
        failures++;
        console.log(JSON.stringify({ assertion, outcome: "failed" }));
    }
}
function record(tool, inputs, data, field, assertions) {
    console.log(JSON.stringify({ tool, inputs, outcome: "success", count: field ? data[field]?.length ?? 0 : undefined,
        rowCount: data.rowCount, cursorPresent: Boolean(data.pageToken), assertions }));
}
async function call(name, args, redactedArgs = args) {
    if (!allowedTools.has(name) || ++calls > 30) throw new Error("Read-call bound exceeded");
    try {
        const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
        if (result.isError) {
            failures++;
            console.log(JSON.stringify({ tool: name, inputs: redactedArgs, outcome: "tool-error", response: "omitted" }));
            return undefined;
        }
        const text = result.content.find((part) => part.type === "text")?.text ?? "";
        try { return JSON.parse(text); } catch {
            if (text.startsWith("No ")) return {};
            throw new Error("Unexpected response shape");
        }
    } catch {
        failures++;
        console.log(JSON.stringify({ tool: name, inputs: redactedArgs, outcome: "transport-or-format-error", response: "omitted" }));
        return undefined;
    }
}
async function pages(tool, field, sizeArgs) {
    const first = await call(tool, sizeArgs);
    if (!first) return undefined;
    check(Array.isArray(first[field]), `${tool}: array response`);
    const size = Number(sizeArgs.maxResults ?? sizeArgs.pageSize);
    check(first[field]?.length <= size, `${tool}: requested page limit`);
    record(tool, sizeArgs, first, field, ["requested page limit"]);
    if (first.pageToken) {
        const args = { ...sizeArgs, pageToken: first.pageToken };
        const safe = { ...sizeArgs, pageToken: "<previous response>" };
        const second = await call(tool, args, safe);
        if (second) {
            check(second[field]?.length <= size, `${tool}: next page limit`);
            const previousIds = new Set(first[field].map((item) => item.id));
            check(second[field]?.every((item) => !previousIds.has(item.id)), `${tool}: disjoint page IDs`);
            record(tool, safe, second, field, ["requested page limit", "disjoint page IDs"]);
        }
    } else {
        console.log(JSON.stringify({ tool, coverageGap: "No cursor returned; next page not exercised" }));
    }
    return first;
}
async function localFilter(tool, field, first, sizeArgs, key, valueKey) {
    if (!first) return;
    const item = first[field]?.find((entry) => typeof entry[valueKey] === "string" && entry[valueKey].length);
    if (item) {
        const args = { ...sizeArgs, [key]: item[valueKey].toUpperCase() };
        const safe = { ...sizeArgs, [key]: "<value from previous page>" };
        const filtered = await call(tool, args, safe);
        if (filtered) {
            const expected = first[field].filter((entry) => entry[valueKey]?.toLowerCase().includes(item[valueKey].toLowerCase()));
            check(JSON.stringify(filtered[field].map((entry) => entry.id)) === JSON.stringify(expected.map((entry) => entry.id)), `${tool}: case-insensitive page match`);
            check(filtered.pageToken === first.pageToken && filtered.rowCount === first.rowCount, `${tool}: cursor and rowCount preserved`);
            record(tool, safe, filtered, field, ["case-insensitive page match", "cursor and rowCount preserved"]);
        }
    }
    const absent = "mcp-read-validation-no-match-9e0b27c5";
    const filtered = await call(tool, { ...sizeArgs, [key]: absent });
    if (filtered) {
        check(filtered[field]?.length === 0, `${tool}: empty match`);
        check(filtered.pageToken === first.pageToken && filtered.rowCount === first.rowCount, `${tool}: empty match preserves cursor and rowCount`);
        record(tool, { ...sizeArgs, [key]: absent }, filtered, field, ["empty match", "cursor and rowCount preserved"]);
    }
}
try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], cwd: tmpdir(),
        env: { PATH: process.env.PATH ?? "", DOIT_API_KEY: process.env.DOIT_OWN_CUSTOMER_API_KEY, DOIT_DEBUG_LEVEL: "0" }, stderr: "ignore" }));
    const tickets = await pages("list_tickets", "tickets", { pageSize: 1 });
    const largerTickets = await call("list_tickets", { pageSize: 3 });
    if (largerTickets) {
        check(largerTickets.tickets?.length <= 3, "list_tickets: pageSize 3 cap");
        record("list_tickets", { pageSize: 3 }, largerTickets, "tickets", ["requested page limit"]);
    }
    await localFilter("list_tickets", "tickets", tickets, { pageSize: 1 }, "subject", "subject");

    const assets = await pages("list_assets", "assets", { maxResults: "2" });
    await localFilter("list_assets", "assets", assets, { maxResults: "2" }, "name", "name");
    const asset = assets?.assets?.[0];
    if (asset) {
        const detailed = await call("get_asset", { id: asset.id }, { id: "<previous response>" });
        if (detailed) {
            check(detailed.id === asset.id, "get_asset: requested ID returned");
            record("get_asset", { id: "<previous response>" }, detailed, undefined, ["requested ID returned"]);
        }
        for (const types of [[asset.type], [...new Set([asset.type, "g-suite", "office-365"])]]) {
            const filter = types.map((type) => `type:${type}`).join("|");
            const filtered = await call("list_assets", { maxResults: "2", filter });
            if (filtered) {
                check(filtered.assets?.every((entry) => types.includes(entry.type)), "list_assets: type filter matches exact OR values");
                record("list_assets", { maxResults: "2", filter }, filtered, "assets", ["exact type values", ...(types.length > 1 ? ["repeated type accepted"] : [])]);
            }
        }
    }
    const platforms = await call("list_platforms", {});
    if (platforms) {
        for (const platform of platforms.platforms ?? []) {
            check(CreateTicketArgumentsSchema.safeParse({ ticket: { body: "synthetic", subject: "synthetic", severity: "normal", product: "synthetic", platform: platform.id } }).success,
                "create_ticket schema: support catalog platform accepted (no creation)");
        }
        record("list_platforms", {}, platforms, "platforms", ["catalog IDs accepted by create_ticket schema without created"]);
    }
    for (const platform of [undefined, "google_cloud_platform", "finance___billing", "credits___request"]) {
        const args = platform ? { platform } : {};
        const products = await call("list_products", args);
        if (products) {
            check(products.products?.every((product) => product.visibility !== "private"), "list_products: private products excluded");
            if (platform) check(products.products?.every((product) => product.platform === platform), "list_products: platform filter matches");
            record("list_products", args, products, "products", ["private products excluded", ...(platform ? ["platform filter matches"] : [])]);
        }
    }
    const roles = await call("list_roles", {});
    if (roles) record("list_roles", {}, roles, "roles", ["role catalog returned"]);
    const users = await call("list_users", {});
    if (users) {
        const roleIds = new Set(roles?.roles?.map((role) => role.id));
        check(users.users?.every((user) => typeof user.roleId === "string"), "list_users: roleId returned");
        if (roles) check(users.users?.every((user) => roleIds.has(user.roleId)), "list_users: roleId resolves via list_roles");
        record("list_users", {}, users, "users", ["roleId returned", ...(roles ? ["roleId resolves via list_roles"] : [])]);
        console.log(JSON.stringify({ tool: "list_users", pendingInvitesPresent: users.users?.some((user) => user.status === "invited") }));
    }
    for (const [tool, field] of [["list_organizations", "organizations"], ["list_account_team", "accountManagers"], ["list_invoices", "invoices"]]) {
        const data = await call(tool, {});
        if (data) record(tool, {}, data, field, ["bounded single response"]);
    }
    const commitments = await pages("list_commitments", "commitments", { maxResults: "2" });
    for (const filter of ["provider:google-cloud", "cloudProvider:google-cloud", "provider:amazon-web-services", "provider:microsoft-azure"]) {
        const data = await call("list_commitments", { maxResults: "2", filter });
        if (data) {
            check(data.commitments?.every((commitment) => commitment.cloudProvider === filter.split(":")[1]), "list_commitments: exact provider filter");
            record("list_commitments", { maxResults: "2", filter }, data, "commitments", ["provider filter accepted", ...(data.commitments?.length ? ["exact provider values"] : [])]);
            if (!data.commitments?.length) console.log(JSON.stringify({ tool: "list_commitments", coverageGap: "Empty result; positive provider matching not exercised" }));
        }
    }
    const commitment = commitments?.commitments?.[0];
    if (commitment) {
        const data = await call("get_commitment", { id: commitment.id }, { id: "<previous response>" });
        if (data) {
            check(data.id === commitment.id, "get_commitment: requested ID returned");
            record("get_commitment", { id: "<previous response>" }, data, undefined, ["requested ID returned"]);
        }
    } else console.log(JSON.stringify({ tool: "get_commitment", coverageGap: "No commitment available; detail read not exercised" }));
} catch {
    failures++;
    console.log(JSON.stringify({ outcome: "harness-error", details: "omitted" }));
} finally {
    await client.close();
}
console.log(JSON.stringify({ calls, failures, writes: 0, cleanup: "No resources created", hostedOAuth: "Not exercised" }));
process.exitCode = failures ? 1 : 0;
