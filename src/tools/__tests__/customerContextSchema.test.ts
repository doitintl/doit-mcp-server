import { describe, expect, it } from "vitest";
import { CUSTOMER_CONTEXT_DESCRIPTION } from "../../utils/schemaHelpers.js";

// Import all tool metadata objects (same list as server.ts ListToolsRequestSchema handler)
import { cloudIncidentsTool, cloudIncidentTool } from "../cloudIncidents.js";
import { anomaliesTool, anomalyTool } from "../anomalies.js";
import { reportsTool, runQueryTool, getReportResultsTool, createReportTool } from "../reports.js";
import { validateUserTool } from "../validateUser.js";
import { dimensionsTool } from "../dimensions.js";
import { dimensionTool } from "../dimension.js";
import { listTicketsTool } from "../tickets.js";
import { listInvoicesTool, getInvoiceTool } from "../invoices.js";
import {
    listAllocationsTool,
    getAllocationTool,
    createAllocationTool,
    updateAllocationTool,
} from "../allocations.js";
import { listAssetsTool } from "../assets.js";
import { listAlertsTool, getAlertTool, createAlertTool, updateAlertTool } from "../alerts.js";
import { triggerCloudFlowTool } from "../cloudflow.js";
import { listOrganizationsTool } from "../organizations.js";
import { listPlatformsTool } from "../platforms.js";
import { listUsersTool } from "../users.js";
import { listRolesTool } from "../roles.js";
import { listProductsTool } from "../products.js";
import { listLabelsTool, getLabelTool } from "../labels.js";
import { findCloudDiagramsTool } from "../cloudDiagrams.js";
import { listBudgetsTool, getBudgetTool, createBudgetTool, updateBudgetTool } from "../budgets.js";

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
    it.each(allTools.map((t) => [t.name, t]))(
        "%s includes customerContext as optional string with correct description",
        (_name, tool) => {
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
        }
    );
});
