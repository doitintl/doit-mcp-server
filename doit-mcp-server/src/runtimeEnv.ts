export type UiDomainProvider = "claude" | "openai" | "omit";

export interface RuntimeEnvVars {
  WORKER_URL?: string;
  PUBLIC_URL?: string;
  PUBLIC_MCP_URL?: string;
  UI_DOMAIN_PROVIDER?: UiDomainProvider;
  CLAUDE_UI_DOMAIN?: string;
  OPENAI_UI_DOMAIN?: string;
}

export type DoitWorkerEnv = Env & RuntimeEnvVars;
