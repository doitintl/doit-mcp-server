import { describe, expect, it } from "vitest";
import {
    buildWidgetResourceContent,
    buildWidgetStub,
    classifyUiDomainProvider,
    computeClaudeDomain,
    resolveUiDomain,
} from "../../../doit-mcp-server/src/widgetResource.js";

const EXPECTED_CLAUDE_DOMAIN = "2f32404e366572ee7f7f5f0eb625e6c4.claudemcpcontent.com";

describe("computeClaudeDomain", () => {
    it("returns the Claude sandbox hostname for the public MCP URL", async () => {
        await expect(computeClaudeDomain("https://mcp.doit.com/sse")).resolves.toBe(EXPECTED_CLAUDE_DOMAIN);
    });
});

describe("resolveUiDomain", () => {
    it("classifies the Claude-family aliases seen in worker logs", () => {
        expect(classifyUiDomainProvider("Anthropic/Toolbox")).toBe("claude");
        expect(classifyUiDomainProvider("Anthropic/ClaudeAI")).toBe("claude");
        expect(classifyUiDomainProvider("claude-ai")).toBe("claude");
    });

    it("classifies Claude-family clients and computes a Claude sandbox domain", async () => {
        await expect(
            resolveUiDomain({
                mcpClient: "Claude Cowork",
                widgetFetchOrigin: "https://mcp.doit.com",
                publicMcpUrl: "https://mcp.doit.com/sse",
                env: {},
            })
        ).resolves.toEqual({
            provider: "claude",
            uiDomain: EXPECTED_CLAUDE_DOMAIN,
        });
    });

    it("classifies OpenAI clients and returns an origin-style domain", async () => {
        await expect(
            resolveUiDomain({
                mcpClient: "ChatGPT",
                widgetFetchOrigin: "https://mcp.doit.com",
                publicMcpUrl: "https://mcp.doit.com/sse",
                env: {},
            })
        ).resolves.toEqual({
            provider: "openai",
            uiDomain: "https://mcp.doit.com",
        });
    });

    it("omits ui.domain when the client is undefined", async () => {
        await expect(
            resolveUiDomain({
                widgetFetchOrigin: "https://mcp.doit.com",
                publicMcpUrl: "https://mcp.doit.com/sse",
                env: {},
            })
        ).resolves.toEqual({
            provider: "omit",
        });
    });

    it("falls back to the persisted session provider when mcpClient is unavailable", async () => {
        await expect(
            resolveUiDomain({
                sessionProvider: "claude",
                widgetFetchOrigin: "https://mcp.doit.com",
                publicMcpUrl: "https://mcp.doit.com/sse",
                env: {},
            })
        ).resolves.toEqual({
            provider: "claude",
            uiDomain: EXPECTED_CLAUDE_DOMAIN,
        });
    });

    it("does not reuse a persisted provider when the current client is explicitly unknown", async () => {
        await expect(
            resolveUiDomain({
                mcpClient: "acme-mcp-client",
                sessionProvider: "claude",
                widgetFetchOrigin: "https://mcp.doit.com",
                publicMcpUrl: "https://mcp.doit.com/sse",
                env: {},
            })
        ).resolves.toEqual({
            provider: "omit",
        });
    });

    it("omits ui.domain for unknown clients", async () => {
        await expect(
            resolveUiDomain({
                mcpClient: "acme-mcp-client",
                widgetFetchOrigin: "https://mcp.doit.com",
                publicMcpUrl: "https://mcp.doit.com/sse",
                env: {},
            })
        ).resolves.toEqual({
            provider: "omit",
        });
    });

    it("honors forced provider overrides for rollout and debugging", async () => {
        await expect(
            resolveUiDomain({
                widgetFetchOrigin: "https://mcp.doit.com",
                publicMcpUrl: "https://mcp.doit.com/sse",
                env: {
                    UI_DOMAIN_PROVIDER: "openai",
                    OPENAI_UI_DOMAIN: "https://widgets.example.com",
                },
            })
        ).resolves.toEqual({
            provider: "openai",
            uiDomain: "https://widgets.example.com",
        });
    });
});

describe("widget resource contract", () => {
    it("keeps the widget stub pointed at the real widget fetch origin", () => {
        expect(buildWidgetStub("https://widgets.example.com")).toContain('"https://widgets.example.com/widget"');
    });

    it("emits the OpenAI alias only for OpenAI clients", async () => {
        const content = await buildWidgetResourceContent({
            widgetUri: "ui://doit/cloud-intelligence-v10.html",
            mcpClient: "ChatGPT",
            widgetFetchOrigin: "https://widgets.example.com",
            publicMcpUrl: "https://widgets.example.com/mcp",
            env: {},
        });

        const meta = content._meta as {
            ui: { domain?: string; csp: { connectDomains: string[] } };
            "openai/widgetDomain"?: string;
        };

        expect(meta.ui.domain).toBe("https://widgets.example.com");
        expect(meta["openai/widgetDomain"]).toBe("https://widgets.example.com");
        expect(meta.ui.csp.connectDomains).toEqual(
            expect.arrayContaining(["https://api.doit.com", "https://mcp.doit.com", "https://widgets.example.com"])
        );
    });

    it("uses a persisted OpenAI provider when the current request lacks mcpClient", async () => {
        const content = await buildWidgetResourceContent({
            widgetUri: "ui://doit/cloud-intelligence-v10.html",
            sessionProvider: "openai",
            widgetFetchOrigin: "https://widgets.example.com",
            publicMcpUrl: "https://widgets.example.com/mcp",
            env: {},
        });

        const meta = content._meta as {
            ui: { domain?: string; csp: { connectDomains: string[] } };
            "openai/widgetDomain"?: string;
        };

        expect(meta.ui.domain).toBe("https://widgets.example.com");
        expect(meta["openai/widgetDomain"]).toBe("https://widgets.example.com");
    });

    it("includes the public MCP origin in CSP when it differs from the widget fetch origin", async () => {
        const content = await buildWidgetResourceContent({
            widgetUri: "ui://doit/cloud-intelligence-v10.html",
            mcpClient: "ChatGPT",
            widgetFetchOrigin: "https://widgets.example.com",
            publicMcpUrl: "https://mcp-alt.example.com/mcp",
            env: {},
        });

        const meta = content._meta as {
            ui: { domain?: string; csp: { connectDomains: string[] } };
        };

        expect(meta.ui.csp.connectDomains).toEqual(
            expect.arrayContaining([
                "https://api.doit.com",
                "https://mcp.doit.com",
                "https://widgets.example.com",
                "https://mcp-alt.example.com",
            ])
        );
    });

    it("does not include the legacy ngrok host in CSP by default", async () => {
        const content = await buildWidgetResourceContent({
            widgetUri: "ui://doit/cloud-intelligence-v10.html",
            mcpClient: "ChatGPT",
            widgetFetchOrigin: "https://widgets.example.com",
            publicMcpUrl: "https://widgets.example.com/mcp",
            env: {},
        });

        const meta = content._meta as {
            ui: { domain?: string; csp: { connectDomains: string[] } };
        };

        expect(meta.ui.csp.connectDomains).not.toContain("https://dci-mcp.ngrok.app");
    });

    it("omits the domain key entirely when the resolver omits ui.domain", async () => {
        const content = await buildWidgetResourceContent({
            widgetUri: "ui://doit/cloud-intelligence-v10.html",
            mcpClient: "acme-mcp-client",
            widgetFetchOrigin: "https://widgets.example.com",
            publicMcpUrl: "https://widgets.example.com/mcp",
            env: {},
        });

        const meta = content._meta as {
            ui: { domain?: string; csp: { connectDomains: string[] } };
            "openai/widgetDomain"?: string;
        };

        expect(meta.ui).not.toHaveProperty("domain");
        expect(meta).not.toHaveProperty("openai/widgetDomain");
        expect(content.text).toContain('"https://widgets.example.com/widget"');
    });
});
