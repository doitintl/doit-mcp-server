interface Props {
  columns: string[];
  rows: Record<string, unknown>[];
  label?: string;
}

export function DataTable({ columns, rows, label }: Props) {
  return (
    <div aria-label={label ?? "Data table"} style={{ fontSize: "0.75rem", color: "var(--dci-text-secondary)" }}>
      DataTable ({rows.length} rows, {columns.length} columns)
    </div>
  );
}
