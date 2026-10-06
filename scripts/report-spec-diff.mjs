#!/usr/bin/env node
// Builds the pull-request body for the scheduled spec-refresh workflow: compares the
// previous openapi.json snapshot against the freshly generated one and reports added
// and removed operations, splitting additions into "exposed as MCP tools" vs
// "excluded by policy" (src/tools/generated/excludedOperations.json).
//
// Usage:
//   node scripts/report-spec-diff.mjs <old-openapi.json> <new-openapi.json>
// Prints GitHub-flavored markdown to stdout.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HTTP_METHODS = ["get", "put", "post", "delete", "patch"];
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [oldPath, newPath] = process.argv.slice(2);
if (!oldPath || !newPath) {
    console.error("Usage: node scripts/report-spec-diff.mjs <old-openapi.json> <new-openapi.json>");
    process.exit(1);
}

const exclusions = JSON.parse(
    readFileSync(path.resolve(__dirname, "../src/tools/generated/excludedOperations.json"), "utf8"),
);
const excludedEndpoints = new Map(
    exclusions.excludedEndpoints.map((entry) => [entry.endpoint.toLowerCase(), entry.reason]),
);
const excludedTags = new Set(exclusions.excludedTags.map((tag) => tag.toLowerCase()));

function operations(specPath) {
    const spec = JSON.parse(readFileSync(specPath, "utf8"));
    const out = new Map();
    for (const [pathTemplate, pathItem] of Object.entries(spec.paths ?? {})) {
        for (const method of HTTP_METHODS) {
            const operation = pathItem?.[method];
            if (!operation) continue;
            out.set(`${method}:${pathTemplate}`.toLowerCase(), {
                method,
                pathTemplate,
                operationId: operation.operationId,
                summary: operation.summary ?? operation.operationId ?? "",
                tags: operation.tags ?? [],
            });
        }
    }
    return out;
}

function isExcluded(key, op) {
    if (excludedEndpoints.has(key)) return excludedEndpoints.get(key) ?? "excluded";
    const tag = op.tags.find((t) => excludedTags.has(t.toLowerCase()));
    return tag ? `tag "${tag}" is excluded` : null;
}

// Mirrors toolNameFor in src/tools/generated/generateTools.ts so the report
// shows the exact tool names agents see.
function toolNameFor(method, pathTemplate, operationId) {
    const id = operationId || `${method}_${pathTemplate.replace(/[{}/]/g, "_")}`;
    return id
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
}

const oldOps = operations(oldPath);
const newOps = operations(newPath);

const added = [...newOps.entries()].filter(([key]) => !oldOps.has(key));
const removed = [...oldOps.entries()].filter(([key]) => !newOps.has(key));
const exposed = added.filter(([key, op]) => !isExcluded(key, op));
const excluded = added.filter(([key, op]) => isExcluded(key, op));
// Same method+path in both snapshots but a different operationId: the
// operation didn't move, its generated tool name did. Invisible to the
// added/removed sets, and a breaking change for anyone calling the old name.
const renamed = [...newOps.entries()].filter(
    ([key, op]) => oldOps.has(key) && oldOps.get(key).operationId !== op.operationId,
);

const line = ([, op]) => `- \`${op.method.toUpperCase()} ${op.pathTemplate}\` — ${op.summary}`;

console.log("## OpenAPI snapshot refresh");
console.log();
console.log(
    `Regenerated \`src/tools/generated/openapi.json\` from the live spec: ${oldOps.size} → ${newOps.size} operations.`,
);
console.log();
console.log(`### New operations exposed as MCP tools (${exposed.length})`);
console.log();
console.log(exposed.length ? exposed.map(line).join("\n") : "_None._");
console.log();
console.log(`### New operations excluded by policy (${excluded.length})`);
console.log();
console.log(
    excluded.length
        ? excluded.map(([key, op]) => `${line([key, op])} _(${isExcluded(key, op)})_`).join("\n")
        : "_None._",
);
console.log();
console.log(`### Removed operations (${removed.length})`);
console.log();
console.log(removed.length ? removed.map(line).join("\n") : "_None._");
console.log();
console.log(`### Renamed operationIds — same endpoint, new generated tool name (${renamed.length})`);
console.log();
if (renamed.length) {
    console.log(
        "_Applies to auto-generated tools; endpoints covered by a hand-written tool keep their curated name._",
    );
    console.log();
}
console.log(
    renamed.length
        ? renamed
              .map(([key, op]) => {
                  const old = oldOps.get(key);
                  return `- \`${toolNameFor(old.method, old.pathTemplate, old.operationId)}\` → \`${toolNameFor(op.method, op.pathTemplate, op.operationId)}\` (\`${op.method.toUpperCase()} ${op.pathTemplate}\`)`;
              })
              .join("\n")
        : "_None._",
);
console.log();
console.log(
    "> Review checklist: new **exposed** operations become MCP tools on the next release — confirm none of them should instead be added to `src/tools/generated/excludedOperations.json`. Removed operations disappear as tools; hand-written tools covering them will start failing and need cleanup. Renamed tools are breaking for anyone calling the old name — flag them in the release notes.",
);
