import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { OpenAPIV3 } from "openapi-types";

const specPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "openapi.json");

/**
 * Loads the pre-dereferenced (zero $ref) OpenAPI spec bundled at build time. Node-only —
 * the Cloudflare Worker has no filesystem, so it statically imports openapi.json directly
 * instead (see doit-mcp-server/src/index.ts).
 */
export function loadGeneratedToolsSpec(): OpenAPIV3.Document {
    return JSON.parse(readFileSync(specPath, "utf8")) as OpenAPIV3.Document;
}
