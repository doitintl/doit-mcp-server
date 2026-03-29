import type { ViewProps } from "../router";
import { GenericTable } from "./GenericTable";

export function AnomalyAlert(props: ViewProps) {
  // TODO: Replace with dedicated visualization
  return <GenericTable {...props} />;
}
