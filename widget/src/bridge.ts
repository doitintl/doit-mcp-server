// widget/src/bridge.ts

/** Theme object provided by ChatGPT host */
export interface OpenAITheme {
  mode: "light" | "dark";
  [key: string]: unknown;
}

/** Tool output delivered to the widget */
export interface ToolResult {
  toolOutput: Record<string, unknown>;       // structuredContent
  toolResponseMetadata: {
    toolName: string;
    rawData?: Record<string, unknown>;
    ui?: { resourceUri: string };
    [key: string]: unknown;
  };
}

/** The window.openai API injected by ChatGPT */
export interface OpenAIBridge {
  // State & data
  toolInput: Record<string, unknown> | null;
  toolOutput: Record<string, unknown> | null;
  toolResponseMetadata: Record<string, unknown> | null;
  widgetState: Record<string, unknown> | null;
  theme: OpenAITheme;
  displayMode: "inline" | "fullscreen" | "pip";
  locale: string;
  maxHeight: number;

  // Methods
  setWidgetState(state: Record<string, unknown>): void;
  notifyIntrinsicHeight(height: number): void;
  requestDisplayMode(mode: "inline" | "fullscreen" | "pip"): void;
  requestClose(): void;
  sendFollowUpMessage(params: { prompt: string; scrollToBottom?: boolean }): void;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  updateModelContext(context: Record<string, unknown>): void;
  openExternal(params: { href: string; redirectUrl?: string }): void;
}

declare global {
  interface Window {
    openai: OpenAIBridge;
  }
}

/** Safe accessor — returns null if not in ChatGPT iframe */
export function getBridge(): OpenAIBridge | null {
  return typeof window !== "undefined" && window.openai ? window.openai : null;
}
