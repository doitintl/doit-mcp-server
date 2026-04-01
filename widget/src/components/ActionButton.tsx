interface Props {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

/**
 * Primary uses DoiT green. Secondary uses border style.
 * Max 2 of these per inline card (OpenAI requirement).
 */
export function ActionButton({ label, onClick, variant = "secondary" }: Props) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        padding: "8px 16px",
        borderRadius: "var(--dci-radius)",
        fontSize: "0.8125rem",
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        border: isPrimary ? "none" : "1px solid var(--dci-border)",
        background: isPrimary ? "var(--dci-accent)" : "transparent",
        color: isPrimary ? "#000" : "var(--dci-text)",
      }}
    >
      {label}
    </button>
  );
}
