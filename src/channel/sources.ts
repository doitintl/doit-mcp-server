import { ANOMALIES_BASE_URL, type AnomaliesResponse } from "../tools/anomalies.js";
import { CLOUD_INCIDENTS_BASE_URL, type CloudIncidentsResponse } from "../tools/cloudIncidents.js";
import { makeDoitRequest } from "../utils/util.js";
import type { ChannelEventKind } from "./config.js";

const HOUR_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 100;

/** One item a source saw on a poll. */
export type ChannelItem = {
    id: string;
    /** Declarative, fixed-template text: no free text from the API. */
    content: string;
    /** Tag attributes. Keys are identifiers (letters, digits, underscores); values are sanitized. */
    meta: Record<string, string>;
};

export type ChannelSource = {
    kind: ChannelEventKind;
    /** How far back each poll looks. Older items are not fetched. */
    lookbackMs: number;
    /** Fetches the items inside the window. Throws on API failure; the poller handles it. */
    fetch(token: string, sinceMs: number): Promise<ChannelItem[]>;
};

/**
 * Reduces an API-supplied value to a short single-token attribute value. Event attributes are
 * rendered into the model's context, so nothing free-form is passed through: only letters,
 * digits and `. _ : / -` survive, everything else becomes `_`, and the result is capped.
 */
export function sanitizeMetaValue(value: unknown, maxLength = 64): string {
    if (value === null || value === undefined) return "";
    return String(value)
        .normalize("NFKC")
        .replace(/[^A-Za-z0-9._:/-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, maxLength);
}

function compactMeta(meta: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== ""));
}

/**
 * Cost anomalies. The list endpoint's `minCreationTime` filters on usage start time, and an
 * anomaly is typically detected some time after its usage started, so the window is wide and
 * newness is decided by unseen ID, never by timestamp.
 */
export const anomaliesSource: ChannelSource = {
    kind: "anomalies",
    lookbackMs: 7 * 24 * HOUR_MS,
    async fetch(token, sinceMs) {
        const params = new URLSearchParams({
            minCreationTime: String(sinceMs),
            sortBy: "startTime",
            sortOrder: "desc",
            maxResults: String(PAGE_SIZE),
        });
        const data = await makeDoitRequest<AnomaliesResponse>(`${ANOMALIES_BASE_URL}?${params}`, token, {
            method: "GET",
            timeoutMs: REQUEST_TIMEOUT_MS,
        });
        return (data?.anomalies ?? [])
            .filter((anomaly) => typeof anomaly.id === "string" && anomaly.id !== "")
            .map((anomaly) => ({
                id: anomaly.id as string,
                content: "DoiT detected a new cost anomaly. Details are available from get_anomaly by anomaly_id.",
                meta: compactMeta({
                    event_type: "cost_anomaly",
                    anomaly_id: sanitizeMetaValue(anomaly.id),
                    severity: sanitizeMetaValue(anomaly.severityLevel),
                    platform: sanitizeMetaValue(anomaly.platform),
                    service: sanitizeMetaValue(anomaly.serviceName),
                    cost_of_anomaly: Number.isFinite(anomaly.costOfAnomaly) ? anomaly.costOfAnomaly.toFixed(2) : "",
                }),
            }));
    },
};

/** Active cloud provider incidents, windowed on the incident's creation time. */
export const incidentsSource: ChannelSource = {
    kind: "incidents",
    lookbackMs: 24 * HOUR_MS,
    async fetch(token, sinceMs) {
        const params = new URLSearchParams({
            filter: "status:active",
            minCreationTime: String(sinceMs),
            maxResults: String(PAGE_SIZE),
        });
        const data = await makeDoitRequest<CloudIncidentsResponse>(`${CLOUD_INCIDENTS_BASE_URL}?${params}`, token, {
            method: "GET",
            timeoutMs: REQUEST_TIMEOUT_MS,
        });
        return (data?.incidents ?? [])
            .filter((incident) => incident.id !== undefined && incident.id !== null && String(incident.id) !== "")
            .map((incident) => ({
                id: String(incident.id),
                content:
                    "A new cloud provider incident was reported. Details are available from get_cloud_incident by incident_id.",
                meta: compactMeta({
                    event_type: "cloud_incident",
                    incident_id: sanitizeMetaValue(incident.id),
                    platform: sanitizeMetaValue(incident.platform),
                    product: sanitizeMetaValue(incident.product),
                    status: sanitizeMetaValue(incident.status),
                }),
            }));
    },
};

const SOURCES: Record<ChannelEventKind, ChannelSource> = {
    anomalies: anomaliesSource,
    incidents: incidentsSource,
};

export function sourcesFor(kinds: readonly ChannelEventKind[]): ChannelSource[] {
    return kinds.map((kind) => SOURCES[kind]);
}
