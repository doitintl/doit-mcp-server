// Explicit opt-in: RUN_DOIT_LIVE_READS=1 yarn node live/insightsAlertsReads.mjs
// Run from test/integration after building the local server. Reads only; no auto-confirmation.
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

if (process.env.RUN_DOIT_LIVE_READS !== "1" || !process.env.DOIT_OWN_CUSTOMER_API_KEY) {
    throw new Error("Set RUN_DOIT_LIVE_READS=1 and DOIT_OWN_CUSTOMER_API_KEY to opt in to customer reads.");
}
const client = new Client({ name: "bounded-read-validation", version: "1.0.0" });
const allowed = new Set([
    "list_optimization_recommendations",
    "get_insight",
    "get_insight_resources",
    "get_anomalies",
    "get_anomaly",
    "list_alerts",
    "get_alert",
    "list_budgets",
    "get_budget",
    "get_cloud_incidents",
    "get_cloud_incident",
]);
let calls = 0;
let failures = 0;
function record(tool, input, outcome) {
    console.log(JSON.stringify({ tool, input, ...outcome }));
}
async function read(name, args, redacted = args) {
    assert(allowed.has(name), "Only approved read tools may be called");
    assert(++calls <= 25, "Read budget exceeded");
    const result = await client.callTool({ name, arguments: args });
    let data;
    try {
        data = JSON.parse(result.content.find((part) => part.type === "text")?.text ?? "");
    } catch {
        record(name, redacted, {
            ok: false,
            limitation: "Tool returned a non-JSON response; customer content withheld",
        });
        failures++;
        return null;
    }
    if (result.isError || data.error) {
        record(name, redacted, { ok: false, limitation: "API/tool error; customer content withheld" });
        failures++;
        return null;
    }
    record(name, redacted, {
        ok: true,
        rowCount: data.rowCount,
        hasNextPage: Boolean(data.pageToken),
        fields: Object.keys(data),
    });
    return data;
}
function check(label, condition) {
    record("assertion", label, { passed: Boolean(condition) });
    if (!condition) failures++;
}
async function continuePage(name, args, data, field, redacted = args) {
    if (!data?.pageToken) {
        record(name, redacted, { limitation: "No next cursor available; continuation unverified live" });
        return;
    }
    const next = await read(
        name,
        { ...args, pageToken: data.pageToken },
        { ...redacted, pageToken: "<returned cursor>" }
    );
    if (next) {
        check(`${name}: continuation envelope`, Array.isArray(next[field]));
        if (data[field]?.length && next[field]?.length) {
            const identity = (row) =>
                row.id ??
                (row.resourceId ? `${row.resourceId}/${row.account}/${row.resultType}` : `${row.source}/${row.key}`);
            const previous = new Set(data[field].map(identity));
            check(
                `${name}: continuation advances`,
                next[field].some((row) => !previous.has(identity(row)))
            );
        }
    }
}
try {
    await client.connect(
        new StdioClientTransport({
            command: process.execPath,
            args: [fileURLToPath(new URL("../../../dist/index.js", import.meta.url))],
            cwd: tmpdir(),
            stderr: "ignore",
            env: { PATH: process.env.PATH ?? "", DOIT_API_KEY: process.env.DOIT_OWN_CUSTOMER_API_KEY },
        })
    );
    const insights = await read("list_optimization_recommendations", { maxResults: 2 });
    if (insights) {
        check(
            "recommendations bounded and provider/easyWin fields usable",
            insights.insights.length <= 2 &&
                insights.insights.every(
                    (r) =>
                        typeof r.provider === "string" &&
                        (r.easyWinDescription === null
                            ? r.easyWin === null
                            : r.easyWin === (r.easyWinDescription !== ""))
                )
        );
        await continuePage("list_optimization_recommendations", { maxResults: 2 }, insights, "insights");
        const item = insights.insights[0];
        if (item) {
            const identity = { source: item.source, key: item.key };
            const hiddenIdentity = { source: "<returned source>", key: "<returned key>" };
            const detail = await read("get_insight", identity, hiddenIdentity);
            if (detail)
                check("recommendation provider matches detail cloudProvider", item.provider === detail.cloudProvider);
            const resources = await read(
                "get_insight_resources",
                { ...identity, maxResults: 2 },
                { ...hiddenIdentity, maxResults: 2 }
            );
            if (resources) {
                check(
                    "resource envelope and bound",
                    Array.isArray(resources.resourceResults) &&
                        resources.resourceResults.length <= 2 &&
                        resources.rowCount === resources.resourceResults.length
                );
                await continuePage(
                    "get_insight_resources",
                    { ...identity, maxResults: 2 },
                    resources,
                    "resourceResults",
                    { ...hiddenIdentity, maxResults: 2 }
                );
            }
            const filtered = await read(
                "list_optimization_recommendations",
                { provider: item.provider, searchTerm: item.title, maxResults: 2 },
                { provider: "<returned provider>", searchTerm: "<returned title>", maxResults: 2 }
            );
            if (filtered)
                check(
                    "provider and title filters match",
                    filtered.insights.length > 0 &&
                        filtered.insights.every(
                            (r) =>
                                r.provider === item.provider && r.title.toLowerCase().includes(item.title.toLowerCase())
                        )
                );
        }
    }
    for (const easyWin of [true, false]) {
        const data = await read("list_optimization_recommendations", { easyWin, maxResults: 2 });
        if (data)
            check(
                `easyWin=${easyWin} excludes opposite values`,
                data.insights.every((r) => r.easyWin === easyWin)
            );
    }
    const categorized = await read("list_optimization_recommendations", { category: "FinOps", maxResults: 2 });
    if (categorized)
        check(
            "single category filter",
            categorized.insights.every((r) => r.categories.split(", ").includes("FinOps"))
        );
    const actionable = await read("list_optimization_recommendations", {
        displayStatus: ["actionable"],
        maxResults: 1,
    });
    if (actionable)
        check(
            "status filter",
            actionable.insights.every((r) => r.displayStatus === "actionable")
        );
    if (actionable?.insights[0]) {
        const item = actionable.insights[0];
        const args = { source: item.source, key: item.key, maxResults: 1 };
        const redacted = { source: "<actionable source>", key: "<actionable key>", maxResults: 1 };
        const resources = await read("get_insight_resources", args, redacted);
        if (resources) {
            check("actionable resource page bounded", resources.resourceResults.length <= 1);
            await continuePage("get_insight_resources", args, resources, "resourceResults", redacted);
        }
    }
    const anomalies = await read("get_anomalies", {});
    if (anomalies?.anomalies?.[0]?.id) {
        const detail = await read("get_anomaly", { id: anomalies.anomalies[0].id }, { id: "<returned anomaly id>" });
        if (detail)
            record("get_anomaly", "optional fields", {
                present: ["resourceData", "actualCost", "expectedMaxCost", "allocations"].filter(
                    (key) => key in detail
                ),
                absent: ["resourceData", "actualCost", "expectedMaxCost", "allocations"].filter(
                    (key) => !(key in detail)
                ),
            });
    }
    for (const [listTool, detailTool, field, nameField] of [
        ["list_alerts", "get_alert", "alerts", "name"],
        ["list_budgets", "get_budget", "budgets", "budgetName"],
    ]) {
        const data = await read(listTool, { maxResults: "2" });
        if (!data) continue;
        check(`${listTool}: bounded page`, Array.isArray(data[field]) && data[field].length <= 2);
        await continuePage(listTool, { maxResults: "2" }, data, field);
        const item = data[field]?.[0];
        if (item) {
            await read(detailTool, { id: item.id }, { id: "<returned id>" });
            const args =
                listTool === "list_budgets"
                    ? { name: item[nameField], maxResults: "1" }
                    : { filter: `name:${item[nameField]}`, maxResults: "1" };
            const filtered = await read(listTool, args, {
                [listTool === "list_budgets" ? "name" : "filter"]: "<returned name>",
                maxResults: "1",
            });
            if (filtered)
                check(
                    `${listTool}: name filter matches`,
                    filtered[field].length > 0 &&
                        filtered[field].every((r) =>
                            listTool === "list_budgets"
                                ? r[nameField].toLowerCase().includes(item[nameField].toLowerCase())
                                : r[nameField] === item[nameField]
                        )
                );
        }
    }
    const incidentArgs = { platform: "google-cloud", filter: "status:active" };
    const incidents = await read("get_cloud_incidents", incidentArgs);
    if (incidents) {
        check(
            "incident platform and status filter",
            incidents.incidents.every((i) => i.platform === "google-cloud" && i.status === "active")
        );
        await continuePage("get_cloud_incidents", incidentArgs, incidents, "incidents");
    }
    const archived = await read("get_cloud_incidents", {
        filter: "platform:google-cloud|platform:amazon-web-services|status:archived",
    });
    if (archived) {
        check(
            "incident repeated platform OR plus status AND",
            archived.incidents.every(
                (i) => ["google-cloud", "amazon-web-services"].includes(i.platform) && i.status === "archived"
            )
        );
        await continuePage(
            "get_cloud_incidents",
            { filter: "platform:google-cloud|platform:amazon-web-services|status:archived" },
            archived,
            "incidents"
        );
        if (archived.incidents[0])
            await read("get_cloud_incident", { id: archived.incidents[0].id }, { id: "<returned incident id>" });
    }
    record("validation", "summary", { calls, failures, writes: 0, cleanupRequired: false });
    process.exitCode = failures ? 1 : 0;
} finally {
    await client.close();
}
