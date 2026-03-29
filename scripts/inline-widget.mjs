#!/usr/bin/env node
/**
 * Reads widget/dist/index.html and writes doit-mcp-server/src/widgetHtml.ts
 * so the CF Worker can serve the widget as an MCP resource at build time.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const src = resolve(root, "widget/dist/index.html");
const out = resolve(root, "doit-mcp-server/src/widgetHtml.ts");

let html;
try {
  html = readFileSync(src, "utf-8");
} catch (e) {
  console.error(`inline-widget: could not read ${src}`);
  console.error("  Run 'npm run build --workspace=widget' first.");
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });

const escaped = JSON.stringify(html);
writeFileSync(
  out,
  `// AUTO-GENERATED — do not edit. Run 'npm run build' to regenerate.\nexport const WIDGET_HTML: string = ${escaped};\n`,
  "utf-8"
);

const kb = (html.length / 1024).toFixed(1);
console.log(`inline-widget: wrote ${kb} kB → doit-mcp-server/src/widgetHtml.ts`);
