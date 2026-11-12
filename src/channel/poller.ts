import { DoitRequestError } from "../utils/requestError.js";
import type { ChannelItem, ChannelSource } from "./sources.js";

export type ChannelEvent = { content: string; meta: Record<string, string> };

export type ChannelPollerOptions = {
    sources: ChannelSource[];
    intervalMs: number;
    /** Delivers one event. A rejection is logged and does not stop the poller. */
    emit: (event: ChannelEvent) => Promise<void>;
    /** Read on every tick, so a key that appears later is picked up. */
    getToken?: () => string | undefined;
    log?: (message: string) => void;
    now?: () => number;
    /** Individual events per source per tick; the remainder is reported as one summary event. */
    maxEventsPerTick?: number;
    /** IDs remembered per source; the oldest are forgotten first. */
    maxSeenIds?: number;
};

type SourceState = {
    source: ChannelSource;
    /** False until one fetch has succeeded; that fetch is the baseline and emits nothing. */
    baselined: boolean;
    seen: Set<string>;
    failures: number;
    retryAt: number;
    /** Set on 401/403: retrying with the same key cannot succeed. */
    disabled: boolean;
};

const MAX_BACKOFF_MS = 60 * 60 * 1000;

const SUMMARY_LISTING: Record<string, string> = {
    anomalies: "get_anomalies lists recent anomalies.",
    incidents: "get_cloud_incidents lists recent incidents.",
};

/**
 * Polls DoiT list endpoints and emits one event per item not seen before.
 *
 * - The first successful fetch of a source is a baseline: everything it returns is recorded
 *   and nothing is emitted, so opening a session never replays history.
 * - Newness is decided by unseen ID. Failures back off exponentially per source, and nothing
 *   thrown by a source or by `emit` escapes a tick — the stdio entry treats an unhandled
 *   rejection as fatal, and a polling problem must never take the tools down.
 * - `stop()` is final: no timer is left and no event is emitted afterwards.
 */
export class ChannelPoller {
    private readonly states: SourceState[];
    private readonly intervalMs: number;
    private readonly emit: (event: ChannelEvent) => Promise<void>;
    private readonly getToken: () => string | undefined;
    private readonly log: (message: string) => void;
    private readonly now: () => number;
    private readonly maxEventsPerTick: number;
    private readonly maxSeenIds: number;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private started = false;
    private stopped = false;
    private ticking = false;
    private warnedMissingToken = false;

    constructor(options: ChannelPollerOptions) {
        this.states = options.sources.map((source) => ({
            source,
            baselined: false,
            seen: new Set<string>(),
            failures: 0,
            retryAt: 0,
            disabled: false,
        }));
        this.intervalMs = options.intervalMs;
        this.emit = options.emit;
        this.getToken = options.getToken ?? (() => process.env.DOIT_API_KEY);
        this.log = options.log ?? ((message) => console.error(message));
        this.now = options.now ?? Date.now;
        this.maxEventsPerTick = options.maxEventsPerTick ?? 10;
        this.maxSeenIds = options.maxSeenIds ?? 5000;
    }

    /** Takes the baseline now and schedules the following polls. Idempotent. */
    start(): void {
        if (this.started || this.stopped) return;
        this.started = true;
        void this.run();
    }

    stop(): void {
        this.stopped = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
    }

    private async run(): Promise<void> {
        await this.tick();
        if (this.stopped) return;
        this.timer = setTimeout(() => void this.run(), this.intervalMs);
        // Never keep the process alive: when the client closes stdin the server must exit.
        this.timer.unref?.();
    }

    /** One poll of every source. Never rejects. Exposed for tests. */
    async tick(): Promise<void> {
        if (this.ticking || this.stopped) return;
        this.ticking = true;
        try {
            const token = this.getToken();
            if (!token) {
                if (!this.warnedMissingToken) {
                    this.log("DoiT channel: DOIT_API_KEY is not set; no events will be sent until it is.");
                    this.warnedMissingToken = true;
                }
                return;
            }
            for (const state of this.states) {
                if (this.stopped) return;
                await this.pollSource(state, token);
            }
        } catch (error) {
            this.log(`DoiT channel: poll failed: ${describeError(error)}`);
        } finally {
            this.ticking = false;
        }
    }

    private async pollSource(state: SourceState, token: string): Promise<void> {
        const { source } = state;
        if (state.disabled || this.now() < state.retryAt) return;

        let items: ChannelItem[];
        try {
            items = await source.fetch(token, this.now() - source.lookbackMs);
        } catch (error) {
            this.recordFailure(state, error);
            return;
        }
        state.failures = 0;
        state.retryAt = 0;

        const fresh = items.filter((item) => !state.seen.has(item.id));
        for (const item of items) this.remember(state, item.id);

        if (!state.baselined) {
            state.baselined = true;
            return;
        }

        const individual = fresh.slice(0, this.maxEventsPerTick);
        for (const item of individual) {
            await this.deliver({ content: item.content, meta: item.meta });
        }
        const remaining = fresh.length - individual.length;
        if (remaining > 0) {
            await this.deliver({
                content:
                    `${remaining} further new ${source.kind} were not sent individually. ${SUMMARY_LISTING[source.kind] ?? ""}`.trim(),
                meta: { event_type: `${source.kind}_summary`, additional_count: String(remaining) },
            });
        }
    }

    private async deliver(event: ChannelEvent): Promise<void> {
        if (this.stopped) return;
        try {
            await this.emit(event);
        } catch (error) {
            this.log(`DoiT channel: could not send event: ${describeError(error)}`);
        }
    }

    private remember(state: SourceState, id: string): void {
        // Re-insert so ids still being returned stay the most recent and are evicted last.
        state.seen.delete(id);
        state.seen.add(id);
        while (state.seen.size > this.maxSeenIds) {
            const oldest = state.seen.values().next().value;
            if (oldest === undefined) break;
            state.seen.delete(oldest);
        }
    }

    private recordFailure(state: SourceState, error: unknown): void {
        const status = error instanceof DoitRequestError ? error.status : undefined;
        if (status === 401 || status === 403) {
            state.disabled = true;
            this.log(
                `DoiT channel: ${state.source.kind} polling stopped (HTTP ${status}). Check DOIT_API_KEY and its permissions, then restart.`
            );
            return;
        }
        state.failures += 1;
        const delay = Math.min(this.intervalMs * 2 ** state.failures, MAX_BACKOFF_MS);
        state.retryAt = this.now() + delay;
        this.log(
            `DoiT channel: ${state.source.kind} poll failed (${describeError(error)}); next attempt in ${Math.round(delay / 1000)}s.`
        );
    }
}

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
