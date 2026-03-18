import { HttpResponse, http } from "msw";
import { fixtures } from "../fixtures/index.js";

const API_BASE = "https://api.doit.com";

export const mockedDoitApiHandlers = [
    // Organizations
    http.get(`${API_BASE}/iam/v1/organizations`, () => {
        return HttpResponse.json(fixtures.organizations);
    }),

    // Roles
    http.get(`${API_BASE}/iam/v1/roles`, () => {
        return HttpResponse.json(fixtures.roles);
    }),

    // Users
    http.get(`${API_BASE}/iam/v1/users`, () => {
        return HttpResponse.json(fixtures.users);
    }),

    // Platforms
    http.get(`${API_BASE}/support/v1/metadata/platforms`, () => {
        return HttpResponse.json(fixtures.platforms);
    }),

    // Products
    http.get(`${API_BASE}/support/v1/metadata/products`, () => {
        return HttpResponse.json(fixtures.products);
    }),

    // Cloud Incidents
    http.get(`${API_BASE}/core/v1/cloudincidents/:id`, ({ params }) => {
        if (params.id === "inc-1") {
            return HttpResponse.json(fixtures.cloudIncident);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/core/v1/cloudincidents`, () => {
        return HttpResponse.json(fixtures.cloudIncidents);
    }),

    // Anomalies
    http.get(`${API_BASE}/anomalies/v1/:id`, ({ params }) => {
        if (params.id === "anom-1") {
            return HttpResponse.json(fixtures.anomaly);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/anomalies/v1`, () => {
        return HttpResponse.json(fixtures.anomalies);
    }),

    // Reports
    http.get(`${API_BASE}/analytics/v1/reports/:id`, ({ params }) => {
        if (params.id === "report-1") {
            return HttpResponse.json(fixtures.reportResults);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/reports`, () => {
        return HttpResponse.json(fixtures.reports);
    }),
    http.post(`${API_BASE}/analytics/v1/reports/query`, () => {
        return HttpResponse.json(fixtures.queryResult);
    }),

    // Validate User
    http.get(`${API_BASE}/auth/v1/validate`, () => {
        return HttpResponse.json(fixtures.validateUser);
    }),

    // Dimensions
    http.get(`${API_BASE}/analytics/v1/dimensions`, () => {
        return HttpResponse.json(fixtures.dimensions);
    }),

    // Dimension (single)
    http.get(`${API_BASE}/analytics/v1/dimension`, () => {
        return HttpResponse.json(fixtures.dimension);
    }),

    // Tickets (hardcoded URL in source)
    http.get(`${API_BASE}/support/v1/tickets`, () => {
        return HttpResponse.json(fixtures.tickets);
    }),
    http.post(`${API_BASE}/support/v1/tickets`, () => {
        return HttpResponse.json({ id: 99999, status: "created" });
    }),

    // Invoices (hardcoded URL in source)
    http.get(`${API_BASE}/billing/v1/invoices/:id`, ({ params }) => {
        if (params.id === "inv-1") {
            return HttpResponse.json(fixtures.invoice);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/billing/v1/invoices`, () => {
        return HttpResponse.json(fixtures.invoices);
    }),

    // Allocations
    http.get(`${API_BASE}/analytics/v1/allocations/:id`, ({ params }) => {
        if (params.id === "alloc-1") {
            return HttpResponse.json(fixtures.allocation);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/allocations`, () => {
        return HttpResponse.json(fixtures.allocations);
    }),
    http.post(`${API_BASE}/analytics/v1/allocations`, () => {
        return HttpResponse.json(fixtures.createAllocation);
    }),
    http.patch(`${API_BASE}/analytics/v1/allocations/:id`, () => {
        return HttpResponse.json(fixtures.updateAllocation);
    }),

    // Assets
    http.get(`${API_BASE}/billing/v1/assets`, () => {
        return HttpResponse.json(fixtures.assets);
    }),

    // Alerts
    http.get(`${API_BASE}/analytics/v1/alerts/:id`, ({ params }) => {
        if (params.id === "alert-1") {
            return HttpResponse.json(fixtures.alert);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/alerts`, () => {
        return HttpResponse.json(fixtures.alerts);
    }),

    // Labels
    http.get(`${API_BASE}/analytics/v1/labels/:id`, ({ params }) => {
        if (params.id === "label-1") {
            return HttpResponse.json(fixtures.label);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/labels`, () => {
        return HttpResponse.json(fixtures.labels);
    }),

    // Cloud Diagrams
    http.post(`${API_BASE}/clouddiagrams/v1/scheme/find`, () => {
        return HttpResponse.json(fixtures.cloudDiagrams);
    }),

    // CloudFlow trigger
    http.post(`${API_BASE}/cloudflow/v1/trigger/:flowId`, () => {
        return HttpResponse.json(fixtures.cloudflowTrigger);
    }),

    // Budgets
    http.get(`${API_BASE}/analytics/v1/budgets`, () => {
        return HttpResponse.json(fixtures.budgets);
    }),
];
