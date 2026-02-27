import { describe, expect, it } from "vitest";
import type { Prompt } from "../prompts.js";
import { resolvePromptMessages } from "../prompts.js";

describe("resolvePromptMessages", () => {
    describe("single-message prompts", () => {
        it("returns a single message with role defaulting to 'user' when role is omitted", () => {
            const prompt: Prompt = {
                name: "Test",
                description: "Test prompt",
                text: "Hello world",
            };

            const messages = resolvePromptMessages(prompt);

            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual({ role: "user", text: "Hello world" });
        });

        it("returns a single message with the explicit 'user' role", () => {
            const prompt: Prompt = {
                name: "Test",
                description: "Test prompt",
                text: "Hello world",
                role: "user",
            };

            const messages = resolvePromptMessages(prompt);

            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual({ role: "user", text: "Hello world" });
        });

        it("returns a single message with the explicit 'assistant' role", () => {
            const prompt: Prompt = {
                name: "Test",
                description: "Test prompt",
                text: "I am the assistant.",
                role: "assistant",
            };

            const messages = resolvePromptMessages(prompt);

            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual({ role: "assistant", text: "I am the assistant." });
        });

        it("preserves the full text content unchanged", () => {
            const text = "Multi\nline\ntext with special chars: <>&\"'";
            const prompt: Prompt = {
                name: "Test",
                description: "Test prompt",
                text,
            };

            expect(resolvePromptMessages(prompt)[0].text).toBe(text);
        });
    });

    describe("multi-message prompts", () => {
        it("returns all messages as-is", () => {
            const prompt: Prompt = {
                name: "Test",
                description: "Test prompt",
                messages: [
                    { role: "user", text: "What are my costs?" },
                    { role: "assistant", text: "Let me check." },
                    { role: "user", text: "Focus on last month." },
                ],
            };

            const messages = resolvePromptMessages(prompt);

            expect(messages).toHaveLength(3);
            expect(messages[0]).toEqual({ role: "user", text: "What are my costs?" });
            expect(messages[1]).toEqual({ role: "assistant", text: "Let me check." });
            expect(messages[2]).toEqual({ role: "user", text: "Focus on last month." });
        });

        it("returns a single-element messages array unchanged", () => {
            const prompt: Prompt = {
                name: "Test",
                description: "Test prompt",
                messages: [{ role: "assistant", text: "Starting as assistant." }],
            };

            const messages = resolvePromptMessages(prompt);

            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual({ role: "assistant", text: "Starting as assistant." });
        });

        it("returns the exact messages array reference", () => {
            const messageArray = [{ role: "user" as const, text: "Hello" }];
            const prompt: Prompt = {
                name: "Test",
                description: "Test prompt",
                messages: messageArray,
            };

            expect(resolvePromptMessages(prompt)).toBe(messageArray);
        });
    });
});
