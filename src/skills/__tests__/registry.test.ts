import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createSkillRegistry, MAX_SKILL_BYTES, MAX_SKILL_FILES, type SkillSource } from "../registry.js";

const markdown = (name: string) =>
    `---\nname: ${name}\ndescription: A fixture workflow.\nmetadata:\n  tags: one,two\nx-extra:\n  tags: [one, two]\nlicense: MIT\n---\n\nRead references/checklist.md when needed.\n`;
const source = (name: string): SkillSource => ({
    name,
    files: [
        { path: "SKILL.md", text: markdown(name) },
        { path: "references/checklist.md", text: "Fixture bytes: café.\n" },
        { path: "assets/example.bin", blob: Buffer.from([0, 255, 1, 128]).toString("base64") },
    ],
});
const directories: string[] = [];
afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Skills registry", () => {
    it("preserves all frontmatter, complete manifests, and raw bytes across multiple skills", () => {
        const input = [source("beta-workflow"), source("alpha-workflow")];
        const registry = createSkillRegistry(input, { pageSize: 1 });
        const first = registry.listSkills();
        expect(first).toMatchObject({ resultType: "complete", ttlMs: 300000, cacheScope: "public" });
        expect(first.skills[0].frontmatter).toEqual({
            name: "alpha-workflow",
            description: "A fixture workflow.",
            metadata: { tags: "one,two" },
            "x-extra": { tags: ["one", "two"] },
            license: "MIT",
        });
        const second = registry.listSkills(first.nextCursor);
        expect(second.skills[0].frontmatter.name).toBe("beta-workflow");
        expect(second.nextCursor).toBeUndefined();
        for (const skill of [...first.skills, ...second.skills]) {
            expect(registry.getSkill(skill.uri).skill).toEqual(skill);
            expect(skill.resources).toHaveLength(3);
            for (const resource of skill.resources) {
                const result = registry.readSkillResource(resource.uri);
                expect(result).toMatchObject({ resultType: "complete", ttlMs: 300000, cacheScope: "public" });
                const file = result.contents[0];
                const raw = file.text === undefined ? Buffer.from(file.blob ?? "", "base64") : Buffer.from(file.text);
                expect(resource.size).toBe(raw.length);
                expect(resource.digest).toBe(`sha256:${createHash("sha256").update(raw).digest("hex")}`);
            }
        }
        input[0].files[0].text = "mutated";
        expect(registry.readSkillResource("skill://beta-workflow/SKILL.md").contents[0].text).toBe(
            markdown("beta-workflow")
        );
        expect(Object.isFrozen(first.skills[0].frontmatter)).toBe(true);
    });
    it("uses deterministic snapshots and rejects stale, malformed, and foreign cursors", () => {
        const sources = [source("beta-workflow"), source("alpha-workflow")];
        const registry = createSkillRegistry(sources, { pageSize: 1 });
        expect(registry.listSkills()).toEqual(
            createSkillRegistry([...sources].reverse(), { pageSize: 1 }).listSkills()
        );
        const cursor = registry.listSkills().nextCursor;
        const changed = createSkillRegistry([source("alpha-workflow"), source("charlie-workflow")], { pageSize: 1 });
        for (const bad of ["", "unknown", cursor?.replace(":1", ":999"), cursor?.replace(":1", ":01")])
            expect(() => registry.listSkills(bad)).toThrow();
        expect(() => changed.listSkills(cursor)).toThrow();
        expect(() => registry.getSkill("skill://unknown/SKILL.md")).toThrow(expect.objectContaining({ code: -32602 }));
        expect(() => registry.readSkillResource("skill://alpha-workflow/../secret")).toThrow(
            expect.objectContaining({ code: -32602 })
        );
    });
    it("allows an empty published registry and direct lookups independent of pagination", () => {
        expect(createSkillRegistry([]).listSkills().skills).toEqual([]);
        const registry = createSkillRegistry([source("alpha-workflow"), source("beta-workflow")], { pageSize: 1 });
        expect(registry.getSkill("skill://beta-workflow/SKILL.md").skill.frontmatter.name).toBe("beta-workflow");
    });
    it.each([
        "metadata: {tags: [one, two]}",
        "metadata: null",
        "license: [MIT]",
        "allowed-tools: [Read]",
        "compatibility: false",
        'compatibility: ""',
        `compatibility: ${"a".repeat(501)}`,
    ])("rejects invalid standard frontmatter field %s", (field) => {
        const text = `---\nname: safe\ndescription: Valid description.\n${field}\n---\n`;
        expect(() => createSkillRegistry([{ name: "safe", files: [{ path: "SKILL.md", text }] }])).toThrow(
            /Invalid skill/
        );
    });
    it.each(["../escape", "/absolute", "nested//file", "nested/./file", "back\\slash", "line\nfeed"])(
        "rejects unsafe path %s",
        (path) => {
            expect(() =>
                createSkillRegistry([
                    {
                        name: "safe",
                        files: [
                            { path: "SKILL.md", text: markdown("safe") },
                            { path, text: "x" },
                        ],
                    },
                ])
            ).toThrow();
        }
    );
    it("rejects duplicate names/paths, invalid frontmatter, malformed bytes, and package limits", () => {
        expect(() => createSkillRegistry([source("same"), source("same")])).toThrow(/Duplicate skill name/);
        expect(() =>
            createSkillRegistry([
                {
                    name: "same",
                    files: [
                        { path: "SKILL.md", text: markdown("same") },
                        { path: "SKILL.md", text: "other" },
                    ],
                },
            ])
        ).toThrow(/Duplicate skill path/);
        expect(() =>
            createSkillRegistry([{ name: "same", files: [{ path: "SKILL.md", text: markdown("other") }] }])
        ).toThrow(/matching name/);
        expect(() =>
            createSkillRegistry([
                {
                    name: "same",
                    files: [{ path: "SKILL.md", text: "---\nname: same\nname: duplicate\ndescription: x\n---\n" }],
                },
            ])
        ).toThrow(/Invalid frontmatter/);
        expect(() => createSkillRegistry([{ name: "same", files: [{ path: "SKILL.md", blob: "invalid" }] }])).toThrow(
            /base64/
        );
        expect(() =>
            createSkillRegistry([{ name: "same", files: [{ path: "SKILL.md", text: "x", blob: "eA==" }] }])
        ).toThrow(/exactly one/);
        expect(() =>
            createSkillRegistry([
                {
                    name: "same",
                    files: [
                        { path: "SKILL.md", text: markdown("same") },
                        { path: "huge", blob: Buffer.alloc(MAX_SKILL_BYTES).toString("base64") },
                    ],
                },
            ])
        ).toThrow(/byte limit/);
        expect(() =>
            createSkillRegistry([
                {
                    name: "same",
                    files: Array.from({ length: MAX_SKILL_FILES + 1 }, (_, index) => ({
                        path: `file-${index}`,
                        text: "x",
                    })),
                },
            ])
        ).toThrow(/file limits/);
    });
});

describe("Build-time discovery", () => {
    const generator = fileURLToPath(new URL("../../../scripts/generate-skills.mjs", import.meta.url));
    const fixtureRoot = fileURLToPath(new URL("../../../test/fixtures/skills", import.meta.url));
    function temporary() {
        const directory = mkdtempSync(join(tmpdir(), "mcp-skills-"));
        directories.push(directory);
        return directory;
    }
    it("automatically bundles multiple directories and detects stale generated content", () => {
        const output = join(temporary(), "generated.ts");
        const run = (...args: string[]) =>
            execFileSync(process.execPath, [generator, "--root", fixtureRoot, "--output", output, ...args], {
                stdio: "pipe",
            });
        run();
        const generated = readFileSync(output, "utf8");
        expect(generated).toContain('"alpha-workflow"');
        expect(generated).toContain('"beta-workflow"');
        expect(generated).toContain("references/checklist.md");
        run("--check");
        writeFileSync(output, "stale");
        expect(() => run("--check")).toThrow();
    });
    it("generates and checks a skill at the supported byte limit", () => {
        const root = temporary();
        const output = join(root, "generated.ts");
        mkdirSync(join(root, "large"));
        const instructions = markdown("large");
        const asset = Buffer.alloc(MAX_SKILL_BYTES - Buffer.byteLength(instructions), 255);
        writeFileSync(join(root, "large", "SKILL.md"), instructions);
        writeFileSync(join(root, "large", "asset.bin"), asset);
        const run = (...args: string[]) =>
            execFileSync(process.execPath, [generator, "--root", root, "--output", output, ...args], {
                stdio: "pipe",
            });
        run();
        expect(readFileSync(output, "utf8")).toContain(asset.toString("base64"));
        run("--check");
    });
    it.each([Buffer.from([255]), Buffer.from([0])])(
        "rejects non-text SKILL.md bytes %j during generation",
        (invalid) => {
            const root = temporary();
            mkdirSync(join(root, "safe"));
            writeFileSync(join(root, "safe", "SKILL.md"), Buffer.concat([Buffer.from(markdown("safe")), invalid]));
            expect(() =>
                execFileSync(process.execPath, [generator, "--root", root, "--output", join(root, "out.ts")], {
                    stdio: "pipe",
                })
            ).toThrow(/SKILL.md must be UTF-8 text/);
        }
    );
    it("excludes ignored local files while including new skill sources", () => {
        const root = temporary();
        execFileSync("git", ["init", "--quiet", root]);
        writeFileSync(join(root, ".gitignore"), ".env*\n.DS_Store\nignored/\n");
        const skills = join(root, "skills");
        const directory = join(skills, "safe");
        mkdirSync(join(directory, "ignored"), { recursive: true });
        writeFileSync(join(directory, "SKILL.md"), markdown("safe"));
        writeFileSync(join(directory, "guide.md"), "Public supporting reference");
        for (const path of [".env.local", ".DS_Store", "ignored/private.txt"])
            writeFileSync(join(directory, path), "PRIVATE_FIXTURE_CONTENT");
        const output = join(root, "generated.ts");
        execFileSync(process.execPath, [generator, "--root", skills, "--output", output], { stdio: "pipe" });
        const generated = readFileSync(output, "utf8");
        expect(generated).toContain("Public supporting reference");
        expect(generated).not.toContain("PRIVATE_FIXTURE_CONTENT");
        expect(generated).not.toContain(".DS_Store");
    });
    it("rejects a symlinked skill root, skill directory, or supporting file", () => {
        const root = temporary();
        const target = temporary();
        const output = join(root, "out.ts");
        symlinkSync(target, join(root, "linked-root"));
        const run = (directory: string) =>
            execFileSync(process.execPath, [generator, "--root", directory, "--output", output], { stdio: "pipe" });
        expect(() => run(join(root, "linked-root"))).toThrow();
        mkdirSync(join(root, "skills"));
        symlinkSync(target, join(root, "skills", "linked-skill"));
        expect(() => run(join(root, "skills"))).toThrow();
        rmSync(join(root, "skills", "linked-skill"));
        mkdirSync(join(root, "skills", "safe"));
        writeFileSync(join(root, "skills", "safe", "SKILL.md"), markdown("safe"));
        symlinkSync(output, join(root, "skills", "safe", "linked-file"));
        expect(() => run(join(root, "skills"))).toThrow();
    });
    it("rejects invalid standard metadata during generation", () => {
        const root = temporary();
        mkdirSync(join(root, "safe"));
        writeFileSync(
            join(root, "safe", "SKILL.md"),
            "---\nname: safe\ndescription: Fixture.\nmetadata: {tags: [one, two]}\n---\n"
        );
        expect(() =>
            execFileSync(process.execPath, [generator, "--root", root, "--output", join(root, "out.ts")], {
                stdio: "pipe",
            })
        ).toThrow();
    });
});
