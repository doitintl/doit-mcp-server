import { describe, expect, it } from "vitest";
import type { Prompt, PromptMessage } from "../prompts.js";
import { applyPromptMessageArguments, getPromptMissingArgs, resolvePromptMessages } from "../prompts.js";

describe("applyPromptMessageArguments", () => {
    const msg = (text: string, role: "user" | "assistant" = "user"): PromptMessage => ({ role, text });

    it("handles an empty messages array", () => {
        expect(applyPromptMessageArguments([], { name: "Alice" })).toEqual([]);
    });

    it("appends a single arg as a key-value line after the last message", () => {
        const result = applyPromptMessageArguments([msg("Do the thing")], { flowID: "f-1" });
        expect(result[0].text).toBe("Do the thing\n\nflowID: f-1");
    });

    it("appends multiple args as separate key-value lines", () => {
        const result = applyPromptMessageArguments([msg("Hello")], { name: "Alice", id: "42" });
        expect(result[0].text).toBe("Hello\n\nname: Alice\nid: 42");
    });

    it("only modifies the last message in a multi-message prompt", () => {
        const messages = [msg("First"), msg("Second", "assistant"), msg("Third")];
        const result = applyPromptMessageArguments(messages, { key: "val" });
        expect(result[0].text).toBe("First");
        expect(result[1].text).toBe("Second");
        expect(result[2].text).toBe("Third\n\nkey: val");
    });

    it("preserves the role of every message", () => {
        const messages: PromptMessage[] = [
            { role: "user", text: "A" },
            { role: "assistant", text: "B" },
        ];
        const result = applyPromptMessageArguments(messages, { x: "1" });
        expect(result[0].role).toBe("user");
        expect(result[1].role).toBe("assistant");
    });

    it("converts non-string arg values to strings", () => {
        const result = applyPromptMessageArguments([msg("Base")], { count: 7 });
        expect(result[0].text).toBe("Base\n\ncount: 7");
    });

    it("does not mutate the original messages", () => {
        const original: PromptMessage[] = [{ role: "user", text: "Hello" }];
        applyPromptMessageArguments(original, { name: "Alice" });
        expect(original[0].text).toBe("Hello");
    });
});

describe("getPromptMissingArgs", () => {
    const base = { name: "p", description: "d", text: "t" };

    it("returns empty array when prompt has no arguments", () => {
        expect(getPromptMissingArgs({ ...base }, {})).toEqual([]);
    });

    it("returns empty array when all required args are present", () => {
        const prompt: Prompt = { ...base, arguments: [{ name: "foo", description: "", required: true }] };
        expect(getPromptMissingArgs(prompt, { foo: "bar" })).toEqual([]);
    });

    it("returns names of required args that are absent", () => {
        const prompt: Prompt = {
            ...base,
            arguments: [
                { name: "foo", description: "", required: true },
                { name: "bar", description: "", required: true },
            ],
        };
        expect(getPromptMissingArgs(prompt, {})).toEqual(["foo", "bar"]);
    });

    it("does not report optional args as missing", () => {
        const prompt: Prompt = {
            ...base,
            arguments: [
                { name: "req", description: "", required: true },
                { name: "opt", description: "", required: false },
            ],
        };
        expect(getPromptMissingArgs(prompt, {})).toEqual(["req"]);
    });

    it("treats an empty string as missing", () => {
        const prompt: Prompt = { ...base, arguments: [{ name: "foo", description: "", required: true }] };
        expect(getPromptMissingArgs(prompt, { foo: "" })).toEqual(["foo"]);
    });

    it("accepts numeric zero as a provided value", () => {
        const prompt: Prompt = { ...base, arguments: [{ name: "count", description: "", required: true }] };
        expect(getPromptMissingArgs(prompt, { count: 0 })).toEqual([]);
    });

    it("only reports args that are actually missing when some are present", () => {
        const prompt: Prompt = {
            ...base,
            arguments: [
                { name: "a", description: "", required: true },
                { name: "b", description: "", required: true },
                { name: "c", description: "", required: true },
            ],
        };
        expect(getPromptMissingArgs(prompt, { b: "val" })).toEqual(["a", "c"]);
    });
});

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
