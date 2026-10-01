#!/usr/bin/env node
// Regenerates src/tools/generated/openapi.json — the pre-dereferenced (zero $ref) snapshot
// that the auto-generated tools (src/tools/generated/) are built from. Run this manually
// whenever the DoiT external API's OpenAPI spec changes; it is NOT fetched at runtime (the
// Cloudflare Worker transport has no filesystem, so both transports load this static file).
//
// Usage:
//   node scripts/refresh-generated-spec.mjs [source] [output]
//   source defaults to https://api.doit.com/openapi.yaml; pass a local path to dereference
//   a spec you already have on disk instead. output defaults to src/tools/generated/openapi.json.
//
// The fetched spec is untrusted input (it runs on a credentialed CI runner and the result is
// published in a PR), so only the root document is ever read: any $ref that is not a local
// "#/..." pointer is rejected before dereferencing, external resolution is disabled outright,
// and the result must match the expected OpenAPI shape before it is written.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dereference, parse } from "@readme/openapi-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = process.argv[2] ?? "https://api.doit.com/openapi.yaml";
const outputPath = path.resolve(process.argv[3] ?? path.resolve(__dirname, "../src/tools/generated/openapi.json"));

const TOP_LEVEL_KEYS = new Set([
    "openapi",
    "info",
    "jsonSchemaDialect",
    "servers",
    "paths",
    "webhooks",
    "components",
    "security",
    "tags",
    "externalDocs",
]);
const INFO_STRING_KEYS = new Set(["title", "summary", "description", "termsOfService", "version"]);
const INFO_OBJECT_KEYS = { contact: new Set(["name", "url", "email"]), license: new Set(["name", "identifier", "url"]) };
const COMPONENT_KEYS = new Set([
    "schemas",
    "responses",
    "parameters",
    "examples",
    "requestBodies",
    "headers",
    "securitySchemes",
    "links",
    "callbacks",
    "pathItems",
]);

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Walks every node (cycle-safe, since a dereferenced document can be circular) and calls
// visit(value, pointer) for each "$ref" key found.
function forEachRef(node, visit, pointer = "#", seen = new Set()) {
    if (node === null || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
        const childPointer = `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
        if (key === "$ref") visit(value, childPointer);
        forEachRef(value, visit, childPointer, seen);
    }
}

function assertOnlyLocalRefs(document) {
    const external = [];
    forEachRef(document, (ref, pointer) => {
        if (typeof ref !== "string" || !ref.startsWith("#")) external.push(`${pointer}: ${JSON.stringify(ref)}`);
    });
    if (external.length > 0) {
        throw new Error(`Spec contains non-local $ref pointers, which are not allowed:\n  ${external.join("\n  ")}`);
    }
}

function assertNoRefs(document) {
    const remaining = [];
    forEachRef(document, (ref, pointer) => remaining.push(`${pointer}: ${JSON.stringify(ref)}`));
    if (remaining.length > 0) {
        throw new Error(`Dereferenced spec still contains $ref pointers:\n  ${remaining.join("\n  ")}`);
    }
}

function assertExpectedShape(document) {
    const problems = [];
    if (!isPlainObject(document)) throw new Error("Spec is not an object");

    for (const key of Object.keys(document)) {
        if (!TOP_LEVEL_KEYS.has(key) && !key.startsWith("x-")) problems.push(`unexpected top-level key "${key}"`);
    }
    if (typeof document.openapi !== "string" || !document.openapi.startsWith("3.")) {
        problems.push(`"openapi" must be a 3.x version string`);
    }
    if (!isPlainObject(document.paths)) problems.push(`"paths" must be an object`);

    if (!isPlainObject(document.info)) {
        problems.push(`"info" must be an object`);
    } else {
        for (const [key, value] of Object.entries(document.info)) {
            if (INFO_STRING_KEYS.has(key)) {
                if (typeof value !== "string") problems.push(`"info.${key}" must be a string`);
            } else if (key in INFO_OBJECT_KEYS) {
                if (!isPlainObject(value)) {
                    problems.push(`"info.${key}" must be an object`);
                    continue;
                }
                for (const [subKey, subValue] of Object.entries(value)) {
                    if (!INFO_OBJECT_KEYS[key].has(subKey) || typeof subValue !== "string") {
                        problems.push(`unexpected "info.${key}.${subKey}"`);
                    }
                }
            } else {
                problems.push(`unexpected key "info.${key}"`);
            }
        }
    }

    if (document.components !== undefined) {
        if (!isPlainObject(document.components)) {
            problems.push(`"components" must be an object`);
        } else {
            for (const [key, value] of Object.entries(document.components)) {
                if (!COMPONENT_KEYS.has(key)) problems.push(`unexpected key "components.${key}"`);
                else if (!isPlainObject(value)) problems.push(`"components.${key}" must be an object`);
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(`Spec does not match the expected OpenAPI shape:\n  ${problems.join("\n  ")}`);
    }
}

// parse() reads only the root document; it never follows $refs.
const parsed = await parse(source, { resolve: { external: false } });
assertOnlyLocalRefs(parsed);

// Dereference the already-parsed object with every external resolver disabled, so even a $ref
// the check above somehow missed cannot make this process read a file or fetch a URL.
const document = await dereference(parsed, { resolve: { external: false, file: false } });
assertNoRefs(document);
assertExpectedShape(document);

writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

console.error(`Wrote dereferenced spec from ${source} to ${outputPath}`);
