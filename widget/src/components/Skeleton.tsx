interface Props {
  height?: string;
  width?: string;
}

export function Skeleton({ height = "16px", width = "100%" }: Props) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading..."
      style={{
        height,
        width,
        background: "var(--dci-bg-secondary)",
        borderRadius: "4px",
      }}
    />
  );
}
