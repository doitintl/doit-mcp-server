import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoitRequestError } from "../../utils/requestError.js";
import { type ChannelEvent, ChannelPoller } from "../poller.js";
import type { ChannelItem, ChannelSource } from "../sources.js";

const item = (id: string): ChannelItem => ({
    id,
    content: `new ${id}`,
    meta: { event_type: "cost_anomaly", anomaly_id: id },
});

function setup(overrides: Partial<ConstructorParameters<typeof ChannelPoller>[0]> = {}) {
    const fetch = vi.fn<ChannelSource["fetch"]>();
    const source: ChannelSource = { kind: "anomalies", lookbackMs: 1000, fetch };
    const events: ChannelEvent[] = [];
    const log = vi.fn();
    let clock = 10_000;
    const poller = new ChannelPoller({
        sources: [source],
        intervalMs: 60_000,
        emit: async (event) => {
            events.push(event);
        },
        getToken: () => "token",
        log,
        now: () => clock,
        ...overrides,
    });
    return { poller, fetch, events, log, advance: (ms: number) => (clock += ms) };
}

describe("ChannelPoller", () => {
    it("treats the first successful fetch as a baseline and emits nothing", async () => {
        const { poller, fetch, events } = setup();
        fetch.mockResolvedValue([item("a"), item("b")]);

        await poller.tick();

        expect(events).toEqual([]);
        expect(fetch).toHaveBeenCalledWith("token", 9_000);
    });

    it("emits only items whose id was not seen before, once each", async () => {
        const { poller, fetch, events } = setup();
        fetch.mockResolvedValueOnce([item("a")]);
        fetch.mockResolvedValueOnce([item("b"), item("a")]);
        fetch.mockResolvedValueOnce([item("b"), item("a")]);

        await poller.tick();
        await poller.tick();
        await poller.tick();

        expect(events).toEqual([{ content: "new b", meta: { event_type: "cost_anomaly", anomaly_id: "b" } }]);
    });

    it("uses the next success as the baseline when the first fetch fails", async () => {
        const { poller, fetch, events, advance } = setup();
        fetch.mockRejectedValueOnce(new Error("network down"));
        fetch.mockResolvedValueOnce([item("a")]);
        fetch.mockResolvedValueOnce([item("a"), item("b")]);

        await poller.tick();
        advance(120_000);
        await poller.tick();
        await poller.tick();

        expect(events.map((event) => event.meta.anomaly_id)).toEqual(["b"]);
    });

    it("backs off exponentially after failures and recovers", async () => {
        const { poller, fetch, log, advance } = setup();
        fetch.mockRejectedValue(new Error("boom"));

        await poller.tick(); // failure 1 → retry in 120s
        await poller.tick(); // still backing off
        expect(fetch).toHaveBeenCalledTimes(1);

        advance(120_000);
        await poller.tick(); // failure 2 → retry in 240s
        advance(120_000);
        await poller.tick();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenCalledWith(expect.stringContaining("next attempt in 240s"));

        fetch.mockResolvedValue([]);
        advance(120_000);
        await poller.tick();
        await poller.tick();
        expect(fetch).toHaveBeenCalledTimes(4);
    });

    it.each([401, 403])("stops polling a source for good on HTTP %i", async (status) => {
        const { poller, fetch, log, advance } = setup();
        fetch.mockRejectedValue(new DoitRequestError("denied", status));

        await poller.tick();
        advance(24 * 60 * 60 * 1000);
        await poller.tick();

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(expect.stringContaining(`HTTP ${status}`));
    });

    it("does not call the API without a token, and says so once", async () => {
        const { poller, fetch, log } = setup({ getToken: () => undefined });

        await poller.tick();
        await poller.tick();

        expect(fetch).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledTimes(1);
    });

    it("caps individual events per tick and reports the rest in one summary event", async () => {
        const { poller, fetch, events } = setup({ maxEventsPerTick: 2 });
        fetch.mockResolvedValueOnce([]);
        fetch.mockResolvedValueOnce([item("a"), item("b"), item("c"), item("d")]);
        fetch.mockResolvedValueOnce([item("a"), item("b"), item("c"), item("d")]);

        await poller.tick();
        await poller.tick();
        await poller.tick();

        expect(events).toHaveLength(3);
        expect(events[2].meta).toEqual({ event_type: "anomalies_summary", additional_count: "2" });
        expect(events[2].content).toContain("get_anomalies");
    });

    it("forgets the oldest ids beyond maxSeenIds but keeps ids still being returned", async () => {
        const { poller, fetch, events } = setup({ maxSeenIds: 2 });
        fetch.mockResolvedValueOnce([item("a"), item("b")]);
        fetch.mockResolvedValueOnce([item("c"), item("b")]);
        fetch.mockResolvedValueOnce([item("c"), item("b")]);

        await poller.tick();
        await poller.tick();
        await poller.tick();

        expect(events.map((event) => event.meta.anomaly_id)).toEqual(["c"]);
    });

    it("survives a rejecting emit and a throwing source without rejecting", async () => {
        const { poller, fetch, log } = setup({ emit: () => Promise.reject(new Error("transport closed")) });
        fetch.mockResolvedValueOnce([]);
        fetch.mockResolvedValueOnce([item("a")]);

        await expect(poller.tick()).resolves.toBeUndefined();
        await expect(poller.tick()).resolves.toBeUndefined();

        expect(log).toHaveBeenCalledWith(expect.stringContaining("transport closed"));
    });

    it("emits nothing after stop(), even for a fetch already in flight", async () => {
        const { poller, fetch, events } = setup();
        fetch.mockResolvedValueOnce([]);
        await poller.tick();
        let release: (items: ChannelItem[]) => void = () => {};
        fetch.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

        const inFlight = poller.tick();
        poller.stop();
        release([item("a")]);
        await inFlight;

        expect(events).toEqual([]);
    });

    describe("scheduling", () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it("polls on start and then every interval until stopped", async () => {
            const { poller, fetch } = setup();
            fetch.mockResolvedValue([]);

            poller.start();
            poller.start();
            await vi.advanceTimersByTimeAsync(0);
            expect(fetch).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(60_000);
            expect(fetch).toHaveBeenCalledTimes(2);

            poller.stop();
            await vi.advanceTimersByTimeAsync(600_000);
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(vi.getTimerCount()).toBe(0);
        });

        it("does not start after stop()", async () => {
            const { poller, fetch } = setup();

            poller.stop();
            poller.start();
            await vi.advanceTimersByTimeAsync(60_000);

            expect(fetch).not.toHaveBeenCalled();
        });
    });
});
