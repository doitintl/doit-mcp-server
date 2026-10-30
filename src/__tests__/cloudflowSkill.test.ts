import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CLOUDFLOW_AUTHORING_GUIDE, SKILL_REGISTRY } from "../core.js";

const SKILL_URI = "skill://doit-cloudflow-authoring/SKILL.md";
const GUIDE_URI = "skill://doit-cloudflow-authoring/references/authoring-guide.md";

describe("CloudFlow authoring skill through the shared core", () => {
    it("discovers the skill and delivers its installable files with exact bytes and manifests", () => {
        const skill = SKILL_REGISTRY.getSkill(SKILL_URI).skill;
        expect(SKILL_REGISTRY.listSkills().skills).toContainEqual(skill);
        expect(skill.frontmatter.name).toBe("doit-cloudflow-authoring");
        expect(skill.resources.map((resource) => resource.uri)).toEqual([SKILL_URI, GUIDE_URI]);

        for (const resource of skill.resources) {
            const path = resource.uri.replace("skill://doit-cloudflow-authoring/", "");
            const raw = readFileSync(new URL(`../../skills/doit-cloudflow-authoring/${path}`, import.meta.url));
            expect(resource.size).toBe(raw.length);
            expect(resource.digest).toBe(`sha256:${createHash("sha256").update(raw).digest("hex")}`);
            expect(SKILL_REGISTRY.readSkillResource(resource.uri).contents[0]).toMatchObject({
                text: raw.toString("utf8"),
                mimeType: "text/markdown",
            });
        }
    });

    it("preserves frontmatter and shares the guide with the existing resource export", () => {
        const text = SKILL_REGISTRY.readSkillResource(SKILL_URI).contents[0];
        if (!("text" in text)) throw new Error("Expected skill text");
        expect(SKILL_REGISTRY.getSkill(SKILL_URI).skill.frontmatter).toEqual(parse(text.text.split("---\n")[1]));
        expect(text.text).toContain("](references/authoring-guide.md)");
        expect(SKILL_REGISTRY.readSkillResource(GUIDE_URI).contents[0]).toMatchObject({
            text: CLOUDFLOW_AUTHORING_GUIDE,
        });
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("Only action nodes record `input`");
        expect(CLOUDFLOW_AUTHORING_GUIDE).toContain("## Tenant scoping caveat");
    });
});
