import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient } from "../helpers.js";

describe("MCP Prompts Integration", () => {
    let client: Client;
    let _server: Server;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        ({ client, _server, cleanup } = await createTestClient());
    });

    afterEach(async () => {
        await cleanup();
        vi.restoreAllMocks();
    });

    describe("prompts/list", () => {
        it("returns all registered prompts", async () => {
            const result = await client.listPrompts();
            expect(result.prompts.length).toBeGreaterThan(0);
        });

        it("each prompt has name and description", async () => {
            const result = await client.listPrompts();
            for (const prompt of result.prompts) {
                expect(prompt.name).toBeTruthy();
                expect(prompt.description).toBeTruthy();
            }
        });

        it("includes expected prompt names", async () => {
            const result = await client.listPrompts();
            const names = result.prompts.map((p) => p.name);
            expect(names).toContain("filter_fields_reference");
            expect(names).toContain("generate_report_document");
            expect(names).toContain("query_best_practice");
            expect(names).toContain("trigger_cloudflow_flow");
            expect(names).toContain("search_expert_inquiries");
            expect(names).toContain("expert_inquiries");
        });
    });

    describe("prompts/get", () => {
        it("retrieves a prompt by name and returns messages", async () => {
            const result = await client.getPrompt({ name: "query_best_practice" });
            expect(result.messages).toBeDefined();
            expect(result.messages.length).toBeGreaterThan(0);
            expect(result.messages[0].role).toBe("user");
            expect(result.messages[0].content.type).toBe("text");
        });

        it("returns prompt with description", async () => {
            const result = await client.getPrompt({ name: "generate_report_document" });
            expect(result.description).toBeTruthy();
        });

        it("returns error for unknown prompt", async () => {
            await expect(client.getPrompt({ name: "nonexistent_prompt" })).rejects.toThrow();
        });

        it("handles prompt with arguments", async () => {
            const result = await client.getPrompt({
                name: "trigger_cloudflow_flow",
                arguments: { flowID: "flow-abc" },
            });
            expect(result.messages).toBeDefined();
            expect(result.messages.length).toBeGreaterThan(0);
            const lastMessage = result.messages[result.messages.length - 1];
            expect(lastMessage.content.type).toBe("text");
            const text = lastMessage.content.type === "text" ? lastMessage.content.text : "";
            expect(text).toContain("flow-abc");
        });
    });

    describe("expert_inquiries prompt", () => {
        it("is listed and returns a user message referencing list_tickets", async () => {
            const list = await client.listPrompts();
            expect(list.prompts.find((p) => p.name === "expert_inquiries")).toBeDefined();
            const result = await client.getPrompt({ name: "expert_inquiries" });
            expect(result.messages[0].role).toBe("user");
            const text = result.messages[0].content.type === "text" ? result.messages[0].content.text : "";
            expect(text).toContain("list_tickets");
        });
    });

    describe("search_expert_inquiries prompt", () => {
        it("is listed with a description", async () => {
            const result = await client.listPrompts();
            const prompt = result.prompts.find((p) => p.name === "search_expert_inquiries");
            expect(prompt).toBeDefined();
            expect(prompt?.description).toBeTruthy();
        });

        it("lists keyword as required and platform/product as optional arguments", async () => {
            const result = await client.listPrompts();
            const prompt = result.prompts.find((p) => p.name === "search_expert_inquiries");
            expect(prompt).toBeDefined();
            const args = prompt?.arguments ?? [];
            const keyword = args.find((a) => a.name === "keyword");
            const platform = args.find((a) => a.name === "platform");
            const product = args.find((a) => a.name === "product");
            expect(keyword).toBeDefined();
            expect(keyword?.required).toBe(true);
            expect(platform).toBeDefined();
            expect(platform?.required).toBeFalsy();
            expect(product).toBeDefined();
            expect(product?.required).toBeFalsy();
        });

        it("returns a user message when called with a keyword", async () => {
            const result = await client.getPrompt({
                name: "search_expert_inquiries",
                arguments: { keyword: "billing" },
            });
            expect(result.messages).toBeDefined();
            expect(result.messages.length).toBeGreaterThan(0);
            expect(result.messages[0].role).toBe("user");
            expect(result.messages[0].content.type).toBe("text");
        });

        it("prompt text references list_tickets tool", async () => {
            const result = await client.getPrompt({
                name: "search_expert_inquiries",
                arguments: { keyword: "billing" },
            });
            const text = result.messages[0].content.type === "text" ? result.messages[0].content.text : "";
            expect(text).toContain("list_tickets");
        });
    });
});
