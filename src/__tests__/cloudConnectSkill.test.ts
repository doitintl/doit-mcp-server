import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
    CLOUD_CONNECT_PROMPT,
    CLOUD_CONNECT_SKILL,
    CLOUD_CONNECT_SKILL_FILES,
    getCloudConnectSkill,
    listCloudConnectSkills,
    readCloudConnectResource,
} from "../docs/cloudConnectSkill.js";

describe("Cloud Connect skill delivery", () => {
    it("serves the installable directory's exact bytes with complete stable manifests", () => {
        expect(listCloudConnectSkills().skills).toEqual([getCloudConnectSkill(CLOUD_CONNECT_SKILL.uri).skill]);
        expect(CLOUD_CONNECT_SKILL.resources).toHaveLength(Object.keys(CLOUD_CONNECT_SKILL_FILES).length);
        for (const resource of CLOUD_CONNECT_SKILL.resources) {
            const path = resource.uri.replace("skill://doit-cloud-connect/", "");
            const raw = readFileSync(new URL(`../../skills/doit-cloud-connect/${path}`, import.meta.url));
            expect(resource.digest).toBe(`sha256:${createHash("sha256").update(raw).digest("hex")}`);
            expect(resource.size).toBe(raw.length);
            expect(readCloudConnectResource(resource.uri).contents[0].text).toBe(raw.toString("utf8"));
        }
    });
    it("preserves every frontmatter field and derives the prompt from the same skill", () => {
        const text = CLOUD_CONNECT_SKILL_FILES[CLOUD_CONNECT_SKILL.uri].text;
        const frontmatter = text.split("---\n")[1];
        expect(CLOUD_CONNECT_SKILL.frontmatter).toEqual(parse(frontmatter));
        expect(CLOUD_CONNECT_PROMPT.text).toBe(
            text.replace(/\]\((references|assets)\//g, "](skill://doit-cloud-connect/$1/")
        );
    });
    it("cannot read another path or silently accept an invalid cursor", () => {
        expect(() => readCloudConnectResource("skill://doit-cloud-connect/../../private.env")).toThrow();
        expect(() => getCloudConnectSkill("skill://another/SKILL.md")).toThrow();
        expect(() => listCloudConnectSkills("invented-cursor")).toThrow();
    });
});
