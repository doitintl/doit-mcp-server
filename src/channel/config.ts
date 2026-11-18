/** Event kinds the channel can push. Values are what `DOIT_CHANNEL_EVENTS` accepts. */
export const CHANNEL_EVENT_KINDS = ["anomalies", "incidents"] as const;
export type ChannelEventKind = (typeof CHANNEL_EVENT_KINDS)[number];

export const DEFAULT_CHANNEL_POLL_SECONDS = 300;
export const MIN_CHANNEL_POLL_SECONDS = 60;

export type ChannelConfig = {
    events: ChannelEventKind[];
    pollIntervalMs: number;
};

/**
 * Reads the channel opt-in from the environment. Returns undefined — channel mode off, no
 * capability, no polling — unless `DOIT_CHANNEL_EVENTS` names at least one known event kind.
 *
 * - `DOIT_CHANNEL_EVENTS`: comma-separated list of {@link CHANNEL_EVENT_KINDS}. Unknown entries
 *   are reported through `warn` and ignored.
 * - `DOIT_CHANNEL_POLL_SECONDS`: poll interval, default 300, floor 60. An unparseable value
 *   falls back to the default.
 */
export function parseChannelConfig(
    env: Record<string, string | undefined> = process.env,
    warn: (message: string) => void = (message) => console.error(message)
): ChannelConfig | undefined {
    const requested = (env.DOIT_CHANNEL_EVENTS ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    if (requested.length === 0) return undefined;

    const known = new Set<string>(CHANNEL_EVENT_KINDS);
    const unknown = requested.filter((entry) => !known.has(entry));
    if (unknown.length > 0) {
        warn(
            `DOIT_CHANNEL_EVENTS: ignoring unknown event kind(s) ${unknown.join(", ")}; supported: ${CHANNEL_EVENT_KINDS.join(", ")}`
        );
    }
    const events = CHANNEL_EVENT_KINDS.filter((kind) => requested.includes(kind));
    if (events.length === 0) return undefined;

    const rawSeconds = env.DOIT_CHANNEL_POLL_SECONDS;
    let seconds = DEFAULT_CHANNEL_POLL_SECONDS;
    if (rawSeconds !== undefined && rawSeconds.trim() !== "") {
        const parsed = Number(rawSeconds);
        if (Number.isFinite(parsed) && parsed > 0) {
            seconds = Math.max(MIN_CHANNEL_POLL_SECONDS, Math.floor(parsed));
            if (parsed < MIN_CHANNEL_POLL_SECONDS) {
                warn(`DOIT_CHANNEL_POLL_SECONDS: raised to the ${MIN_CHANNEL_POLL_SECONDS}s minimum`);
            }
        } else {
            warn(`DOIT_CHANNEL_POLL_SECONDS: "${rawSeconds}" is not a positive number; using ${seconds}s`);
        }
    }

    return { events, pollIntervalMs: seconds * 1000 };
}

/**
 * `DOIT_CHANNEL_ONLY`: serve events and nothing else — no tools, prompts or resources. For a
 * client that already has the DoiT tools from another connection (for example the hosted
 * server) and wants this process for channel events alone. Takes effect whether or not
 * `DOIT_CHANNEL_EVENTS` names an event kind: a channel-only process never serves tools.
 */
export function isChannelOnly(env: Record<string, string | undefined> = process.env): boolean {
    return ["1", "true", "yes", "on"].includes((env.DOIT_CHANNEL_ONLY ?? "").trim().toLowerCase());
}
