import type { ViewProps } from "../router";
import { GenericTable } from "./GenericTable";

export function InvoiceList(props: ViewProps) {
  // TODO: Replace with dedicated visualization
  return <GenericTable {...props} />;
}
