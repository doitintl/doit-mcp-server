import { listAccountTeamTool } from "./accountTeam.js";
import { createAlertTool, getAlertTool, listAlertsTool, updateAlertTool } from "./alerts.js";
import { createAllocationTool, getAllocationTool, listAllocationsTool, updateAllocationTool } from "./allocations.js";
import { createAnnotationTool, getAnnotationTool, listAnnotationsTool, updateAnnotationTool } from "./annotations.js";
import { anomaliesTool, anomalyTool } from "./anomalies.js";
import { getAssetTool, listAssetsTool } from "./assets.js";
import { askAvaSyncTool } from "./ava.js";
import { getAwsAccountTool, getCloudConnectSupportedFeaturesTool } from "./awsAccounts.js";
import { createBudgetTool, getBudgetTool, listBudgetsTool, updateBudgetTool } from "./budgets.js";
import {
    findCloudDiagramsTool,
    getCloudDiagramComponentsTool,
    getCloudDiagramCostSnapshotTool,
    getCloudDiagramResourceRelationshipsTool,
    getCloudDiagramsStatsTool,
    listCloudDiagramActivityGroupsTool,
    listCloudDiagramNodeActivitiesTool,
    searchCloudDiagramsTool,
} from "./cloudDiagrams.js";
import {
    createCloudFlowConnectionTool,
    getCloudFlowConnectionTool,
    getCloudFlowTemplateTool,
    listCloudFlowConnectionsTool,
    listCloudFlowsTool,
    listCloudFlowTemplatesTool,
    refineCloudflowTool,
    triggerCloudFlowTool,
    updateCloudFlowConnectionTool,
} from "./cloudflow.js";
import { cloudIncidentsTool, cloudIncidentTool } from "./cloudIncidents.js";
import { getCommitmentTool, listCommitmentsTool } from "./commitmentManager.js";
import {
    createDatahubDatasetTool,
    getDatahubDatasetTool,
    listDatahubDatasetsTool,
    updateDatahubDatasetTool,
} from "./datahubDatasets.js";
import { sendDatahubEventsTool } from "./datahubEvents.js";
import { dimensionTool } from "./dimension.js";
import { dimensionsTool } from "./dimensions.js";
import { createFolderTool, getFolderTool, listFoldersTool, updateFolderTool } from "./folders.js";
import { getInsightResourcesTool, getInsightTool, listOptimizationRecommendationsTool } from "./insights.js";
import { getInvoiceTool, listInvoicesTool } from "./invoices.js";
import {
    assignObjectsToLabelTool,
    createLabelTool,
    getLabelAssignmentsTool,
    getLabelTool,
    listLabelsTool,
    updateLabelTool,
} from "./labels.js";
import { listOrganizationsTool } from "./organizations.js";
import { cloudOverviewTool } from "./overview.js";
import { getResourcePermissionsTool, updateResourcePermissionsTool } from "./permissions.js";
import { listPlatformsTool } from "./platforms.js";
import { listProductsTool } from "./products.js";
import { compareSpendTool, costBreakdownTool, costTrendTool } from "./queryHelpers.js";
import {
    createReportTool,
    getReportConfigTool,
    getReportResultsTool,
    reportsTool,
    runQueryTool,
    updateReportTool,
} from "./reports.js";
import { listRolesTool } from "./roles.js";
import { searchCustomersTool } from "./searchCustomers.js";
import { getActiveThemeTool, getThemeTool, listThemesTool, setActiveThemeTool, updateThemeTool } from "./themes.js";
import {
    createTicketCommentTool,
    createTicketTool,
    getTicketTool,
    listTicketCommentsTool,
    listTicketsTool,
} from "./tickets.js";
import { inviteUserTool, listUsersTool, updateUserTool } from "./users.js";
import { validateUserTool } from "./validateUser.js";

type HandWrittenTool = { name: string; coversEndpoint: string | null };

/**
 * Every hand-written tool exposed via stdio's ListTools response (see src/server.ts).
 * A tool that duplicates an OpenAPI operation declares its `coversEndpoint` so the
 * generator (src/tools/generated/generateTools.ts) can skip that operation automatically —
 * see COVERED_ENDPOINTS below. No separate list to keep in sync. Tools with no OpenAPI
 * equivalent must still declare `coversEndpoint: null` so this is never accidentally omitted.
 */
export const HAND_WRITTEN_TOOLS: HandWrittenTool[] = [
    cloudOverviewTool,
    cloudIncidentsTool,
    cloudIncidentTool,
    anomaliesTool,
    anomalyTool,
    reportsTool,
    runQueryTool,
    costBreakdownTool,
    costTrendTool,
    compareSpendTool,
    listOptimizationRecommendationsTool,
    getInsightResourcesTool,
    getInsightTool,
    getReportResultsTool,
    getReportConfigTool,
    createReportTool,
    updateReportTool,
    validateUserTool,
    dimensionsTool,
    dimensionTool,
    listTicketsTool,
    getTicketTool,
    listTicketCommentsTool,
    createTicketCommentTool,
    createTicketTool,
    listInvoicesTool,
    getInvoiceTool,
    listAllocationsTool,
    getAllocationTool,
    createAllocationTool,
    updateAllocationTool,
    listAssetsTool,
    getAssetTool,
    searchCustomersTool,
    listAlertsTool,
    getAlertTool,
    createAlertTool,
    updateAlertTool,
    triggerCloudFlowTool,
    listCloudFlowsTool,
    listCloudFlowConnectionsTool,
    getCloudFlowConnectionTool,
    createCloudFlowConnectionTool,
    updateCloudFlowConnectionTool,
    listCloudFlowTemplatesTool,
    getCloudFlowTemplateTool,
    refineCloudflowTool,
    listOrganizationsTool,
    listPlatformsTool,
    listUsersTool,
    updateUserTool,
    inviteUserTool,
    listRolesTool,
    listProductsTool,
    listLabelsTool,
    getLabelTool,
    createLabelTool,
    updateLabelTool,
    getLabelAssignmentsTool,
    assignObjectsToLabelTool,
    listFoldersTool,
    getFolderTool,
    createFolderTool,
    updateFolderTool,
    listThemesTool,
    getThemeTool,
    getActiveThemeTool,
    setActiveThemeTool,
    updateThemeTool,
    getAwsAccountTool,
    getCloudConnectSupportedFeaturesTool,
    listDatahubDatasetsTool,
    getDatahubDatasetTool,
    createDatahubDatasetTool,
    updateDatahubDatasetTool,
    sendDatahubEventsTool,
    findCloudDiagramsTool,
    getCloudDiagramsStatsTool,
    searchCloudDiagramsTool,
    getCloudDiagramCostSnapshotTool,
    getCloudDiagramResourceRelationshipsTool,
    listCloudDiagramActivityGroupsTool,
    listCloudDiagramNodeActivitiesTool,
    getCloudDiagramComponentsTool,
    listBudgetsTool,
    getBudgetTool,
    createBudgetTool,
    updateBudgetTool,
    listAnnotationsTool,
    getAnnotationTool,
    createAnnotationTool,
    updateAnnotationTool,
    listCommitmentsTool,
    getCommitmentTool,
    listAccountTeamTool,
    getResourcePermissionsTool,
    updateResourcePermissionsTool,
    askAvaSyncTool,
];

export const COVERED_ENDPOINTS: Set<string> = new Set(
    HAND_WRITTEN_TOOLS.flatMap((tool) => (tool.coversEndpoint ? [tool.coversEndpoint.toLowerCase()] : []))
);
