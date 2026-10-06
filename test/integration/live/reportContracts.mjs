import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Explicitly opt-in; outside the deterministic Vitest include patterns. No automatic write confirmation.
if (process.env.DOIT_LIVE_REPORT_CONTRACTS !== "1" || !process.env.DOIT_OWN_CUSTOMER_API_KEY) {
    throw new Error("Requires DOIT_LIVE_REPORT_CONTRACTS=1 and DOIT_OWN_CUSTOMER_API_KEY in the environment.");
}
const writes = process.argv.includes("--disposable-report");
const client = new Client({ name: "report-contract-validation", version: "1.0.0" });
const serverEntry = fileURLToPath(new URL("../../../dist/index.js", import.meta.url));
const runId = randomUUID();
const journal = join(tmpdir(), `report-contract-${runId}.json`);
let createdId;
let createdName;
let callCount = 0;
let phase = "connect";
const evidence = [];
const check = (condition, message) => {
    if (!condition) throw new Error(message);
};
const record = (assertion, details = {}) => {
    const entry = { assertion, ...details };
    evidence.push(entry);
    console.log(JSON.stringify(entry));
};
const persist = (status) => {
    writeFileSync(journal, JSON.stringify({ status, createdId, createdName, evidence }), { mode: 0o600 });
};
const parse = (result, name) => {
    check(!result.isError, `${name} returned a tool error (response withheld)`);
    const text = result.content?.find((item) => item.type === "text")?.text;
    check(text, `${name} returned no text`);
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`${name} returned non-JSON text (withheld)`);
    }
    return data;
};
async function request(name, args) {
    check(++callCount <= 24, "Live call budget exceeded");
    phase = name;
    return client.callTool({ name, arguments: args }, undefined, { timeout: 150_000 });
}
async function call(name, args) {
    const data = parse(await request(name, args), name);
    check(data.status !== "approval_required", `${name} unexpectedly requires approval; no automatic confirmation`);
    return data;
}
const isoDay = (date) => date.toISOString().slice(0, 10);
const now = new Date();
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const priorStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const priorSecond = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 2));
const dates = { from: `${isoDay(priorStart)}T00:00:00Z`, to: `${isoDay(priorSecond)}T23:59:59Z` };
const group = [
    {
        id: "cloud_provider",
        type: "fixed",
        limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 },
    },
];
const base = { dataSource: "billing", metrics: [{ type: "basic", value: "cost" }], group };
function days(result) {
    const indexes = ["year", "month", "day"].map((name) => result.columns.findIndex((col) => col.name === name));
    check(
        indexes.every((index) => index >= 0),
        "Expected year/month/day columns"
    );
    return [
        ...new Set(
            result.rows.map((row) =>
                indexes.map((index, part) => String(row[index]).padStart(part === 0 ? 4 : 2, "0")).join("-")
            )
        ),
    ].sort();
}
function equalResults(left, right) {
    if (JSON.stringify(left.columns) !== JSON.stringify(right.columns) || left.rows.length !== right.rows.length)
        return false;
    const floatColumn = (index) => left.columns[index].type === "float";
    const key = (row) => JSON.stringify(row.filter((_, index) => !floatColumn(index)));
    const leftRows = [...left.rows].sort((a, b) => key(a).localeCompare(key(b)));
    const rightRows = [...right.rows].sort((a, b) => key(a).localeCompare(key(b)));
    return leftRows.every((row, rowIndex) =>
        row.every((value, colIndex) => {
            const other = rightRows[rowIndex][colIndex];
            if (value === other) return true;
            // Parallel BigQuery aggregates can differ at machine precision; identifiers/dates remain exact.
            return (
                floatColumn(colIndex) &&
                typeof value === "number" &&
                typeof other === "number" &&
                Math.abs(value - other) <= 1e-9 * Math.max(1, Math.abs(value), Math.abs(other))
            );
        })
    );
}
function verifyDaily(result, from, to) {
    check(result.rows.length > 0, "Date assertion requires non-empty live results");
    const returnedDays = days(result);
    check(
        returnedDays.every((day) => day >= from && day <= to),
        "Returned dates escaped requested range"
    );
    return returnedDays;
}
await client.connect(
    new StdioClientTransport({
        command: process.execPath,
        args: [serverEntry],
        cwd: tmpdir(),
        env: { DOIT_API_KEY: process.env.DOIT_OWN_CUSTOMER_API_KEY },
        stderr: "ignore",
    })
);
try {
    const dimension = await call("get_dimension", { type: "fixed", id: "cloud_provider" });
    check(dimension.id === "cloud_provider" && dimension.type === "fixed", "Dimension identity mismatch");
    const provider =
        dimension.values?.find((item) => item.value === "google-cloud")?.value ?? dimension.values?.[0]?.value;
    check(provider, "No provider available for bounded validation");
    const filters = [{ id: "cloud_provider", type: "fixed", values: [provider] }];
    const config = { ...base, filters, timeInterval: "day", timeRange: { mode: "custom" }, customTimeRange: dates };
    const custom = await call("run_query", { config });
    const actualDays = verifyDaily(custom, isoDay(priorStart), isoDay(priorSecond));
    check(actualDays.length === 2, "Expected both requested calendar days in this account");
    check(
        custom.rows.every((row) => row[custom.columns.findIndex((col) => col.name === "cloud_provider")] === provider),
        "Omitted mode did not restrict provider"
    );
    record("custom dates and omitted filter mode: exact two requested days and provider only", {
        input: { config },
        rowCount: custom.rowCount,
        returnedDays: actualDays,
    });
    const explicitMode = await call("run_query", { config: { ...config, filters: [{ ...filters[0], mode: "is" }] } });
    check(equalResults(custom, explicitMode), "Omitted mode differs from explicit is");
    record("omitted filter mode equals explicit is", { rowCount: explicitMode.rowCount });

    const compare = await call("compare_spend", {
        period1Months: 2,
        period2: dates,
        cloud: provider,
        groupBy: "cloud",
    });
    const firstDates = { from: dates.from, to: `${isoDay(now)}T23:59:59Z` };
    const monthly = { ...base, filters, timeInterval: "month", timeRange: { mode: "custom" } };
    const first = await call("run_query", { config: { ...monthly, customTimeRange: firstDates } });
    const second = await call("run_query", { config: { ...monthly, customTimeRange: dates } });
    check(equalResults(compare.period1, first), "Period 1 differs from explicit previous-month-start through today");
    check(equalResults(compare.period2, second), "Period 2 differs from the requested explicit dates");
    const firstDaily = await call("run_query", { config: { ...config, customTimeRange: firstDates } });
    const firstDays = verifyDaily(firstDaily, isoDay(priorStart), isoDay(now));
    check(firstDays[0] === isoDay(priorStart), "Period 1 did not begin at the prior calendar month start");
    check(
        firstDays.some((day) => day >= isoDay(monthStart)),
        "Period 1 is missing the current partial month"
    );
    record("compare_spend periods match explicit monthly queries; daily checks establish date bounds", {
        input: { period1Months: 2, period2: dates, groupBy: "cloud", cloud: provider },
        period1: {
            from: firstDates.from,
            through: firstDates.to,
            rowCount: first.rowCount,
            firstReturnedDay: firstDays[0],
            lastReturnedDay: firstDays.at(-1),
        },
        period2: { rowCount: second.rowCount, returnedDays: actualDays },
        computedDiff: false,
    });

    if (writes) {
        createdName = `MCP report contract validation ${runId}`;
        persist("creation-attempted-once");
        const created = await call("create_report", {
            name: createdName,
            config: { ...config, dimensions: [{ id: "cloud_provider", type: "fixed" }] },
        });
        check(
            typeof created.id === "string" && created.id.length > 0,
            "Create did not return a report ID; resolve unique name from local journal before cleanup"
        );
        createdId = created.id;
        persist("created");
        const saved = await call("get_report_config", { id: createdId });
        check(saved.name === createdName || saved.reportName === createdName, "Saved report name mismatch");
        check(
            saved.config.timeRange.mode === "custom" && !saved.config.timeRange.unit,
            "Saved custom mode/unit mismatch"
        );
        check(
            Date.parse(saved.config.customTimeRange.from) === Date.parse(dates.from) &&
                Date.parse(saved.config.customTimeRange.to) === Date.parse(dates.to),
            "Create did not persist requested dates"
        );
        check(
            saved.config.filters.some((filter) => filter.id === "cloud_provider" && filter.values.includes(provider)),
            "Create did not persist omitted-mode filter"
        );
        record("disposable create/read-back preserves custom dates, mode and omitted-mode filter", {
            resource: "session-created report; id/name withheld",
        });
        const updatedDates = { from: `${isoDay(priorSecond)}T00:00:00Z`, to: dates.to };
        await call("update_report", {
            id: createdId,
            config: {
                timeRange: { mode: "custom" },
                customTimeRange: updatedDates,
                timeInterval: "day",
                filters: [],
                group: [],
            },
            labels: [],
        });
        const updated = await call("get_report_config", { id: createdId });
        check(
            Date.parse(updated.config.customTimeRange.from) === Date.parse(updatedDates.from) &&
                Date.parse(updated.config.customTimeRange.to) === Date.parse(updatedDates.to),
            "Update did not persist requested dates"
        );
        check(
            (updated.config.filters?.length ?? 0) === 0 && (updated.config.group?.length ?? 0) === 0,
            "Empty arrays did not clear filters/groups"
        );
        check(
            ["billing", "billing-datahub"].includes(updated.config.dataSource),
            "Missing dataSource did not resolve to billing default"
        );
        check(
            updated.config.dimensions.map((dimension) => `${dimension.type}:${dimension.id}`).join(",") ===
                "datetime:year,datetime:month,datetime:day",
            "timeInterval did not reset columns"
        );
        await call("update_report", {
            id: createdId,
            config: { dataSource: updated.config.dataSource, customTimeRange: dates },
        });
        const dateOnlyUpdate = await call("get_report_config", { id: createdId });
        check(
            dateOnlyUpdate.config.timeRange.mode === "custom" &&
                Date.parse(dateOnlyUpdate.config.customTimeRange.from) === Date.parse(dates.from),
            "Date-only update failed to preserve saved custom mode"
        );
        record("date-only update preserves saved custom mode", { dates });
        const savedResults = await call("get_report_results", { id: createdId });
        check(savedResults.result, "Saved report returned no result");
        const savedDays = verifyDaily(
            { columns: savedResults.result.schema, rows: savedResults.result.rows },
            isoDay(priorStart),
            isoDay(priorSecond)
        );
        record(
            "disposable update/read-back replaces arrays, resets columns/source and saved results use updated range",
            { sourceBefore: saved.config.dataSource, sourceAfter: updated.config.dataSource, returnedDays: savedDays }
        );
    }
} catch (error) {
    console.error(
        JSON.stringify({
            status: "failed",
            phase,
            reason: error instanceof Error ? error.message : "Unknown failure",
            rawResponsesWithheld: true,
        })
    );
    process.exitCode = 1;
} finally {
    if (createdId) {
        try {
            phase = "cleanup";
            const deletion = parse(await request("delete_report", { id: createdId }), "delete_report");
            if (deletion.status === "approval_required") {
                check(
                    typeof deletion.summary === "string" &&
                        deletion.summary.includes(`DELETE /analytics/v1/reports/${createdId}.`),
                    "Cleanup approval names unexpected report"
                );
                check(typeof deletion.approvalToken === "string", "Cleanup approval missing token");
                parse(await request("confirm_action", { token: deletion.approvalToken }), "confirm_action");
            }
            // Exact-name lookup verifies absence without exposing other reports.
            const absence = await request("list_reports", { filter: `reportName:${createdName}` });
            check(
                absence.isError && absence.content?.some((item) => item.text === "No reports found"),
                "Cleanup absence verification failed"
            );
            record("disposable report deleted and exact-name lookup confirms absence");
            persist("deleted-and-verified");
        } catch {
            console.error(JSON.stringify({ status: "cleanup-needs-attention", journal, rawResponsesWithheld: true }));
            persist("cleanup-needs-attention");
            process.exitCode = 1;
        }
    }
    await client.close();
    record("live run complete", { callCount, writes, status: process.exitCode ? "failed" : "passed" });
}
