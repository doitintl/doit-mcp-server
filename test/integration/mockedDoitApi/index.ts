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

    // Account Team
    http.get(`${API_BASE}/customers/v1/accountTeam`, () => {
        return HttpResponse.json(fixtures.accountTeam);
    }),

    // Resource Permissions (sharing)
    http.get(`${API_BASE}/sharing/v1/:resourceType/:resourceId`, ({ params }) => {
        const { resourceType, resourceId } = params;
        const allowed = ["alerts", "budgets", "reports", "allocations"];
        if (allowed.includes(resourceType as string) && resourceId === "budget-1") {
            return HttpResponse.json(fixtures.resourcePermissions);
        }
        return new HttpResponse(null, { status: 404 });
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
    http.post(`${API_BASE}/support/v1/tickets/:ticketId/comments`, async ({ params, request }) => {
        if (params.ticketId === "12345") {
            const body = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({ ...fixtures.createTicketComment, _requestBody: body }, { status: 201 });
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/support/v1/tickets/:ticketId/comments`, ({ params }) => {
        if (params.ticketId === "12345") {
            return HttpResponse.json(fixtures.ticketComments);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/support/v1/tickets/:ticketId`, ({ params }) => {
        if (params.ticketId === "12345") {
            return HttpResponse.json(fixtures.ticketDetail);
        }
        return new HttpResponse(null, { status: 404 });
    }),
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

    // Folders
    http.post(`${API_BASE}/analytics/v1/folders`, () => {
        return HttpResponse.json(fixtures.createFolder, { status: 201 });
    }),
    http.patch(`${API_BASE}/analytics/v1/folders/:id`, () => {
        return HttpResponse.json(fixtures.updateFolder);
    }),
    http.get(`${API_BASE}/analytics/v1/folders/:id`, ({ params }) => {
        if (params.id === "folder-1") {
            return HttpResponse.json(fixtures.folder);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/folders`, () => {
        return HttpResponse.json(fixtures.folders);
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
    http.get(`${API_BASE}/clouddiagrams/v1/scheme/stats`, () => {
        return HttpResponse.json(fixtures.cloudDiagramsStats);
    }),
    http.post(`${API_BASE}/clouddiagrams/v1/scheme/search`, () => {
        return HttpResponse.json(fixtures.cloudDiagramsSearch);
    }),
    http.get(`${API_BASE}/clouddiagrams/v1/statussheet/:id/resources/:rid/relationships`, () => {
        return HttpResponse.json(fixtures.cloudDiagramResourceRelationships);
    }),
    http.get(`${API_BASE}/clouddiagrams/v1/statussheet/:id/costs`, () => {
        return HttpResponse.json(fixtures.cloudDiagramCostSnapshot);
    }),
    // Node activities must be registered before the catch-all /activity route
    http.get(`${API_BASE}/clouddiagrams/v1/activity/node-activities`, () => {
        return HttpResponse.json(fixtures.cloudDiagramNodeActivities);
    }),
    http.get(`${API_BASE}/clouddiagrams/v1/activity`, () => {
        return HttpResponse.json(fixtures.cloudDiagramActivityGroups);
    }),

    // CloudFlow trigger
    http.post(`${API_BASE}/cloudflow/v1/trigger/:flowId`, () => {
        return HttpResponse.json(fixtures.cloudflowTrigger);
    }),

    // CloudFlow connections (register specific :connectionId before the list route)
    http.get(`${API_BASE}/cloudflow/v1/connections/:connectionId`, ({ params }) => {
        if (params.connectionId === "conn-1") {
            return HttpResponse.json(fixtures.cloudflowConnection);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/cloudflow/v1/connections`, () => {
        return HttpResponse.json(fixtures.cloudflowConnections);
    }),

    // CloudFlow templates (register specific :templateId before the list route)
    http.get(`${API_BASE}/cloudflow/v1/templates/:templateId`, ({ params }) => {
        if (params.templateId === "tmpl-1") {
            return HttpResponse.json(fixtures.cloudflowTemplate);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/cloudflow/v1/templates`, () => {
        return HttpResponse.json(fixtures.cloudflowTemplates);
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

    // Commitment Manager
    http.get(`${API_BASE}/analytics/v1/commitment-manager/:id`, ({ params }) => {
        if (params.id === "commitment-1") {
            return HttpResponse.json(fixtures.commitment);
        }
        return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API_BASE}/analytics/v1/commitment-manager`, () => {
        return HttpResponse.json(fixtures.commitments);
    }),

    // Themes (active)
    http.get(`${API_BASE}/analytics/v1/settings/active-theme`, () => {
        return HttpResponse.json(fixtures.activeTheme);
    }),
    http.put(`${API_BASE}/analytics/v1/settings/active-theme`, () => {
        return HttpResponse.json(fixtures.setActiveTheme);
    }),

    // Themes (custom)
    http.patch(`${API_BASE}/analytics/v1/settings/themes/:id`, () => {
        return HttpResponse.json(fixtures.updateTheme);
    }),

    // Insights (retrieve a single insight by source + key)
    http.get(`${API_BASE}/insights/v1/results/source/:source/insight/:key`, ({ params }) => {
        if (params.source === "aws-cost-optimization-hub" && params.key === "delete-ebs-volumes") {
            return HttpResponse.json(fixtures.insight);
        }
        return new HttpResponse(null, { status: 404 });
    }),

    // AVA
    http.post(`${API_BASE}/ava/v1/askSync`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        if (body?.ephemeral === false) {
            return HttpResponse.json(fixtures.avaAskSyncWithConversation);
        }
        return HttpResponse.json(fixtures.avaAskSync);
    }),
];
