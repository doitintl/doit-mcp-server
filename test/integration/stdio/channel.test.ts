import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { type ChannelServerHandle, serveDoitChannelStdio } from "../../../src/channel/serve.js";
import { SERVER_INSTRUCTIONS } from "../../../src/docs/serverInstructions.js";
import { createTestClient } from "../helpers.js";
import { mswServer } from "../setup.js";

const API_BASE = "https://api.doit.com";

type ChannelNotification = { method: string; params?: { content?: string; meta?: Record<string, string> } };

const anomaly = (id: string) => ({
    id,
    billingAccount: "ba-123",
    attribution: "Project X",
    costOfAnomaly: 150.5,
    platform: "google-cloud",
    scope: "project",
    serviceName: "Compute Engine",
    top3SKUs: [],
    severityLevel: "high",
    timeFrame: "daily",
    startTime: Date.now(),
    status: "open",
    endTime: null,
    acknowledged: false,
});

const incident = (id: string) => ({
    id,
    createTime: Date.now(),
    platform: "amazon-web-services",
    product: "EC2",
    title: "Free-text title that stays out of the event",
    status: "active",
});

/** Serves the channel entry over an in-memory transport to a 2025-era client. */
async function connectChannel(pollIntervalMs = 20) {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const logs: string[] = [];
    const handle = await serveDoitChannelStdio(
        { events: ["anomalies", "incidents"], pollIntervalMs },
        { transport: serverTransport, log: (message) => logs.push(message) }
    );
    const received: ChannelNotification[] = [];
    const client = new Client({ name: "channel-test-client", version: "1.0.0" });
    client.fallbackNotificationHandler = async (notification) => {
        received.push(notification as ChannelNotification);
    };
    await client.connect(clientTransport);
    return { client, handle, received, logs };
}

async function waitFor(condition: () => boolean, timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error("timed out waiting for condition");
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

describe("channel mode (DOIT_CHANNEL_EVENTS)", () => {
    let open: { client: Client; handle: ChannelServerHandle } | undefined;

    afterEach(async () => {
        await open?.client.close();
        await open?.handle.close();
        open = undefined;
    });

    it("declares the channel capability and describes events, keeping the full tool surface", async () => {
        mswServer.use(
            http.get(`${API_BASE}/anomalies/v1`, () => HttpResponse.json({ anomalies: [] })),
            http.get(`${API_BASE}/core/v1/cloudincidents`, () => HttpResponse.json({ incidents: [] }))
        );
        open = await connectChannel();
        const { client } = open;

        expect(client.getServerCapabilities()?.experimental).toEqual({ "claude/channel": {} });
        expect(client.getServerCapabilities()?.tools).toEqual({});
        expect(client.getInstructions()).toContain(SERVER_INSTRUCTIONS);
        expect(client.getInstructions()).toContain("cost_anomaly");

        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(["get_anomaly", "get_cloud_incident"]));
    });

    it("baselines on the first poll, then pushes one event per new anomaly and incident", async () => {
        let anomalyPolls = 0;
        let incidentPolls = 0;
        const requests: URL[] = [];
        mswServer.use(
            http.get(`${API_BASE}/anomalies/v1`, ({ request }) => {
                requests.push(new URL(request.url));
                anomalyPolls += 1;
                return HttpResponse.json({
                    anomalies: anomalyPolls === 1 ? [anomaly("anom-old")] : [anomaly("anom-new"), anomaly("anom-old")],
                });
            }),
            http.get(`${API_BASE}/core/v1/cloudincidents`, ({ request }) => {
                requests.push(new URL(request.url));
                incidentPolls += 1;
                return HttpResponse.json({
                    incidents: incidentPolls === 1 ? [incident("inc-old")] : [incident("inc-old"), incident("inc-new")],
                });
            })
        );
        open = await connectChannel();
        const { received } = open;

        await waitFor(() => received.length >= 2);
        await waitFor(() => anomalyPolls >= 4 && incidentPolls >= 4);

        expect(received).toHaveLength(2); // no replay of the baseline, no repeats on later polls
        expect(received.every((n) => n.method === "notifications/claude/channel")).toBe(true);
        expect(received.map((n) => n.params?.meta)).toEqual(
            expect.arrayContaining([
                {
                    event_type: "cost_anomaly",
                    anomaly_id: "anom-new",
                    severity: "high",
                    platform: "google-cloud",
                    service: "Compute_Engine",
                    cost_of_anomaly: "150.50",
                },
                {
                    event_type: "cloud_incident",
                    incident_id: "inc-new",
                    platform: "amazon-web-services",
                    product: "EC2",
                    status: "active",
                },
            ])
        );
        expect(JSON.stringify(received)).not.toMatch(/Free-text|Project X/);

        const incidentRequest = requests.find((url) => url.pathname.endsWith("/cloudincidents"));
        expect(incidentRequest?.searchParams.get("filter")).toBe("status:active");
        expect(requests[0].searchParams.get("minCreationTime")).toMatch(/^\d+$/);
    });

    it("keeps serving tools while the API is failing, and stops polling when the client disconnects", async () => {
        let polls = 0;
        mswServer.use(
            http.get(`${API_BASE}/anomalies/v1`, () => {
                polls += 1;
                return HttpResponse.json({ error: "down" }, { status: 500 });
            }),
            http.get(`${API_BASE}/core/v1/cloudincidents`, () => {
                polls += 1;
                return HttpResponse.json({ incidents: [] });
            })
        );
        open = await connectChannel();
        const { client, received, logs } = open;

        await waitFor(() => logs.some((line) => line.includes("anomalies poll failed")));
        const { tools } = await client.listTools();
        expect(tools.length).toBeGreaterThan(0);
        expect(received).toEqual([]);

        await client.close();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const pollsAfterClose = polls;
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(polls).toBe(pollsAfterClose);
    });
});

describe("default stdio mode", () => {
    it("declares no channel capability and makes no polling requests", async () => {
        let polls = 0;
        mswServer.use(
            http.get(`${API_BASE}/anomalies/v1`, () => {
                polls += 1;
                return HttpResponse.json({ anomalies: [] });
            })
        );
        const { client, cleanup } = await createTestClient();
        try {
            expect(client.getServerCapabilities()?.experimental).toBeUndefined();
            expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(polls).toBe(0);
        } finally {
            await cleanup();
        }
    });
});
