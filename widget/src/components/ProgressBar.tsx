interface Props {
  value: number;  // 0–100
  label?: string;
}

export function ProgressBar({ value, label }: Props) {
  return (
    <div aria-label={label ?? `Progress: ${value}%`}>
      <div style={{ background: "var(--dci-bg-secondary)", borderRadius: "9999px", height: "8px", overflow: "hidden" }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: "100%",
          background: "var(--dci-accent)",
          borderRadius: "9999px",
        }} />
      </div>
      {label && <span style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>{label}</span>}
    </div>
  );
}
