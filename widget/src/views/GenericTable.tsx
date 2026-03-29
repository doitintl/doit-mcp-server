import type { ViewProps } from "../router";
import { Layout } from "../components/Layout";

/**
 * Auto-formats any tool output as a key-value list or table.
 * This also serves as the JSON fallback when data shape is unexpected.
 */
export function GenericTable({ data }: ViewProps) {
  const items = data.items ?? (Array.isArray(data) ? data : null);

  if (items && Array.isArray(items) && items.length > 0) {
    const keys = Object.keys(items[0] as Record<string, unknown>).slice(0, 6);
    return (
      <Layout>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k} style={{
                  textAlign: "left",
                  padding: "8px",
                  borderBottom: "1px solid var(--dci-border)",
                  color: "var(--dci-text-secondary)",
                  fontWeight: 500,
                  fontSize: "0.75rem",
                }}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(items as Record<string, unknown>[]).slice(0, 20).map((item, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k} style={{
                    padding: "8px",
                    borderBottom: "1px solid var(--dci-border)",
                    color: "var(--dci-text)",
                  }}>
                    {String(item[k] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
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

  // Single object — render key-value pairs
  return (
    <Layout>
      <dl style={{ fontSize: "0.8125rem" }}>
        {Object.entries(data).map(([key, value]) => (
          <div key={key} style={{
            display: "flex",
            gap: "12px",
            padding: "6px 0",
            borderBottom: "1px solid var(--dci-border)",
          }}>
            <dt style={{ color: "var(--dci-text-secondary)", minWidth: "120px", fontWeight: 500 }}>
              {key}
            </dt>
            <dd style={{ color: "var(--dci-text)" }}>
              {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
            </dd>
          </div>
        ))}
      </dl>
    </Layout>
  );
}
