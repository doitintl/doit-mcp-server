import {
    alertFixture,
    alertsFixture,
    allocationFixture,
    allocationsFixture,
    annotationFixture,
    annotationsFixture,
    budgetFixture,
    budgetsFixture,
    createAlertFixture,
    createAllocationFixture,
    createAnnotationFixture,
    createBudgetFixture,
    createLabelFixture,
    createReportFixture,
    dimensionFixture,
    dimensionsFixture,
    labelAssignmentsFixture,
    labelFixture,
    labelsFixture,
    queryResultFixture,
    reportConfigFixture,
    reportResultsFixture,
    reportsFixture,
    updateAlertFixture,
    updateAllocationFixture,
    updateAnnotationFixture,
    updateBudgetFixture,
    updateLabelFixture,
    updateReportFixture,
} from "./analytics.js";
import { anomaliesFixture, anomalyFixture } from "./anomalies.js";
import { assetDetailedFixture, assetsFixture, invoiceFixture, invoicesFixture } from "./billing.js";
import { cloudDiagramsFixture } from "./cloudDiagrams.js";
import { cloudflowTriggerFixture } from "./cloudflow.js";
import { cloudIncidentFixture, cloudIncidentsFixture } from "./cloudIncidents.js";
import {
    createDatahubDatasetFixture,
    datahubDatasetFixture,
    datahubDatasetsFixture,
    sendDatahubEventsFixture,
    updateDatahubDatasetFixture,
} from "./datahub.js";
import {
    inviteUserFixture,
    organizationsFixture,
    rolesFixture,
    updateUserFixture,
    usersFixture,
    validateUserFixture,
} from "./iam.js";
import { platformsFixture, productsFixture, ticketsFixture } from "./support.js";

export const fixtures = {
    organizations: organizationsFixture,
    roles: rolesFixture,
    users: usersFixture,
    updateUser: updateUserFixture,
    platforms: platformsFixture,
    products: productsFixture,
    validateUser: validateUserFixture,
    inviteUser: inviteUserFixture,

    cloudIncidents: cloudIncidentsFixture,
    cloudIncident: cloudIncidentFixture,

    anomalies: anomaliesFixture,
    anomaly: anomalyFixture,

    reports: reportsFixture,
    queryResult: queryResultFixture,
    reportResults: reportResultsFixture,
    reportConfig: reportConfigFixture,
    createReport: createReportFixture,
    updateReport: updateReportFixture,
    dimensions: dimensionsFixture,
    dimension: dimensionFixture,

    allocations: allocationsFixture,
    allocation: allocationFixture,
    createAllocation: createAllocationFixture,
    updateAllocation: updateAllocationFixture,

    alerts: alertsFixture,
    alert: alertFixture,
    createAlert: createAlertFixture,
    updateAlert: updateAlertFixture,

    invoices: invoicesFixture,
    invoice: invoiceFixture,
    assets: assetsFixture,
    assetDetailed: assetDetailedFixture,

    tickets: ticketsFixture,

    cloudDiagrams: cloudDiagramsFixture,

    datahubDatasets: datahubDatasetsFixture,
    datahubDataset: datahubDatasetFixture,
    createDatahubDataset: createDatahubDatasetFixture,
    updateDatahubDataset: updateDatahubDatasetFixture,
    sendDatahubEvents: sendDatahubEventsFixture,

    cloudflowTrigger: cloudflowTriggerFixture,

    label: labelFixture,
    labels: labelsFixture,
    createLabel: createLabelFixture,
    updateLabel: updateLabelFixture,
    labelAssignments: labelAssignmentsFixture,

    budgets: budgetsFixture,
    budget: budgetFixture,
    createBudget: createBudgetFixture,
    updateBudget: updateBudgetFixture,

    annotation: annotationFixture,
    annotations: annotationsFixture,
    createAnnotation: createAnnotationFixture,
    updateAnnotation: updateAnnotationFixture,
};
