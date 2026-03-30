import { useRef, useEffect, useMemo } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { ViewProps } from "../router";
import { Layout } from "../components/Layout";
import { GenericTable } from "./GenericTable";

// Schema field descriptor from DoiT Cloud Analytics
interface SchemaField {
  name: string;
  type: string;
}

// ── Type helpers ──────────────────────────────────────────────────────────────

function isDateField(f: SchemaField): boolean {
  const t = f.type.toUpperCase();
  const n = f.name.toLowerCase();
  return (
    t.includes("DATE") || t.includes("TIME") || t.includes("TIMESTAMP") ||
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
  if (typeof val === "number") return val > 1e10 ? val / 1000 : val; // ms vs s
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d.getTime() / 1000;
}

function formatAxisDate(ts: number): string {
  const d = new Date(ts * 1000);
  const mo = d.toLocaleString("default", { month: "short" });
  return `${mo} ${d.getDate()}`;
}

function formatCost(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

// ── Colour palette ────────────────────────────────────────────────────────────

const SERIES_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#FF6D00", "#AB47BC", "#00BCD4"];

// ── CostDashboard ─────────────────────────────────────────────────────────────

export function CostDashboard({ data, meta }: ViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // run_query result shape: { rowCount, rows: Array<Array<any>>, columns: SchemaField[] }
  const schema = data.columns as SchemaField[] | undefined;
  const rows   = data.rows as Array<Array<unknown>> | undefined;
  const rowCount = data.rowCount as number | undefined;

  // Identify time + numeric columns
  const timeIdx     = schema ? schema.findIndex(isDateField) : -1;
  const numericCols = schema
    ? schema.map((f, i) => ({ ...f, idx: i })).filter(f => f.idx !== timeIdx && isNumericField(f))
    : [];

  const hasChart =
    timeIdx >= 0 &&
    numericCols.length > 0 &&
    Array.isArray(rows) &&
    rows.length >= 2;

  // Build uplot-compatible data: [[x...], [y1...], [y2...], ...]
  const uplotData = useMemo<uPlot.AlignedData | null>(() => {
    if (!hasChart || !rows || timeIdx < 0) return null;

    const sorted = [...rows].sort((a, b) => {
      return (parseToUnixSec(a[timeIdx]) ?? 0) - (parseToUnixSec(b[timeIdx]) ?? 0);
    });

    const xSeries = sorted.map(r => parseToUnixSec(r[timeIdx]) ?? 0);
    const ySeries = numericCols.map(col =>
      sorted.map(r => {
        const v = Number(r[col.idx]);
        return isNaN(v) ? null : v;
      })
    );
    return [xSeries, ...ySeries] as uPlot.AlignedData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current || !uplotData || !hasChart) return;

    const w = (chartRef.current.closest(".u-wrap")?.clientWidth ||
               chartRef.current.offsetWidth ||
               window.innerWidth) - 16;

    const opts: uPlot.Options = {
      width:  Math.max(w, 280),
      height: 150,
      padding: [8, 0, 0, 0],
      series: [
        {},
        ...numericCols.map((col, i) => ({
          label: col.name,
          stroke: SERIES_COLORS[i % SERIES_COLORS.length],
          fill:   `${SERIES_COLORS[i % SERIES_COLORS.length]}18`,
          width:  1.5,
          points: { show: rows && rows.length <= 14 },
        })),
      ],
      axes: [
        {
          values: (_u, vals) => vals.map(v => formatAxisDate(v as number)),
          gap: 4,
          size: 28,
        },
        {
          values: (_u, vals) => vals.map(v => v !== null ? formatCost(v as number) : ""),
          gap: 4,
          size: 52,
        },
      ],
      legend: { show: numericCols.length > 1 },
      cursor: { show: false },
    };

    const u = new uPlot(opts, uplotData, chartRef.current);
    return () => u.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uplotData]);

  // ── Fallback for unexpected shapes ─────────────────────────────────────────
  if (!Array.isArray(rows) || !schema || schema.length === 0) {
    return <GenericTable data={data} meta={meta} />;
  }

  // ── Render chart + table ───────────────────────────────────────────────────
  return (
    <Layout>
      {hasChart && (
        <div ref={chartRef} style={{ marginBottom: "12px" }} />
      )}

      <div style={{
        marginBottom: "6px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--dci-text)" }}>
          Query Results
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>
          {rowCount ?? rows.length} rows
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
        <thead>
          <tr>
            {schema.map((col) => (
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
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "var(--dci-bg-secondary)" }}>
              {schema.map((col, ci) => (
                <td key={col.name} style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--dci-border)",
                  color: "var(--dci-text)",
                }}>
                  {isNumericField(col) && typeof row[ci] === "number"
                    ? `$${(row[ci] as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : String(row[ci] ?? "—")}
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
    </Layout>
  );
}
