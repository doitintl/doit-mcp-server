// widget/src/router.ts

import type { FunctionComponent } from "preact";
import { CostDashboard } from "./views/CostDashboard";
import { AnomalyAlert } from "./views/AnomalyAlert";
import { BudgetOverview } from "./views/BudgetOverview";
import { InvoiceList } from "./views/InvoiceList";
import { TicketList } from "./views/TicketList";
import { IncidentFeed } from "./views/IncidentFeed";
import { AssetBrowser } from "./views/AssetBrowser";
import { UserProfile } from "./views/UserProfile";
import { GenericTable } from "./views/GenericTable";

export interface ViewProps {
  data: Record<string, unknown>;     // structuredContent
  meta: Record<string, unknown>;     // _meta (includes rawData)
}

const VIEW_MAP: Record<string, FunctionComponent<ViewProps>> = {
  run_query:           CostDashboard,
  get_anomalies:       AnomalyAlert,
  get_anomaly:         AnomalyAlert,
  list_budgets:        BudgetOverview,
  get_budget:          BudgetOverview,
  list_invoices:       InvoiceList,
  get_invoice:         InvoiceList,
  list_tickets:        TicketList,
  get_cloud_incidents: IncidentFeed,
  get_cloud_incident:  IncidentFeed,
  list_assets:         AssetBrowser,
  get_asset:           AssetBrowser,
  validate_user:       UserProfile,
};

export function routeToView(toolName: string): FunctionComponent<ViewProps> {
  return VIEW_MAP[toolName] ?? GenericTable;
}
