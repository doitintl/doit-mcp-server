import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClient } from "../helpers.js";

describe("MCP Prompts Integration", () => {
	let client: Client;
	let server: Server;
	let cleanup: () => Promise<void>;

	beforeEach(async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		({ client, server, cleanup } = await createTestClient());
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
});
