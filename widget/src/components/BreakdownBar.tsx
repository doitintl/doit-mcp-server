interface Segment {
  label: string;
  value: number;
}

interface Props {
  segments: Segment[];
  label?: string;
}

export function BreakdownBar({ segments, label }: Props) {
  return (
    <div aria-label={label ?? "Breakdown bar"} style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>
      BreakdownBar ({segments.length} segments)
    </div>
  );
}
