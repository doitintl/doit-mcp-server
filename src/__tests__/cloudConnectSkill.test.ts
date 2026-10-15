import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
    CLOUD_CONNECT_PROMPT,
    CLOUD_CONNECT_SKILL_URI,
    getSkill,
    listSkills,
    readSkillResource,
    SKILL_REGISTRY,
} from "../core.js";

describe("Cloud Connect skill delivery through the shared core", () => {
    it("serves every installable file's exact bytes with complete stable manifests", () => {
        const skill = getSkill(CLOUD_CONNECT_SKILL_URI).skill;
        expect(listSkills().skills).toContainEqual(skill);
        expect(SKILL_REGISTRY.getSkill(CLOUD_CONNECT_SKILL_URI).skill).toEqual(skill);
        const root = new URL("../../skills/doit-cloud-connect/", import.meta.url);
        const paths = (readdirSync(root, { recursive: true }) as string[])
            .filter((path) => statSync(new URL(path, root)).isFile())
            .sort();
        expect(skill.resources.map((resource) => resource.uri.replace("skill://doit-cloud-connect/", ""))).toEqual(
            paths
        );
        for (const resource of skill.resources) {
            const path = resource.uri.replace("skill://doit-cloud-connect/", "");
            const raw = readFileSync(new URL(path, root));
            expect(resource.digest).toBe(`sha256:${createHash("sha256").update(raw).digest("hex")}`);
            expect(resource.size).toBe(raw.length);
            expect(readSkillResource(resource.uri).contents[0]).toMatchObject({ text: raw.toString("utf8") });
        }
    });
    it("preserves every frontmatter field and derives the prompt from the shared skill bytes", () => {
        const resource = readSkillResource(CLOUD_CONNECT_SKILL_URI).contents[0];
        if (!("text" in resource)) throw new Error("Expected text instructions");
        const text = resource.text;
        const frontmatter = text.split("---\n")[1];
        expect(getSkill(CLOUD_CONNECT_SKILL_URI).skill.frontmatter).toEqual(parse(frontmatter));
        expect(CLOUD_CONNECT_PROMPT.text).toBe(
            text.replace(/\]\((references|assets)\//g, "](skill://doit-cloud-connect/$1/")
        );
    });
    it("cannot read another path or silently accept an invalid cursor", () => {
        expect(() => readSkillResource("skill://doit-cloud-connect/../../private.env")).toThrow();
        expect(() => getSkill("skill://another/SKILL.md")).toThrow();
        expect(() => listSkills("invented-cursor")).toThrow();
    });
});
