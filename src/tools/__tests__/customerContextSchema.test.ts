import { describe, expect, it } from "vitest";
import { CUSTOMER_CONTEXT_DESCRIPTION } from "../../utils/schemaHelpers.js";
import { createAlertTool, getAlertTool, listAlertsTool, updateAlertTool } from "../alerts.js";
import { createAllocationTool, getAllocationTool, listAllocationsTool, updateAllocationTool } from "../allocations.js";
import { anomaliesTool, anomalyTool } from "../anomalies.js";
import { listAssetsTool } from "../assets.js";
import { createBudgetTool, getBudgetTool, listBudgetsTool, updateBudgetTool } from "../budgets.js";
import { findCloudDiagramsTool } from "../cloudDiagrams.js";
import { triggerCloudFlowTool } from "../cloudflow.js";
// Import all tool metadata objects (same list as server.ts ListToolsRequestSchema handler)
import { cloudIncidentsTool, cloudIncidentTool } from "../cloudIncidents.js";
import { dimensionTool } from "../dimension.js";
import { dimensionsTool } from "../dimensions.js";
import { getInvoiceTool, listInvoicesTool } from "../invoices.js";
import { getLabelTool, listLabelsTool } from "../labels.js";
import { listOrganizationsTool } from "../organizations.js";
import { listPlatformsTool } from "../platforms.js";
import { listProductsTool } from "../products.js";
import { createReportTool, getReportResultsTool, reportsTool, runQueryTool } from "../reports.js";
import { listRolesTool } from "../roles.js";
import { listTicketsTool } from "../tickets.js";
import { listUsersTool } from "../users.js";
import { validateUserTool } from "../validateUser.js";

const allTools = [
    cloudIncidentsTool,
    cloudIncidentTool,
    anomaliesTool,
    anomalyTool,
    reportsTool,
    runQueryTool,
    getReportResultsTool,
    createReportTool,
    validateUserTool,
    dimensionsTool,
    dimensionTool,
    listTicketsTool,
    listInvoicesTool,
    getInvoiceTool,
    listAllocationsTool,
    getAllocationTool,
    createAllocationTool,
    updateAllocationTool,
    listAssetsTool,
    listAlertsTool,
    getAlertTool,
    createAlertTool,
    updateAlertTool,
    triggerCloudFlowTool,
    listOrganizationsTool,
    listPlatformsTool,
    listUsersTool,
    listRolesTool,
    listProductsTool,
    listLabelsTool,
    getLabelTool,
    findCloudDiagramsTool,
    listBudgetsTool,
    getBudgetTool,
    createBudgetTool,
    updateBudgetTool,
];

describe("customerContext schema coverage", () => {
    it.each(
        allTools.map((t) => [t.name, t])
    )("%s includes customerContext as optional string with correct description", (_name, tool) => {
        const schema = (tool as any).inputSchema as any;
        const props = schema.properties;

        // Property exists
        expect(props.customerContext).toBeDefined();

        // Type is string
        expect(props.customerContext.type).toBe("string");

        // Description matches canonical constant
        expect(props.customerContext.description).toBe(CUSTOMER_CONTEXT_DESCRIPTION);

        // Not required
        const required = schema.required ?? [];
        expect(required).not.toContain("customerContext");
    });
});
