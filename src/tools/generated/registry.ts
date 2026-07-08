import { generateTools } from "./generateTools.js";
import { loadGeneratedToolsSpec } from "./loadSpec.js";
import type { GeneratedTool } from "./types.js";

/**
 * Computed once at module load (stdio only — the Worker builds its own from the
 * statically-imported spec, since it can't use loadSpec.ts's fs-based loader).
 * Shared by src/server.ts (tool listing) and src/utils/toolsHandler.ts (dispatch)
 * so the spec is only parsed and walked once per process.
 */
export const generatedTools: GeneratedTool[] = generateTools(loadGeneratedToolsSpec());

export const generatedToolsByName: Map<string, GeneratedTool> = new Map(
    generatedTools.map((tool) => [tool.name, tool])
);
