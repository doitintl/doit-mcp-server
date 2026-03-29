interface Props {
  data: number[];
  label?: string;
}

export function SparkChart({ data, label }: Props) {
  return (
    <div aria-label={label ?? "Sparkline chart"} style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>
      SparkChart ({data.length} points)
    </div>
  );
}
