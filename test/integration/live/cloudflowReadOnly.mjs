// Explicitly opt-in: node test/integration/live/cloudflowReadOnly.mjs after yarn build.
// The key stays in the child environment. Only semantic assertions/counts are printed.
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const key = process.env.DOIT_OWN_CUSTOMER_API_KEY;
if (!key) throw new Error("DOIT_OWN_CUSTOMER_API_KEY is unavailable");
const client = new Client({ name: "cloudflow-read-only-validation", version: "1.0.0" });
const calls = [];
try {
    await client.connect(
        new StdioClientTransport({
            command: process.execPath,
            args: [fileURLToPath(new URL("../../../dist/index.js", import.meta.url))],
            cwd: tmpdir(),
            stderr: "ignore",
            env: { DOIT_API_KEY: key, CUSTOMER_CONTEXT: "" },
        })
    );
    const { tools } = await client.listTools();
    const create = tools.find((t) => t.name === "create_cloudflow_connection");
    const update = tools.find((t) => t.name === "update_cloudflow_connection");
    assert(create?.inputSchema.required.includes("idempotencyKey"));
    assert(update?.inputSchema.required.includes("ifMatch"));
    assert(tools.find((t) => t.name === "test_run_cloudflow_flow")?.description.includes("executes real actions"));
    calls.push({ operation: "tools/list", assertions: ["create requires idempotencyKey", "update requires ifMatch", "draft execution warning delivered"] });

    async function call(name, args, redactedInputs = args) {
        const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 45_000 });
        // Never print API error text or raw data; it may contain customer information.
        calls.push({ operation: name, inputs: redactedInputs, isError: result.isError === true });
        if (result.isError) return undefined;
        const text = result.content.find((c) => c.type === "text")?.text;
        return JSON.parse(text);
    }

    const user = await call("validate_user", {});
    if (user) {
        assert.equal(typeof user.email, "string");
        assert.equal(typeof user.domain, "string");
        calls.at(-1).assertions = ["authenticated email and scoped domain returned; values redacted"];
    }
    for (const [name, detail, idField, argName] of [
        ["list_cloudflow_connections", "get_cloudflow_connection", "connectionId", "connectionId"],
        ["list_cloudflow_templates", "get_cloudflow_template", "id", "templateId"],
        ["list_cloudflows", undefined, "id", undefined],
    ]) {
        const page = await call(name, { maxResults: "1" });
        if (!page) continue;
        assert(Array.isArray(page.items));
        assert(page.items.length <= 1);
        assert(page.pageToken === null || typeof page.pageToken === "string");
        calls.at(-1).assertions = ["items array, at most one result, nullable pageToken"];
        calls.at(-1).rowCount = page.items.length;
        calls.at(-1).hasNextPage = Boolean(page.pageToken);
        if (detail && page.items[0]?.[idField]) {
            const item = await call(detail, { [argName]: page.items[0][idField] }, { [argName]: "[redacted ID from first page]" });
            if (item) {
                assert(item[idField] === page.items[0][idField], "Returned ID must match the first-page result");
                calls.at(-1).assertions = ["returned ID matches bounded list result"];
                if (detail === "get_cloudflow_connection") {
                    assert(typeof item.etag === "string" && /^(?:W\/)?".+"$/.test(item.etag), "Connection must return a quoted etag");
                    calls.at(-1).assertions.push("quoted connection etag is available for update");
                }
            }
        }
        if (page.pageToken) {
            const next = await call(name, { maxResults: "1", pageToken: page.pageToken }, { maxResults: "1", pageToken: "[redacted cursor]" });
            if (next) {
                assert(Array.isArray(next.items));
                assert(next.items.length <= 1);
                calls.at(-1).assertions = ["next cursor accepted; bounded items returned"];
            }
        }
    }
    console.log(JSON.stringify({ transport: "built local stdio tools/call", context: "fresh personal-key session, no customer switch", writes: 0, calls }, null, 2));
} finally {
    await client.close();
}
