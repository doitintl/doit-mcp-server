interface Props {
  label: string;
  value: string;
  trend?: string;        // e.g., "+8.3%"
  trendDirection?: "up" | "down" | "flat";
}

export function MetricCard({ label, value, trend, trendDirection }: Props) {
  const trendColor = trendDirection === "up"
    ? "var(--dci-danger)"
    : trendDirection === "down"
    ? "var(--dci-success)"
    : "var(--dci-text-secondary)";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    }}>
      <span style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>
        {label}
      </span>
      <span style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--dci-text)" }}>
        {value}
      </span>
      {trend && (
        <span style={{ fontSize: "0.75rem", color: trendColor }}>
          {trend}
        </span>
      )}
    </div>
  );
}
