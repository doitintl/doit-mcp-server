import { describe, expect, it } from "vitest";
import * as core from "../../core.js";
import { zodToMcpInputSchema } from "../../utils/schemaHelpers.js";
import { ConfirmActionArgumentsSchema, confirmActionTool } from "../confirmAction.js";
import { HAND_WRITTEN_TOOLS } from "../handWrittenTools.js";

// Pair the stdio definitions with the Zod argument schemas exposed to remote consumers.
// Keep this explicit: deriving the expected schema from inputSchema itself would hide drift.
const toolSchemas = [
    [core.listAccountTeamTool, core.ListAccountTeamArgumentsSchema],
    [core.listAlertsTool, core.ListAlertsArgumentsSchema],
    [core.getAlertTool, core.GetAlertArgumentsSchema],
    [core.createAlertTool, core.CreateAlertArgumentsSchema],
    [core.updateAlertTool, core.UpdateAlertArgumentsSchema],
    [core.listAllocationsTool, core.ListAllocationsArgumentsSchema],
    [core.getAllocationTool, core.GetAllocationArgumentsSchema],
    [core.createAllocationTool, core.CreateAllocationArgumentsSchema],
    [core.updateAllocationTool, core.UpdateAllocationArgumentsSchema],
    [core.listAnnotationsTool, core.ListAnnotationsArgumentsSchema],
    [core.getAnnotationTool, core.GetAnnotationArgumentsSchema],
    [core.createAnnotationTool, core.CreateAnnotationArgumentsSchema],
    [core.updateAnnotationTool, core.UpdateAnnotationArgumentsSchema],
    [core.anomaliesTool, core.AnomaliesArgumentsSchema],
    [core.anomalyTool, core.AnomalyArgumentsSchema],
    [core.listAssetsTool, core.ListAssetsArgumentsSchema],
    [core.getAssetTool, core.GetAssetArgumentsSchema],
    [core.askAvaSyncTool, core.AskAvaSyncArgumentsSchema],
    [core.getAwsAccountTool, core.GetAwsAccountArgumentsSchema],
    [core.getCloudConnectSupportedFeaturesTool, core.GetCloudConnectSupportedFeaturesArgumentsSchema],
    [core.listBudgetsTool, core.ListBudgetsArgumentsSchema],
    [core.getBudgetTool, core.GetBudgetArgumentsSchema],
    [core.createBudgetTool, core.CreateBudgetArgumentsSchema],
    [core.updateBudgetTool, core.UpdateBudgetArgumentsSchema],
    [core.changeCustomerTool, core.ChangeCustomerArgumentsSchema],
    [core.findCloudDiagramsTool, core.FindCloudDiagramsArgumentsSchema],
    [core.getCloudDiagramsStatsTool, core.GetCloudDiagramsStatsArgumentsSchema],
    [core.searchCloudDiagramsTool, core.SearchCloudDiagramsArgumentsSchema],
    [core.getCloudDiagramCostSnapshotTool, core.GetCloudDiagramCostSnapshotArgumentsSchema],
    [core.getCloudDiagramResourceRelationshipsTool, core.GetCloudDiagramResourceRelationshipsArgumentsSchema],
    [core.listCloudDiagramActivityGroupsTool, core.ListCloudDiagramActivityGroupsArgumentsSchema],
    [core.listCloudDiagramNodeActivitiesTool, core.ListCloudDiagramNodeActivitiesArgumentsSchema],
    [core.getCloudDiagramComponentsTool, core.GetCloudDiagramComponentsArgumentsSchema],
    [core.cloudIncidentsTool, core.CloudIncidentsArgumentsSchema],
    [core.cloudIncidentTool, core.CloudIncidentArgumentsSchema],
    [core.triggerCloudFlowTool, core.TriggerCloudFlowArgumentsSchema],
    [core.refineCloudflowTool, core.RefineCloudflowArgumentsSchema],
    [core.buildCloudflowTool, core.BuildCloudflowArgumentsSchema],
    [core.listCloudFlowConnectionsTool, core.ListCloudFlowConnectionsArgumentsSchema],
    [core.getCloudFlowConnectionTool, core.GetCloudFlowConnectionArgumentsSchema],
    [core.createCloudFlowConnectionTool, core.CreateCloudFlowConnectionArgumentsSchema],
    [core.updateCloudFlowConnectionTool, core.UpdateCloudFlowConnectionArgumentsSchema],
    [core.listCloudFlowTemplatesTool, core.ListCloudFlowTemplatesArgumentsSchema],
    [core.getCloudFlowTemplateTool, core.GetCloudFlowTemplateArgumentsSchema],
    [core.listCloudFlowsTool, core.ListCloudFlowsArgumentsSchema],
    [core.listCommitmentsTool, core.ListCommitmentsArgumentsSchema],
    [core.getCommitmentTool, core.GetCommitmentArgumentsSchema],
    [confirmActionTool, ConfirmActionArgumentsSchema],
    [core.listDatahubDatasetsTool, core.ListDatahubDatasetsArgumentsSchema],
    [core.getDatahubDatasetTool, core.GetDatahubDatasetArgumentsSchema],
    [core.createDatahubDatasetTool, core.CreateDatahubDatasetArgumentsSchema],
    [core.updateDatahubDatasetTool, core.UpdateDatahubDatasetArgumentsSchema],
    [core.sendDatahubEventsTool, core.SendDatahubEventsArgumentsSchema],
    [core.dimensionTool, core.DimensionArgumentsSchema],
    [core.dimensionsTool, core.DimensionsArgumentsSchema],
    [core.listFoldersTool, core.ListFoldersArgumentsSchema],
    [core.getFolderTool, core.GetFolderArgumentsSchema],
    [core.createFolderTool, core.CreateFolderArgumentsSchema],
    [core.updateFolderTool, core.UpdateFolderArgumentsSchema],
    [core.listOptimizationRecommendationsTool, core.ListInsightsArgumentsSchema],
    [core.getInsightResourcesTool, core.GetInsightResourcesArgumentsSchema],
    [core.getInsightTool, core.GetInsightArgumentsSchema],
    [core.postInsightResultTool, core.PostInsightResultArgumentsSchema],
    [core.updateInsightStatusTool, core.UpdateInsightStatusArgumentsSchema],
    [core.listInvoicesTool, core.ListInvoicesArgumentsSchema],
    [core.getInvoiceTool, core.GetInvoiceArgumentsSchema],
    [core.listLabelsTool, core.ListLabelsArgumentsSchema],
    [core.getLabelTool, core.GetLabelArgumentsSchema],
    [core.createLabelTool, core.CreateLabelArgumentsSchema],
    [core.updateLabelTool, core.UpdateLabelArgumentsSchema],
    [core.getLabelAssignmentsTool, core.GetLabelAssignmentsArgumentsSchema],
    [core.assignObjectsToLabelTool, core.AssignObjectsToLabelArgumentsSchema],
    [core.listOrganizationsTool, core.ListOrganizationsArgumentsSchema],
    [core.cloudOverviewTool, core.CloudOverviewArgumentsSchema],
    [core.getResourcePermissionsTool, core.GetResourcePermissionsArgumentsSchema],
    [core.updateResourcePermissionsTool, core.UpdateResourcePermissionsArgumentsSchema],
    [core.listPlatformsTool, core.ListPlatformsArgumentsSchema],
    [core.listProductsTool, core.ListProductsArgumentsSchema],
    [core.costBreakdownTool, core.CostBreakdownArgumentsSchema],
    [core.costTrendTool, core.CostTrendArgumentsSchema],
    [core.compareSpendTool, core.CompareSpendArgumentsSchema],
    [core.reportsTool, core.ReportsArgumentsSchema],
    [core.getReportResultsTool, core.GetReportResultsArgumentsSchema],
    [core.getReportConfigTool, core.GetReportConfigArgumentsSchema],
    [core.runQueryTool, core.RunQueryArgumentsSchema],
    [core.createReportTool, core.CreateReportArgumentsSchema],
    [core.updateReportTool, core.UpdateReportArgumentsSchema],
    [core.listRolesTool, core.ListRolesArgumentsSchema],
    [core.searchCustomersTool, core.SearchCustomersArgumentsSchema],
    [core.listThemesTool, core.ListThemesArgumentsSchema],
    [core.getThemeTool, core.GetThemeArgumentsSchema],
    [core.getActiveThemeTool, core.GetActiveThemeArgumentsSchema],
    [core.setActiveThemeTool, core.SetActiveThemeArgumentsSchema],
    [core.updateThemeTool, core.UpdateThemeArgumentsSchema],
    [core.listTicketsTool, core.ListTicketsArgumentsSchema],
    [core.createTicketTool, core.CreateTicketArgumentsSchema],
    [core.getTicketTool, core.GetTicketArgumentsSchema],
    [core.listTicketCommentsTool, core.ListTicketCommentsArgumentsSchema],
    [core.createTicketCommentTool, core.CreateTicketCommentArgumentsSchema],
    [core.listUsersTool, core.ListUsersArgumentsSchema],
    [core.updateUserTool, core.UpdateUserArgumentsSchema],
    [core.inviteUserTool, core.InviteUserArgumentsSchema],
    [core.validateUserTool, core.ValidateUserArgumentsSchema],
] as const;

describe("hand-written tool schema parity", () => {
    it("covers every registered and core-exported tool", () => {
        const covered = new Set(toolSchemas.map(([tool]) => tool));
        for (const tool of HAND_WRITTEN_TOOLS) {
            expect(covered.has(tool as (typeof toolSchemas)[number][0]), tool.name).toBe(true);
        }
        for (const value of Object.values(core)) {
            if (value && typeof value === "object" && "inputSchema" in value) {
                expect(covered.has(value as (typeof toolSchemas)[number][0]), value.name).toBe(true);
            }
        }
    });

    it.each(toolSchemas.map(([tool, schema]) => ({ name: tool.name, tool, schema })))(
        "$name advertises its Zod input schema, including descriptions",
        ({ tool, schema }) => {
            expect(tool.inputSchema).toEqual(zodToMcpInputSchema(schema));
        }
    );
});

describe("migrated schema compatibility", () => {
    it("keeps descriptions on every nested ticket parameter", () => {
        const schema = core.createTicketTool.inputSchema as any;
        for (const [name, property] of Object.entries(schema.properties.ticket.properties)) {
            expect((property as { description?: string }).description, name).toBeTruthy();
        }
    });

    it("keeps CloudFlow request bodies open to arbitrary nested JSON", () => {
        const payload = { flowID: "flow-1", requestBodyJson: { custom: { values: [1, null, true] } } };
        expect(core.TriggerCloudFlowArgumentsSchema.parse(payload)).toEqual(payload);
        const schema = core.triggerCloudFlowTool.inputSchema as any;
        expect(schema.properties.requestBodyJson.additionalProperties).toEqual({});
    });
});
