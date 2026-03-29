interface Props {
  message: string;
  icon?: string;
}

export function EmptyState({ message, icon = "📭" }: Props) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
      padding: "32px 16px",
      color: "var(--dci-text-secondary)",
      fontSize: "0.8125rem",
      textAlign: "center",
    }}>
      <span style={{ fontSize: "2rem" }} aria-hidden="true">{icon}</span>
      <span>{message}</span>
    </div>
  );
}
