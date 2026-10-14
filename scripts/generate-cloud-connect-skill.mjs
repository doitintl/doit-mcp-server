import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = new URL("../skills/doit-cloud-connect/", import.meta.url);
const output = new URL("../src/docs/cloudConnectSkill.generated.ts", import.meta.url);
const files = {};
async function walk(directory, prefix = "") {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isSymbolicLink()) throw new Error("Skill symlinks are not supported");
        const path = prefix + entry.name;
        if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, directory), `${path}/`);
        else {
            const raw = await readFile(new URL(entry.name, directory));
            const text = raw.toString("utf8");
            if (!Buffer.from(text).equals(raw)) throw new Error(`Skill files must be UTF-8: ${path}`);
            files[`skill://doit-cloud-connect/${path}`] = { text, digest: `sha256:${createHash("sha256").update(raw).digest("hex")}`, size: raw.length };
        }
    }
}
await walk(root);
const uri = "skill://doit-cloud-connect/SKILL.md";
const match = files[uri]?.text.match(/^---\n([\s\S]+?)\n---\n/);
if (!match) throw new Error("Skill frontmatter missing");
const frontmatter = parse(match[1]);
if (frontmatter.name !== "doit-cloud-connect" || typeof frontmatter.description !== "string") throw new Error("Invalid skill frontmatter");
if (!files["skill://doit-cloud-connect/references/catalog.md"]) throw new Error("Generate the release catalog first");
const manifest = { uri, frontmatter, resources: Object.entries(files).map(([uri, { digest, size }]) => ({ uri, digest, size })) };
const source = `// Generated from skills/doit-cloud-connect by yarn generate:cloud-connect-skill. Do not edit.\nexport const CLOUD_CONNECT_SKILL = ${JSON.stringify(manifest, null, 4)} as const;\nexport const CLOUD_CONNECT_SKILL_FILES: Record<string, { text: string; digest: string; size: number }> = ${JSON.stringify(files, null, 4)};\n`;
const generated = execFileSync(fileURLToPath(new URL("../node_modules/.bin/biome", import.meta.url)), ["format", "--stdin-file-path=src/docs/cloudConnectSkill.generated.ts"], { input: source, encoding: "utf8" });
if (process.argv.includes("--check")) {
    if (await readFile(output, "utf8") !== generated) throw new Error("Cloud Connect skill bundle is stale; run yarn generate:cloud-connect-skill");
} else {
    await writeFile(output, generated);
    process.stdout.write(`Generated ${manifest.resources.length} skill resources in ${fileURLToPath(output)}\n`);
}
