// Argument for a prompt when using the GetPromptRequestSchema
export type PromptArgument = {
    name: string;
    description: string;
    required?: boolean;
};

export type PromptRole = "user" | "assistant";

export type PromptMessage = {
    role: PromptRole;
    text: string;
};

// base type for a prompt for both single and multi message prompts
type PromptBase = {
    name: string;
    description: string;
    arguments?: PromptArgument[];
};

// simple definition of a prompt with a single message, backward compatible with initial project prompts
type SingleMessagePrompt = PromptBase & {
    text: string;
    role?: PromptRole;
    messages?: never;
};

// protocol compatible definition of a prompt with multiple messages
type MultiMessagePrompt = PromptBase & {
    messages: PromptMessage[];
    text?: never;
    role?: never;
};

export type Prompt = SingleMessagePrompt | MultiMessagePrompt;
