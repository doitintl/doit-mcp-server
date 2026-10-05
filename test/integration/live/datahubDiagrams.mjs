import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
// Explicitly opt-in: run after yarn build and installing test/integration dependencies.
// This script performs bounded reads only. It never calls find_cloud_diagrams or ingests events.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const key = process.env.DOIT_OWN_CUSTOMER_API_KEY;
if (!key) {
    console.log(JSON.stringify({ status: "unavailable", reason: "DOIT_OWN_CUSTOMER_API_KEY missing" }));
    process.exit(1);
}
const client = new Client({ name: "bounded-contract-validation", version: "1.0.0" });
const transport = new StdioClientTransport({
    command: process.execPath,
    args: [`${root}dist/index.js`],
    cwd: tmpdir(),
    stderr: "ignore",
    env: { PATH: process.env.PATH, DOIT_API_KEY: key, DEBUG: "0" },
});
await client.connect(transport);
async function call(name, args) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) return { ok: false };
    try {
        return { ok: true, data: JSON.parse(result.content.find((c) => c.type === "text")?.text ?? "") };
    } catch {
        return { ok: false };
    }
}
try {
    const list = await client.listTools();
    const find = list.tools.find((t) => t.name === "find_cloud_diagrams");
    assert.equal(find.annotations.readOnlyHint, false);
    console.log(JSON.stringify({ check: "built MCP metadata", findReadOnly: false }));
    const discovery = await call("get_cloud_diagram_components", {});
    console.log(
        JSON.stringify({
            check: "diagram discovery",
            ok: discovery.ok,
            diagramCount: Object.keys(discovery.data?.scheme ?? {}).length,
            hasComponentData: !!discovery.data?.statussheet,
        })
    );
    if (discovery.ok) {
        assert(discovery.data.statussheet === undefined, "Discovery must omit component data");
        const scheme = Object.values(discovery.data.scheme ?? {}).find((s) => s.statussheet?.length);
        if (scheme) {
            const sheet = scheme.statussheet[0];
            const layerId = sheet.ssid ?? sheet._id;
            const selected = await call("get_cloud_diagram_components", {
                scheme_ids: [scheme._id],
                include_components: false,
            });
            if (selected.ok)
                assert(
                    Object.keys(selected.data.scheme ?? {}).length === 1 && !!selected.data.scheme[scheme._id],
                    "Diagram filter must select only the requested diagram"
                );
            console.log(
                JSON.stringify({
                    check: "diagram filter",
                    input: { scheme_ids: "[redacted existing ID]", include_components: false },
                    ok: selected.ok,
                    onlyRequestedDiagram: selected.ok,
                })
            );
            for (const include_components of [false, true]) {
                const r = await call("get_cloud_diagram_components", { layer_ids: [layerId], include_components });
                if (r.ok) {
                    assert(
                        Object.keys(r.data.statussheet ?? {}).length === 1 && !!r.data.statussheet[layerId],
                        "Layer filter must select only the requested layer"
                    );
                    if (!include_components)
                        assert(r.data.statussheet[layerId].node === undefined, "Components must be omitted when false");
                }
                console.log(
                    JSON.stringify({
                        check: "layer component read",
                        input: { layer_ids: "[redacted existing ID]", include_components },
                        ok: r.ok,
                        onlyRequestedLayer: r.ok,
                        componentMaps: r.ok
                            ? Object.keys(r.data.statussheet[layerId]).filter((k) => k !== "statussheet")
                            : [],
                    })
                );
            }
            const activity = await call("list_cloud_diagram_activity_groups", { ss_id: layerId, limit: 1 });
            console.log(
                JSON.stringify({
                    check: "bounded activity read",
                    input: { ss_id: "[redacted existing ID]", limit: 1 },
                    ok: activity.ok,
                    count: Array.isArray(activity.data) ? activity.data.length : undefined,
                })
            );
        } else
            console.log(
                JSON.stringify({
                    check: "filtered diagram coverage",
                    status: "unavailable",
                    reason: "no accessible diagram with a layer",
                })
            );
    }
    const datasets = await call("list_datahub_datasets", {});
    const entries = Array.isArray(datasets.data) ? datasets.data : (datasets.data?.datasets ?? []);
    console.log(
        JSON.stringify({
            check: "DataHub discovery",
            ok: datasets.ok,
            datasetCount: entries.length,
            topLevelKeys: datasets.ok && !Array.isArray(datasets.data) ? Object.keys(datasets.data) : undefined,
        })
    );
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 365);
    const base = { format: "jsonl", startTime: start.toISOString(), endTime: now.toISOString(), maxResults: 1 };
    let advanced = false;
    for (const entry of entries.slice(0, 4)) {
        const name = typeof entry === "string" ? entry : entry.name;
        if (!name) continue;
        const first = await call("export_datahub_dataset_records", { ...base, name });
        console.log(
            JSON.stringify({
                check: "DataHub export page 1",
                input: { ...base, name: "[redacted existing dataset]" },
                ok: first.ok,
                bodyBytes: first.ok ? Buffer.byteLength(first.data.data) : undefined,
                hasNext: first.ok ? !!first.data.pageToken : undefined,
            })
        );
        if (first.ok && first.data.pageToken) {
            const next = await call("export_datahub_dataset_records", {
                ...base,
                name,
                pageToken: first.data.pageToken,
            });
            if (next.ok) {
                assert(next.data.data !== first.data.data, "Records must advance");
                assert(next.data.pageToken !== first.data.pageToken, "Cursor must advance");
                let a, b;
                try {
                    a = first.data.data
                        .trim()
                        .split("\n")
                        .filter(Boolean)
                        .map((x) => JSON.parse(x));
                    b = next.data.data
                        .trim()
                        .split("\n")
                        .filter(Boolean)
                        .map((x) => JSON.parse(x));
                } catch {
                    throw new Error("Export must contain valid JSONL");
                }
                assert(a.length === 1 && b.length === 1);
                assert(a[0]?.id !== b[0]?.id, "Event IDs must differ across pages");
                advanced = true;
            }
            console.log(
                JSON.stringify({
                    check: "DataHub export page 2",
                    input: { pageToken: "[redacted opaque cursor]", maxResults: 1 },
                    ok: next.ok,
                    cursorAdvanced: next.ok,
                    recordsDiffer: next.ok,
                    rowCount: next.ok ? next.data.data.trim().split("\n").filter(Boolean).length : undefined,
                    hasNext: next.ok ? !!next.data.pageToken : undefined,
                })
            );
            break;
        }
    }
    if (!advanced)
        console.log(
            JSON.stringify({
                check: "live export pagination",
                status: "unavailable",
                reason: "no suitable dataset yielded a cursor within bounded reads",
            })
        );
} finally {
    await client.close();
}
