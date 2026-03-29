interface Props {
  label: string;
  variant: "success" | "warning" | "danger" | "neutral";
}

const VARIANT_STYLES: Record<string, { bg: string; color: string }> = {
  success: { bg: "var(--dci-success)", color: "#fff" },
  warning: { bg: "var(--dci-warning)", color: "#000" },
  danger:  { bg: "var(--dci-danger)",  color: "#fff" },
  neutral: { bg: "var(--dci-bg-secondary)", color: "var(--dci-text-secondary)" },
};

export function StatusBadge({ label, variant }: Props) {
  const style = VARIANT_STYLES[variant] ?? VARIANT_STYLES.neutral;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "9999px",
      fontSize: "0.6875rem",
      fontWeight: 500,
      background: style.bg,
      color: style.color,
    }}>
      {label}
    </span>
  );
}
