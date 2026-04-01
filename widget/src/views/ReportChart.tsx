// widget/src/views/ReportChart.tsx
// Dynamic chart view for get_report_results. Analyses the schema at render time
// and picks the best visualisation type.

import { useRef, useEffect, useMemo, useState } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { ViewProps } from "../router";
import { Layout } from "../components/Layout";
import { GenericTable } from "./GenericTable";

// ── Schema helpers (shared with CostDashboard) ────────────────────────────────

interface SchemaField { name: string; type: string; }

function isDateType(f: SchemaField): boolean {
  const t = f.type.toUpperCase();
  return t.includes("DATE") || t.includes("TIME") || t.includes("TIMESTAMP");
}

function isDateLikeName(f: SchemaField): boolean {
  const n = f.name.toLowerCase();
  return (
    n === "month" || n === "week" || n === "day" || n === "year" ||
    n === "date" || n === "time_interval" || n.endsWith("_date") || n.endsWith("_time")
  );
}

function isNumericField(f: SchemaField): boolean {
  const t = f.type.toUpperCase();
  return (
    t.includes("FLOAT") || t.includes("INT") || t.includes("NUMERIC") ||
    t.includes("DECIMAL") || t.includes("CURRENCY") || t.includes("NUMBER")
  );
}

function parseToUnixSec(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val > 1e10 ? val / 1000 : val;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d.getTime() / 1000;
}

function formatCost(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtCell(col: SchemaField, val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (isNumericField(col) && typeof val === "number") {
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (isDateType(col) && typeof val === "number") {
    const d = new Date(val > 1e10 ? val : val * 1000);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString();
  }
  return String(val);
}

// ── Colour palette ────────────────────────────────────────────────────────────

const PALETTE = [
  "#4285F4", "#EA4335", "#FBBC05", "#34A853",
  "#FF6D00", "#AB47BC", "#00BCD4", "#F06292",
  "#8BC34A", "#FF7043",
];

// ── Schema analysis ───────────────────────────────────────────────────────────

type ChartType = "stacked-area" | "line" | "none";

interface Plan {
  type: ChartType;
  timeIdx: number;
  groupIdx: number;  // -1 = no categorical grouping column
  metricIdx: number; // first numeric column
}

function analyzePlan(schema: SchemaField[]): Plan {
  // Prefer exact timestamp/datetime types; fall back to date-like field names
  let timeIdx = schema.findIndex(f => isDateType(f));
  if (timeIdx < 0) timeIdx = schema.findIndex(f => isDateLikeName(f));

  const metricIdx = schema.findIndex(f => isNumericField(f));

  // Group = first string column that is neither numeric nor date-like nor the time column
  const groupIdx = schema.findIndex((f, i) =>
    i !== timeIdx &&
    !isNumericField(f) &&
    !isDateType(f) &&
    !isDateLikeName(f)
  );

  let type: ChartType = "none";
  if (timeIdx >= 0 && metricIdx >= 0) {
    type = groupIdx >= 0 ? "stacked-area" : "line";
  }

  return { type, timeIdx, groupIdx, metricIdx };
}

// ── Pivot (stacked area) ──────────────────────────────────────────────────────

const MAX_SERIES = 10;

interface PivotResult {
  xValues: number[];
  xLabels: string[];            // human-readable labels for categorical fallback
  seriesData: { name: string; values: number[] }[];
  isEpochX: boolean;
}

function pivotData(rows: unknown[][], plan: Plan): PivotResult {
  const { timeIdx, groupIdx, metricIdx } = plan;

  // Build X-axis: try to parse as epoch; if all fail, use categorical indices
  const rawX = rows.map(r => r[timeIdx]);
  const parsedX = rawX.map(v => parseToUnixSec(v));
  const isEpochX = parsedX.some(v => v !== null);

  // Unique X values in sorted order
  const xMap = new Map<number, string>(); // numeric key → label
  rows.forEach((r, i) => {
    const num = isEpochX ? (parsedX[i] ?? 0) : 0;
    const lbl = String(r[timeIdx] ?? "");
    if (!xMap.has(num)) xMap.set(num, lbl);
  });

  let xEntries: [number, string][];
  if (isEpochX) {
    xEntries = Array.from(xMap.entries()).sort((a, b) => a[0] - b[0]);
  } else {
    // Categorical: assign sequential indices preserving insertion order
    let idx = 0;
    xEntries = Array.from(xMap.entries()).map(([, lbl]) => [idx++, lbl]);
  }

  const xValues = xEntries.map(([n]) => n);
  const xLabels = xEntries.map(([, l]) => l);
  const xIndex = new Map(xEntries.map(([n], i) => [n, i]));

  // Group totals → pick top N
  const groupTotals = new Map<string, number>();
  rows.forEach(r => {
    const g = String(r[groupIdx] ?? "");
    const v = Number(r[metricIdx]);
    groupTotals.set(g, (groupTotals.get(g) ?? 0) + (isNaN(v) ? 0 : v));
  });
  const topGroups = Array.from(groupTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERIES)
    .map(([g]) => g);

  // Build per-group value arrays (index = xValues position)
  const lookup = new Map<string, number[]>();
  topGroups.forEach(g => lookup.set(g, new Array(xValues.length).fill(0)));

  rows.forEach((r, ri) => {
    const g = String(r[groupIdx] ?? "");
    if (!lookup.has(g)) return;
    const v = Number(r[metricIdx]);
    if (isNaN(v)) return;
    const xNum = isEpochX ? (parsedX[ri] ?? 0) : 0;
    const xI = isEpochX
      ? (xIndex.get(xNum) ?? -1)
      : (xIndex.get(xEntries.findIndex(([, l]) => l === String(r[timeIdx] ?? "")) as any) ?? -1);
    if (xI < 0) return;
    lookup.get(g)![xI] += v;
  });

  const seriesData = topGroups.map(g => ({ name: g, values: lookup.get(g)! }));
  return { xValues, xLabels, seriesData, isEpochX };
}

// ── ReportChart ───────────────────────────────────────────────────────────────

export function ReportChart({ data, meta }: ViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const schema    = data.schema    as SchemaField[]   | undefined;
  const rows      = data.rows      as unknown[][]     | undefined;
  const rowCount  = data.rowCount  as number          | undefined;
  const reportName = data.reportName as string        | undefined;
  const urlUI     = data.urlUI     as string          | undefined;

  // Fall back to GenericTable for bad data
  if (!Array.isArray(rows) || !schema || schema.length === 0) {
    return <GenericTable data={data} meta={meta} />;
  }

  const plan    = useMemo(() => analyzePlan(schema), [schema]);
  const pivoted = useMemo<PivotResult | null>(() => {
    if (plan.type !== "stacked-area") return null;
    return pivotData(rows, plan);
  }, [rows, plan]);

  // Build uplot-compatible aligned data
  const uplotData = useMemo<uPlot.AlignedData | null>(() => {
    if (plan.type === "stacked-area" && pivoted) {
      // Compute cumulative sums for stacked area
      const cum: number[][] = [];
      for (let i = 0; i < pivoted.seriesData.length; i++) {
        cum.push(pivoted.xValues.map((_, j) =>
          pivoted.seriesData.slice(0, i + 1).reduce((s, sd) => s + sd.values[j], 0)
        ));
      }
      return [pivoted.xValues, ...cum] as uPlot.AlignedData;
    }

    if (plan.type === "line") {
      const sorted = [...rows].sort((a, b) =>
        (parseToUnixSec(a[plan.timeIdx]) ?? 0) - (parseToUnixSec(b[plan.timeIdx]) ?? 0)
      );
      const xSeries = sorted.map(r => parseToUnixSec(r[plan.timeIdx]) ?? 0);
      const metricCols = schema
        .map((f, i) => ({ ...f, idx: i }))
        .filter((f, i) => i !== plan.timeIdx && isNumericField(f));
      const ySeries = metricCols.map(col =>
        sorted.map(r => { const v = Number(r[col.idx]); return isNaN(v) ? null : v; })
      );
      return [xSeries, ...ySeries] as uPlot.AlignedData;
    }
    return null;
  }, [rows, plan, pivoted, schema]);

  const hasChart = !!uplotData && rows.length >= 2;

  useEffect(() => {
    if (!chartRef.current || !uplotData || !hasChart || !plan) return;

    const w = Math.max((chartRef.current.offsetWidth || window.innerWidth) - 16, 280);

    let seriesLabels: string[];
    let bands: { series: [number, number] }[] | undefined;

    if (plan.type === "stacked-area" && pivoted) {
      seriesLabels = pivoted.seriesData.map(s => s.name);
      // Fill between adjacent cumulative series for stacked appearance
      bands = pivoted.seriesData.slice(1).map((_, i) => ({
        series: [i + 2, i + 1] as [number, number],
      }));
    } else {
      // line: series labels = metric column names
      seriesLabels = schema
        .filter((f, i) => i !== plan.timeIdx && isNumericField(f))
        .map(f => f.name);
    }

    const opts: uPlot.Options = {
      width:  w,
      height: 180,
      padding: [8, 0, 0, 0],
      series: [
        {},
        ...seriesLabels.map((label, i) => ({
          label,
          stroke: PALETTE[i % PALETTE.length],
          fill: plan.type === "stacked-area"
            ? `${PALETTE[i % PALETTE.length]}99`
            : `${PALETTE[i % PALETTE.length]}18`,
          width: plan.type === "line" ? 1.5 : 0.5,
          points: { show: false },
        })),
      ],
      ...(bands ? { bands } : {}),
      axes: [
        {
          values: (_u, vals) => vals.map(v => {
            const d = new Date((v as number) * 1000);
            if (isNaN(d.getTime())) return String(v);
            return `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
          }),
          gap: 4,
          size: 28,
        },
        {
          values: (_u, vals) => vals.map(v => v !== null ? formatCost(v as number) : ""),
          gap: 4,
          size: 52,
        },
      ],
      legend: { show: seriesLabels.length <= 8 },
      cursor: { show: false },
    };

    const u = new uPlot(opts, uplotData, chartRef.current);
    return () => u.destroy();
  }, [uplotData]);

  const [tableOpen, setTableOpen] = useState(false);

  // Columns to show in table: exclude timestamp (system field)
  const tableCols = schema
    .map((col, idx) => ({ col, idx }))
    .filter(({ col }) => col.name.toLowerCase() !== "timestamp");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Header */}
      <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--dci-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {reportName ?? "Report Results"}
        </span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>
            {rowCount ?? rows.length} rows
          </span>
          {urlUI && typeof urlUI === "string" && urlUI.startsWith("https://") && (
            <a
              href={urlUI}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "0.75rem", color: "var(--dci-accent, #4285F4)", textDecoration: "none" }}
            >
              Open ↗
            </a>
          )}
        </div>
      </div>

      {/* Chart */}
      {hasChart && <div ref={chartRef} style={{ marginBottom: "12px" }} />}

      {/* Collapsible data table */}
      <div>
        <button
          onClick={() => setTableOpen(o => !o)}
          style={{
            background: "none",
            border: "none",
            padding: "4px 0",
            cursor: "pointer",
            fontSize: "0.75rem",
            color: "var(--dci-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "0.625rem" }}>{tableOpen ? "▾" : "▸"}</span>
          {tableOpen ? "Hide data" : "Show data"}
        </button>

        {tableOpen && (
          <div style={{ overflowX: "auto", marginTop: "4px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr>
                  {tableCols.map(({ col }) => (
                    <th key={col.name} style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      borderBottom: "2px solid var(--dci-border)",
                      color: "var(--dci-text-secondary)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}>
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "var(--dci-bg-secondary, rgba(0,0,0,.03))" }}>
                    {tableCols.map(({ col, idx }) => (
                      <td key={col.name} style={{
                        padding: "6px 8px",
                        borderBottom: "1px solid var(--dci-border)",
                        color: "var(--dci-text)",
                        whiteSpace: "nowrap",
                      }}>
                        {fmtCell(col, row[idx])}
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
