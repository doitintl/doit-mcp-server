import {
	alertFixture,
	alertsFixture,
	allocationFixture,
	allocationsFixture,
	createAllocationFixture,
	dimensionFixture,
	dimensionsFixture,
	queryResultFixture,
	reportResultsFixture,
	reportsFixture,
	updateAllocationFixture,
} from "./analytics.js";
import { anomaliesFixture, anomalyFixture } from "./anomalies.js";
import { assetsFixture, invoiceFixture, invoicesFixture } from "./billing.js";
import { cloudIncidentFixture, cloudIncidentsFixture } from "./cloudIncidents.js";
import { cloudflowTriggerFixture } from "./cloudflow.js";
import { organizationsFixture, rolesFixture, usersFixture, validateUserFixture } from "./iam.js";
import { platformsFixture, ticketsFixture } from "./support.js";

export const fixtures = {
	organizations: organizationsFixture,
	roles: rolesFixture,
	users: usersFixture,
	platforms: platformsFixture,
	validateUser: validateUserFixture,

	cloudIncidents: cloudIncidentsFixture,
	cloudIncident: cloudIncidentFixture,

	anomalies: anomaliesFixture,
	anomaly: anomalyFixture,

	reports: reportsFixture,
	queryResult: queryResultFixture,
	reportResults: reportResultsFixture,
	dimensions: dimensionsFixture,
	dimension: dimensionFixture,

	allocations: allocationsFixture,
	allocation: allocationFixture,
	createAllocation: createAllocationFixture,
	updateAllocation: updateAllocationFixture,

	alerts: alertsFixture,
	alert: alertFixture,

	invoices: invoicesFixture,
	invoice: invoiceFixture,
	assets: assetsFixture,

	tickets: ticketsFixture,

	cloudflowTrigger: cloudflowTriggerFixture,
};
