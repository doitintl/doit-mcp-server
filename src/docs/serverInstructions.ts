import { CLOUDFLOW_INSTRUCTIONS } from "./cloudflowGuidance.js";

/**
 * The server `instructions` string returned at `initialize`.
 *
 * This is a shared budget, not a per-domain one: CloudFlow is one tool family among many here,
 * and if every family claims a dozen lines the instructions stop being read at all. Keep this
 * tier to rules that change behavior across a whole domain and have no other channel — anything
 * else belongs in a tool description (which rides every `tools/list`) or the MCP resource.
 *
 * A second domain needing this treatment is the signal to design a real per-domain guidance
 * mechanism rather than to grow this string.
 */
export const SERVER_INSTRUCTIONS = CLOUDFLOW_INSTRUCTIONS;
