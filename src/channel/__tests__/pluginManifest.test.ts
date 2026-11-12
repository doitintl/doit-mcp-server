import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseChannelConfig } from "../config.js";

// CI has no `claude` CLI, so `claude plugin validate` cannot run there. This keeps the plugin
// manifest and the server's channel opt-in from drifting apart.
const read = (path: string) => JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8"));
const plugin = read("plugins/doit/.claude-plugin/plugin.json");
const marketplace = read(".claude-plugin/marketplace.json");
const packageJson = read("package.json");
const server = plugin.mcpServers.doit;
const [channel] = plugin.channels;

describe("doit plugin manifest", () => {
    it("is the plugin the marketplace lists", () => {
        expect(marketplace.plugins).toEqual([expect.objectContaining({ name: plugin.name, source: "./plugins/doit" })]);
    });

    it("binds the channel to the MCP server that runs the published package", () => {
        expect(plugin.channels).toHaveLength(1);
        expect(channel.server).toBe("doit");
        expect([server.command, ...server.args]).toEqual([
            "npx",
            "-y",
            `@doitintl/doit-mcp-server@${packageJson.version}`,
        ]);
    });

    it("carries the package version, so every release raises it and re-pins the package", () => {
        // The plugin directory refuses an unpinned launcher (`@latest` or a range) and expects
        // `version` to rise with each release. scripts/release/prepare-release.sh keeps both in step.
        expect(plugin.version).toBe(packageJson.version);
    });

    it("ships what the plugin directory requires in the plugin folder", () => {
        expect(plugin.license).toBe(packageJson.license);
        expect(plugin.privacyPolicyUrl).toMatch(/^https:\/\//);
        expect(plugin.supportUrl).toMatch(/^https:\/\//);
        expect(existsSync(new URL("../../../plugins/doit/.claude-plugin/icon.png", import.meta.url))).toBe(true);
        const readme = readFileSync(new URL("../../../plugins/doit/README.md", import.meta.url), "utf8");
        expect(readme).toContain(`@doitintl/doit-mcp-server@${packageJson.version}`);
    });

    it("passes every setting to an environment variable the server reads", () => {
        // Claude Code substitutes `${user_config.<key>}` when it launches the server.
        const setting = (key: string) => `\${user_config.${key}}`;
        expect(server.env).toEqual({
            DOIT_API_KEY: setting("api_key"),
            // Events only: the tools come from the listed DoiT plugin or the remote connector, so
            // this server must not serve them a second time.
            DOIT_CHANNEL_ONLY: "true",
            DOIT_CHANNEL_EVENTS: setting("events"),
            DOIT_CHANNEL_POLL_SECONDS: setting("poll_seconds"),
        });
        expect(Object.keys(plugin.userConfig).sort()).toEqual(["api_key", "events", "poll_seconds"]);
        expect(plugin.userConfig.api_key).toMatchObject({ sensitive: true, required: true });
    });

    it("declares settings at the plugin's top level, not under the channel entry", () => {
        // Observed on Claude Code 2.1.322: with the settings declared under the channel entry,
        // `claude plugin configure` listed no options and the plugin's server was never launched.
        expect(channel).toEqual({ server: "doit", displayName: plugin.displayName });
    });

    it("has defaults that turn channel mode on with a valid interval", () => {
        const { events, poll_seconds: pollSeconds } = plugin.userConfig;

        expect(
            parseChannelConfig(
                { DOIT_CHANNEL_EVENTS: events.default, DOIT_CHANNEL_POLL_SECONDS: String(pollSeconds.default) },
                () => {
                    throw new Error("defaults must not produce a warning");
                }
            )
        ).toEqual({ events: ["anomalies", "incidents"], pollIntervalMs: 300_000 });
        expect(pollSeconds.min).toBe(60);
    });
});
