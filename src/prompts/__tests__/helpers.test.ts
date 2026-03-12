import { describe, expect, it } from "vitest";
import {
    applyPromptMessageArguments,
    deprecateBySnakeCaseNotice,
    filterPromptArgs,
    getPromptMissingArgs,
    resolvePromptMessages,
} from "../helpers.js";
import type { Prompt, PromptMessage } from "../types.js";

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

    it("returns messages unchanged when args is empty", () => {
        const original: PromptMessage[] = [{ role: "user", text: "Hello" }];
        const result = applyPromptMessageArguments(original, {});
        expect(result[0].text).toBe("Hello");
        expect(result).toEqual(original);
    });

    it("serializes a plain object value with JSON.stringify", () => {
        const body = { key: "value", nested: { n: 1 } };
        const result = applyPromptMessageArguments([msg("Trigger")], { requestBodyJson: body });
        expect(result[0].text).toBe(`Trigger\n\nrequestBodyJson: ${JSON.stringify(body, null, 2)}`);
    });

    it("serializes an array value with JSON.stringify", () => {
        const list = [1, "two", { three: 3 }];
        const result = applyPromptMessageArguments([msg("Base")], { items: list });
        expect(result[0].text).toBe(`Base\n\nitems: ${JSON.stringify(list, null, 2)}`);
    });

    it("skips null arg values and returns messages unchanged", () => {
        const original = [msg("Base")];
        const result = applyPromptMessageArguments(original, { optional: null });
        expect(result[0].text).toBe("Base");
    });

    it("skips undefined arg values and returns messages unchanged", () => {
        const original = [msg("Base")];
        const result = applyPromptMessageArguments(original, { optional: undefined });
        expect(result[0].text).toBe("Base");
    });

    it("skips null/undefined args but still appends present args", () => {
        const result = applyPromptMessageArguments([msg("Base")], { skip: null, keep: "yes", also: undefined });
        expect(result[0].text).toBe("Base\n\nkeep: yes");
    });
});

describe("filterPromptArgs", () => {
    const base = { name: "p", description: "d", text: "t" };

    it("returns an empty object when the prompt declares no arguments", () => {
        expect(filterPromptArgs({ ...base }, { extra: "value" })).toEqual({});
    });

    it("keeps only keys declared in prompt.arguments", () => {
        const prompt: Prompt = { ...base, arguments: [{ name: "flowID", description: "" }] };
        expect(filterPromptArgs(prompt, { flowID: "f-1", injected: "bad" })).toEqual({ flowID: "f-1" });
    });

    it("drops entries whose value is an empty string", () => {
        const prompt: Prompt = {
            ...base,
            arguments: [
                { name: "flowID", description: "" },
                { name: "requestBodyJson", description: "" },
            ],
        };
        expect(filterPromptArgs(prompt, { flowID: "f-1", requestBodyJson: "" })).toEqual({ flowID: "f-1" });
    });

    it("retains non-string values including objects and numbers", () => {
        const prompt: Prompt = {
            ...base,
            arguments: [
                { name: "count", description: "" },
                { name: "payload", description: "" },
            ],
        };
        const payload = { key: "val" };
        expect(filterPromptArgs(prompt, { count: 5, payload })).toEqual({ count: 5, payload });
    });

    it("returns an empty object when args is empty", () => {
        const prompt: Prompt = { ...base, arguments: [{ name: "flowID", description: "" }] };
        expect(filterPromptArgs(prompt, {})).toEqual({});
    });

    it("returns an empty object when args contains only undeclared keys", () => {
        const prompt: Prompt = { ...base, arguments: [{ name: "flowID", description: "" }] };
        expect(filterPromptArgs(prompt, { unknown: "x", another: "y" })).toEqual({});
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

describe("deprecateBySnakeCaseNotice", () => {
    const base = { name: "Filter Fields Reference", description: "Filter fields explanation", text: "some text" };

    it("appends a deprecation notice with the snake_case name to the description", () => {
        const result = deprecateBySnakeCaseNotice(base);
        expect(result.description).toBe(
            "Filter fields explanation [DEPRECATED: Please use 'filter_fields_reference' instead]"
        );
    });

    it("preserves all other prompt fields", () => {
        const prompt: Prompt = {
            ...base,
            arguments: [{ name: "flowID", description: "The flow ID" }],
        };
        const result = deprecateBySnakeCaseNotice(prompt);
        expect(result.text).toBe("some text");
        expect(result.arguments).toEqual([{ name: "flowID", description: "The flow ID" }]);
    });

    it("does not mutate the original prompt", () => {
        const original: Prompt = { ...base };
        deprecateBySnakeCaseNotice(original);
        expect(original.description).toBe("Filter fields explanation");
    });
});
