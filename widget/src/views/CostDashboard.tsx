import { useRef, useEffect, useMemo, useState } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { ViewProps } from "../router";
import { Layout } from "../components/Layout";
import { GenericTable } from "./GenericTable";

interface SchemaField { name: string; type: string; }

// ── Type helpers ──────────────────────────────────────────────────────────────

/** Prefer TIMESTAMP/DATETIME typed column; fall back to date-like names (excluding year/month/day fragments). */
function findTimeColIdx(schema: SchemaField[]): number {
  let idx = schema.findIndex(f => {
    const t = f.type.toUpperCase();
    return t.includes("TIMESTAMP") || t.includes("DATETIME");
  });
  if (idx >= 0) return idx;
  return schema.findIndex(f => {
    const n = f.name.toLowerCase();
    return n === "date" || n === "week" || n === "time_interval" ||
      n.endsWith("_date") || n.endsWith("_time");
  });
}

function isNumericField(f: SchemaField): boolean {
  const t = f.type.toUpperCase();
  return t.includes("FLOAT") || t.includes("INT") || t.includes("NUMERIC") ||
    t.includes("DECIMAL") || t.includes("CURRENCY") || t.includes("NUMBER");
}

function isDateLikeName(f: SchemaField): boolean {
  const n = f.name.toLowerCase();
  return n === "year" || n === "month" || n === "day" || n === "week" ||
    n === "date" || n === "time_interval" || n.endsWith("_date") || n.endsWith("_time");
}

function parseToUnixSec(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val > 1e10 ? val / 1000 : val;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d.getTime() / 1000;
}

function formatAxisDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
}

function formatCost(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

// ── Pivot ─────────────────────────────────────────────────────────────────────

const MAX_SERIES = 8;
const PALETTE = ["#4285F4","#EA4335","#FBBC05","#34A853","#FF6D00","#AB47BC","#00BCD4","#F06292"];

interface PivotResult {
  xValues: number[];
  seriesData: { name: string; values: number[] }[];
}

function pivotRows(rows: unknown[][], timeIdx: number, groupIdx: number, metricIdx: number): PivotResult {
  const parsedX = rows.map(r => parseToUnixSec(r[timeIdx]) ?? 0);

  // Unique sorted X values
  const xSet = Array.from(new Set(parsedX)).sort((a, b) => a - b);
  const xIndex = new Map(xSet.map((v, i) => [v, i]));

  // Group totals → top N series
  const totals = new Map<string, number>();
  rows.forEach(r => {
    const g = String(r[groupIdx] ?? "");
    const v = Number(r[metricIdx]);
    totals.set(g, (totals.get(g) ?? 0) + (isNaN(v) ? 0 : v));
  });
  const topGroups = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERIES)
    .map(([g]) => g);

  const lookup = new Map(topGroups.map(g => [g, new Array(xSet.length).fill(0)]));
  rows.forEach((r, ri) => {
    const g = String(r[groupIdx] ?? "");
    if (!lookup.has(g)) return;
    const v = Number(r[metricIdx]);
    if (isNaN(v)) return;
    const xi = xIndex.get(parsedX[ri]);
    if (xi === undefined) return;
    lookup.get(g)![xi] += v;
  });

  return { xValues: xSet, seriesData: topGroups.map(g => ({ name: g, values: lookup.get(g)! })) };
}

// ── CostDashboard ─────────────────────────────────────────────────────────────

export function CostDashboard({ data, meta }: ViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const schema   = data.columns as SchemaField[] | undefined;
  const rows     = data.rows    as Array<Array<unknown>> | undefined;
  const rowCount = data.rowCount as number | undefined;

  const timeIdx   = schema ? findTimeColIdx(schema) : -1;
  const metricIdx = schema ? schema.findIndex(isNumericField) : -1;

  // Group column: first string column that is not numeric, not date-like, not the time column
  const groupIdx = schema ? schema.findIndex((f, i) =>
    i !== timeIdx && !isNumericField(f) && !isDateLikeName(f) &&
    !f.type.toUpperCase().includes("TIMESTAMP") && !f.type.toUpperCase().includes("DATETIME")
  ) : -1;

  const hasChart = timeIdx >= 0 && metricIdx >= 0 && Array.isArray(rows) && rows.length >= 2;
  const isPivoted = groupIdx >= 0;

  const pivot = useMemo<PivotResult | null>(() => {
    if (!hasChart || !isPivoted || !rows) return null;
    return pivotRows(rows, timeIdx, groupIdx, metricIdx);
  }, [hasChart, isPivoted, rows, timeIdx, groupIdx, metricIdx]);

  // Build uplot data
  const uplotData = useMemo<uPlot.AlignedData | null>(() => {
    if (!hasChart || !rows) return null;

    if (isPivoted && pivot) {
      // Stacked-area: cumulative sums
      const cum: number[][] = [];
      for (let i = 0; i < pivot.seriesData.length; i++) {
        cum.push(pivot.xValues.map((_, j) =>
          pivot.seriesData.slice(0, i + 1).reduce((s, sd) => s + sd.values[j], 0)
        ));
      }
      return [pivot.xValues, ...cum] as uPlot.AlignedData;
    }

    // Simple line: single cost series
    const sorted = [...rows].sort((a, b) =>
      (parseToUnixSec(a[timeIdx]) ?? 0) - (parseToUnixSec(b[timeIdx]) ?? 0)
    );
    const xSeries = sorted.map(r => parseToUnixSec(r[timeIdx]) ?? 0);
    const ySeries = sorted.map(r => { const v = Number(r[metricIdx]); return isNaN(v) ? null : v; });
    return [xSeries, ySeries] as uPlot.AlignedData;
  }, [hasChart, isPivoted, pivot, rows, timeIdx, metricIdx]);

  useEffect(() => {
    if (!chartRef.current || !uplotData || !hasChart) return;
    const w = Math.max((chartRef.current.offsetWidth || window.innerWidth) - 16, 280);

    const seriesLabels = isPivoted && pivot
      ? pivot.seriesData.map(s => s.name)
      : [schema?.find(isNumericField)?.name ?? "cost"];

    const bands = isPivoted && pivot
      ? pivot.seriesData.slice(1).map((_, i) => ({ series: [i + 2, i + 1] as [number, number] }))
      : undefined;

    const opts: uPlot.Options = {
      width: w, height: 160, padding: [8, 0, 0, 0],
      series: [
        {},
        ...seriesLabels.map((label, i) => ({
          label,
          stroke: PALETTE[i % PALETTE.length],
          fill: isPivoted
            ? `${PALETTE[i % PALETTE.length]}99`
            : `${PALETTE[i % PALETTE.length]}18`,
          width: isPivoted ? 0.5 : 1.5,
          points: { show: false },
        })),
      ],
      ...(bands ? { bands } : {}),
      axes: [
        { values: (_u, vals) => vals.map(v => formatAxisDate(v as number)), gap: 4, size: 28 },
        { values: (_u, vals) => vals.map(v => v !== null ? formatCost(v as number) : ""), gap: 4, size: 52 },
      ],
      legend: { show: false },
      cursor: { show: false },
    };

    const u = new uPlot(opts, uplotData, chartRef.current);
    return () => u.destroy();
  }, [uplotData]);

  if (!Array.isArray(rows) || !schema || schema.length === 0) {
    return <GenericTable data={data} meta={meta} />;
  }

  // Table columns: exclude timestamp
  const tableCols = schema.map((f, i) => ({ ...f, idx: i })).filter(f => f.name.toLowerCase() !== "timestamp");

  // Total cost across all rows
  const totalCost = rows.reduce((sum, r) => sum + (typeof r[metricIdx] === "number" ? (r[metricIdx] as number) : 0), 0);

  // Series labels for custom legend
  const seriesLabels = isPivoted && pivot
    ? pivot.seriesData.map(s => s.name)
    : (metricIdx >= 0 ? [schema[metricIdx].name] : []);

  return (
    <Layout>
      {/* Total cost sub-card */}
      <div style={{
        display: "inline-block",
        padding: "6px 12px",
        marginBottom: "12px",
        borderRadius: "8px",
        background: "var(--dci-bg-secondary, rgba(0,0,0,0.04))",
        border: "1px solid var(--dci-border)",
      }}>
        <span style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>Total </span>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dci-text)" }}>
          ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {hasChart && <div ref={chartRef} style={{ marginBottom: "6px" }} />}

      {/* Custom legend — shown below chart axis, no "--" values */}
      {isPivoted && seriesLabels.length > 1 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "4px 12px",
          padding: "4px 0 10px 52px", // align with chart's Y-axis offset
        }}>
          {seriesLabels.map((label, i) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", color: "var(--dci-text-secondary)" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "2px", flexShrink: 0, background: PALETTE[i % PALETTE.length] }} />
              {label}
            </span>
          ))}
        </div>
      )}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
          <button
            onClick={() => setTableOpen(o => !o)}
            style={{
              background: "none", border: "none", padding: "4px 0", cursor: "pointer",
              fontSize: "0.75rem", color: "var(--dci-text-secondary)",
              display: "flex", alignItems: "center", gap: "4px",
            }}
          >
            <span style={{ fontSize: "0.625rem" }}>{tableOpen ? "▾" : "▸"}</span>
            {tableOpen ? "Hide data" : "Show data"}
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>
            {rowCount ?? rows.length} rows
          </span>
        </div>

        {tableOpen && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr>
                  {tableCols.map(col => (
                    <th key={col.name} style={{
                      textAlign: "left", padding: "6px 8px",
                      borderBottom: "2px solid var(--dci-border)",
                      color: "var(--dci-text-secondary)", fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "var(--dci-bg-secondary)" }}>
                    {tableCols.map(col => (
                      <td key={col.name} style={{
                        padding: "6px 8px", borderBottom: "1px solid var(--dci-border)", color: "var(--dci-text)",
                      }}>
                        {isNumericField(col) && typeof row[col.idx] === "number"
                          ? `$${(row[col.idx] as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : String(row[col.idx] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length < (rowCount ?? 0) && (
              <p style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)", padding: "8px 0" }}>
                Showing {rows.length} of {rowCount} rows.
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
