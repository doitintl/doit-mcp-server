// widget/src/router.ts

import type { FunctionComponent } from "preact";
import { CostDashboard } from "./views/CostDashboard";
import { GenericTable } from "./views/GenericTable";

export interface ViewProps {
  data: Record<string, unknown>;     // structuredContent
  meta: Record<string, unknown>;     // _meta (includes rawData)
}

const VIEW_MAP: Record<string, FunctionComponent<ViewProps>> = {
  run_query: CostDashboard,
};

export function routeToView(toolName: string): FunctionComponent<ViewProps> {
  return VIEW_MAP[toolName] ?? GenericTable;
}
