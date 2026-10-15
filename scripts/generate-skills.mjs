import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const MAX_FILES = 512;
const MAX_BYTES = 16 * 1024 * 1024;
const byName = (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

function includedFiles(root) {
    try {
        const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "."], {
            cwd: root, encoding: "utf8", stdio: "pipe", maxBuffer: MAX_BYTES,
        });
        const included = new Set(paths.split("\0").filter(Boolean));
        for (const path of [...included]) {
            const parts = path.split("/");
            while (parts.length > 1) {
                parts.pop();
                included.add(parts.join("/"));
            }
        }
        return included;
    } catch (error) {
        // Standalone skill directories need no Git repository.
        if (error.status === 128 && error.stderr?.toString().includes("not a git repository")) return null;
        throw error;
    }
}

/** Bundle source files at build time; no runtime directory scanning. */
export async function discoverSkills(root) {
    try {
        const stat = await lstat(root);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Skills root must be a real directory");
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
    const included = includedFiles(root);
    const sources = [];
    for (const child of (await readdir(root, { withFileTypes: true })).sort(byName)) {
        if (child.isSymbolicLink()) throw new Error(`Skill symlinks are forbidden: ${child.name}`);
        if (!child.isDirectory()) continue;
        if (included && !included.has(`${child.name}/SKILL.md`)) continue;
        const directory = join(root, child.name);
        let skillBytes;
        try {
            const stat = await lstat(join(directory, "SKILL.md"));
            if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Invalid SKILL.md: ${child.name}`);
            if (stat.size > MAX_BYTES) throw new Error(`Skill ${child.name} exceeds limits`);
            skillBytes = await readFile(join(directory, "SKILL.md"));
        } catch (error) {
            if (error.code === "ENOENT") continue;
            throw error;
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(child.name) || child.name.length > 64)
            throw new Error(`Invalid skill directory name: ${child.name}`);
        const skillText = skillBytes.toString("utf8");
        if (skillBytes.includes(0) || !Buffer.from(skillText, "utf8").equals(skillBytes))
            throw new Error(`SKILL.md must be UTF-8 text: ${child.name}`);
        const match = skillText.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        if (!match) throw new Error(`Missing frontmatter: ${child.name}`);
        const document = parseDocument(match[1], { uniqueKeys: true });
        if (document.errors.length || document.warnings.length) throw new Error(`Invalid frontmatter: ${child.name}`);
        const fields = document.toJS({ maxAliasCount: 0 });
        if (fields?.name !== child.name || typeof fields.description !== "string" || !fields.description.trim() || fields.description.length > 1024)
            throw new Error(`Skill ${child.name} requires matching name and description`);

    for (const key of ["license", "allowed-tools"])
        if (fields[key] !== undefined && typeof fields[key] !== "string") throw new Error(`Invalid skill ${key}: ${child.name}`);
    if (fields.compatibility !== undefined && (typeof fields.compatibility !== "string" || !fields.compatibility.length || fields.compatibility.length > 500))
        throw new Error(`Invalid skill compatibility: ${child.name}`);
    if (fields.metadata !== undefined && (!fields.metadata || typeof fields.metadata !== "object" || Array.isArray(fields.metadata) || Object.values(fields.metadata).some((value) => typeof value !== "string")))
        throw new Error(`Invalid skill metadata: ${child.name}`);
        const files = [];
        let totalBytes = 0;
        async function walk(current, prefix = "") {
            for (const entry of (await readdir(current, { withFileTypes: true })).sort(byName)) {
                const relative = `${prefix}${entry.name}`;
                if (included && !included.has(`${child.name}/${relative}`)) continue;
                if (entry.isSymbolicLink()) throw new Error(`Skill symlinks are forbidden: ${child.name}/${relative}`);
                if (entry.name.includes("\\") || /[\u0000-\u001f\u007f]/.test(entry.name)) throw new Error("Invalid skill file name");
                if (entry.isDirectory()) await walk(join(current, entry.name), `${relative}/`);
                else {
                    if (!entry.isFile()) throw new Error(`Unsupported skill file: ${relative}`);
                    const stat = await lstat(join(current, entry.name));
                    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Skill file changed during generation: ${relative}`);
                    if (files.length >= MAX_FILES || stat.size > MAX_BYTES - totalBytes) throw new Error(`Skill ${child.name} exceeds limits`);
                    const raw = await readFile(join(current, entry.name));
                    totalBytes += raw.length;
                    if (totalBytes > MAX_BYTES) throw new Error(`Skill ${child.name} exceeds limits`);
                    const text = raw.toString("utf8");
                    const isText = !raw.includes(0) && Buffer.from(text, "utf8").equals(raw);
                    files.push({ path: relative, ...(isText ? { text } : { blob: raw.toString("base64") }) });
                }
            }
        }
        await walk(directory);
        sources.push({ name: child.name, files });
    }
    return sources;
}

async function main() {
    const arguments_ = process.argv.slice(2);
    const flagValue = (flag, fallback) => {
        const index = arguments_.indexOf(flag);
        if (index === -1) return fallback;
        if (!arguments_[index + 1] || arguments_[index + 1].startsWith("--")) throw new Error(`Missing ${flag} value`);
        return resolve(arguments_[index + 1]);
    };
    const root = flagValue("--root", join(packageRoot, "skills"));
    const output = flagValue("--output", join(packageRoot, "src/skills/bundle.generated.ts"));
    const sources = await discoverSkills(root);
    const source = `// Generated by yarn generate:skills. Do not edit.\nimport type { SkillSource } from "./registry.js";\n\nexport const BUNDLED_SKILLS: readonly SkillSource[] = ${JSON.stringify(sources, null, 4)};\n`;
    const generated = execFileSync(
        join(packageRoot, "node_modules/.bin/biome"),
        ["format", "--stdin-file-path=src/skills/bundle.generated.ts"],
        {
            input: source,
            encoding: "utf8",
            // Encoded assets can exceed Node's default 1 MiB subprocess buffer.
            maxBuffer: Buffer.byteLength(source) * 2 + 1024 * 1024,
        }
    );
    if (arguments_.includes("--check")) {
        if (await readFile(output, "utf8") !== generated) throw new Error("Skill bundle is stale; run yarn generate:skills");
    } else {
        // The source directory is tracked; custom outputs must also have an existing parent.
        await lstat(dirname(output));
        await writeFile(output, generated);
        process.stdout.write(`Generated ${sources.length} skills\n`);
    }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
