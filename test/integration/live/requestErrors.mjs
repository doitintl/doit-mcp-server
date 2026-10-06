// Explicitly opt-in. Build at the root first, then run `yarn test:live:request-errors`
// from test/integration with DOIT_OWN_CUSTOMER_API_KEY already in the environment.
// Only bounded reads are sent; do not use the auto-confirming integration helper.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const key = process.env.DOIT_OWN_CUSTOMER_API_KEY;
if (!key) throw new Error("DOIT_OWN_CUSTOMER_API_KEY is required for this opt-in check.");
const entry = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));
assert.ok(existsSync(entry), "Build the local server before running this check.");
const client = new Client({ name: "request-error-validation", version: "1.0.0" });
const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    cwd: tmpdir(),
    env: { DOIT_API_KEY: key, DOIT_DEBUG_LEVEL: "3" },
    stderr: "pipe",
});
let stderr = "";
transport.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
const textOf = (result) => result.content?.find((item) => item.type === "text")?.text ?? "";
try {
    await client.connect(transport);
    const invalid = await client.callTool({ name: "list_labels", arguments: { maxResults: "1", filter: "invalid_read_filter:validation" } });
    const reason = textOf(invalid);
    assert.equal(invalid.isError, true, "Invalid filter must be an MCP tool error.");
    assert.ok(/^HTTP 400: /i.test(reason), "Invalid filter must preserve HTTP 400.");
    assert.ok(/filter/i.test(reason), "Invalid filter must preserve an actionable API filter reason.");
    assert.ok(!reason.includes(key), "The API key must never appear in a tool error.");
    // The invalid input is synthetic; no customer response data is printed.
    console.log(JSON.stringify({ tool: "list_labels", input: { maxResults: "1", filter: "invalid_read_filter:validation" }, isError: true, reason }));

    const success = await client.callTool({ name: "list_labels", arguments: { maxResults: "1" } });
    assert.ok(!success.isError, "The bounded successful read must remain successful.");
    const data = JSON.parse(textOf(success));
    assert.ok(Array.isArray(data.labels), "Successful read must return the labels collection.");
    assert.ok(data.labels.length <= 1, "Successful read must respect the requested bound.");
    assert.ok(stderr.includes("Sending DoiT API request"), "TRACE stderr must be captured for the log assertions.");
    assert.ok(!stderr.includes(key), "The API key must never appear on stderr.");
    for (const label of data.labels) {
        if (label.name) assert.ok(!stderr.includes(label.name), "Customer response data must not appear on stderr.");
    }
    console.log(JSON.stringify({ tool: "list_labels", input: { maxResults: "1" }, isError: false, assertions: ["labels array", "at most one item", "credential and response-data log checks passed"], customerData: "omitted" }));
} finally {
    await client.close();
}
