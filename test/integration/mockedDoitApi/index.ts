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
    http.post(`${API_BASE}/iam/v1/users/invite`, () => {
        return HttpResponse.json(fixtures.inviteUser, { status: 201 });
    }),
    http.patch(`${API_BASE}/iam/v1/users/:id`, () => {
        return HttpResponse.json(fixtures.updateUser);
    }),
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
    http.patch(`${API_BASE}/analytics/v1/reports/:id`, ({ params }) => {
        if (params.id === "report-1") {
            return HttpResponse.json(fixtures.updateReport);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.post(`${API_BASE}/analytics/v1/reports`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
            ...fixtures.createReport,
            ...(body as Record<string, unknown>),
            _requestBody: body,
        });
    }),
    http.get(`${API_BASE}/analytics/v1/reports/:id/config`, ({ params }) => {
        if (params.id === "report-1") {
            return HttpResponse.json(fixtures.reportConfig);
        }
        return new HttpResponse(null, { status: 404 });
    }),
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
    http.get(`${API_BASE}/billing/v1/assets/:id`, ({ params }) => {
        if (params.id === "asset-1") {
            return HttpResponse.json(fixtures.assetDetailed);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/billing/v1/assets`, () => {
        return HttpResponse.json(fixtures.assets);
    }),

    // Alerts
    http.post(`${API_BASE}/analytics/v1/alerts`, () => {
        return HttpResponse.json(fixtures.createAlert);
    }),
    http.patch(`${API_BASE}/analytics/v1/alerts/:id`, () => {
        return HttpResponse.json(fixtures.updateAlert);
    }),

    http.get(`${API_BASE}/analytics/v1/alerts/:id`, ({ params }) => {
        if (params.id === "alert-1") {
            return HttpResponse.json(fixtures.alert);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/alerts`, () => {
        return HttpResponse.json(fixtures.alerts);
    }),

    // Label Assignments (must be before /labels/:id)
    http.get(`${API_BASE}/analytics/v1/labels/:id/assignments`, ({ params }) => {
        if (params.id === "label-1") {
            return HttpResponse.json(fixtures.labelAssignments);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.post(`${API_BASE}/analytics/v1/labels/:id/assignments`, ({ params }) => {
        if (params.id === "label-1") {
            return new HttpResponse(null, { status: 200 });
        }
        return new HttpResponse(null, { status: 404 });
    }),

    // Labels
    http.post(`${API_BASE}/analytics/v1/labels`, () => {
        return HttpResponse.json(fixtures.createLabel);
    }),
    http.patch(`${API_BASE}/analytics/v1/labels/:id`, () => {
        return HttpResponse.json(fixtures.updateLabel);
    }),
    http.get(`${API_BASE}/analytics/v1/labels/:id`, ({ params }) => {
        if (params.id === "label-1") {
            return HttpResponse.json(fixtures.label);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/labels`, () => {
        return HttpResponse.json(fixtures.labels);
    }),

    // Annotations
    http.patch(`${API_BASE}/analytics/v1/annotations/:id`, () => {
        return HttpResponse.json(fixtures.updateAnnotation);
    }),
    http.get(`${API_BASE}/analytics/v1/annotations/:id`, ({ params }) => {
        if (params.id === "annotation-1") {
            return HttpResponse.json(fixtures.annotation);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.post(`${API_BASE}/analytics/v1/annotations`, () => {
        return HttpResponse.json(fixtures.createAnnotation);
    }),
    http.get(`${API_BASE}/analytics/v1/annotations`, () => {
        return HttpResponse.json(fixtures.annotations);
    }),

    // DataHub Datasets
    http.post(`${API_BASE}/datahub/v1/datasets`, () => {
        return HttpResponse.json(fixtures.createDatahubDataset);
    }),
    http.patch(`${API_BASE}/datahub/v1/datasets/:name`, () => {
        return HttpResponse.json(fixtures.updateDatahubDataset);
    }),
    http.get(`${API_BASE}/datahub/v1/datasets/:name`, ({ params }) => {
        if (params.name === "My Custom Dataset") {
            return HttpResponse.json(fixtures.datahubDataset);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/datahub/v1/datasets`, () => {
        return HttpResponse.json(fixtures.datahubDatasets);
    }),

    // DataHub Events
    http.post(`${API_BASE}/datahub/v1/events`, () => {
        return HttpResponse.json(fixtures.sendDatahubEvents, { status: 201 });
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
    http.patch(`${API_BASE}/analytics/v1/budgets/:id`, ({ params }) => {
        if (params.id === "budget-1") {
            return HttpResponse.json(fixtures.updateBudget);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/budgets/:id`, ({ params }) => {
        if (params.id === "budget-1") {
            return HttpResponse.json(fixtures.budget);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.post(`${API_BASE}/analytics/v1/budgets`, () => {
        return HttpResponse.json(fixtures.createBudget);
    }),
    http.get(`${API_BASE}/analytics/v1/budgets`, () => {
        return HttpResponse.json(fixtures.budgets);
    }),
];
