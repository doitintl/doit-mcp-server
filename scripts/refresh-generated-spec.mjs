#!/usr/bin/env node
// Regenerates src/tools/generated/openapi.json — the pre-dereferenced (zero $ref) snapshot
// that the auto-generated tools (src/tools/generated/) are built from. Run this manually
// whenever the DoiT external API's OpenAPI spec changes; it is NOT fetched at runtime (the
// Cloudflare Worker transport has no filesystem, so both transports load this static file).
//
// Usage:
//   node scripts/refresh-generated-spec.mjs [source]
//   source defaults to https://api.doit.com/openapi.yaml; pass a local path to dereference
//   a spec you already have on disk instead.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import OpenAPIParser from "@readme/openapi-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = process.argv[2] ?? "https://api.doit.com/openapi.yaml";
const outputPath = path.resolve(
  __dirname,
  "../src/tools/generated/openapi.json",
);

const document = await OpenAPIParser.dereference(source);
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

console.error(`Wrote dereferenced spec from ${source} to ${outputPath}`);
