import type { JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import type { ViewProps } from "../router";
import { Layout } from "../components/Layout";
import type { ColumnDef, ColumnFormat, ColumnFormatOptions, DrilldownConfig } from "../../../src/utils/widgetConfig";
import { ICON_SETS } from "../icons/cloudPlatforms";
import { getBridge } from "../bridge";

// ── FetchImage: loads images via fetch (connect-src) to bypass img-src CSP ───

function FetchImage({ src }: { src: string }): JSX.Element {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    fetch(src)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.blob(); })
      .then((blob) => { revoke = URL.createObjectURL(blob); setBlobUrl(revoke); })
      .catch((e) => setError(e.message));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [src]);

  if (error) return <span style={{ fontSize: "0.65rem", color: "var(--dci-text-secondary)" }}>Chart unavailable</span>;
  if (!blobUrl) return <span style={{ fontSize: "0.65rem", color: "var(--dci-text-secondary)" }}>Loading chart…</span>;
  return <img src={blobUrl} alt="chart" style={{ maxWidth: "100%", borderRadius: "6px", display: "block" }} />;
}

// ── Colour maps ───────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--dci-danger)",
  warning:  "var(--dci-warning)",
  info:     "var(--dci-text-secondary)",
};

const STATUS_COLOR: Record<string, string> = {
  active:   "var(--dci-success)",
  inactive: "var(--dci-text-secondary)",
  resolved: "var(--dci-success)",
  open:     "var(--dci-warning)",
  closed:   "var(--dci-text-secondary)",
};

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }): JSX.Element {
  const W = 64, H = 22, PAD = 2;
  if (values.length < 2) {
    return <span style={{ color: "var(--dci-text-secondary)" }}>—</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--dci-accent, #4285F4)"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }): JSX.Element {
  const pct = max > 0 ? Math.min((value / max) * 100, 200) : 0;
  const color =
    pct > 100 ? "var(--dci-danger)" :
    pct > 80  ? "var(--dci-warning)" :
                "var(--dci-success)";
  const label = max > 0 ? `${Math.round(pct)}%` : `$${value.toLocaleString()}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: "120px" }}>
      <div style={{
        flex: 1, height: "6px", borderRadius: "3px",
        background: "var(--dci-border)",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`,
          height: "100%",
          borderRadius: "3px",
          background: color,
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: "0.7rem", color: "var(--dci-text-secondary)", minWidth: "32px", textAlign: "right" }}>
        {label}
      </span>
    </div>
  );
}

// ── renderCell ────────────────────────────────────────────────────────────────

/**
 * Render a single cell value.
 * @param value      - the raw cell value
 * @param format     - format type from ColumnDef
 * @param options    - format options from ColumnDef
 * @param context    - the full row/item object, used for "progress" maxKey lookup
 */
function renderCell(
  value: unknown,
  format?: ColumnFormat,
  options?: ColumnFormatOptions,
  context?: Record<string, unknown>,
): JSX.Element {
  if (value === null || value === undefined) {
    return <span style={{ color: "var(--dci-text-secondary)" }}>—</span>;
  }

  switch (format) {
    case "currency": {
      const n = Number(value);
      return <span>{isNaN(n) ? String(value) : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>;
    }

    case "date": {
      const d = typeof value === "number" ? new Date(value) : new Date(String(value));
      return <span>{isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()}</span>;
    }

    case "datetime": {
      const d = typeof value === "number" ? new Date(value) : new Date(String(value));
      return <span>{isNaN(d.getTime()) ? String(value) : d.toLocaleString()}</span>;
    }

    case "severity": {
      const s = String(value).toLowerCase();
      return (
        <span style={{ color: SEVERITY_COLOR[s] ?? "var(--dci-text)", fontWeight: 600 }}>
          {String(value)}
        </span>
      );
    }

    case "status": {
      const s = String(value).toLowerCase();
      return (
        <span style={{ color: STATUS_COLOR[s] ?? "var(--dci-text)" }}>
          {String(value)}
        </span>
      );
    }

    case "boolean":
      return <span>{value ? "Yes" : "No"}</span>;

    case "icon": {
      const iconSet = options?.iconSet;
      const resolver = iconSet ? ICON_SETS[iconSet] : undefined;
      const icon = resolver ? resolver(String(value)) : null;
      return icon
        ? <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
        : <span>{String(value)}</span>;
    }

    case "progress": {
      const current = Number(value);
      let max = options?.maxValue ?? 0;
      if (options?.maxKey && context) {
        const maxVal = Number(context[options.maxKey]);
        if (!isNaN(maxVal)) max = maxVal;
      }
      if (isNaN(current)) return <span>{String(value)}</span>;
      return <ProgressBar value={current} max={max} />;
    }

    case "sparkline": {
      if (!Array.isArray(value)) return <span>{String(value)}</span>;
      return <Sparkline values={(value as unknown[]).map(Number).filter(n => !isNaN(n))} />;
    }

    case "image": {
      const src = String(value);
      if (!src || src === "undefined" || src === "null" || !src.startsWith("https://")) return <span>—</span>;
      // Use FetchImage component to bypass img-src CSP by loading via fetch (connect-src)
      return <FetchImage src={src} />;
    }

    default:
      return <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>;
  }
}

// ── GenericTable ──────────────────────────────────────────────────────────────

/**
 * Config-driven table and key-value renderer.
 * Reads _columns from structuredContent (injected by responseAdapter) for
 * column selection, labelling, and formatting. Falls back to key inference.
 */
function useDrilldown(drilldown: DrilldownConfig | undefined) {
  const [pending, setPending] = useState<string | null>(null);

  function handleRowClick(item: Record<string, unknown>) {
    if (!drilldown) return;
    const id = String(item[drilldown.idKey] ?? "");
    if (!id) return;
    const prompt = (drilldown.promptTemplate ?? "Show me details for {id}").replace("{id}", id);
    setPending(id);
    const bridge = getBridge();
    if (bridge) {
      bridge.sendFollowUpMessage({ prompt, scrollToBottom: true });
    }
    // Reset after a short delay so repeated clicks are possible
    setTimeout(() => setPending(null), 2000);
  }

  return { pending, handleRowClick };
}

export function GenericTable({ data }: ViewProps) {
  const configColumns = data._columns as ColumnDef[] | undefined;
  const emptyMessage = (data._emptyMessage as string | undefined) ?? "No results found.";
  const drilldown = data._drilldown as DrilldownConfig | undefined;
  const items = data.items ?? (Array.isArray(data) ? data : null);
  const { pending, handleRowClick } = useDrilldown(drilldown);

  // ── List / table view ───────────────────────────────────────────────────────
  if (items && Array.isArray(items) && items.length > 0) {
    const cols: ColumnDef[] =
      configColumns && configColumns.length > 0
        ? configColumns
        : Object.keys(items[0] as Record<string, unknown>)
            .filter((k) => !k.startsWith("_"))
            .slice(0, 6)
            .map((k) => ({ key: k, label: k }));

    return (
      <Layout>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr>
              {cols.map(({ key, label }) => (
                <th key={key} style={{
                  textAlign: "left",
                  padding: "8px",
                  borderBottom: "1px solid var(--dci-border)",
                  color: "var(--dci-text-secondary)",
                  fontWeight: 500,
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                }}>
                  {label}
                </th>
              ))}
              {drilldown && <th style={{ width: "28px", borderBottom: "1px solid var(--dci-border)" }} />}
            </tr>
          </thead>
          <tbody>
            {(items as Record<string, unknown>[]).slice(0, 20).map((item, i) => {
              const rowId = drilldown ? String(item[drilldown.idKey] ?? "") : "";
              const isLoading = pending === rowId;
              return (
                <tr
                  key={i}
                  role={drilldown ? "button" : undefined}
                  tabIndex={drilldown ? 0 : undefined}
                  onClick={drilldown ? () => handleRowClick(item) : undefined}
                  onKeyDown={drilldown ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRowClick(item); } } : undefined}
                  style={{
                    cursor: drilldown ? "pointer" : "default",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={drilldown ? (e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--dci-hover, rgba(0,0,0,0.04))"; } : undefined}
                  onMouseLeave={drilldown ? (e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; } : undefined}
                >
                  {cols.map(({ key, format, formatOptions }) => (
                    <td key={key} style={{
                      padding: "8px",
                      borderBottom: "1px solid var(--dci-border)",
                      color: "var(--dci-text)",
                      verticalAlign: "middle",
                    }}>
                      {renderCell(item[key], format, formatOptions, item)}
                    </td>
                  ))}
                  {drilldown && (
                    <td style={{
                      padding: "8px",
                      borderBottom: "1px solid var(--dci-border)",
                      color: "var(--dci-text-secondary)",
                      verticalAlign: "middle",
                      textAlign: "center",
                      fontSize: "0.75rem",
                    }}>
                      {isLoading ? "…" : "›"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.hasMore && (
          <p style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)", padding: "8px" }}>
            Showing first {(items as unknown[]).length} results. Ask for more to see additional data.
          </p>
        )}
      </Layout>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (items && Array.isArray(items) && items.length === 0) {
    return (
      <Layout>
        <p style={{ fontSize: "0.8125rem", color: "var(--dci-text-secondary)", padding: "16px" }}>
          {emptyMessage}
        </p>
      </Layout>
    );
  }

  // ── Single object — key-value pairs ────────────────────────────────────────
  const kvEntries =
    configColumns && configColumns.length > 0
      ? configColumns
          .map(({ key, label, format, formatOptions }) => ({
            key, label, format, formatOptions,
            value: (data as Record<string, unknown>)[key],
          }))
          .filter(({ value, format }) => !(format === "image" && !value))
      : Object.entries(data)
          .filter(([key]) => !key.startsWith("_"))
          .map(([key, value]) => ({
            key, label: key, format: undefined as ColumnFormat | undefined,
            formatOptions: undefined as ColumnFormatOptions | undefined, value,
          }));

  return (
    <Layout>
      <dl style={{ fontSize: "0.8125rem", margin: 0 }}>
        {kvEntries.map(({ key, label, format, formatOptions, value }) => (
          <div key={key} style={{
            display: "flex",
            gap: "12px",
            padding: "6px 0",
            borderBottom: "1px solid var(--dci-border)",
            alignItems: "center",
          }}>
            <dt style={{
              color: "var(--dci-text-secondary)",
              minWidth: "130px",
              fontWeight: 500,
              flexShrink: 0,
            }}>
              {label}
            </dt>
            <dd style={{ color: "var(--dci-text)", margin: 0, flex: 1 }}>
              {renderCell(value, format, formatOptions, data as Record<string, unknown>)}
            </dd>
          </div>
        ))}
      </dl>
    </Layout>
  );
}
