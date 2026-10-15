import { createHash } from "node:crypto";
import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { parseDocument } from "yaml";

export const SKILL_EXTENSION_CAPABILITY = { "io.modelcontextprotocol/skills": {} };
export const MAX_SKILL_FILES = 512;
export const MAX_SKILL_BYTES = 16 * 1024 * 1024;

/** Build-time input; no filesystem access is needed to serve these immutable bytes. */
export interface SkillFile {
    path: string;
    mimeType?: string;
    text?: string;
    blob?: string;
}
export interface SkillSource {
    name: string;
    files: readonly SkillFile[];
}
export interface SkillEntry {
    uri: string;
    frontmatter: Record<string, unknown>;
    resources: Array<{ uri: string; digest: string; size: number }>;
}
export interface SkillRegistryOptions {
    pageSize?: number;
    ttlMs?: number;
}
type SkillContent = { uri: string; mimeType: string } & ({ text: string } | { blob: string });

const MIME_TYPES: Record<string, string> = {
    md: "text/markdown",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    yaml: "application/yaml",
    yml: "application/yaml",
    html: "text/html",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
};
function freeze<T>(value: T): T {
    if (value && typeof value === "object") {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}
function invalid(message: string): never {
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, message);
}
function fileBytes(file: SkillFile): Buffer {
    if ((file.text === undefined) === (file.blob === undefined))
        throw new Error(`Skill file ${file.path} requires exactly one of text or blob`);
    if (file.text !== undefined) {
        const bytes = Buffer.from(file.text, "utf8");
        if (bytes.toString("utf8") !== file.text) throw new Error(`Invalid UTF-8 text: ${file.path}`);
        return bytes;
    }
    const encoded = file.blob ?? "";
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded) throw new Error(`Invalid base64: ${file.path}`);
    return bytes;
}
function validatePath(path: string) {
    if (
        !path ||
        path.includes("\\") ||
        [...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    )
        throw new Error(`Invalid skill path: ${path}`);
    if (path.split("/").some((part) => !part || part === "." || part === ".."))
        throw new Error(`Invalid skill path: ${path}`);
}
function frontmatterOf(name: string, file: SkillFile): Record<string, unknown> {
    const match = file.text?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error(`Skill ${name} must start with YAML frontmatter`);
    const document = parseDocument(match[1], { uniqueKeys: true });
    if (document.errors.length || document.warnings.length) throw new Error(`Invalid frontmatter for ${name}`);
    const value: unknown = document.toJS({ maxAliasCount: 0 });
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`Skill ${name} frontmatter must be a mapping`);
    const fields = value as Record<string, unknown>;
    if (fields.name !== name || typeof fields.description !== "string" || !fields.description.trim())
        throw new Error(`Skill ${name} requires matching name and nonempty description`);
    if (fields.description.length > 1024) throw new Error(`Skill ${name} description exceeds 1024 characters`);

    for (const key of ["license", "allowed-tools"])
        if (fields[key] !== undefined && typeof fields[key] !== "string")
            throw new Error(`Invalid skill ${key}: ${name}`);
    if (
        fields.compatibility !== undefined &&
        (typeof fields.compatibility !== "string" || !fields.compatibility.length || fields.compatibility.length > 500)
    )
        throw new Error(`Invalid skill compatibility: ${name}`);
    if (
        fields.metadata !== undefined &&
        (!fields.metadata ||
            typeof fields.metadata !== "object" ||
            Array.isArray(fields.metadata) ||
            Object.values(fields.metadata).some((value) => typeof value !== "string"))
    )
        throw new Error(`Invalid skill metadata: ${name}`);
    // Clone plain JSON values, preserving every field without YAML aliases or shared mutable objects.
    const serialized = JSON.stringify(fields, (_key, item) => {
        if (typeof item === "bigint" || (typeof item === "number" && !Number.isFinite(item)))
            throw new Error(`Skill ${name} frontmatter must contain JSON-compatible values`);
        return item;
    });
    return JSON.parse(serialized) as Record<string, unknown>;
}

/** Creates a filesystem-free registry suitable for stdio and hosted transports. */
export function createSkillRegistry(sources: readonly SkillSource[], options: SkillRegistryOptions = {}) {
    const pageSize = options.pageSize ?? 50;
    const ttlMs = options.ttlMs ?? 300000;
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error("Invalid skill page size");
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 0) throw new Error("Invalid skill cache TTL");
    const entries = new Map<string, SkillEntry>();
    const files = new Map<string, SkillContent>();
    const resources: Array<{ uri: string; name: string; mimeType: string; size: number }> = [];
    for (const source of [...sources].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.name) || source.name.length > 64)
            throw new Error(`Invalid skill name: ${source.name}`);
        const uri = `skill://${source.name}/SKILL.md`;
        if (entries.has(uri)) throw new Error(`Duplicate skill name: ${source.name}`);
        if (!source.files.length || source.files.length > MAX_SKILL_FILES)
            throw new Error(`Skill ${source.name} exceeds file limits`);
        const manifest: SkillEntry["resources"] = [];
        let byteSize = 0;
        const paths = new Set<string>();
        for (const input of [...source.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
            validatePath(input.path);
            if (paths.has(input.path)) throw new Error(`Duplicate skill path: ${source.name}/${input.path}`);
            paths.add(input.path);
            const bytes = fileBytes(input);
            byteSize += bytes.length;
            if (byteSize > MAX_SKILL_BYTES) throw new Error(`Skill ${source.name} exceeds byte limit`);
            const resourceUri = `skill://${source.name}/${input.path.split("/").map(encodeURIComponent).join("/")}`;
            const mimeType =
                input.mimeType ??
                MIME_TYPES[input.path.split(".").at(-1)?.toLowerCase() ?? ""] ??
                (input.text !== undefined ? "text/plain" : "application/octet-stream");
            const content: SkillContent =
                input.text !== undefined
                    ? { uri: resourceUri, mimeType, text: input.text }
                    : { uri: resourceUri, mimeType, blob: input.blob ?? "" };
            files.set(resourceUri, freeze(content));
            manifest.push({
                uri: resourceUri,
                digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
                size: bytes.length,
            });
            resources.push({ uri: resourceUri, name: input.path, mimeType, size: bytes.length });
        }
        const skillFile = source.files.find((file) => file.path === "SKILL.md");
        if (!skillFile) throw new Error(`Missing SKILL.md for ${source.name}`);
        entries.set(uri, freeze({ uri, frontmatter: frontmatterOf(source.name, skillFile), resources: manifest }));
    }
    const orderedEntries = [...entries.values()];
    const snapshot = createHash("sha256").update(JSON.stringify(orderedEntries)).digest("hex");
    const cache = { resultType: "complete" as const, ttlMs, cacheScope: "public" as const };
    return freeze({
        resources,
        listSkills(cursor?: string) {
            let offset = 0;
            if (cursor !== undefined) {
                const match = /^skills:([a-f0-9]{64}):([1-9][0-9]*)$/.exec(cursor);
                if (!match || match[1] !== snapshot) return invalid("Invalid skill cursor");
                offset = Number(match[2]);
                if (!Number.isSafeInteger(offset) || offset >= orderedEntries.length || offset % pageSize !== 0)
                    return invalid("Invalid skill cursor");
            }
            const next = offset + pageSize;
            return {
                ...cache,
                skills: orderedEntries.slice(offset, next),
                ...(next < orderedEntries.length ? { nextCursor: `skills:${snapshot}:${next}` } : {}),
            };
        },
        getSkill(uri: string) {
            const skill = entries.get(uri);
            if (!skill) return invalid(`Unknown skill: ${uri}`);
            return { ...cache, skill };
        },
        readSkillResource(uri: string) {
            const content = files.get(uri);
            if (!content) return invalid(`Unknown skill resource: ${uri}`);
            return { ...cache, contents: [content] };
        },
    });
}
export type SkillRegistry = ReturnType<typeof createSkillRegistry>;
